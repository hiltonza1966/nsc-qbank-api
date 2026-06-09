const express = require('express');
const router = express.Router();

// GET /api/taxonomy/tags
router.get('/tags', async (req, res) => {
  try {
    const [rows] = await req.db.execute('SELECT * FROM lookup_tag_taxonomy WHERE is_active = 1 ORDER BY tag_category, tag_name');
    res.json({ success: true, count: rows.length, tags: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
