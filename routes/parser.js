const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Preserve original filename with extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '..', '..', 'uploads', 'temp');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Preserve original extension
    const ext = path.extname(file.originalname) || '.tmp';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const PARSER_API_PATH = path.join(__dirname, '..', 'backend', 'parsers', 'parser_api.py');

console.log('[Parser] Python path:', PYTHON_PATH);
console.log('[Parser] Parser API path:', PARSER_API_PATH);
console.log('[Parser] Parser API exists:', fs.existsSync(PARSER_API_PATH));

router.post('/parse', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    const { subject_id, grade_id, year, language, paper_number } = req.body;
    if (!req.files?.qp_file || !req.files?.memo_file) {
      return res.status(400).json({ error: 'Both QP and Memo files required' });
    }

    const qpFile = req.files.qp_file[0];
    const memoFile = req.files.memo_file[0];

    console.log('[Parser] QP file:', qpFile.path, 'ext:', path.extname(qpFile.originalname));
    console.log('[Parser] Memo file:', memoFile.path, 'ext:', path.extname(memoFile.originalname));

    const paperCode = `${subject_id}_P${paper_number}_${year}`;
    const outputDir = path.join(__dirname, '..', '..', 'uploads', 'parser_results');

    const pythonProcess = spawn(PYTHON_PATH, [
      PARSER_API_PATH, 'parse', qpFile.path, memoFile.path, paperCode, outputDir
    ]);

    let result = '';
    let error = '';
    pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

    pythonProcess.on('close', async (code) => {
      try { fs.unlinkSync(qpFile.path); fs.unlinkSync(memoFile.path); } catch (e) {}
      if (code !== 0) {
        return res.status(500).json({ error: 'Parser failed', details: error, exitCode: code });
      }
      try {
        const parsedResult = JSON.parse(result);
        res.json(parsedResult);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse output', details: e.message, rawOutput: result });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', (req, res) => {
  if (!fs.existsSync(PARSER_API_PATH)) {
    return res.status(500).json({ error: 'parser_api.py not found', path: PARSER_API_PATH });
  }
  const pythonProcess = spawn(PYTHON_PATH, [PARSER_API_PATH, 'status']);
  let result = '';
  let errorOut = '';
  pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
  pythonProcess.stderr.on('data', (data) => { errorOut += data.toString(); });
  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ error: 'Python failed', pythonAvailable: false, exitCode: code, stderr: errorOut });
    }
    try {
      const status = JSON.parse(result);
      res.json({ ...status, pythonAvailable: true, apiVersion: 'v20' });
    } catch (e) {
      res.status(500).json({ error: 'Invalid output', rawOutput: result });
    }
  });
});

module.exports = router;
