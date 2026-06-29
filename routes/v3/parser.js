const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { promoteSessionToItemMaster } = require('../../utils/promoteSession');

const upload = multer({ dest: 'uploads/' });
const PARSERS_DIR = path.join(__dirname, '..', '..', 'backend', 'parsers');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const ROOT_DIR = path.join(__dirname, '..', '..');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 2000);
      reject(new Error(`Python script timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

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

router.get('/status', async (req, res) => {
  try {
    const status = await runPythonScript(['status'], 10000);
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/parse-qp', upload.fields([
  { name: 'qp_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const db = req.db;
    const qpFile = req.files['qp_file']?.[0];
    const paperCode = req.body.paper_code || req.body.paperCode || 'UNKNOWN';
    const dimensions = {
      subject_id: req.body.subject_id,
      grade_id: req.body.grade_id,
      year_id: req.body.year_id,
      paper_id: req.body.paper_id,
      assessment_type_id: req.body.assessment_type_id,
      assessment_body_id: req.body.assessment_body_id
    };
    
    if (!qpFile) {
      return res.status(400).json({ success: false, error: 'QP file required' });
    }
    
    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });
    const qpFilePath = path.resolve(ROOT_DIR, qpFile.path);
    
    const result = await runPythonScript(['parse-qp', qpFilePath, paperCode, outputDir], 30000);
    
    // Create parse session
    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(
      `INSERT INTO parse_sessions (session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, file_name, parser_version, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, dimensions.year_id, dimensions.grade_id, dimensions.subject_id, dimensions.paper_id, dimensions.assessment_type_id, dimensions.assessment_body_id, qpFile.originalname, result.parser_version || 'v32', 'qp_extracted', now]
    );
    
    // Insert QP results
    const items = result.items || [];
    for (const item of items) {
      const resultId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO parse_results (result_id, session_id, paper_code, question_number, question_text, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [resultId, sessionId, paperCode, item.question_number, item.question_text || '', item.marks || 0, item.marks || 0, item.marks || 0, 'auto_corrected', now, now]
      );
    }
    
    res.json({ success: true, session_id: sessionId, paper_code: paperCode, qp_items: items.length, items: result.items || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/parse-memo', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const db = req.db;
    const qpFile = req.files['qp_file']?.[0];
    const memoFile = req.files['memo_file']?.[0];
    const paperCode = req.body.paper_code || req.body.paperCode || 'UNKNOWN';
    const sessionId = req.body.session_id;
    
    if (!qpFile || !memoFile) {
      return res.status(400).json({ success: false, error: 'Both QP and Memo files required' });
    }
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'session_id required - upload QP first' });
    }
    
    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });
    const qpFilePath = path.resolve(ROOT_DIR, qpFile.path);
    const memoFilePath = path.resolve(ROOT_DIR, memoFile.path);
    
    const result = await runPythonScript(['parse', qpFilePath, memoFilePath, paperCode, outputDir], 60000);
    
    // Insert memo results
    const memoItems = result.matched_items || result.green_items || [];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    for (const item of memoItems) {
      const memoId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO parse_memos (memo_id, session_id, paper_code, question_number, answer_text, parser_extracted_marks, auto_corrected_marks, correction_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [memoId, sessionId, paperCode, item.question_number, item.answer_text || '', item.marks || 0, item.marks || 0, 'auto_corrected', now, now]
      );
    }
    
    // Update session
    await db.execute(
      'UPDATE parse_sessions SET total_marks_parser = ?, total_marks_expected = ?, status = ? WHERE session_id = ?',
      [result.total_marks || 0, result.target_marks || 0, 'completed', sessionId]
    );
    
    res.json({ success: true, session_id: sessionId, paper_code: paperCode, matched: result.matched || 0, total_marks: result.total_marks || 0, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/images/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, 'parser_output', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, error: 'Image not found' });
  }
});

router.post('/approve', async (req, res) => {
  try {
    const db = req.db;
    const { session_id, paper_code, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, language } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ success: false, error: 'session_id is required' });
    }
    
    const dimensions = { subject_id, paper_id, year_id, grade_id, assessment_type_id, assessment_body_id, language };
    
    if (paper_id) {
      const [paperRows] = await db.execute('SELECT paper_no FROM lookup_papers WHERE paper_id = ? LIMIT 1', [paper_id]);
      if (paperRows.length > 0) dimensions.paper_no = paperRows[0].paper_no;
    }
    
    if (year_id) {
      const [yearRows] = await db.execute('SELECT year_value FROM lookup_years WHERE year_id = ? LIMIT 1', [year_id]);
      if (yearRows.length > 0) dimensions.year = yearRows[0].year_value;
    }
    
    const result = await promoteSessionToItemMaster(db, session_id, paper_code, dimensions, 1);
    res.json({ success: true, result });
  } catch (e) {
    console.error('Approve error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
