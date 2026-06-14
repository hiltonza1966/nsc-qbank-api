const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { PythonShell } = require('python-shell');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// ============================================================
// POST /api/wizard/extract-qp
// Uploads QP PDF, runs Python extraction, saves to parse_expected_structure
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

    if (existing.length > 0 && existing[0].status !== 'failed') {
      fs.unlinkSync(pdfPath);
      return res.status(409).json({
        error: 'Paper already parsed',
        session_id: existing[0].session_id,
        message: 'Use force_overwrite=true to re-parse'
      });
    }

    // Run Python extraction script
    const options = {
      args: [pdfPath, 'qp', paper_code],
      pythonPath: 'python3',
      pythonOptions: ['-u']
    };

    const results = await new Promise((resolve, reject) => {
      PythonShell.run('scripts/extract_dbe_paper.py', options, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const extracted = JSON.parse(results[0]);

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
        extracted.total_items, extracted.total_marks
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

    await conn.commit();
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      session_id: sessionId,
      paper_code: paper_code,
      total_items: extracted.total_items,
      total_marks: extracted.total_marks,
      items: extracted.items
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
    const options = {
      args: [pdfPath, 'memo', paper_code],
      pythonPath: 'python3',
      pythonOptions: ['-u']
    };

    const results = await new Promise((resolve, reject) => {
      PythonShell.run('scripts/extract_dbe_paper.py', options, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    const extracted = JSON.parse(results[0]);

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

    // Save memo items to parse_results with is_memo = 1
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

      await conn.execute(
        `INSERT INTO parse_results
         (session_id, paper_code, question_number, question_text,
          parser_extracted_marks, expected_marks, auto_corrected_marks,
          correction_status, reviewer_notes, is_memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          session_id, paper_code, item.number, item.text,
          item.marks, expectedMarks || 0, correctedMarks,
          status, notes, 1
        ]
      );
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
      items: extracted.items
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
// Returns current extraction status and summary
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

module.exports = router;
