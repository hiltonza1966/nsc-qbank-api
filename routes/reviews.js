const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');

// GET /api/qbank/items/:item_id/reviews — Get reviews for an item
router.get('/:item_id/reviews', async (req, res) => {
  const db = req.db;
  try {
    const [reviews] = await db.execute(
      `SELECT ir.*, u.username as reviewer_name
       FROM item_reviews ir
       LEFT JOIN qbank_users u ON ir.reviewer_id = u.user_id
       WHERE ir.item_id = ?
       ORDER BY ir.created_at DESC`,
      [req.params.item_id]
    );
    res.json({ success: true, count: reviews.length, reviews });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:item_id/reviews — Add review comment
router.post('/:item_id/reviews', requireRole('subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const itemId = req.params.item_id;
  const userId = req.user.id;
  const { review_type, comment, status = 'open' } = req.body;

  if (!comment) {
    return res.status(400).json({ success: false, error: 'comment is required' });
  }

  try {
    const [items] = await db.execute(
      'SELECT subject_official_code, subject_alpha_code, paper_no FROM item_master WHERE item_id = ?',
      [itemId]
    );
    if (!items.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const item = items[0];

    const [result] = await db.execute(
      `INSERT INTO item_reviews (item_id, subject_official_code, subject_alpha_code, paper_no, reviewer_id, reviewer_role, review_type, comment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, item.subject_official_code, item.subject_alpha_code, item.paper_no, userId, req.user.role, review_type || 'general', comment, status]
    );

    res.json({ success: true, review_id: result.insertId, item_id: itemId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/reviews — Add review without item_id (for bulk)
router.post('/', requireRole('subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const { item_id, review_type, comment, status = 'open' } = req.body;

  if (!item_id || !comment) {
    return res.status(400).json({ success: false, error: 'item_id and comment are required' });
  }

  try {
    const [items] = await db.execute(
      'SELECT subject_official_code, subject_alpha_code, paper_no FROM item_master WHERE item_id = ?',
      [item_id]
    );
    if (!items.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const item = items[0];

    const [result] = await db.execute(
      `INSERT INTO item_reviews (item_id, subject_official_code, subject_alpha_code, paper_no, reviewer_id, reviewer_role, review_type, comment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, item.subject_official_code, item.subject_alpha_code, item.paper_no, req.user.id, req.user.role, review_type || 'general', comment, status]
    );

    res.json({ success: true, review_id: result.insertId, item_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items/reviews/pending — Get all pending reviews (for reviewers)
router.get('/pending', requireRole('subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const { subject_official_code, paper_no } = req.query;

  let sql = `SELECT ir.*, im.question_text, im.status as item_status, u.username as reviewer_name
             FROM item_reviews ir
             JOIN item_master im ON ir.item_id = im.item_id
             LEFT JOIN qbank_users u ON ir.reviewer_id = u.user_id
             WHERE ir.status = 'open'`;
  const p = [];

  if (subject_official_code) { sql += ` AND ir.subject_official_code = ?`; p.push(subject_official_code); }
  if (paper_no) { sql += ` AND ir.paper_no = ?`; p.push(paper_no); }

  sql += ` ORDER BY ir.created_at DESC`;

  try {
    const [reviews] = await db.execute(sql, p);
    res.json({ success: true, count: reviews.length, reviews });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/qbank/items/reviews/:review_id — Update review status
router.put('/:review_id', requireRole('subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const { status } = req.body;

  try {
    await db.execute(
      'UPDATE item_reviews SET status = ?, updated_at = NOW() WHERE review_id = ?',
      [status, req.params.review_id]
    );
    res.json({ success: true, review_id: req.params.review_id, status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/reviews/:review_id/reply — Reply to review
router.post('/:review_id/reply', requireRole('author', 'subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const { comment } = req.body;

  if (!comment) {
    return res.status(400).json({ success: false, error: 'comment is required' });
  }

  try {
    const [parent] = await db.execute(
      'SELECT item_id, subject_official_code, subject_alpha_code, paper_no FROM item_reviews WHERE review_id = ?',
      [req.params.review_id]
    );
    if (!parent.length) return res.status(404).json({ success: false, error: 'Review not found' });

    const parentReview = parent[0];

    const [result] = await db.execute(
      `INSERT INTO item_reviews (item_id, subject_official_code, subject_alpha_code, paper_no, parent_review_id, reviewer_id, reviewer_role, review_type, comment, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'general', ?, 'open')`,
      [parentReview.item_id, parentReview.subject_official_code, parentReview.subject_alpha_code, parentReview.paper_no, req.params.review_id, req.user.id, req.user.role, comment]
    );

    res.json({ success: true, review_id: result.insertId, parent_review_id: req.params.review_id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
