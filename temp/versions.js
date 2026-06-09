const express = require('express');
const router = express.Router();

// GET /api/items/:item_id/versions
router.get('/:item_id/versions', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM item_versions WHERE item_id = ? ORDER BY version_number DESC',
      [req.params.item_id]
    );
    res.json({ success: true, count: rows.length, versions: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
