const express = require('express');
const router = express.Router();

// GET /api/qbank/items/:item_id/versions — Get version history
router.get('/:item_id/versions', async (req, res) => {
  const db = req.db;
  try {
    const [versions] = await db.execute(
      `SELECT iv.*, u.username as created_by_name
       FROM item_versions iv
       LEFT JOIN qbank_users u ON iv.created_by = u.user_id
       WHERE iv.item_id = ?
       ORDER BY iv.version_number DESC`,
      [req.params.item_id]
    );
    res.json({ success: true, count: versions.length, versions });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:item_id/snapshot — Create manual version snapshot
router.post('/:item_id/snapshot', async (req, res) => {
  const db = req.db;
  const itemId = req.params.item_id;
  const userId = req.headers['x-user-id'] || 1;

  try {
    const [items] = await db.execute(
      'SELECT current_version FROM item_master WHERE item_id = ?',
      [itemId]
    );
    if (!items.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const currentVersion = items[0].current_version;

    await db.execute(
      `INSERT INTO item_versions (item_id, version_number, question_text, question_text_afr, marks, cognitive_level, difficulty, status, created_by)
       SELECT item_id, ?, question_text, question_text_afr, marks, cognitive_level, difficulty, status, ?
       FROM item_master WHERE item_id = ?`,
      [currentVersion + 1, userId, itemId]
    );

    await db.execute(
      'UPDATE item_master SET current_version = current_version + 1 WHERE item_id = ?',
      [itemId]
    );

    res.json({ success: true, item_id: itemId, version_number: currentVersion + 1 });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items/:item_id/versions/:version_id — Get specific version
router.get('/:item_id/versions/:version_id', async (req, res) => {
  const db = req.db;
  try {
    const [versions] = await db.execute(
      'SELECT * FROM item_versions WHERE item_id = ? AND version_id = ?',
      [req.params.item_id, req.params.version_id]
    );
    if (!versions.length) return res.status(404).json({ success: false, error: 'Version not found' });
    res.json({ success: true, version: versions[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:item_id/rollback — Rollback to specific version
router.post('/:item_id/rollback', async (req, res) => {
  const db = req.db;
  const itemId = req.params.item_id;
  const { version_id } = req.body;

  if (!version_id) {
    return res.status(400).json({ success: false, error: 'version_id is required' });
  }

  try {
    const [versions] = await db.execute(
      'SELECT * FROM item_versions WHERE item_id = ? AND version_id = ?',
      [itemId, version_id]
    );
    if (!versions.length) return res.status(404).json({ success: false, error: 'Version not found' });

    const version = versions[0];

    await db.execute(
      `UPDATE item_master SET
        question_text = ?,
        question_text_afr = ?,
        marks = ?,
        cognitive_level = ?,
        difficulty = ?,
        status = ?,
        current_version = current_version + 1,
        updated_at = NOW()
       WHERE item_id = ?`,
      [version.question_text, version.question_text_afr, version.marks, version.cognitive_level, version.difficulty, version.status, itemId]
    );

    res.json({ success: true, item_id: itemId, rolled_back_to_version: version.version_number });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
