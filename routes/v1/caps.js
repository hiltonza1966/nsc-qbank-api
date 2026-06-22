const express = require('express');
const router = express.Router();
const { isEnabled } = require('../../config/features');

router.use((req, res, next) => {
  if (!isEnabled('caps_parser_v9')) {
    return res.status(503).json({ success: false, error: 'CAPS parser v9 is disabled' });
  }
  next();
});

router.get('/subjects', async (req, res) => {
  try {
    const db = req.db;
    const [subjects] = await db.query(
      `SELECT subject_official_code, subject_alpha_code, subject_name
       FROM caps_subjects_master
       WHERE is_active = 1
       ORDER BY subject_name`
    );
    res.json({ success: true, subjects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/content/:subjectCode', async (req, res) => {
  try {
    const db = req.db;
    const [content] = await db.query(
      `SELECT grade, term, week_range, paper_no, paper_code,
              topic, subtopic, caps_ref, source_url
       FROM caps_atp_content
       WHERE subject_official_code = ?
       ORDER BY grade, term, week_range, topic`,
      [req.params.subjectCode]
    );
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/poa/:subjectCode', async (req, res) => {
  try {
    const db = req.db;
    const [poa] = await db.query(
      `SELECT grade, term, week_range, paper_no, paper_code,
              topic, subtopic, caps_ref, source_url,
              programme_of_assessment, weight_sba_pct, cognitive_level
       FROM caps_poa_template
       WHERE subject_official_code = ?
       ORDER BY grade, term, week_range, topic`,
      [req.params.subjectCode]
    );
    res.json({ success: true, poa });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
