const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

// ============================================================
// HELPER: Ensure directory exists
// ============================================================
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================
// HELPER: Save image from Python output
// ============================================================
function saveImageFromBase64(base64Data, outputPath) {
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

// ============================================================
// POST /api/wizard/extract-qp
// Uploads QP PDF, runs Python extraction, saves to parse_expected_structure
// Also extracts images and saves to uploads/wizard/{session_id}/
// Body: multipart form with 'pdf' file + 'paper_code', 'year_id', 'grade_id', 
//       'subject_id', 'paper_id', 'assessment_type_id', 'assessment_body_id'
// ============================================================
router.post('/extract-qp', upload.single('pdf'), async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    const {
      paper_code, year_id, grade_id, subject_id, paper_id,
      assessment_type_id, assessment_body_id
    } = req.body;

    if (!req.file || !paper_code) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'PDF file and paper_code required' });
    }

    const pdfPath = req.file.path;
    const fileHash = crypto.createHash('sha256').update(fs.readFileSync(pdfPath)).digest('hex');

    // Check for existing completed session
    const [existing] = await conn.execute(
      'SELECT session_id, status FROM parse_sessions WHERE paper_code = ? ORDER BY created_at DESC LIMIT 1',
      [paper_code]
    );

    if (existing.length > 0 && existing[0].status !== 'failed' && req.body.force_overwrite !== 'true') {
      fs.unlinkSync(pdfPath);
      return res.status(409).json({
        error: 'Paper already parsed',
        session_id: existing[0].session_id,
        message: 'Use force_overwrite=true to re-parse'
      });
    }

    // Run Python extraction script
    const pythonPath = 'C:\\Python314\\python.exe';
    const scriptPath = path.join(__dirname, '..', 'scripts', 'extract_dbe_paper.py');
    const pyArgs = [
      scriptPath,
      pdfPath,
      'qp',
      paper_code,
      paper_code.split('_')[0],
      paper_code.split('_')[1].replace('P', ''),
      paper_code.split('_')[3],
      paper_code.split('_')[2]
    ];

    const extracted = await new Promise((resolve, reject) => {
      const py = require('child_process').spawn(pythonPath, pyArgs, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 });
      let stdout = '';
      let stderr = '';
      py.stdout.on('data', (data) => { stdout += data.toString(); });
      py.stderr.on('data', (data) => { stderr += data.toString(); });
      py.on('close', (code) => {
        if (code !== 0) reject(new Error(`Python exited ${code}: ${stderr}`));
        else {
          try { resolve(JSON.parse(stdout)); }
          catch (e) { reject(new Error(`Invalid JSON: ${stdout}`)); }
        }
      });
    });

    if (extracted.error) {
      throw new Error(extracted.error);
    }

    // Create parse session
    const sessionId = crypto.randomUUID();
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO parse_sessions
       (session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
        paper_code, file_name, file_hash, parser_version,
        total_items_found, total_marks_parser, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'comparing')`,
      [
        sessionId,
        year_id || null, grade_id || null, subject_id || null, paper_id || null,
        assessment_type_id || null, assessment_body_id || null,
        paper_code, req.file.originalname, fileHash, 'py-mupdf-1.0',
        extracted.total_items ?? 0, extracted.total_marks ?? 0
      ]
    );

    // Clear existing expected structure for this paper
    await conn.execute(
      'DELETE FROM parse_expected_structure WHERE paper_code = ?',
      [paper_code]
    );

    // Insert extracted items into parse_expected_structure
    const typeMap = { 'MCQ': 1, 'Short': 2, 'Matching': 3, 'Diagram': 4, 'Extended': 5 };
    let sequence = 1;

    for (const item of extracted.items) {
      const typeId = typeMap[item.type] || 5;
      const parts = item.number.split('.');
      const parentQuestion = parts.length === 3 ? parts[0] + '.' + parts[1] : null;
      const isSubPart = parts.length === 3 ? 1 : 0;

      await conn.execute(
        `INSERT INTO parse_expected_structure
         (paper_code, question_number, question_type_id, section, expected_marks, sequence, parent_question, is_sub_part)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paper_code, item.number, typeId, item.section, item.marks,
          sequence++, parentQuestion, isSubPart
        ]
      );
    }

    // Save extracted images
    const imageDir = path.join(process.cwd(), 'uploads', 'wizard', sessionId);
    ensureDir(imageDir);
    const savedImages = [];

    if (extracted.images && Array.isArray(extracted.images)) {
      for (let i = 0; i < extracted.images.length; i++) {
        const img = extracted.images[i];
        const imgPath = path.join(imageDir, `img_${String(i + 1).padStart(3, '0')}.png`);
        saveImageFromBase64(img.base64, imgPath);
        savedImages.push({
          path: imgPath.replace(process.cwd(), ''),
          page: img.page,
          question_number: img.question_number || null
        });
      }
    }

    await conn.commit();
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      session_id: sessionId,
      paper_code: paper_code,
      total_items: extracted.total_items,
      total_marks: extracted.total_marks,
      items: extracted.items,
      images: savedImages
    });

  } catch (error) {
    await conn.rollback();
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Extract-QP Error:', error);
    res.status(500).json({ error: 'Extraction failed', details: error.message });
  } finally {
    conn.release();
  }
});

