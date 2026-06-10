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

// GET /api/caps/subjects - List available subjects
router.get('/subjects', async (req, res) => {
  try {
    const db = req.db;
    const [subjects] = await db.query(
      'SELECT subject_official_code, subject_alpha_code, subject_name FROM lookup_subjects WHERE is_active = 1 ORDER BY subject_name'
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
      'SELECT grade_id, grade_value, grade_label FROM lookup_grades WHERE is_active = 1 ORDER BY grade_id'
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

module.exports = router;
