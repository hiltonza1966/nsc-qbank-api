const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');

// ============================================
// AUDIT HELPER — Aligned to existing item_audit_log schema
// Columns: log_id, item_id, user_id, action, field_name, old_value, new_value, reason, comment, ip_address, user_agent, timestamp
// ============================================
async function logAudit(db, { item_id, action, action_by, old_values, new_values, notes, paper_code }) {
  await db.query(
    `INSERT INTO item_audit_log (item_id, user_id, action, old_value, new_value, reason, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      item_id,
      parseInt(action_by) || 1,
      action,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      paper_code || null,
      notes || null
    ]
  );
}

// ============================================
// GET /api/qbank/items/pending
// Returns items awaiting moderator review (review_status = 'draft' or NULL)
// Query: ?paper_code=&subject_id=&year_id=&page=1&limit=50
// ============================================
router.get('/items/pending', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { paper_code, subject_id, year_id, page = 1, limit = 50 } = req.query;

    const conditions = ["(i.review_status = 'draft' OR i.review_status IS NULL)"];
    const params = [];

    if (paper_code) {
      conditions.push("i.source_paper_code LIKE ?");
      params.push(`%${paper_code}%`);
    }
    if (subject_id) {
      conditions.push("i.subject_id = ?");
      params.push(subject_id);
    }
    if (year_id) {
      conditions.push("i.year_id = ?");
      params.push(year_id);
    }

    const whereClause = conditions.join(' AND ');
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM item_master i WHERE ${whereClause}`,
      params
    );

    const [items] = await db.query(
      `SELECT 
        i.item_id,
        i.source_paper_code,
        i.question_number,
        i.question_text,
        i.item_type_id,
        i.marks,
        i.item_answer_json,
        i.review_status,
        i.created_at,
        s.subject_name,
        s.subject_official_code,
        COUNT(DISTINCT a.attachment_id) as attachment_count
       FROM item_master i
       LEFT JOIN lookup_subjects s ON i.subject_id = s.subject_id
       LEFT JOIN item_attachments a ON CONVERT(i.item_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(a.item_id USING utf8mb4) COLLATE utf8mb4_unicode_ci
       WHERE ${whereClause}
       GROUP BY i.item_id
       ORDER BY i.source_paper_code, i.question_number
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    items.forEach(item => {
      if (item.item_answer_json && typeof item.item_answer_json === 'string') {
        try { item.item_answer_json = JSON.parse(item.item_answer_json); } catch (e) {}
      }
    });

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error("[GET /items/pending ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/qbank/items/:id/review
// Body: { action: 'approve' | 'reject' | 'request_changes', notes?, reviewer? }
// ============================================
router.post('/items/:id/review', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const itemId = req.params.id;
    const { action, notes, reviewer } = req.body;

    if (!['approve', 'reject', 'request_changes'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid action. Use approve, reject, or request_changes' });
    }

    const [items] = await db.query(
      `SELECT item_id, review_status, status, source_paper_code FROM item_master WHERE item_id = ?`,
      [itemId]
    );
    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const item = items[0];
    const oldValues = { review_status: item.review_status, status: item.status };
    let newReviewStatus, newStatus;

    if (action === 'approve') {
      newReviewStatus = 'approved';
      newStatus = item.status;
    } else if (action === 'reject') {
      newReviewStatus = 'rejected';
      newStatus = item.status;
    } else {
      newReviewStatus = 'peer_review';
      newStatus = item.status;
    }

    await db.query(
      `UPDATE item_master SET review_status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE item_id = ?`,
      [newReviewStatus, reviewer || 'system', itemId]
    );

    await logAudit(db, {
      item_id: itemId,
      action: action === 'approve' ? 'approve' : action === 'reject' ? 'reject' : 'state_change',
      action_by: reviewer || 'system',
      old_values: oldValues,
      new_values: { review_status: newReviewStatus },
      notes: notes || null,
      paper_code: item.source_paper_code
    });

    res.json({ success: true, data: { item_id: itemId, review_status: newReviewStatus } });
  } catch (error) {
    console.error("[POST /items/:id/review ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/qbank/items/publish
// Body: { item_ids: ['uuid', ...], publisher? }
// Only items with review_status = 'approved' can be published
// ============================================
router.post('/items/publish', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { item_ids, publisher } = req.body;

    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'item_ids array required' });
    }

    const placeholders = item_ids.map(() => '?').join(',');
    const [items] = await db.query(
      `SELECT item_id, review_status, status, source_paper_code 
       FROM item_master 
       WHERE item_id IN (${placeholders}) AND review_status = 'approved'`,
      item_ids
    );

    const publishableIds = items.map(i => i.item_id);
    const skippedIds = item_ids.filter(id => !publishableIds.includes(id));

    if (publishableIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No approved items to publish',
        skipped: skippedIds
      });
    }

    const pubPlaceholders = publishableIds.map(() => '?').join(',');
    await db.query(
      `UPDATE item_master 
       SET status = 'published', published_by = ?, published_at = NOW()
       WHERE item_id IN (${pubPlaceholders})`,
      [publisher || 'system', ...publishableIds]
    );

    for (const item of items) {
      await logAudit(db, {
        item_id: item.item_id,
        action: 'publish',
        action_by: publisher || 'system',
        old_values: { status: item.status },
        new_values: { status: 'published' },
        paper_code: item.source_paper_code
      });
    }

    res.json({
      success: true,
      data: {
        published: publishableIds.length,
        skipped: skippedIds.length,
        published_ids: publishableIds,
        skipped_ids: skippedIds
      }
    });
  } catch (error) {
    console.error("[POST /items/publish ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/qbank/items/fix-diagram-mcqs
// Detects missing diagram-based MCQs (1.1.x) and fixes existing mis-typed ones
// Body: { paper_code: "LIFESCIENCES_P1_2025_NOV_ENG", dry_run: false }
// ============================================
router.post('/items/fix-diagram-mcqs', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { paper_code, dry_run = true } = req.body;

    if (!paper_code) {
      return res.status(400).json({ success: false, error: 'paper_code required' });
    }

    // 1. Get metadata from an existing item in this paper
    const [metaRows] = await db.query(
      `SELECT year_id, grade_id, subject_id, paper_id, assessment_type_id, 
              assessment_body_id, language_id, subject_official_code, subject_alpha_code
       FROM item_master WHERE source_paper_code = ? LIMIT 1`,
      [paper_code]
    );

    if (metaRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No existing items found for this paper. Cannot infer metadata.'
      });
    }

    const meta = metaRows[0];

    // 2. Find existing Section 1 items
    const [existing] = await db.query(
      `SELECT item_id, question_number, item_type_id, item_answer_json, marks, question_text, item_code
       FROM item_master 
       WHERE source_paper_code = ? AND question_number LIKE '1.1.%'
       ORDER BY question_number`,
      [paper_code]
    );

    const existingNumbers = existing.map(i => i.question_number);
    const expectedNumbers = Array.from({ length: 10 }, (_, i) => `1.1.${i + 1}`);
    const missingNumbers = expectedNumbers.filter(n => !existingNumbers.includes(n));

    // 3. Build fix lists
    const toInsert = [];
    const toUpdate = [];

    // Missing items
    for (const qNum of missingNumbers) {
      const itemCode = `${paper_code}_${qNum}_DIAGRAM`;
      toInsert.push({
        question_number: qNum,
        item_code: itemCode,
        marks: 2,
        marks_allocated: 2,
        item_type_id: 1,
        item_answer_json: JSON.stringify({
          options: [
            { label: "P", text: "[DIAGRAM — Option P]" },
            { label: "S", text: "[DIAGRAM — Option S]" },
            { label: "R", text: "[DIAGRAM — Option R]" }
          ],
          correct_answer: null,
          is_diagram_based: true,
          needs_manual_answer: true
        }),
        question_text: `[DIAGRAM-BASED MCQ ${qNum} — Correct answer must be set manually]`
      });
    }

    // Existing items that should be diagram MCQs but are not tagged
    for (const item of existing) {
      const isLikelyDiagram = /^1\.1\.([5-8])$/.test(item.question_number);
      if (isLikelyDiagram && item.item_type_id != 1) {
        toUpdate.push({
          item_id: item.item_id,
          question_number: item.question_number
        });
      }
    }

    const results = {
      paper_code,
      dry_run,
      missing_detected: toInsert.length,
      existing_to_fix: toUpdate.length,
      inserted: [],
      updated: [],
      errors: []
    };

    if (!dry_run) {
      // Insert missing diagram MCQs
      for (const mcq of toInsert) {
        try {
          const newId = randomUUID();
          await db.query(
            `INSERT INTO item_master (
              item_id, item_code, source_paper_code, source_question_number,
              question_number, question_text, marks, marks_allocated,
              item_type_id, item_answer_json, review_status, status,
              year_id, grade_id, subject_id, paper_id, assessment_type_id,
              assessment_body_id, language_id, subject_official_code,
              subject_alpha_code, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              newId, mcq.item_code, paper_code, mcq.question_number,
              mcq.question_number, mcq.question_text, mcq.marks, mcq.marks_allocated,
              mcq.item_type_id, mcq.item_answer_json,
              meta.year_id, meta.grade_id, meta.subject_id, meta.paper_id,
              meta.assessment_type_id, meta.assessment_body_id, meta.language_id,
              meta.subject_official_code, meta.subject_alpha_code, 1
            ]
          );
          results.inserted.push({ question_number: mcq.question_number, item_id: newId });
        } catch (err) {
          results.errors.push({ question_number: mcq.question_number, error: err.message });
        }
      }

      // Fix existing mis-typed items
      for (const item of toUpdate) {
        try {
          const answerJson = JSON.stringify({
            options: [
              { label: "P", text: "[DIAGRAM — Option P]" },
              { label: "S", text: "[DIAGRAM — Option S]" },
              { label: "R", text: "[DIAGRAM — Option R]" }
            ],
            correct_answer: null,
            is_diagram_based: true,
            needs_manual_answer: true
          });
          await db.query(
            `UPDATE item_master 
             SET item_type_id = 1, item_answer_json = ?, review_status = 'draft'
             WHERE item_id = ?`,
            [answerJson, item.item_id]
          );
          results.updated.push({ item_id: item.item_id, question_number: item.question_number });
        } catch (err) {
          results.errors.push({ item_id: item.item_id, error: err.message });
        }
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error("[FIX DIAGRAM MCQs ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/qbank/items/stats
// Query: ?paper_code=
// ============================================
router.get('/items/stats', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { paper_code } = req.query;
    const params = [];
    let paperFilter = "";

    if (paper_code) {
      paperFilter = "WHERE source_paper_code LIKE ?";
      params.push(`%${paper_code}%`);
    }

    const [stats] = await db.query(
      `SELECT 
        COUNT(*) as total_items,
        SUM(CASE WHEN review_status = 'draft' OR review_status IS NULL THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN review_status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN review_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN item_type_id = 1 THEN 1 ELSE 0 END) as mcq_count
       FROM item_master ${paperFilter}`,
      params
    );

    const [byPaper] = await db.query(
      `SELECT source_paper_code, COUNT(*) as items,
        SUM(CASE WHEN review_status = 'draft' OR review_status IS NULL THEN 1 ELSE 0 END) as pending
       FROM item_master ${paperFilter}
       GROUP BY source_paper_code 
       ORDER BY items DESC 
       LIMIT 20`,
      params
    );

    res.json({ success: true, data: { overall: stats[0], by_paper: byPaper } });
  } catch (error) {
    console.error("[GET /items/stats ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/qbank/audit-log
// Query: ?item_id=&paper_code=&action=&page=1&limit=50
// ============================================
router.get('/audit-log', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { item_id, paper_code, action, page = 1, limit = 50 } = req.query;
    const conditions = ["1=1"];
    const params = [];

    if (item_id) { conditions.push("item_id = ?"); params.push(item_id); }
    if (paper_code) { conditions.push("reason LIKE ?"); params.push(`%${paper_code}%`); }
    if (action) { conditions.push("action = ?"); params.push(action); }

    const whereClause = conditions.join(' AND ');
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM item_audit_log WHERE ${whereClause}`,
      params
    );

    const [logs] = await db.query(
      `SELECT * FROM item_audit_log 
       WHERE ${whereClause} 
       ORDER BY timestamp DESC 
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    logs.forEach(log => {
      if (log.old_value && typeof log.old_value === 'string') {
        try { log.old_value = JSON.parse(log.old_value); } catch (e) {}
      }
      if (log.new_value && typeof log.new_value === 'string') {
        try { log.new_value = JSON.parse(log.new_value); } catch (e) {}
      }
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countRows[0].total,
        pages: Math.ceil(countRows[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error("[GET /audit-log ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// ============================================
// POST /api/qbank/admin/bulk-set-mcq-answers
// Body: multipart/form-data with field 'csv'
// CSV format: item_id,correct_answer
// correct_answer must be P, S, or R
// ============================================
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/admin/bulk-set-mcq-answers', upload.single('csv'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No CSV file uploaded. Field name must be "csv".' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('item_id') ? 1 : 0;

    const results = {
      total_rows: lines.length - startIndex,
      updated: [],
      skipped: [],
      errors: []
    };

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) {
        results.errors.push({ row: i + 1, line: line, error: 'Invalid CSV format: expected item_id,correct_answer' });
        continue;
      }

      const itemId = parts[0].trim();
      const correctAnswer = parts[1].trim().toUpperCase();

      if (!['P', 'S', 'R'].includes(correctAnswer)) {
        results.errors.push({ row: i + 1, item_id: itemId, error: `Invalid answer "${correctAnswer}". Must be P, S, or R.` });
        continue;
      }

      // Validate item exists and is MCQ
      const [items] = await db.query(
        `SELECT item_id, item_type_id, item_answer_json FROM item_master WHERE item_id = ?`,
        [itemId]
      );

      if (items.length === 0) {
        results.errors.push({ row: i + 1, item_id: itemId, error: 'Item not found' });
        continue;
      }

      const item = items[0];
      if (item.item_type_id != 1) {
        results.errors.push({ row: i + 1, item_id: itemId, error: `Item is not MCQ (item_type_id=${item.item_type_id})` });
        continue;
      }

      // Update item_answer_json
      let answerJson = item.item_answer_json;
      if (typeof answerJson === 'string') {
        try { answerJson = JSON.parse(answerJson); } catch (e) {}
      }

      if (!answerJson || typeof answerJson !== 'object') {
        answerJson = { options: [
          { label: "P", text: "[DIAGRAM â€” Option P]" },
          { label: "S", text: "[DIAGRAM â€” Option S]" },
          { label: "R", text: "[DIAGRAM â€” Option R]" }
        ]};
      }

      answerJson.correct_answer = correctAnswer;
      answerJson.needs_manual_answer = false;
      answerJson.verified_at = new Date().toISOString();

      await db.query(
        `UPDATE item_master SET item_answer_json = ? WHERE item_id = ?`,
        [JSON.stringify(answerJson), itemId]
      );

      results.updated.push({ row: i + 1, item_id: itemId, correct_answer: correctAnswer });

      // Log audit
      await logAudit(db, {
        item_id: itemId,
        action: 'update',
        action_by: req.body.updated_by || 'csv_bulk',
        old_values: { correct_answer: null },
        new_values: { correct_answer: correctAnswer },
        notes: 'Bulk CSV upload: set diagram MCQ correct answer',
        paper_code: item.source_paper_code
      });
    }

    res.json({
      success: true,
      data: {
        processed: results.updated.length + results.errors.length,
        updated: results.updated.length,
        errors: results.errors.length,
        details: results
      }
    });
  } catch (error) {
    console.error("[BULK SET MCQ ANSWERS ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

