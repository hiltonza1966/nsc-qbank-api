const express = require('express');
const router = express.Router();

// GET /api/items/:item_id/workflow
router.get('/:item_id/workflow', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM review_workflow WHERE item_id = ? ORDER BY created_at DESC',
      [req.params.item_id]
    );
    res.json({ success: true, count: rows.length, transitions: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
