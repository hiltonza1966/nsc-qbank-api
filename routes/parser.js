const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

const upload = multer({ dest: 'uploads/' });
const PARSERS_DIR = path.join(__dirname, '..', 'backend', 'parsers');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const ROOT_DIR = path.join(__dirname, '..');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper: Run Python script with spawn, timeout, and explicit kill
function runPythonScript(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(pythonPath, ['-u', path.join(PARSERS_DIR, 'parser_api_v2.py'), ...args], {
      cwd: PARSERS_DIR,
      env: process.env,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 2000);
      reject(new Error(`Python script timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;

      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}. stderr: ${stderr.substring(0, 500)}`));
        return;
      }

      try {
        const lines = stdout.trim().split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}. stdout: ${stdout.substring(0, 500)}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

// GET /api/parser/status - Check parser status
router.get('/status', async (req, res) => {
  try {
    const status = await runPythonScript(['status'], 10000);
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/parser/parse - Run full parser (QP + Memo)
router.post('/parse', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const qpFile = req.files['qp_file']?.[0];
    const memoFile = req.files['memo_file']?.[0];
    const paperCode = req.body.paper_code || req.body.paperCode || 'UNKNOWN';

    if (!qpFile || !memoFile) {
      return res.status(400).json({ success: false, error: 'Both QP and Memo files required' });
    }

    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });

    const qpFilePath = path.resolve(ROOT_DIR, qpFile.path);
    const memoFilePath = path.resolve(ROOT_DIR, memoFile.path);

    const result = await runPythonScript(['parse', qpFilePath, memoFilePath, paperCode, outputDir], 60000);
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/parser/parse-qp - Run QP parser only (Step 1)
router.post('/parse-qp', upload.fields([
  { name: 'qp_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const qpFile = req.files['qp_file']?.[0];
    const paperCode = req.body.paper_code || req.body.paperCode || 'UNKNOWN';

    if (!qpFile) {
      return res.status(400).json({ success: false, error: 'QP file required' });
    }

    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });

    const qpFilePath = path.resolve(ROOT_DIR, qpFile.path);

    const result = await runPythonScript(['parse-qp', qpFilePath, paperCode, outputDir], 30000);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/parser/parse-memo - Run full parser for Step 2
router.post('/parse-memo', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const qpFile = req.files['qp_file']?.[0];
    const memoFile = req.files['memo_file']?.[0];
    const paperCode = req.body.paper_code || req.body.paperCode || 'UNKNOWN';

    if (!qpFile || !memoFile) {
      return res.status(400).json({ success: false, error: 'Both QP and Memo files required' });
    }

    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });

    const qpFilePath = path.resolve(ROOT_DIR, qpFile.path);
    const memoFilePath = path.resolve(ROOT_DIR, memoFile.path);

    const result = await runPythonScript(['parse', qpFilePath, memoFilePath, paperCode, outputDir], 60000);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/parser/images/:filename - Serve extracted images
router.get('/images/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, 'parser_output', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, error: 'Image not found' });
  }
});

// POST /api/parser/approve - Approve and import parsed items into corporate tables
// Corporate workflow: parse_sessions -> parse_results + parse_memos
router.post('/approve', async (req, res) => {
  const db = req.db;
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database connection not available' });
  }

  try {
    // Accept both 'items' and 'approved_items' from frontend
    const items = req.body.items || req.body.approved_items;
    const paperCode = req.body.paper_code || req.body.paperCode;

    // Dimension IDs from wizard dropdowns
    const yearId = req.body.year_id || null;
    const gradeId = req.body.grade_id || null;
    const subjectId = req.body.subject_id || null;
    const paperId = req.body.paper_id || null;
    const assessmentTypeId = req.body.assessment_type_id || null;
    const assessmentBodyId = req.body.assessment_body_id || null;
    const examSessionId = req.body.exam_session_id || null;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Items array required' });
    }

    if (!paperCode) {
      return res.status(400).json({ success: false, error: 'Paper code required' });
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Calculate counts
    const totalItems = items.length;
    const totalMarksParser = items.reduce((sum, item) => sum + (item.final_marks || 0), 0);
    const autoCorrectedCount = items.filter(item => item.confidence === 'green').length;
    const manualReviewCount = items.filter(item => item.confidence === 'yellow').length;
    const missingCount = items.filter(item => item.confidence === 'red').length;

    // 1. Insert parse_sessions record (audit trail)
    await db.execute(
      `INSERT INTO parse_sessions 
       (session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, 
        assessment_body_id, file_name, file_hash, parser_version, total_items_found, 
        total_marks_parser, total_marks_expected, total_marks_corrected, 
        auto_corrected_count, manual_review_count, missing_count, status, 
        error_message, completed_at, created_at, paper_code, is_memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        yearId,
        gradeId,
        subjectId,
        paperId,
        assessmentTypeId,
        assessmentBodyId,
        paperCode + '_QP_Memo.pdf',
        crypto.createHash('sha256').update(paperCode).digest('hex').substring(0, 64),
        'v30',
        totalItems,
        totalMarksParser,
        150, // expected marks from QP header
        totalMarksParser,
        autoCorrectedCount,
        manualReviewCount,
        missingCount,
        'imported',
        null,
        now,
        now,
        paperCode,
        0
      ]
    );

    // 2. Insert parse_results for each item (QP data)
    const parseResultsInserted = [];
    for (const item of items) {
      const [result] = await db.execute(
        `INSERT INTO parse_results 
         (session_id, paper_code, question_number, question_text, answer_text,
          parsed_type_id, parsed_section, parser_extracted_marks, expected_marks,
          auto_corrected_marks, correction_status, user_corrected_marks,
          reviewer_notes, is_memo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          paperCode,
          item.question_number,
          item.question_text || null,
          item.answer_text || null,
          null, // parsed_type_id - would need mapping
          item.section || null,
          item.qp_marks || item.final_marks || 0,
          item.expected_marks || item.final_marks || 0,
          item.final_marks || 0,
          item.confidence === 'green' ? 'auto_corrected' : 
            item.confidence === 'yellow' ? 'manual_review' : 'parser_missing',
          item.final_marks || 0,
          item.notes || null,
          0, // is_memo = 0 for QP results
          now,
          now
        ]
      );
      parseResultsInserted.push({ id: result.insertId, question_number: item.question_number });
    }

    // 3. Insert parse_memos for each item (Memo data)
    const parseMemosInserted = [];
    for (const item of items) {
      const [result] = await db.execute(
        `INSERT INTO parse_memos 
         (session_id, paper_code, question_number, question_text, answer_text,
          parser_extracted_marks, expected_marks, auto_corrected_marks,
          correction_status, user_corrected_marks, reviewer_notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          paperCode,
          item.question_number,
          item.question_text || null,
          item.answer_text || null,
          item.memo_marks || item.final_marks || 0,
          item.expected_marks || item.final_marks || 0,
          item.final_marks || 0,
          item.confidence === 'green' ? 'auto_corrected' : 
            item.confidence === 'yellow' ? 'manual_review' : 'parser_missing',
          item.final_marks || 0,
          item.notes || null,
          now,
          now
        ]
      );
      parseMemosInserted.push({ id: result.insertId, question_number: item.question_number });
    }

    res.json({
      success: true,
      session_id: sessionId,
      parse_results: parseResultsInserted,
      parse_memos: parseMemosInserted,
      total_items: totalItems,
      total_marks: totalMarksParser
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;