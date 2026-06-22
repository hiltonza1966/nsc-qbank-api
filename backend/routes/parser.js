const express = require('express');
const router = express.Router();
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });
const PARSERS_DIR = path.join(__dirname, '..', 'backend', 'parsers');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// GET /api/parser/status - Check parser status
router.get('/status', async (req, res) => {
  try {
    const options = {
      mode: 'text',
      pythonPath: 'python',
      pythonOptions: ['-u'],
      scriptPath: PARSERS_DIR,
      args: ['status']
    };

    const results = await new Promise((resolve, reject) => {
      PythonShell.run('parser_api_v2.py', options, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const status = JSON.parse(results.join(''));
    res.json({ success: true, status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/parser/parse - Run full parser (QP + Memo)
router.post('/parse', upload.fields([
  { name: 'qpFile', maxCount: 1 },
  { name: 'memoFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const qpFile = req.files['qpFile']?.[0];
    const memoFile = req.files['memoFile']?.[0];
    const paperCode = req.body.paperCode || 'UNKNOWN';

    if (!qpFile || !memoFile) {
      return res.status(400).json({ success: false, error: 'Both QP and Memo files required' });
    }

    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });

    const options = {
      mode: 'text',
      pythonPath: 'python',
      pythonOptions: ['-u'],
      scriptPath: PARSERS_DIR,
      args: ['parse', qpFile.path, memoFile.path, paperCode, outputDir]
    };

    const results = await new Promise((resolve, reject) => {
      PythonShell.run('parser_api_v2.py', options, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const result = JSON.parse(results.join(''));
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/parser/parse-qp - Run QP parser only
router.post('/parse-qp', upload.single('qpFile'), async (req, res) => {
  try {
    const qpFile = req.file;
    const paperCode = req.body.paperCode || 'UNKNOWN';

    if (!qpFile) {
      return res.status(400).json({ success: false, error: 'QP file required' });
    }

    const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
    fs.mkdirSync(outputDir, { recursive: true });

    const options = {
      mode: 'text',
      pythonPath: 'python',
      pythonOptions: ['-u'],
      scriptPath: PARSERS_DIR,
      args: ['parse-qp', qpFile.path, paperCode, outputDir]
    };

    const results = await new Promise((resolve, reject) => {
      PythonShell.run('parser_api_v2.py', options, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const result = JSON.parse(results.join(''));
    res.json({ success: true, result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
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

// POST /api/parser/approve - Approve and import parsed items
router.post('/approve', async (req, res) => {
  try {
    const { items, paperCode } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Items array required' });
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
