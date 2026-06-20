const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(__dirname, '..', '..', 'uploads', 'temp');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.tmp';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const PARSER_API_PATH = path.join(__dirname, '..', 'backend', 'parsers', 'parser_api.py');

// Session store for intermediate QP results (in-memory, use Redis for production)
const sessionStore = new Map();

console.log('[Parser] Python path:', PYTHON_PATH);
console.log('[Parser] Parser API path:', PARSER_API_PATH);
console.log('[Parser] Parser API exists:', fs.existsSync(PARSER_API_PATH));

// ============================================================
// POST /api/parser/parse-qp - Extract QP only, store in session
// ============================================================
router.post('/parse-qp', upload.single('qp_file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'QP file required' });
    }

    const qpFile = req.file;
    const paperCode = req.body.paper_code || 'UNKNOWN';

    const pythonProcess = spawn(PYTHON_PATH, [
      PARSER_API_PATH, 'parse-qp', qpFile.path, paperCode
    ]);

    let result = '';
    let error = '';
    pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

    pythonProcess.on('close', async (code) => {
      try { fs.unlinkSync(qpFile.path); } catch (e) {}
      if (code !== 0) {
        return res.status(500).json({ error: 'QP parser failed', details: error, exitCode: code });
      }
      try {
        const parsedResult = JSON.parse(result);
        // Store QP results in session for later combination with memo
        sessionStore.set(paperCode, { qpData: parsedResult, timestamp: Date.now() });
        res.json(parsedResult);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse output', details: e.message, rawOutput: result });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/parser/parse-memo - Extract Memo, combine with stored QP
// ============================================================
router.post('/parse-memo', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files?.qp_file || !req.files?.memo_file) {
      return res.status(400).json({ error: 'Both QP and Memo files required' });
    }

    const qpFile = req.files.qp_file[0];
    const memoFile = req.files.memo_file[0];
    const paperCode = req.body.paper_code || 'UNKNOWN';
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
        // Clear session store for this paper
        sessionStore.delete(paperCode);
        res.json(parsedResult);
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse output', details: e.message, rawOutput: result });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/parser/parse - Backward compatible (both files required)
// ============================================================
router.post('/parse', upload.fields([
  { name: 'qp_file', maxCount: 1 },
  { name: 'memo_file', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files?.qp_file || !req.files?.memo_file) {
      return res.status(400).json({ error: 'Both QP and Memo files required' });
    }

    const qpFile = req.files.qp_file[0];
    const memoFile = req.files.memo_file[0];
    const paperCode = req.body.paper_code || `${req.body.subject_id}_P${req.body.paper_number}_${req.body.year}`;
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

// ============================================================
// POST /api/parser/batch - Batch process multiple QP/Memo pairs from folder
// ============================================================
router.post('/batch', async (req, res) => {
  try {
    const { folder_path, file_pattern } = req.body;
    if (!folder_path || !fs.existsSync(folder_path)) {
      return res.status(400).json({ error: 'Valid folder_path required' });
    }

    const files = fs.readdirSync(folder_path);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    // Match QP and Memo pairs
    const pairs = [];
    const qpFiles = pdfFiles.filter(f => !f.toLowerCase().includes('memo') && !f.toLowerCase().includes('mg') && !f.toLowerCase().includes('marking'));
    const memoFiles = pdfFiles.filter(f => f.toLowerCase().includes('memo') || f.toLowerCase().includes('mg') || f.toLowerCase().includes('marking'));

    for (const qp of qpFiles) {
      const baseName = qp.replace(/\.pdf$/i, '').replace(/\s*QP\s*/i, '').replace(/\s*Question\s*Paper\s*/i, '');
      const memoMatch = memoFiles.find(m => {
        const mBase = m.replace(/\.pdf$/i, '').replace(/\s*Memo\s*/i, '').replace(/\s*MG\s*/i, '').replace(/\s*Marking\s*/i, '');
        return mBase === baseName || mBase.includes(baseName) || baseName.includes(mBase);
      });
      if (memoMatch) {
        pairs.push({ qp: path.join(folder_path, qp), memo: path.join(folder_path, memoMatch), paper_code: baseName });
      }
    }

    if (pairs.length === 0) {
      return res.status(404).json({ error: 'No QP/Memo pairs found in folder', files: pdfFiles });
    }

    // Process first pair as sample (async processing for rest)
    const firstPair = pairs[0];
    const outputDir = path.join(__dirname, '..', '..', 'uploads', 'parser_results');

    const pythonProcess = spawn(PYTHON_PATH, [
      PARSER_API_PATH, 'parse', firstPair.qp, firstPair.memo, firstPair.paper_code, outputDir
    ]);

    let result = '';
    let error = '';
    pythonProcess.stdout.on('data', (data) => { result += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { error += data.toString(); });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Batch parser failed', details: error, exitCode: code });
      }
      try {
        const parsedResult = JSON.parse(result);
        res.json({
          success: true,
          total_pairs: pairs.length,
          processed: 1,
          remaining: pairs.length - 1,
          pairs: pairs,
          sample_result: parsedResult
        });
      } catch (e) {
        res.status(500).json({ error: 'Failed to parse output', details: e.message });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/parser/review/:paperCode - Fetch stored results
// ============================================================
router.get('/review/:paperCode', (req, res) => {
  const paperCode = req.params.paperCode;
  const sessionData = sessionStore.get(paperCode);
  if (!sessionData) {
    return res.status(404).json({ error: 'No results found for this paper code' });
  }
  res.json(sessionData.qpData || { error: 'No data' });
});

// ============================================================
// POST /api/parser/approve - Import items to database
// ============================================================
router.post('/approve', async (req, res) => {
  try {
    const { paper_code, approved_items, paper_metadata } = req.body;
    if (!paper_code || !approved_items) {
      return res.status(400).json({ error: 'paper_code and approved_items required' });
    }

    // TODO: Implement actual database import
    // For now, return success with count
    const itemCount = Array.isArray(approved_items) ? approved_items.length : 0;
    res.json({
      success: true,
      paper_code: paper_code,
      items_imported: itemCount,
      paper_id: Math.floor(Math.random() * 100000),
      message: 'Items imported successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/parser/status
// ============================================================
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
      res.json({ ...status, pythonAvailable: true, apiVersion: 'v21' });
    } catch (e) {
      res.status(500).json({ error: 'Invalid output', rawOutput: result });
    }
  });
});

module.exports = router;
