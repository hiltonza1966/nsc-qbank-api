const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { auditLog } = require('../middleware/audit');

// Helper: lookup surrogate IDs from natural keys
async function lookupIds(db, subject_official_code, paper_no) {
  const [subj] = await db.execute('SELECT subject_id FROM lookup_subjects WHERE subject_official_code = ?', [subject_official_code]);
  const [pap] = await db.execute('SELECT paper_id FROM lookup_papers WHERE paper_no = ?', [paper_no]);
  return { subject_id: subj[0]?.subject_id || null, paper_id: pap[0]?.paper_id || null };
}

// Helper: detect required tool from subject
async function getToolRequired(db, subject_official_code) {
  const [mappings] = await db.execute(
    'SELECT tool_required FROM subject_tool_mapping WHERE subject_official_code = ? AND is_primary = 1 AND is_active = 1 LIMIT 1',
    [subject_official_code]
  );
  return mappings[0]?.tool_required || 'general';
}

// GET /api/qbank/items — List items with JOINs for display names + pagination + search
// GET /api/qbank/items — List items with JOINs for display names + pagination + search + metadata filters
router.get('/', async (req, res) => {
  const db = req.db;
  const {
    subject_official_code, paper_no, status, grade_id,
    item_type_id, cognitive_level_id, difficulty_id,
    min_marks, max_marks, has_attachments, has_memo,
    created_after, created_before,
    limit, offset, search
  } = req.query;

  // Build WHERE clause and params
  let where = 'WHERE 1=1';
  const params = [];

  if (subject_official_code) { where += ' AND im.subject_official_code = ?'; params.push(subject_official_code); }
  if (paper_no) { where += ' AND im.paper_no = ?'; params.push(parseInt(paper_no)); }
  if (status) { where += ' AND im.status = ?'; params.push(status); }
  if (grade_id) { where += ' AND im.grade_id = ?'; params.push(parseInt(grade_id)); }
  if (item_type_id) { where += ' AND im.item_type_id = ?'; params.push(parseInt(item_type_id)); }
  if (cognitive_level_id) { where += ' AND im.cognitive_level_id = ?'; params.push(parseInt(cognitive_level_id)); }
  if (difficulty_id) { where += ' AND im.difficulty_id = ?'; params.push(parseInt(difficulty_id)); }
  if (min_marks) { where += ' AND im.marks >= ?'; params.push(parseInt(min_marks)); }
  if (max_marks) { where += ' AND im.marks <= ?'; params.push(parseInt(max_marks)); }
  if (created_after) { where += ' AND im.created_at >= ?'; params.push(created_after + ' 00:00:00'); }
  if (created_before) { where += ' AND im.created_at <= ?'; params.push(created_before + ' 23:59:59'); }
  if (search) {
    where += ' AND (im.question_text LIKE ? OR im.item_code LIKE ? OR im.question_number LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const pageLimit = parseInt(limit) || 20;
  const pageOffset = parseInt(offset) || 0;

  try {
    // Base select columns
    let selectCols = `
      im.item_id, im.item_code, im.question_number, im.question_text, im.marks, im.status,
      im.subject_official_code, im.subject_alpha_code, im.paper_no,
      im.year_id, im.grade_id, im.assessment_type_id, im.assessment_body_id,
      im.item_type_id, im.cognitive_level_id, im.difficulty_id,
      im.caps_subtopic_id, im.caps_reference, im.created_by, im.created_at, im.updated_at,
      ls.subject_name,
      lp.paper_name,
      lg.grade_number,
      lcl.level_name as cognitive_level_name,
      ldl.difficulty_name,
      lit.type_name as item_type_name
    `;

    // Joins for has_attachments / has_memo filtering
    let joinClause = '';
    if (has_attachments === '1') {
      joinClause += ' INNER JOIN (SELECT DISTINCT item_id FROM item_attachments) att ON im.item_id = att.item_id';
    } else if (has_attachments === '0') {
      joinClause += ' LEFT JOIN (SELECT DISTINCT item_id FROM item_attachments) att ON im.item_id = att.item_id';
      where += ' AND att.item_id IS NULL';
    }
    if (has_memo === '1') {
      joinClause += ' INNER JOIN (SELECT DISTINCT item_id FROM item_memos WHERE is_current = 1) mem ON im.item_id = mem.item_id';
    } else if (has_memo === '0') {
      joinClause += ' LEFT JOIN (SELECT DISTINCT item_id FROM item_memos WHERE is_current = 1) mem ON im.item_id = mem.item_id';
      where += ' AND mem.item_id IS NULL';
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM item_master im ${joinClause} ${where}`;
    const [countRows] = await db.query(countSql, params);
    const total = countRows[0].total;

    // Main query
    const sql = `SELECT ${selectCols}
    FROM item_master im
    LEFT JOIN lookup_subjects ls ON im.subject_official_code = ls.subject_official_code
    LEFT JOIN lookup_papers lp ON im.paper_id = lp.paper_id
    LEFT JOIN lookup_grades lg ON im.grade_id = lg.grade_id
    LEFT JOIN lookup_cognitive_levels lcl ON im.cognitive_level_id = lcl.cognitive_level_id
    LEFT JOIN lookup_difficulty_levels ldl ON im.difficulty_id = ldl.difficulty_id
    LEFT JOIN lookup_item_types lit ON im.item_type_id = lit.item_type_id
    ${joinClause}
    ${where}
    ORDER BY im.created_at DESC
    LIMIT ${pageLimit} OFFSET ${pageOffset}`;

    const [items] = await db.query(sql, params);

    // Also return attachment/memo counts for each item
    const itemIds = items.map(i => i.item_id);
    let attachmentCounts = new Map();
    let memoCounts = new Map();

    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');

      const [attachRows] = await db.query(
        `SELECT item_id, COUNT(*) as cnt FROM item_attachments WHERE item_id IN (${placeholders}) GROUP BY item_id`,
        itemIds
      );
      for (const row of attachRows) {
        attachmentCounts.set(row.item_id, row.cnt);
      }

      const [memoRows] = await db.query(
        `SELECT item_id, COUNT(*) as cnt FROM item_memos WHERE item_id IN (${placeholders}) AND is_current = 1 GROUP BY item_id`,
        itemIds
      );
      for (const row of memoRows) {
        memoCounts.set(row.item_id, row.cnt);
      }
    }

    const enrichedItems = items.map(item => ({
      ...item,
      has_attachments: attachmentCounts.get(item.item_id) || 0,
      has_memo: memoCounts.get(item.item_id) || 0,
    }));

    res.json({ success: true, total, count: enrichedItems.length, items: enrichedItems });
  } catch (e) {
    console.error('GET /api/qbank/items error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});



// GET /api/qbank/items/paper/:paperCode — Get all items for a paper (Register-compatible)
router.get('/paper/:paperCode', async (req, res) => {
  const db = req.db;
  try {
    const paperCode = req.params.paperCode;

    // Get all items for this paper
    const [items] = await db.execute(
      `SELECT item_id, question_number, question_text, marks, marks_allocated, qp_marks, memo_marks,
              parent_item_id, parent_question, is_sub_part, item_type_id, cognitive_level_id,
              difficulty_id, status, source_paper_code, source_question_number, created_at, updated_at
       FROM item_master WHERE source_paper_code = ? ORDER BY question_number`,
      [paperCode]
    );

    // Get all memos for these items
    const itemIds = items.map(i => i.item_id);
    let memoMap = new Map();
    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      const [memos] = await db.execute(
        `SELECT memo_id, item_id, question_number, answer_text, marks, is_current
         FROM item_memos WHERE item_id IN (${placeholders}) AND is_current = 1`,
        itemIds
      );
      for (const memo of memos) {
        memoMap.set(memo.item_id, memo);
      }
    }

    // Build question_number -> item_id map for hierarchy detection
    const qnToItemId = new Map();
    for (const item of items) {
      qnToItemId.set(item.question_number, item.item_id);
    }

    // Determine which items have children (for computed is_header / header_level)
    // First check parent_item_id, then fall back to question_number pattern matching
    const childrenCount = new Map();
    for (const item of items) {
      if (item.parent_item_id) {
        childrenCount.set(item.parent_item_id, (childrenCount.get(item.parent_item_id) || 0) + 1);
      }
    }
    // Fallback: detect children by question_number prefix (e.g., "1" has child "1.1")
    for (const item of items) {
      const qn = String(item.question_number);
      for (const other of items) {
        const otherQn = String(other.question_number);
        if (otherQn !== qn && otherQn.startsWith(qn + '.')) {
          childrenCount.set(item.item_id, (childrenCount.get(item.item_id) || 0) + 1);
        }
      }
    }

    // Determine parent relationships by question_number pattern
    const parentMap = new Map(); // item_id -> parent_item_id
    for (const item of items) {
      const qn = String(item.question_number);
      const parts = qn.split('.');
      if (parts.length > 1) {
        // Try each possible parent by removing last dot segment
        for (let i = parts.length - 1; i >= 1; i--) {
          const parentQn = parts.slice(0, i).join('.');
          const parentId = qnToItemId.get(parentQn);
          if (parentId) {
            parentMap.set(item.item_id, parentId);
            break;
          }
        }
      }
    }

    // Build response in ItemPair format (compatible with Register frontend)
    const pairs = items.map(item => {
      const memo = memoMap.get(item.item_id);
      const hasChildren = (childrenCount.get(item.item_id) || 0) > 0;
      const isHeader = hasChildren ? 1 : 0;
      const effectiveParentId = item.parent_item_id || parentMap.get(item.item_id) || null;
      const headerLevel = effectiveParentId
        ? (hasChildren ? 2 : null)
        : (hasChildren ? 1 : null);
      const qpMarks = item.qp_marks !== null ? item.qp_marks : (item.marks || 0);
      const memoMarks = memo ? (memo.marks || 0) : 0;

      return {
        item_id: item.item_id,
        memo_db_id: memo ? memo.memo_id : null,
        question_number: item.question_number,
        question_text: item.question_text || '',
        answer_text: memo ? (memo.answer_text || '') : '',
        expected_marks: qpMarks,
        memo_expected_marks: memo ? memo.marks : null,
        auto_corrected_marks: qpMarks,
        memo_auto_corrected_marks: memo ? memo.marks : null,
        variance: qpMarks - memoMarks,
        is_red_flag: qpMarks !== memoMarks || !item.question_text,
        has_errors: qpMarks !== memoMarks || !item.question_text,
        is_header: isHeader,
        header_level: headerLevel,
        parent_header_id: effectiveParentId,
        // Compatibility fields for parsed mode
        result_id: 0,
        memo_id: null,
        correction_status: item.status || 'draft',
        memo_correction_status: memo ? 'imported' : null,
        error_details: []
      };
    });

    res.json({ success: true, items: pairs });
  } catch (e) {
    console.error('GET /api/qbank/items/paper/:paperCode error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items/:id — Get single item with all JOINs for display names
router.get('/:id', async (req, res) => {
  const db = req.db;
  try {
    const [items] = await db.query(`
      SELECT
        im.*,
        ls.subject_name,
        ls.subject_alpha_code,
        lp.paper_name,
        lp.paper_code,
        lg.grade_number,
        lg.grade_label,
        lcl.level_name as cognitive_level_name,
        ldl.difficulty_name,
        lit.type_name as item_type_name,
        qu.full_name as created_by_name
      FROM item_master im
      LEFT JOIN lookup_subjects ls ON im.subject_official_code = ls.subject_official_code
      LEFT JOIN lookup_papers lp ON im.paper_id = lp.paper_id
      LEFT JOIN lookup_grades lg ON im.grade_id = lg.grade_id
      LEFT JOIN lookup_cognitive_levels lcl ON im.cognitive_level_id = lcl.cognitive_level_id
      LEFT JOIN lookup_difficulty_levels ldl ON im.difficulty_id = ldl.difficulty_id
      LEFT JOIN lookup_item_types lit ON im.item_type_id = lit.item_type_id
      LEFT JOIN qbank_users qu ON im.created_by = qu.user_id
      WHERE im.item_id = ?
    `, [req.params.id]);

    if (!items.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const [options] = await db.execute('SELECT * FROM item_mcq_options WHERE item_id = ? ORDER BY display_order', [req.params.id]);
    const [memos] = await db.execute('SELECT * FROM item_memos WHERE item_id = ? AND is_current = 1', [req.params.id]);
    const [attachments] = await db.execute('SELECT * FROM item_attachments WHERE item_id = ? ORDER BY display_order', [req.params.id]);
    const [tags] = await db.execute(`SELECT it.*, lt.tag_name, lt.tag_category FROM item_tags it JOIN lookup_tag_taxonomy lt ON it.tag_id = lt.tag_id WHERE it.item_id = ?`, [req.params.id]);

    res.json({
      success: true,
      item: items[0],
      options,
      memos,
      attachments,
      tags,
      audit_logs: [],
      secure_media: []
    });
  } catch (e) {
    console.error('GET /api/qbank/items/:id error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items — Create item with security-aligned fields (with audit)
router.post('/', auditLog, async (req, res) => {
  const db = req.db;
  const {
    subject_official_code, subject_alpha_code, paper_no, question_text, marks,
    cognitive_level, difficulty, created_by = 1,
    source_year, source_paper_code, source_question_number,
    year_id = 6, grade_id = 1, assessment_type_id = 1,
    assessment_body_id = 1, language_id = 1, item_type_id = 1,
    marking_scheme_id = null, cognitive_level_id = 1, difficulty_id = 1,
    caps_subtopic_id = null, caps_reference = null,
    item_stem_latex, item_stem_html, item_stem_code,
    item_media_svg, item_media_audio, item_media_file,
    item_rubric_json, item_answer_json
  } = req.body;

  if (!subject_official_code || !paper_no || !question_text) {
    return res.status(400).json({ success: false, error: 'Missing required fields: subject_official_code, paper_no, question_text' });
  }

  try {
    const { subject_id, paper_id } = await lookupIds(db, subject_official_code, paper_no);
    if (!subject_id) return res.status(400).json({ success: false, error: 'Invalid subject_official_code' });
    if (!paper_id) return res.status(400).json({ success: false, error: 'Invalid paper_no' });

    const tool_required = await getToolRequired(db, subject_official_code);
    const item_code = `${subject_official_code}_${paper_no}_${uuidv4().slice(0, 8).toUpperCase()}`;
    const item_id = uuidv4();

    await db.execute(
      `INSERT INTO item_master
       (item_id, subject_official_code, subject_alpha_code, paper_no, subject_id, paper_id,
        year_id, grade_id, assessment_type_id, assessment_body_id, item_code, question_number,
        question_text, marks, marks_allocated, cognitive_level_id, cognitive_level, difficulty_id, difficulty,
        language_id, item_type_id, marking_scheme_id, caps_subtopic_id, caps_reference,
        status, created_by, source_year, source_paper_code, source_question_number,
        item_stem_latex, item_stem_html, item_stem_code,
        item_media_svg, item_media_audio, item_media_file,
        item_rubric_json, item_answer_json, tool_required)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, subject_official_code, subject_alpha_code || subject_official_code, paper_no, subject_id, paper_id,
       year_id, grade_id, assessment_type_id, assessment_body_id, item_code, '1.1',
       question_text, marks || 1, marks || 1, cognitive_level_id, cognitive_level || null,
       difficulty_id, difficulty || null, language_id, item_type_id, marking_scheme_id,
       caps_subtopic_id, caps_reference, created_by,
       source_year || null, source_paper_code || null, source_question_number || null,
       item_stem_latex || null, item_stem_html || null, item_stem_code || null,
       item_media_svg || null, item_media_audio || null, item_media_file || null,
       item_rubric_json ? JSON.stringify(item_rubric_json) : null,
       item_answer_json ? JSON.stringify(item_answer_json) : null,
       tool_required]
    );
    res.json({ success: true, item_id });
  } catch (e) {
    console.error('POST /api/qbank/items error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/qbank/items/:id — Update item with security fields (with audit)
router.put('/:id', auditLog, async (req, res) => {
  const db = req.db;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [current] = await conn.execute('SELECT * FROM item_master WHERE item_id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ success: false, error: 'Item not found' });

    await conn.execute(
      `INSERT INTO item_versions (item_id, version_number, question_text, question_text_afr, marks, cognitive_level_id, difficulty_id, change_type, changed_by)
       SELECT item_id, current_version + 1, question_text, question_text_afr, marks, cognitive_level_id, difficulty_id, 'update', created_by
       FROM item_master WHERE item_id = ?`,
      [req.params.id]
    );

    const {
      question_text, question_text_afr, marks, cognitive_level, difficulty,
      cognitive_level_id, difficulty_id, caps_subtopic_id, caps_reference,
      status, source_year, source_paper_code, source_question_number,
      item_stem_latex, item_stem_html, item_stem_code,
      item_media_svg, item_media_audio, item_media_file,
      item_rubric_json, item_answer_json,
      question_number, qp_marks
    } = req.body;

    // Convert undefined to null for MySQL2 compatibility
    const toNull = (v) => v === undefined ? null : v;

    await conn.execute(
      `UPDATE item_master SET
        question_text = COALESCE(?, question_text),
        question_text_afr = COALESCE(?, question_text_afr),
        question_number = COALESCE(?, question_number),
        marks = COALESCE(?, marks),
        marks_allocated = COALESCE(?, marks_allocated),
        qp_marks = COALESCE(?, qp_marks),
        cognitive_level = COALESCE(?, cognitive_level),
        difficulty = COALESCE(?, difficulty),
        cognitive_level_id = COALESCE(?, cognitive_level_id),
        difficulty_id = COALESCE(?, difficulty_id),
        caps_subtopic_id = COALESCE(?, caps_subtopic_id),
        caps_reference = COALESCE(?, caps_reference),
        status = COALESCE(?, status),
        source_year = COALESCE(?, source_year),
        source_paper_code = COALESCE(?, source_paper_code),
        source_question_number = COALESCE(?, source_question_number),
        item_stem_latex = COALESCE(?, item_stem_latex),
        item_stem_html = COALESCE(?, item_stem_html),
        item_stem_code = COALESCE(?, item_stem_code),
        item_media_svg = COALESCE(?, item_media_svg),
        item_media_audio = COALESCE(?, item_media_audio),
        item_media_file = COALESCE(?, item_media_file),
        item_rubric_json = COALESCE(?, item_rubric_json),
        item_answer_json = COALESCE(?, item_answer_json),
        current_version = current_version + 1,
        updated_at = NOW()
       WHERE item_id = ?`,
      [toNull(question_text), toNull(question_text_afr), toNull(question_number), toNull(marks), toNull(marks), toNull(qp_marks), toNull(cognitive_level), toNull(difficulty),
       toNull(cognitive_level_id), toNull(difficulty_id), toNull(caps_subtopic_id), toNull(caps_reference),
       toNull(status), toNull(source_year), toNull(source_paper_code), toNull(source_question_number),
       toNull(item_stem_latex), toNull(item_stem_html), toNull(item_stem_code),
       toNull(item_media_svg), toNull(item_media_audio), toNull(item_media_file),
       item_rubric_json ? JSON.stringify(item_rubric_json) : null,
       item_answer_json ? JSON.stringify(item_answer_json) : null,
       req.params.id]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    console.error('PUT /api/qbank/items/:id error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});


// GET /api/qbank/items/paper/:paperCode — Get all items for a paper (Register-compatible)
router.get('/paper/:paperCode', async (req, res) => {
  const db = req.db;
  try {
    const paperCode = req.params.paperCode;

    // Get all items for this paper
    const [items] = await db.execute(
      `SELECT item_id, question_number, question_text, marks, marks_allocated, qp_marks, memo_marks,
              parent_item_id, parent_question, is_sub_part, item_type_id, cognitive_level_id,
              difficulty_id, status, source_paper_code, source_question_number, created_at, updated_at
       FROM item_master WHERE source_paper_code = ? ORDER BY question_number`,
      [paperCode]
    );

    // Get all memos for these items
    const itemIds = items.map(i => i.item_id);
    let memoMap = new Map();
    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      const [memos] = await db.execute(
        `SELECT memo_id, item_id, question_number, answer_text, marks, is_current
         FROM item_memos WHERE item_id IN (${placeholders}) AND is_current = 1`,
        itemIds
      );
      for (const memo of memos) {
        memoMap.set(memo.item_id, memo);
      }
    }

    // Build question_number -> item_id map for hierarchy detection
    const qnToItemId = new Map();
    for (const item of items) {
      qnToItemId.set(item.question_number, item.item_id);
    }

    // Determine which items have children (for computed is_header / header_level)
    // First check parent_item_id, then fall back to question_number pattern matching
    const childrenCount = new Map();
    for (const item of items) {
      if (item.parent_item_id) {
        childrenCount.set(item.parent_item_id, (childrenCount.get(item.parent_item_id) || 0) + 1);
      }
    }
    // Fallback: detect children by question_number prefix (e.g., "1" has child "1.1")
    for (const item of items) {
      const qn = String(item.question_number);
      for (const other of items) {
        const otherQn = String(other.question_number);
        if (otherQn !== qn && otherQn.startsWith(qn + '.')) {
          childrenCount.set(item.item_id, (childrenCount.get(item.item_id) || 0) + 1);
        }
      }
    }

    // Determine parent relationships by question_number pattern
    const parentMap = new Map(); // item_id -> parent_item_id
    for (const item of items) {
      const qn = String(item.question_number);
      const parts = qn.split('.');
      if (parts.length > 1) {
        // Try each possible parent by removing last dot segment
        for (let i = parts.length - 1; i >= 1; i--) {
          const parentQn = parts.slice(0, i).join('.');
          const parentId = qnToItemId.get(parentQn);
          if (parentId) {
            parentMap.set(item.item_id, parentId);
            break;
          }
        }
      }
    }

    // Build response in ItemPair format (compatible with Register frontend)
    const pairs = items.map(item => {
      const memo = memoMap.get(item.item_id);
      const hasChildren = (childrenCount.get(item.item_id) || 0) > 0;
      const isHeader = hasChildren ? 1 : 0;
      const effectiveParentId = item.parent_item_id || parentMap.get(item.item_id) || null;
      const headerLevel = effectiveParentId
        ? (hasChildren ? 2 : null)
        : (hasChildren ? 1 : null);
      const qpMarks = item.qp_marks !== null ? item.qp_marks : (item.marks || 0);
      const memoMarks = memo ? (memo.marks || 0) : 0;

      return {
        item_id: item.item_id,
        memo_db_id: memo ? memo.memo_id : null,
        question_number: item.question_number,
        question_text: item.question_text || '',
        answer_text: memo ? (memo.answer_text || '') : '',
        expected_marks: qpMarks,
        memo_expected_marks: memo ? memo.marks : null,
        auto_corrected_marks: qpMarks,
        memo_auto_corrected_marks: memo ? memo.marks : null,
        variance: qpMarks - memoMarks,
        is_red_flag: qpMarks !== memoMarks || !item.question_text,
        has_errors: qpMarks !== memoMarks || !item.question_text,
        is_header: isHeader,
        header_level: headerLevel,
        parent_header_id: effectiveParentId,
        // Compatibility fields for parsed mode
        result_id: 0,
        memo_id: null,
        correction_status: item.status || 'draft',
        memo_correction_status: memo ? 'imported' : null,
        error_details: []
      };
    });

    res.json({ success: true, items: pairs });
  } catch (e) {
    console.error('GET /api/qbank/items/paper/:paperCode error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});


// PUT /api/qbank/items/:id/memo — Update or create memo for an item
router.put('/:id/memo', auditLog, async (req, res) => {
  const db = req.db;
  const { answer_text, marks, question_number } = req.body;

  try {
    // Check if item exists
    const [items] = await db.execute('SELECT item_id FROM item_master WHERE item_id = ?', [req.params.id]);
    if (items.length === 0) return res.status(404).json({ success: false, error: 'Item not found' });

    // Check if memo already exists
    const [memos] = await db.execute(
      'SELECT memo_id FROM item_memos WHERE item_id = ? AND is_current = 1',
      [req.params.id]
    );

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (memos.length > 0) {
      // Update existing memo
      await db.execute(
        `UPDATE item_memos SET
          answer_text = COALESCE(?, answer_text),
          marks = COALESCE(?, marks),
          question_number = COALESCE(?, question_number),
          updated_at = NOW()
         WHERE memo_id = ?`,
        [answer_text, marks, question_number, memos[0].memo_id]
      );
    } else {
      // Create new memo
      const memoId = uuidv4();
      await db.execute(
        `INSERT INTO item_memos (memo_id, item_id, question_number, answer_text, marks, is_current, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [memoId, req.params.id, question_number || '1.1', answer_text || null, marks || 0, now, now]
      );
    }

    // Update item_master.memo_marks to stay in sync
    await db.execute(
      'UPDATE item_master SET memo_marks = ?, updated_at = NOW() WHERE item_id = ?',
      [marks, req.params.id]
    );

    res.json({ success: true, message: 'Memo updated' });
  } catch (e) {
    console.error('PUT /api/qbank/items/:id/memo error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items/:id/audit — Get audit log for item
router.get('/:id/audit', async (req, res) => {
  const db = req.db;
  try {
    const [logs] = await db.execute(
      `SELECT * FROM tool_audit_log WHERE item_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, count: logs.length, audit_logs: logs });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:id/audit — Add manual audit entry
router.post('/:id/audit', async (req, res) => {
  const db = req.db;
  const { tool_name, action, action_details } = req.body;
  const userId = req.headers['x-user-id'] || 1;
  const userRole = req.headers['x-user-role'] || 'author';

  try {
    await db.execute(
      `INSERT INTO tool_audit_log (item_id, user_id, user_role, tool_name, action, action_details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, userId, userRole, tool_name, action,
       action_details ? JSON.stringify(action_details) : null,
       req.ip, req.headers['user-agent']]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});



// POST /api/qbank/items/:id/mark-header — Mark item as header (clear parent)
router.post('/:id/mark-header', auditLog, async (req, res) => {
  const db = req.db;
  try {
    await db.execute(
      'UPDATE item_master SET parent_item_id = NULL, updated_at = NOW() WHERE item_id = ?',
      [req.params.id]
    );
    res.json({ success: true, message: 'Marked as header' });
  } catch (e) {
    console.error('POST /api/qbank/items/:id/mark-header error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:id/unmark-header — Remove header status
router.post('/:id/unmark-header', auditLog, async (req, res) => {
  const db = req.db;
  try {
    await db.execute(
      'UPDATE item_master SET parent_item_id = NULL, updated_at = NOW() WHERE item_id = ?',
      [req.params.id]
    );
    // Also clear children references
    await db.execute(
      'UPDATE item_master SET parent_item_id = NULL WHERE parent_item_id = ?',
      [req.params.id]
    );
    res.json({ success: true, message: 'Unmarked as header' });
  } catch (e) {
    console.error('POST /api/qbank/items/:id/unmark-header error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:id/assign-parent — Assign parent item
router.post('/:id/assign-parent', auditLog, async (req, res) => {
  const db = req.db;
  const { parent_item_id } = req.body;
  try {
    await db.execute(
      'UPDATE item_master SET parent_item_id = ?, updated_at = NOW() WHERE item_id = ?',
      [parent_item_id || null, req.params.id]
    );
    res.json({ success: true, message: 'Parent assigned' });
  } catch (e) {
    console.error('POST /api/qbank/items/:id/assign-parent error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/qbank/items/:id — Delete item and its memos
router.delete('/:id', auditLog, async (req, res) => {
  const db = req.db;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Delete memos first (FK constraint)
    await conn.execute('DELETE FROM item_memos WHERE item_id = ?', [req.params.id]);

    // Delete item
    await conn.execute('DELETE FROM item_master WHERE item_id = ?', [req.params.id]);

    await conn.commit();
    res.json({ success: true, message: 'Item deleted' });
  } catch (e) {
    await conn.rollback();
    console.error('DELETE /api/qbank/items/:id error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});


// POST /api/qbank/items/create — Create a new item + memo for a paper (Register use)
router.post('/create', auditLog, async (req, res) => {
  const db = req.db;
  const { v4: uuidv4 } = require('uuid');
  const {
    source_paper_code, question_number, question_text, marks,
    answer_text, memo_marks, parent_item_id, parent_question
  } = req.body;

  try {
    // Get existing paper dimensions from first item
    const [existing] = await db.execute(
      'SELECT subject_official_code, subject_alpha_code, paper_no, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, language_id FROM item_master WHERE source_paper_code = ? LIMIT 1',
      [source_paper_code]
    );

    const dims = existing[0] || {};
    const itemId = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const isSubPart = parent_question ? 1 : 0;

    await db.execute(
      `INSERT INTO item_master (
        item_id, item_code, subject_official_code, subject_alpha_code, paper_no,
        year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
        language_id, question_number, parent_question, is_sub_part, parent_item_id,
        question_text, marks, marks_allocated, qp_marks, memo_marks,
        item_type_id, cognitive_level_id, difficulty_id, status, review_status,
        source_year, source_paper_code, source_question_number, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        source_paper_code + '_' + String(question_number).replace(/\./g, '_'),
        dims.subject_official_code || null,
        dims.subject_alpha_code || null,
        dims.paper_no || null,
        dims.year_id || null,
        dims.grade_id || null,
        dims.subject_id || null,
        dims.paper_id || null,
        dims.assessment_type_id || null,
        dims.assessment_body_id || null,
        dims.language_id || null,
        question_number,
        parent_question || null,
        isSubPart,
        parent_item_id || null,
        question_text || null,
        marks || 0,
        marks || 0,
        marks || 0,
        memo_marks || null,
        1, 1, 1,
        'draft', 'draft',
        dims.year_id || null,
        source_paper_code,
        question_number,
        1,
        now, now
      ]
    );

    // Create memo if provided
    if (answer_text !== undefined || memo_marks !== undefined) {
      const memoId = uuidv4();
      await db.execute(
        `INSERT INTO item_memos (memo_id, item_id, question_number, answer_text, marks, is_current, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [memoId, itemId, question_number, answer_text || null, memo_marks || 0, now, now]
      );
    }

    res.json({ success: true, item_id: itemId, message: 'Item created' });
  } catch (e) {
    console.error('POST /api/qbank/items/create error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;