const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Helper: lookup surrogate IDs from natural keys
async function lookupIds(db, subject_official_code, paper_no) {
  const [subj] = await db.execute('SELECT subject_id FROM lookup_subjects WHERE subject_official_code = ?', [subject_official_code]);
  const [pap] = await db.execute('SELECT paper_id FROM lookup_papers WHERE paper_no = ?', [paper_no]);
  return { subject_id: subj[0]?.subject_id || null, paper_id: pap[0]?.paper_id || null };
}

// POST /api/qbank/items — Create item with natural keys
router.post('/', async (req, res) => {
  const db = req.db;
  const {
    subject_official_code, subject_alpha_code, paper_no, question_text, marks,
    cognitive_level, difficulty, created_by = 1,
    source_year, source_paper_code, source_question_number,
    year_id = 6, grade_id = 1, assessment_type_id = 1,
    assessment_body_id = 1, language_id = 1, item_type_id = 1,
    marking_scheme_id = null, cognitive_level_id = 1, difficulty_id = 1,
    caps_subtopic_id = null, caps_reference = null
  } = req.body;

  if (!subject_official_code || !paper_no || !question_text) {
    return res.status(400).json({ success: false, error: 'Missing required fields: subject_official_code, paper_no, question_text' });
  }

  try {
    const { subject_id, paper_id } = await lookupIds(db, subject_official_code, paper_no);
    if (!subject_id) return res.status(400).json({ success: false, error: 'Invalid subject_official_code' });
    if (!paper_id) return res.status(400).json({ success: false, error: 'Invalid paper_no' });

    const item_code = `${subject_official_code}_${paper_no}_${uuidv4().slice(0, 8).toUpperCase()}`;
    const item_id = uuidv4();

    await db.execute(
      `INSERT INTO item_master
       (item_id, subject_official_code, subject_alpha_code, paper_no, subject_id, paper_id,
        year_id, grade_id, assessment_type_id, assessment_body_id, item_code, question_number,
        question_text, marks, marks_allocated, cognitive_level_id, cognitive_level, difficulty_id, difficulty,
        language_id, item_type_id, marking_scheme_id, caps_subtopic_id, caps_reference,
        status, created_by, source_year, source_paper_code, source_question_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [item_id, subject_official_code, subject_alpha_code || subject_official_code, paper_no, subject_id, paper_id,
       year_id, grade_id, assessment_type_id, assessment_body_id, item_code, '1.1',
       question_text, marks || 1, marks || 1, cognitive_level_id, cognitive_level || null,
       difficulty_id, difficulty || null, language_id, item_type_id, marking_scheme_id,
       caps_subtopic_id, caps_reference, created_by,
       source_year || null, source_paper_code || null, source_question_number || null]
    );
    res.json({ success: true, item_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items — List items by natural keys
router.get('/', async (req, res) => {
  const db = req.db;
  const { subject_official_code, paper_no, status, grade_id } = req.query;
  let sql = `SELECT im.*, ls.subject_name, lp.paper_code, lp.paper_name
             FROM item_master im
             LEFT JOIN lookup_subjects ls ON im.subject_official_code = ls.subject_official_code
             LEFT JOIN lookup_papers lp ON im.paper_id = lp.paper_id
             WHERE 1=1`;
  const p = [];
  if (subject_official_code) { sql += ` AND im.subject_official_code = ?`; p.push(subject_official_code); }
  if (paper_no) { sql += ` AND im.paper_no = ?`; p.push(paper_no); }
  if (status) { sql += ` AND im.status = ?`; p.push(status); }
  if (grade_id) { sql += ` AND im.grade_id = ?`; p.push(grade_id); }
  sql += ` ORDER BY im.created_at DESC`;
  try {
    const [items] = await db.execute(sql, p);
    res.json({ success: true, count: items.length, items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items/:id — Get single item with details
router.get('/:id', async (req, res) => {
  const db = req.db;
  try {
    const [items] = await db.execute('SELECT * FROM item_master WHERE item_id = ?', [req.params.id]);
    if (!items.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const [options] = await db.execute('SELECT * FROM item_mcq_options WHERE item_id = ? ORDER BY display_order', [req.params.id]);
    const [memos] = await db.execute('SELECT * FROM item_memos WHERE item_id = ? AND is_current = 1', [req.params.id]);
    const [attachments] = await db.execute('SELECT * FROM item_attachments WHERE item_id = ? ORDER BY display_order', [req.params.id]);
    const [tags] = await db.execute(`SELECT it.*, lt.tag_name, lt.tag_category FROM item_tags it JOIN lookup_tag_taxonomy lt ON it.tag_id = lt.tag_id WHERE it.item_id = ?`, [req.params.id]);

    res.json({ success: true, item: items[0], options, memos, attachments, tags });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/qbank/items/:id — Update item
router.put('/:id', async (req, res) => {
  const db = req.db;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [current] = await conn.execute('SELECT * FROM item_master WHERE item_id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ success: false, error: 'Item not found' });

    // Create version snapshot
    await conn.execute(
      `INSERT INTO item_versions (item_id, version_number, question_text, question_text_afr, marks, cognitive_level, difficulty, status, created_by)
       SELECT item_id, current_version + 1, question_text, question_text_afr, marks, cognitive_level, difficulty, status, created_by
       FROM item_master WHERE item_id = ?`,
      [req.params.id]
    );

    // Update item
    const {
      question_text, question_text_afr, marks, cognitive_level, difficulty,
      cognitive_level_id, difficulty_id, caps_subtopic_id, caps_reference,
      status, source_year, source_paper_code, source_question_number
    } = req.body;

    await conn.execute(
      `UPDATE item_master SET
        question_text = COALESCE(?, question_text),
        question_text_afr = COALESCE(?, question_text_afr),
        marks = COALESCE(?, marks),
        marks_allocated = COALESCE(?, marks_allocated),
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
        current_version = current_version + 1,
        updated_at = NOW()
       WHERE item_id = ?`,
      [question_text, question_text_afr, marks, marks, cognitive_level, difficulty,
       cognitive_level_id, difficulty_id, caps_subtopic_id, caps_reference,
       status, source_year, source_paper_code, source_question_number, req.params.id]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

// POST /api/qbank/items/:id/submit — Submit for review
router.post('/:id/submit', async (req, res) => {
  try {
    const role = req.headers['x-user-role'] || 'author';
    await req.db.execute(`UPDATE item_master SET status = 'pending_review' WHERE item_id = ? AND status = 'draft'`, [req.params.id]);
    await req.db.execute(`INSERT INTO review_workflow (item_id, current_state, previous_state, changed_by, changed_by_role) VALUES (?, 'pending_review', 'draft', ?, ?)`, [req.params.id, req.body.user_id || 1, role]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:id/approve — Approve item
router.post('/:id/approve', async (req, res) => {
  const { newStatus = 'peer_approved', user_id = 1 } = req.body;
  const role = req.headers['x-user-role'] || 'peer_reviewer';
  try {
    await req.db.execute('UPDATE item_master SET status = ? WHERE item_id = ?', [newStatus, req.params.id]);
    await req.db.execute(`INSERT INTO review_workflow (item_id, current_state, previous_state, changed_by, changed_by_role) VALUES (?, ?, 'pending_review', ?, ?)`, [req.params.id, newStatus, user_id, role]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:id/reject — Reject item
router.post('/:id/reject', async (req, res) => {
  const role = req.headers['x-user-role'] || 'peer_reviewer';
  try {
    await req.db.execute(`UPDATE item_master SET status = 'revision_required' WHERE item_id = ?`, [req.params.id]);
    await req.db.execute(`INSERT INTO review_workflow (item_id, current_state, previous_state, changed_by, changed_by_role) VALUES (?, 'revision_required', 'pending_review', ?, ?)`, [req.params.id, req.body.user_id || 1, role]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/bulk — Bulk create items
router.post('/bulk', async (req, res) => {
  const db = req.db;
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items array required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const created = [];
    for (const item of items) {
      const {
        subject_official_code, subject_alpha_code, paper_no, question_text, marks,
        cognitive_level, difficulty, created_by = 1,
        source_year, source_paper_code, source_question_number,
        year_id = 6, grade_id = 1, assessment_type_id = 1,
        assessment_body_id = 1, language_id = 1, item_type_id = 1,
        marking_scheme_id = null, cognitive_level_id = 1, difficulty_id = 1,
        caps_subtopic_id = null, caps_reference = null
      } = item;

      const { subject_id, paper_id } = await lookupIds(conn, subject_official_code, paper_no);
      if (!subject_id || !paper_id) continue;

      const item_code = `${subject_official_code}_${paper_no}_${uuidv4().slice(0, 8).toUpperCase()}`;
      const item_id = uuidv4();

      await conn.execute(
        `INSERT INTO item_master
         (item_id, subject_official_code, subject_alpha_code, paper_no, subject_id, paper_id,
          year_id, grade_id, assessment_type_id, assessment_body_id, item_code, question_number,
          question_text, marks, marks_allocated, cognitive_level_id, cognitive_level, difficulty_id, difficulty,
          language_id, item_type_id, marking_scheme_id, caps_subtopic_id, caps_reference,
          status, created_by, source_year, source_paper_code, source_question_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        [item_id, subject_official_code, subject_alpha_code || subject_official_code, paper_no, subject_id, paper_id,
         year_id, grade_id, assessment_type_id, assessment_body_id, item_code, '1.1',
         question_text, marks || 1, marks || 1, cognitive_level_id, cognitive_level || null,
         difficulty_id, difficulty || null, language_id, item_type_id, marking_scheme_id,
         caps_subtopic_id, caps_reference, created_by,
         source_year || null, source_paper_code || null, source_question_number || null]
      );
      created.push(item_id);
    }
    await conn.commit();
    res.json({ success: true, count: created.length, item_ids: created });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
