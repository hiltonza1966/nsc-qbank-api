const express = require('express');
const router = express.Router();

// POST /api/items/:id/versions - Create version
router.post('/:id/versions', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    const { id } = req.params;
    const { question_text, memo_answer, marks, change_reason, change_type, changed_by } = req.body;

    await conn.beginTransaction();

    // Get next version number
    const [rows] = await conn.execute(
      'SELECT MAX(version_number) as max_ver FROM qbank_item_versions WHERE item_id = ?',
      [id]
    );
    const nextVer = (rows[0].max_ver || 0) + 1;

    await conn.execute(
      `INSERT INTO qbank_item_versions (item_id, version_number, question_text, memo_answer, marks, changed_by, change_reason, change_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, nextVer, question_text, memo_answer, marks, changed_by, change_reason, change_type]
    );

    // Update current version on item
    await conn.execute(
      'UPDATE qbank_items SET current_version = ? WHERE id = ?',
      [nextVer, id]
    );

    await conn.commit();
    res.json({ success: true, version_number: nextVer });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/items/:id/versions - Get version history
router.get('/:id/versions', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM qbank_item_versions WHERE item_id = ? ORDER BY version_number DESC',
      [req.params.id]
    );
    res.json({ versions: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
