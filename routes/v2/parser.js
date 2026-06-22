const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

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
    const items = req.body.items || req.body.approved_items;
    const paperCode = req.body.paper_code || req.body.paperCode;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Items array required' });
    }
    if (!paperCode) {
      return res.status(400).json({ success: false, error: 'Paper code required' });
    }
    const inserted = [];
    for (const item of items) {
      const [result] = await req.db.execute(
        `INSERT INTO question_papers 
         (paper_code, question_number, question_text, answer_text, marks, 
          confidence, qp_images, memo_images, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          paperCode,
          item.question_number,
          item.question_text,
          item.answer_text,
          item.final_marks,
          item.confidence,
          JSON.stringify(item.qp_images || []),
          JSON.stringify(item.memo_images || [])
        ]
      );
      inserted.push({ id: result.insertId, question_number: item.question_number });
    }
    res.json({ success: true, inserted, count: inserted.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
