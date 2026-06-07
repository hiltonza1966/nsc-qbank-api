const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/', async (req, res) => {
  const db = req.db;
  const {
    subject_official_code, paper_no, question_text, marks,
    topic, cognitive_level, difficulty, created_by = 1,
    source_year, source_exam_board, source_paper_code
  } = req.body;

  if (!subject_official_code || !paper_no || !question_text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: subject_official_code, paper_no, question_text'
    });
  }

  const item_id = uuidv4();

  try {
    await db.execute(
      `INSERT INTO qbank_items
       (item_id, subject_official_code, paper_no, question_text, marks,
        topic, cognitive_level, difficulty, status, created_by,
        source_year, source_exam_board, source_paper_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)`,
      [item_id, subject_official_code, paper_no, question_text, marks || 1,
       topic || null, cognitive_level || null, difficulty || null, created_by,
       source_year || null, source_exam_board || null, source_paper_code || null]
    );
    res.json({ success: true, item_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', async (req, res) => {
  const db = req.db;
  const { subject, paper } = req.query;
  let sql = `SELECT * FROM qbank_items WHERE 1=1`;
  const p = [];

  if (subject && subject.toLowerCase() !== 'all') {
    sql += ` AND subject_official_code = ?`;
    p.push(subject);
  }
  if (paper) {
    sql += ` AND paper_no = ?`;
    p.push(paper);
  }
  sql += ` ORDER BY created_at DESC LIMIT 100`;

  try {
    const [rows] = await db.execute(sql, p);
    res.json({ success: true, count: rows.length, items: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/bulk', async (req, res) => {
  const db = req.db;
  const items = Array.isArray(req.body) ? req.body : [];

  if (!items.length) {
    return res.status(400).json({ success: false, error: 'No items provided' });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    for (const it of items) {
      const {
        subject_official_code, paper_no, question_text, marks,
        topic, cognitive_level, difficulty, created_by = 1,
        source_year, source_exam_board, source_paper_code
      } = it;

      const item_id = uuidv4();
      await conn.execute(
        `INSERT INTO qbank_items
         (item_id, subject_official_code, paper_no, question_text, marks,
          topic, cognitive_level, difficulty, status, created_by,
          source_year, source_exam_board, source_paper_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?, ?)`,
        [item_id, subject_official_code, paper_no, question_text, marks || 1,
         topic || null, cognitive_level || null, difficulty || null, created_by,
         source_year || null, source_exam_board || null, source_paper_code || null]
      );
    }

    await conn.commit();
    res.json({ success: true, count: items.length });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
