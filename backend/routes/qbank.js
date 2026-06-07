// GET /api/qbank/subjects-with-papers
// Returns subjects with dynamic paper metadata from subject_structure
// Uses paper_mark (not max_mark) as confirmed 2026-06-05

const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/subjects-with-papers', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        subject_alpha_code AS code,
        subject_name_eng AS name,
        subject_name_afr AS name_afr,
        subject_official_code,
        paper_no,
        paper_name_eng,
        paper_type,
        duration,
        paper_mark,
        weighting,
        assessment_origin,
        subject_group
      FROM subject_structure
      WHERE reg_type = 'FT & PT'
      ORDER BY subject_alpha_code, paper_no
    `);

    // Group by subject
    const subjects = {};
    rows.forEach(row => {
      const code = row.code;
      if (!subjects[code]) {
        subjects[code] = {
          id: row.subject_official_code,
          code: row.code,
          name: row.name,
          name_afr: row.name_afr,
          group: row.subject_group,
          papers: []
        };
      }
      subjects[code].papers.push({
        number: row.paper_no,
        name: row.paper_name_eng,
        type: row.paper_type,
        duration: parseFloat(row.duration),
        marks: row.paper_mark,
        weighting: row.weighting,
        origin: row.assessment_origin
      });
    });

    res.json(Object.values(subjects));
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

module.exports = router;
