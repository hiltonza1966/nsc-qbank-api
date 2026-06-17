const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads', 'temp'),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const PYTHON_PATH = process.platform === 'win32' ? 'python' : 'python3';
const PARSER_API_PATH = path.join(__dirname, '..', 'parsers', 'parser_api.py');

/**
 * POST /api/parser/parse
 * Run parser on uploaded QP and Memo files
 */
router.post('/parse', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const { subject_id, grade_id, year, language, paper_number } = req.body;

    if (!req.files?.qp_file || !req.files?.memo_file) {
      return res.status(400).json({ error: 'Both QP and Memo files required' });
    }

    const qpPath = req.files.qp_file[0].path;
    const memoPath = req.files.memo_file[0].path;
    const paperCode = `${subject_id}_P${paper_number}_${year}`;
    const outputDir = path.join(__dirname, '..', '..', 'uploads', 'parser_results');

    const pythonProcess = spawn(PYTHON_PATH, [
      PARSER_API_PATH,
      'parse',
      qpPath,
      memoPath,
      paperCode,
      outputDir
    ]);

    let result = '';
    let error = '';

    pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

    pythonProcess.on('close', async (code) => {
      try { fs.unlinkSync(qpPath); fs.unlinkSync(memoPath); } catch (e) {}

      if (code !== 0) {
        return res.status(500).json({ error: 'Parser execution failed', details: error, exitCode: code });
      }

      try {
        const parsedResult = JSON.parse(result);
        if (parsedResult.status === 'success') {
          await storeParserResult(parsedResult, { subject_id, grade_id, year, language, paper_number });
        }
        res.json(parsedResult);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse parser output', details: e.message, rawOutput: result });
      }
    });

  } catch (error) {
    console.error('Parser route error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parser/status
 */
router.get('/status', (req, res) => {
  const pythonProcess = spawn(PYTHON_PATH, [PARSER_API_PATH, 'status']);
  let result = '';
  pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
  pythonProcess.on('close', (code) => {
    if (code !== 0) return res.status(500).json({ error: 'Failed to check parser status', pythonAvailable: false });
    try {
      const status = JSON.parse(result);
      res.json({ ...status, pythonAvailable: true, parserApiPath: PARSER_API_PATH, apiVersion: 'v20' });
    } catch (e) { res.status(500).json({ error: 'Invalid status output' }); }
  });
});

/**
 * GET /api/parser/review/:paperCode
 */
router.get('/review/:paperCode', async (req, res) => {
  try {
    const { paperCode } = req.params;
    const [results] = await db.query(
      `SELECT * FROM parser_results WHERE paper_code = ? ORDER BY created_at DESC LIMIT 1`,
      [paperCode]
    );
    if (!results || results.length === 0) return res.status(404).json({ error: 'No parser results found' });
    const result = JSON.parse(results[0].result_json);
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

/**
 * POST /api/parser/approve
 * Approve and import to item_master / item_memos
 */
router.post('/approve', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { paper_code, approved_items, paper_metadata } = req.body;

    // 1. Create parse_sessions record
    const [sessionResult] = await connection.query(
      `INSERT INTO parse_sessions 
       (year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
        file_name, parser_version, total_items_found, total_marks_parser, total_marks_expected, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paper_metadata.year_id,
        paper_metadata.grade_id,
        paper_metadata.subject_id,
        paper_metadata.paper_id,
        paper_metadata.assessment_type_id || 1,
        paper_metadata.assessment_body_id || 1,
        paper_code,
        'v20',
        approved_items.length,
        approved_items.reduce((sum, item) => sum + item.final_marks, 0),
        paper_metadata.target_marks || 150,
        'completed'
      ]
    );

    const sessionId = sessionResult.insertId;

    // 2. Create item_master records
    for (const item of approved_items) {
      const itemCode = `${paper_code}_${item.question_number}`;

      await connection.query(
        `INSERT INTO item_master 
         (item_id, item_code, year_id, grade_id, subject_id, paper_id, 
          assessment_type_id, assessment_body_id, language_id,
          question_number, question_text, marks, marks_allocated, 
          qp_marks, memo_marks, parser_confidence, review_status,
          item_type_id, cognitive_level_id, difficulty_id, status,
          source_paper_code, source_question_number, created_by)
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemCode,
          paper_metadata.year_id,
          paper_metadata.grade_id,
          paper_metadata.subject_id,
          paper_metadata.paper_id,
          paper_metadata.assessment_type_id || 1,
          paper_metadata.assessment_body_id || 1,
          paper_metadata.language_id || 1,
          item.question_number,
          item.question_text || '',
          item.final_marks,
          item.final_marks,
          item.qp_marks || 0,
          item.memo_marks || 0,
          item.confidence || 'green',
          item.confidence === 'red' ? 'needs_correction' : 'approved',
          item.item_type_id || 1,
          item.cognitive_level_id || 1,
          item.difficulty_id || 1,
          'draft',
          paper_code,
          item.question_number,
          paper_metadata.created_by || 1
        ]
      );
    }

    // 3. Update parser_results status
    await connection.query(
      `UPDATE parser_results SET status = 'imported' WHERE paper_code = ?`,
      [paper_code]
    );

    await connection.commit();

    res.json({
      success: true,
      session_id: sessionId,
      items_imported: approved_items.length,
      total_marks: approved_items.reduce((sum, item) => sum + item.final_marks, 0)
    });

  } catch (error) {
    await connection.rollback();
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

async function storeParserResult(result, metadata) {
  const connection = await db.getConnection();
  try {
    await connection.query(
      `INSERT INTO parser_results 
       (paper_code, subject_id, grade_id, year, result_json, status, total_marks, target_marks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.paper_code,
        metadata.subject_id,
        metadata.grade_id,
        metadata.year,
        JSON.stringify(result),
        'pending_review',
        result.total_marks,
        result.target_marks
      ]
    );
  } finally {
    connection.release();
  }
}

module.exports = router;
