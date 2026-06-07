/**
 * QBank API Routes
 * GET /api/qbank/subjects-with-papers
 * Returns subjects with paper metadata from subject_structure
 * Uses paper_mark (confirmed 2026-06-05)
 */

const express = require('express');
const router = express.Router();

// Database connection (adjust to your setup)
const mysql = require('mysql2/promise');
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'nsc_registration_v3'
};

/**
 * GET /subjects-with-papers
 * Returns all subjects with their papers dynamically from subject_structure
 */
router.get('/subjects-with-papers', async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    const [rows] = await connection.execute(`
      SELECT 
        ss.subject_alpha_code AS code,
        ss.subject_name_eng AS name,
        ss.subject_name_afr AS name_afr,
        ss.subject_official_code,
        ss.paper_no,
        ss.paper_name_eng,
        ss.paper_name_afr,
        ss.paper_type,
        ss.paper_type_code,
        ss.duration,
        ss.paper_mark,
        ss.max_mark,
        ss.weighting,
        ss.assessment_origin,
        ss.subject_group,
        ss.grade,
        qps.cognitive_weighting,
        qps.difficulty_weighting
      FROM subject_structure ss
      LEFT JOIN qbank_paper_specs qps 
        ON ss.subject_official_code = qps.subject_official_code 
        AND ss.paper_no = qps.paper_no
      WHERE ss.reg_type = 'FT & PT'
        AND ss.subject_alpha_code IS NOT NULL
        AND ss.subject_alpha_code != ''
      ORDER BY ss.subject_alpha_code, ss.paper_no
    `);

    // Group by subject
    const subjectsMap = new Map();
    
    rows.forEach(row => {
      const code = row.code;
      
      if (!subjectsMap.has(code)) {
        subjectsMap.set(code, {
          official_code: row.subject_official_code,
          code: row.code,
          name: row.name,
          name_afr: row.name_afr,
          group: row.subject_group,
          grade: row.grade,
          papers: []
        });
      }
      
      const subject = subjectsMap.get(code);
      subject.papers.push({
        paper_no: row.paper_no,
        name_eng: row.paper_name_eng,
        name_afr: row.paper_name_afr,
        type: row.paper_type,
        type_code: row.paper_type_code,
        duration_hours: parseFloat(row.duration) || 0,
        duration_minutes: Math.round((parseFloat(row.duration) || 0) * 60),
        marks: row.paper_mark, // Using paper_mark as confirmed
        max_marks: row.max_mark,
        weighting: row.weighting,
        assessment_origin: row.assessment_origin,
        has_specs: !!row.cognitive_weighting,
        cognitive_weighting: row.cognitive_weighting ? JSON.parse(row.cognitive_weighting) : null,
        difficulty_weighting: row.difficulty_weighting ? JSON.parse(row.difficulty_weighting) : null
      });
    });

    const subjects = Array.from(subjectsMap.values());
    
    res.json({
      success: true,
      count: subjects.length,
      data: subjects
    });

  } catch (error) {
    console.error('Error fetching subjects with papers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subjects',
      message: error.message
    });
  } finally {
    if (connection) await connection.end();
  }
});

module.exports = router;
