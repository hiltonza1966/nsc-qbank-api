const express = require('express');
const router = express.Router();

// POST /api/items/:id/reviews - Submit review
router.post('/:id/reviews', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    const { id } = req.params;
    const { reviewer_id, reviewer_role, review_type, comment, parent_review_id } = req.body;

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO qbank_item_reviews (item_id, parent_review_id, reviewer_id, reviewer_role, review_type, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, parent_review_id || null, reviewer_id, reviewer_role, review_type, comment]
    );

    await conn.commit();
    res.json({ success: true, review_id: result.insertId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/items/:id/reviews - Get review thread
router.get('/:id/reviews', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT r.*, u.name as reviewer_name
       FROM qbank_item_reviews r
       LEFT JOIN qbank_users u ON r.reviewer_id = u.id
       WHERE r.item_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json({ reviews: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