// ============================================================
// POST /api/wizard/extract-memo
// Uploads Memo PDF, runs Python extraction, saves to parse_results
// Also extracts images and saves to uploads/wizard/{session_id}/
// Body: multipart form with 'pdf' file + 'paper_code', 'session_id'
// ============================================================
router.post('/extract-memo', upload.single('pdf'), async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    const { paper_code, session_id } = req.body;

    if (!req.file || !paper_code || !session_id) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'PDF file, paper_code, and session_id required' });
    }

    const pdfPath = req.file.path;

    // Run Python extraction script
    const pythonPath = 'C:\\Python314\\python.exe';
    const scriptPath = path.join(__dirname, '..', 'scripts', 'extract_dbe_paper.py');
    const pyArgs = [
      scriptPath,
      pdfPath,
      'memo',
      paper_code.split('_')[0],
      paper_code.split('_')[1].replace('P', ''),
      paper_code.split('_')[3],
      paper_code.split('_')[2]
    ];

    const extracted = await new Promise((resolve, reject) => {
      const py = require('child_process').spawn(pythonPath, pyArgs, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 });
      let stdout = '';
      let stderr = '';
      py.stdout.on('data', (data) => { stdout += data.toString(); });
      py.stderr.on('data', (data) => { stderr += data.toString(); });
      py.on('close', (code) => {
        if (code !== 0) reject(new Error(`Python exited ${code}: ${stderr}`));
        else {
          try { resolve(JSON.parse(stdout)); }
          catch (e) { reject(new Error(`Invalid JSON: ${stdout}`)); }
        }
      });
    });

    if (extracted.error) {
      throw new Error(extracted.error);
    }

    await conn.beginTransaction();

    // Load expected structure for mark matching
    const [expectedRows] = await conn.execute(
      'SELECT question_number, expected_marks FROM parse_expected_structure WHERE paper_code = ?',
      [paper_code]
    );
    const expectedMap = new Map();
    expectedRows.forEach(row => expectedMap.set(row.question_number, row.expected_marks));

    let linked = 0;
    let unlinked = 0;

    for (const item of extracted.items) {
      const expectedMarks = expectedMap.get(item.number);
      const isLinked = expectedMarks !== undefined;
      if (isLinked) linked++;
      else unlinked++;

      const correctedMarks = expectedMarks !== undefined ? expectedMarks : item.marks;
      const status = isLinked ? 'validated' : 'manual_review';
      const notes = isLinked ? 'Memo matched to QP' : 'Memo item not found in QP';

      // INSERT IGNORE with is_memo=1
      await conn.execute(
        `INSERT IGNORE INTO parse_results
         (session_id, paper_code, question_number, question_text,
          parser_extracted_marks, expected_marks, auto_corrected_marks,
          correction_status, reviewer_notes, is_memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          session_id, paper_code, item.number, item.text,
          item.marks, expectedMarks || 0, correctedMarks,
          status, notes
        ]
      );
    }

    // Save extracted images
    const imageDir = path.join(process.cwd(), 'uploads', 'wizard', session_id, 'memo');
    ensureDir(imageDir);
    const savedImages = [];

    if (extracted.images && Array.isArray(extracted.images)) {
      for (let i = 0; i < extracted.images.length; i++) {
        const img = extracted.images[i];
        const imgPath = path.join(imageDir, `img_${String(i + 1).padStart(3, '0')}.png`);
        saveImageFromBase64(img.base64, imgPath);
        savedImages.push({
          path: imgPath.replace(process.cwd(), ''),
          page: img.page,
          question_number: img.question_number || null
        });
      }
    }

    // Update session with memo totals
    await conn.execute(
      `UPDATE parse_sessions SET
       total_marks_expected = (SELECT SUM(expected_marks) FROM parse_expected_structure WHERE paper_code = ?),
       status = 'completed'
       WHERE session_id = ?`,
      [paper_code, session_id]
    );

    await conn.commit();
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      session_id: session_id,
      total_items: extracted.total_items,
      total_marks: extracted.total_marks,
      linked: linked,
      unlinked: unlinked,
      items: extracted.items,
      images: savedImages
    });

  } catch (error) {
    await conn.rollback();
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Extract-Memo Error:', error);
    res.status(500).json({ error: 'Memo extraction failed', details: error.message });
  } finally {
    conn.release();
  }
});

// ============================================================
// GET /api/wizard/extraction-status/:session_id
// ============================================================
router.get('/extraction-status/:session_id', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT session_id, paper_code, status, total_items_found, total_marks_parser,
              total_marks_expected, auto_corrected_count, manual_review_count, missing_count
       FROM parse_sessions WHERE session_id = ?`,
      [req.params.session_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /comparison/:session_id - Full comparison results for review
// NOW INCLUDES QP data from parse_expected_structure
// ============================================================
router.get('/comparison/:session_id', async (req, res) => {
  try {
    const [results] = await req.db.execute(
      `SELECT 
        r.result_id,
        r.question_number,
        r.question_text as memo_question_text,
        r.parsed_section,
        COALESCE(lit.type_name, 'Unknown') as parsed_type,
        r.parser_extracted_marks as memo_parser_marks,
        COALESCE(r.expected_marks, e.expected_marks) as expected_marks,
        r.auto_corrected_marks,
        r.correction_status,
        r.user_corrected_marks,
        r.reviewer_notes,
        r.variance,
        r.is_red_flag,
        r.is_memo,
        -- QP data from parse_expected_structure
        e.question_text as qp_question_text,
        e.expected_marks as qp_expected_marks,
        e.section as qp_section,
        e.question_type_id as qp_type_id
      FROM parse_results r
      LEFT JOIN parse_expected_structure e 
        ON r.question_number = e.question_number 
        AND r.paper_code = e.paper_code
      LEFT JOIN lookup_item_types lit
        ON r.parsed_type_id = lit.item_type_id
      WHERE r.session_id = ?
      ORDER BY r.question_number`,
      [req.params.session_id]
    );

    // Get images for this session
    const imageDir = path.join(process.cwd(), 'uploads', 'wizard', req.params.session_id);
    let qpImages = [];
    let memoImages = [];

    if (fs.existsSync(imageDir)) {
      try {
        const files = fs.readdirSync(imageDir);
        qpImages = files
          .filter(f => f.endsWith('.png'))
          .map(f => ({
            path: `/uploads/wizard/${req.params.session_id}/${f}`,
            filename: f
          }));
      } catch (e) { /* ignore */ }

      const memoImageDir = path.join(imageDir, 'memo');
      if (fs.existsSync(memoImageDir)) {
        try {
          const memoFiles = fs.readdirSync(memoImageDir);
          memoImages = memoFiles
            .filter(f => f.endsWith('.png'))
            .map(f => ({
              path: `/uploads/wizard/${req.params.session_id}/memo/${f}`,
              filename: f
            }));
        } catch (e) { /* ignore */ }
      }
    }

    const [sessionRows] = await req.db.execute(
      `SELECT session_id, paper_code, total_items_found, total_marks_parser, 
              total_marks_expected, auto_corrected_count, manual_review_count, missing_count
       FROM parse_sessions WHERE session_id = ?`,
      [req.params.session_id]
    );

    res.json({
      success: true,
      session: sessionRows[0] || null,
      results: results,
      images: {
        qp: qpImages,
        memo: memoImages
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /save-corrections - Save user corrections
// ============================================================
router.post('/save-corrections', async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    const { session_id, corrections } = req.body;

    if (!session_id || !Array.isArray(corrections)) {
      return res.status(400).json({ error: 'session_id and corrections array required' });
    }

    await conn.beginTransaction();

    for (const correction of corrections) {
      const { question_number, user_corrected_marks, notes } = correction;

      await conn.execute(
        `UPDATE parse_results 
         SET user_corrected_marks = ?, reviewer_notes = ?, correction_status = 'validated'
         WHERE session_id = ? AND question_number = ?`,
        [user_corrected_marks, notes || '', session_id, question_number]
      );
    }

    await conn.execute(
      `UPDATE parse_sessions SET status = 'reviewing' WHERE session_id = ?`,
      [session_id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Corrections saved', count: corrections.length });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
