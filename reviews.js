const express = require('express');
const router = express.Router();

// GET /api/items/:item_id/reviews
router.get('/:item_id/reviews', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM item_reviews WHERE item_id = ? ORDER BY created_at DESC',
      [req.params.item_id]
    );
    res.json({ success: true, count: rows.length, reviews: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/items/:item_id/reviews
router.post('/:item_id/reviews', async (req, res) => {
  try {
    const { reviewer_id, reviewer_role, comment, review_type } = req.body;
    const [result] = await req.db.execute(
      'INSERT INTO item_reviews (item_id, reviewer_id, reviewer_role, comment, review_type) VALUES (?, ?, ?, ?, ?)',
      [req.params.item_id, reviewer_id, reviewer_role, comment, review_type || 'general']
    );
    res.json({ success: true, review_id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
