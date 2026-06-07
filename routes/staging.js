const express = require('express');
const router = express.Router();

// All QBank tables are in nsc_qbank (consolidated)
// Only subject_structure is in nsc_registration_v3 (cross-referenced when needed)
const QBANK_DB = process.env.DB_NAME || 'nsc_qbank';

// Validate required fields for staging
function validateItem(it) {
  const required = ['subject_official_code', 'paper_no', 'question_text'];
  for (const f of required) {
    if (!it[f] || String(it[f]).trim() === '') return `Missing ${f}`;
  }
  if (!it.marks || isNaN(parseInt(it.marks))) return 'Missing or invalid marks';
  return null;
}

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
        `INSERT INTO ${QBANK_DB}.qbank_items_staging
         (subject_official_code, paper_no, question_text, marks, topic, cognitive_level, difficulty_level,
          created_by, source_year, source_exam_board, source_paper_code, staging_batch, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`,
        [
          it.subject_official_code,
          parseInt(it.paper_no),
          it.question_text.trim(),
          parseInt(it.marks) || 1,
          it.topic || null,
          it.cognitive_level || null,
          it.difficulty || null,
          it.created_by || 1,
          it.source_year || null,
          it.source_exam_board || null,
          it.source_paper_code || null,
          it.batch || 'wizard-' + new Date().toISOString().slice(0, 10)
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

// approve with tag migration
router.post('/approve/:id', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch from staging table in nsc_qbank
    const [stg] = await conn.query(
      `SELECT * FROM ${QBANK_DB}.qbank_items_staging WHERE id = ?`,
      [req.params.id]
    );
    if (!stg.length) throw new Error('Staging item not found');
    const r = stg[0];

    // Ensure mandatory fields are filled before approval
    const missing = [];
    if (!r.caps_topic) missing.push('caps_topic');
    if (!r.item_type) missing.push('item_type');
    if (!r.cognitive_level) missing.push('cognitive_level');
    if (!r.difficulty_level) missing.push('difficulty_level');
    if (missing.length) throw new Error('Cannot approve, missing: ' + missing.join(', '));

    const item_code = r.item_code || `${r.subject_official_code}-P${r.paper_no}-${r.source_year || 'XXXX'}-${String(r.id).padStart(4, '0')}`;

    // Insert into live qbank_items in nsc_qbank
    const [ins] = await conn.query(
      `INSERT INTO ${QBANK_DB}.qbank_items
       (item_id, subject_official_code, paper_no, item_code, question_text, marks,
        cognitive_level, difficulty, caps_topic, caps_subtopic, item_type,
        created_by, source_reference, status)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved')`,
      [r.subject_official_code, r.paper_no, item_code, r.question_text, r.marks,
       r.cognitive_level, r.difficulty_level, r.caps_topic, r.caps_subtopic, r.item_type,
       r.created_by, r.source_reference]
    );
    const liveId = ins.insertId;

    // Copy tags from staging tags table to live tags table (both in nsc_qbank)
    await conn.query(
      `INSERT INTO ${QBANK_DB}.qbank_item_tags (item_id, tag_type, tag_value)
       SELECT ?, tag_type, tag_value FROM ${QBANK_DB}.qbank_items_staging_tags WHERE item_id = ?`,
      [liveId, r.id]
    );
    await conn.query(
      `INSERT INTO ${QBANK_DB}.qbank_item_curriculum (item_id, caps_code, weight)
       SELECT ?, caps_code, weight FROM ${QBANK_DB}.qbank_items_staging_curriculum WHERE item_id = ?`,
      [liveId, r.id]
    );

    // Cleanup staging tables
    await conn.query(`DELETE FROM ${QBANK_DB}.qbank_items_staging_tags WHERE item_id = ?`, [r.id]);
    await conn.query(`DELETE FROM ${QBANK_DB}.qbank_items_staging_curriculum WHERE item_id = ?`, [r.id]);
    await conn.query(`DELETE FROM ${QBANK_DB}.qbank_items_staging WHERE id = ?`, [r.id]);

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
