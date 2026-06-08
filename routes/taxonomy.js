const express = require('express');
const router = express.Router();

// GET /api/taxonomy - Get tag taxonomy
router.get('/', async (req, res) => {
  try {
    const { level, parent_id } = req.query;
    let query = 'SELECT * FROM qbank_tag_taxonomy WHERE is_active = TRUE';
    const params = [];

    if (level) {
      query += ' AND tag_level = ?';
      params.push(level);
    }
    if (parent_id) {
      query += ' AND parent_tag_id = ?';
      params.push(parent_id);
    }

    query += ' ORDER BY tag_level, tag_name';

    const [rows] = await req.db.execute(query, params);
    res.json({ tags: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/taxonomy - Add new tag (admin only)
router.post('/', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const { tag_code, tag_name, parent_tag_id, tag_level, description, requires_approval, created_by } = req.body;

    await conn.execute(
      `INSERT INTO qbank_tag_taxonomy (tag_code, tag_name, parent_tag_id, tag_level, description, requires_approval, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tag_name = VALUES(tag_name), description = VALUES(description), is_active = TRUE`,
      [tag_code, tag_name, parent_tag_id || null, tag_level, description, requires_approval || false, created_by]
    );

    await conn.commit();
    res.json({ success: true, tag_code });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
