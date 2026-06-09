const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const QBANK_DB = process.env.DB_NAME || 'nsc_qbank';

function validateItem(it) {
  const required = ['subject_official_code', 'paper_no', 'question_text'];
  for (const f of required) {
    if (!it[f] || String(it[f]).trim() === '') return 'Missing ' + f;
  }
  if (!it.marks || isNaN(parseInt(it.marks))) return 'Missing or invalid marks';
  return null;
}

function validateMemo(it) {
  if (!it.question_number || String(it.question_number).trim() === '') return 'Missing question_number';
  if (!it.answer_text || String(it.answer_text).trim() === '') return 'Missing answer_text';
  if (!it.marks || isNaN(parseInt(it.marks))) return 'Missing or invalid marks';
  return null;
}

// POST /api/staging/bulk — Import QP items to staging
router.post('/bulk', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || !items.length)
    return res.status(400).json({ success: false, error: 'No items' });

  let inserted = 0, skipped = 0, errors = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const err = validateItem(it);
    if (err) { errors.push({ index: i, error: err }); continue; }

    try {
      await req.db.query(
        `INSERT INTO ${QBANK_DB}.item_master
         (item_id, subject_official_code, paper_no, question_text, marks, topic, cognitive_level, difficulty,
          created_by, source_year, source_exam_board, source_paper_code, 
          item_code, question_number, source_reference, staging_batch, status, item_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
        [
          uuidv4(),
          it.subject_official_code,
          parseInt(it.paper_no) || null,
          it.question_text.trim(),
          parseInt(it.marks) || 1,
          it.topic || null,
          it.cognitive_level || null,
          it.difficulty || null,
          it.created_by || 1,
          it.source_year || null,
          it.source_exam_board || null,
          it.source_paper_code || null,
          it.item_code || null,
          it.question_number || null,
          it.source_reference || null,
          it.batch || 'wizard-' + new Date().toISOString().slice(0, 10),
          it.item_type || 'Extended'
        ]
      );
      inserted++;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') skipped++;
      else errors.push({ index: i, error: e.message });
    }
  }
  res.json({ success: true, inserted, skipped, errors, total: items.length });
});

// POST /api/staging/bulk-memo — Import Memo items to memo table
router.post('/bulk-memo', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || !items.length)
    return res.status(400).json({ success: false, error: 'No memo items' });

  let inserted = 0, skipped = 0, errors = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const err = validateMemo(it);
    if (err) { errors.push({ index: i, error: err }); continue; }

    try {
      await req.db.query(
        `INSERT INTO ${QBANK_DB}.item_memos
         (memo_id, question_number, answer_text, marks, source_year, source_exam_board, source_paper_code,
          subject_official_code, paper_no, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
        [
          uuidv4(),
          it.question_number.trim(),
          it.answer_text.trim(),
          parseInt(it.marks) || 1,
          it.source_year || null,
          it.source_exam_board || null,
          it.source_paper_code || null,
          it.subject_official_code || null,
          parseInt(it.paper_no) || null
        ]
      );
      inserted++;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') skipped++;
      else errors.push({ index: i, error: e.message });
    }
  }
  res.json({ success: true, inserted, skipped, errors, total: items.length });
});

router.post('/approve/:id', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const [stg] = await conn.query(
      `SELECT * FROM ${QBANK_DB}.item_master WHERE item_id = ?`,
      [req.params.id]
    );
    if (!stg.length) throw new Error('Staging item not found');
    const r = stg[0];

    const missing = [];
    if (!r.caps_topic) missing.push('caps_topic');
    if (!r.item_type) missing.push('item_type');
    if (!r.cognitive_level) missing.push('cognitive_level');
    if (!r.difficulty_level) missing.push('difficulty_level');
    if (missing.length) throw new Error('Cannot approve, missing: ' + missing.join(', '));

    const item_code = r.item_code || `${r.subject_official_code}-P${r.paper_no}-${r.source_year || 'XXXX'}-${String(r.id).padStart(4, '0')}`;

    const [ins] = await conn.query(
      `INSERT INTO ${QBANK_DB}.item_master
       (item_id, subject_official_code, paper_no, item_code, question_text, marks,
        cognitive_level, difficulty, caps_topic, caps_subtopic, item_type,
        created_by, source_reference, status)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved')`,
      [r.subject_official_code, r.paper_no, item_code, r.question_text, r.marks,
       r.cognitive_level, r.difficulty_level, r.caps_topic, r.caps_subtopic, r.item_type,
       r.created_by, r.source_reference]
    );
    const liveId = ins.insertId;

    await conn.query(
      `INSERT INTO ${QBANK_DB}.item_tags (item_id, tag_type, tag_value)
       SELECT ?, tag_type, tag_value FROM ${QBANK_DB}.item_master_tags WHERE item_id = ?`,
      [liveId, r.id]
    );
    await conn.query(
      `INSERT INTO ${QBANK_DB}.item_master (item_id, caps_code, weight)
       SELECT ?, caps_code, weight FROM ${QBANK_DB}.item_master_curriculum WHERE item_id = ?`,
      [liveId, r.id]
    );

    await conn.query(`DELETE FROM ${QBANK_DB}.item_master_tags WHERE item_id = ?`, [r.id]);
    await conn.query(`DELETE FROM ${QBANK_DB}.item_master_curriculum WHERE item_id = ?`, [r.id]);
    await conn.query(`DELETE FROM ${QBANK_DB}.item_master WHERE item_id = ?`, [r.id]);

    await conn.commit();
    res.json({ success: true, live_id: liveId, item_code });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
