// routes/capsParser.js
const express = require('express');
const router = express.Router();
const capsParserService = require('../services/capsParserService');

// POST /api/caps/parse - Parse CAPS JSON and validate
router.post('/parse', async (req, res) => {
  try {
    const db = req.db;
    const result = await capsParserService.parseAndGenerateSQL(req.body, db);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/caps/execute - Execute generated SQL
router.post('/execute', async (req, res) => {
  try {
    const db = req.db;
    const { sql } = req.body;
    const result = await capsParserService.executeSQL(sql, db);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/caps/subjects - List available subjects from caps_subjects_master
router.get('/subjects', async (req, res) => {
  try {
    const db = req.db;
    const [subjects] = await db.query(
      `SELECT subject_official_code, subject_alpha_code, subject_name 
       FROM caps_subjects_master 
       WHERE is_active = 1 
       ORDER BY subject_name`
    );
    res.json({ subjects });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/caps/grades - List available grades
router.get('/grades', async (req, res) => {
  try {
    const db = req.db;
    const [grades] = await db.query(
      `SELECT grade_id, grade_value, grade_label 
       FROM lookup_grades 
       WHERE is_active = 1 
       ORDER BY grade_id`
    );
    res.json({ grades });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/caps/migrations - List existing CAPS migrations
router.get('/migrations', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(process.cwd(), 'database', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      return res.json({ migrations: [] });
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .map(f => ({
        filename: f,
        path: path.join(migrationsDir, f),
        size: fs.statSync(path.join(migrationsDir, f)).size
      }));

    res.json({ migrations: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// NEW ENDPOINTS - Point to caps_atp_content and caps_poa_template
// ============================================================

// GET /api/caps/content/:subjectCode - ATP content from caps_atp_content
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
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/caps/poa/:subjectCode - PoA template from caps_poa_template
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
    res.json({ poa });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/caps/topics/:subjectCode - Distinct topics from caps_atp_content
router.get('/topics/:subjectCode', async (req, res) => {
  try {
    const db = req.db;
    const [topics] = await db.query(
      `SELECT DISTINCT topic, grade
       FROM caps_atp_content
       WHERE subject_official_code = ?
       ORDER BY grade, topic`,
      [req.params.subjectCode]
    );
    res.json({ topics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
