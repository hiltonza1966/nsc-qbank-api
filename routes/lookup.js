const express = require('express');
const router = express.Router();

router.get('/subjects', async (req, res) => {
  try {
    const [rows] = await req.db.query(
      'SELECT subject_official_code, subject_name FROM lookup_subjects ORDER BY subject_name'
    );
    res.json({ subjects: rows });
  } catch (error) {
    console.error('Lookup subjects error:', error);
    res.status(500).json({ error: 'Failed to load subjects from database' });
  }
});

module.exports = router;
