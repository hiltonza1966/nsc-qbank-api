/**
 * QBank Comparison Engine - /api/wizard/compare-qp
 * 
 * Validates parser output against QB_questionP_Structure (gold standard)
 * Auto-corrects marks when parser differs from expected
 * Flags RED for manual review when auto-correction uncertain
 * 
 * Database: nsc_qbank
 * Table: QB_questionP_Structure (expected), QB_parsed_results (actual), QB_parse_sessions (audit)
 */

const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// Database config - matches existing nsc_qbank connection
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'nsc_qbank',
  port: process.env.DB_PORT || 3306,
  connectionLimit: 10
};

const pool = mysql.createPool(dbConfig);

/**
 * POST /api/wizard/compare-qp
 * Body: {
 *   paper_code: "LIFE_SC_P1_NOV_2025",
 *   paper_id: 123,
 *   parser_output: [
 *     { question_number: "1.1.1", question_text: "...", section: "A", type: "MCQ", marks: 2 },
 *     ...
 *   ],
 *   file_name: "LifeSciences_P1_Nov2025.pdf",
 *   file_hash: "sha256..."
 * }
 */
router.post('/compare-qp', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { paper_code, paper_id, parser_output, file_name, file_hash } = req.body;

    if (!paper_code || !Array.isArray(parser_output)) {
      return res.status(400).json({ error: 'paper_code and parser_output array required' });
    }

    // Generate session ID for this parse run
    const sessionId = crypto.randomUUID();

    // 1. Load expected structure from QB_questionP_Structure (GOLD STANDARD)
    const [expectedRows] = await conn.execute(
      `SELECT question_number, question_type, section, expected_marks, sequence, parent_question, is_sub_part
       FROM QB_questionP_Structure 
       WHERE paper_code = ? 
       ORDER BY sequence`,
      [paper_code]
    );

    if (expectedRows.length === 0) {
      return res.status(404).json({ 
        error: 'Paper structure not found in QB_questionP_Structure',
        paper_code 
      });
    }

    // Create lookup map: question_number -> expected data
    const expectedMap = new Map();
    expectedRows.forEach(row => {
      expectedMap.set(row.question_number, row);
    });

    const totalExpectedMarks = expectedRows.reduce((sum, r) => sum + r.expected_marks, 0);
    const totalExpectedItems = expectedRows.length;

    // 2. Create parse session record
    await conn.execute(
      `INSERT INTO QB_parse_sessions 
       (session_id, paper_code, file_name, file_hash, parser_version, total_marks_expected, status)
       VALUES (?, ?, ?, ?, '1.0', ?, 'comparing')`,
      [sessionId, paper_code, file_name || 'unknown', file_hash || 'unknown', totalExpectedMarks]
    );

    // 3. Compare parser output against expected structure
    const results = [];
    let autoCorrectedCount = 0;
    let manualReviewCount = 0;
    let missingCount = 0;
    let totalParserMarks = 0;
    let totalCorrectedMarks = 0;

    // Process each parser item
    for (const parsedItem of parser_output) {
      const qNum = parsedItem.question_number;
      const expected = expectedMap.get(qNum);

      if (!expected) {
        // Parser found a question not in expected structure
        results.push({
          question_number: qNum,
          question_text: parsedItem.question_text,
          parsed_section: parsedItem.section,
          parsed_type: parsedItem.type,
          parser_extracted_marks: parsedItem.marks || 0,
          expected_marks: null,
          auto_corrected_marks: null,
          correction_status: 'parser_missing',
          variance: null,
          is_red_flag: true,
          reason: 'Question not found in expected structure'
        });
        manualReviewCount++;
        continue;
      }

      const parserMarks = parseInt(parsedItem.marks) || 0;
      totalParserMarks += parserMarks;

      let correctedMarks = parserMarks;
      let status = 'auto_corrected';
      let reason = '';

      // AUTO-CORRECTION LOGIC
      if (parserMarks !== expected.expected_marks) {
        // Parser marks differ from expected - AUTO-CORRECT
        correctedMarks = expected.expected_marks;
        autoCorrectedCount++;
        reason = `Parser extracted ${parserMarks}, auto-corrected to ${expected.expected_marks}`;

        // RED FLAG conditions (auto-correction uncertain):
        // 1. Parser marks = 0 (likely failed extraction)
        // 2. Parser marks > expected * 2 (way too high, possible batch error)
        // 3. Parser marks < expected / 2 (way too low)
        if (parserMarks === 0 || parserMarks > expected.expected_marks * 2 || parserMarks < expected.expected_marks / 2) {
          status = 'manual_review';
          manualReviewCount++;
          reason += ' - FLAGGED: Parser extraction highly unreliable';
        }
      } else {
        reason = 'Parser marks match expected - no correction needed';
      }

      totalCorrectedMarks += correctedMarks;

      results.push({
        question_number: qNum,
        question_text: parsedItem.question_text,
        parsed_section: parsedItem.section,
        parsed_type: parsedItem.type,
        parser_extracted_marks: parserMarks,
        expected_marks: expected.expected_marks,
        auto_corrected_marks: correctedMarks,
        correction_status: status,
        variance: correctedMarks - expected.expected_marks,
        is_red_flag: status === 'manual_review',
        reason: reason
      });
    }

    // 4. Check for missing questions (in expected but not in parser output)
    const parserNumbers = new Set(parser_output.map(p => p.question_number));
    for (const [qNum, expected] of expectedMap) {
      if (!parserNumbers.has(qNum)) {
        results.push({
          question_number: qNum,
          question_text: '[NOT FOUND BY PARSER]',
          parsed_section: expected.section,
          parsed_type: expected.question_type,
          parser_extracted_marks: null,
          expected_marks: expected.expected_marks,
          auto_corrected_marks: expected.expected_marks,
          correction_status: 'manual_review',
          variance: 0,
          is_red_flag: true,
          reason: 'Parser failed to detect this question - marks set to expected, requires manual review'
        });
        missingCount++;
        manualReviewCount++;
        totalCorrectedMarks += expected.expected_marks;
      }
    }

    // 5. Sort results by sequence
    results.sort((a, b) => {
      const seqA = expectedMap.get(a.question_number)?.sequence || 999;
      const seqB = expectedMap.get(b.question_number)?.sequence || 999;
      return seqA - seqB;
    });

    // 6. Save all results to QB_parsed_results
    for (const result of results) {
      await conn.execute(
        `INSERT INTO QB_parsed_results 
         (paper_id, parse_session_id, paper_code, question_number, question_text, 
          parsed_type, parsed_section, parser_extracted_marks, expected_marks, 
          auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          paper_id || 0,
          sessionId,
          paper_code,
          result.question_number,
          result.question_text,
          result.parsed_type,
          result.parsed_section,
          result.parser_extracted_marks,
          result.expected_marks,
          result.auto_corrected_marks,
          result.correction_status,
          result.reason
        ]
      );
    }

    // 7. Update session summary
    await conn.execute(
      `UPDATE QB_parse_sessions 
       SET total_items_found = ?, total_marks_parser = ?, total_marks_corrected = ?,
           auto_corrected_count = ?, manual_review_count = ?, missing_count = ?, status = 'auto_corrected'
       WHERE session_id = ?`,
      [parser_output.length, totalParserMarks, totalCorrectedMarks, 
       autoCorrectedCount, manualReviewCount, missingCount, sessionId]
    );

    await conn.commit();

    // 8. Return comparison report
    res.json({
      success: true,
      session_id: sessionId,
      paper_code,
      summary: {
        total_expected_items: totalExpectedItems,
        total_parser_items: parser_output.length,
        total_expected_marks: totalExpectedMarks,
        total_parser_marks: totalParserMarks,
        total_corrected_marks: totalCorrectedMarks,
        auto_corrected_count: autoCorrectedCount,
        manual_review_count: manualReviewCount,
        missing_count: missingCount,
        all_correct: autoCorrectedCount === 0 && manualReviewCount === 0 && missingCount === 0
      },
      results: results,
      red_flags: results.filter(r => r.is_red_flag)
    });

  } catch (error) {
    await conn.rollback();
    console.error('Compare-QP Error:', error);
    res.status(500).json({ error: 'Comparison failed', details: error.message });
  } finally {
    conn.release();
  }
});

/**
 * POST /api/wizard/save-corrections
 * Save manual corrections from review UI
 */
router.post('/save-corrections', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { session_id, corrections } = req.body;

    if (!session_id || !Array.isArray(corrections)) {
      return res.status(400).json({ error: 'session_id and corrections array required' });
    }

    await conn.beginTransaction();

    for (const correction of corrections) {
      await conn.execute(
        `UPDATE QB_parsed_results 
         SET user_corrected_marks = ?, correction_status = 'validated', reviewer_notes = ?
         WHERE parse_session_id = ? AND question_number = ?`,
        [correction.user_corrected_marks, correction.notes || '', session_id, correction.question_number]
      );
    }

    // Update session status
    await conn.execute(
      `UPDATE QB_parse_sessions SET status = 'completed', completed_at = NOW() WHERE session_id = ?`,
      [session_id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Corrections saved' });

  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/wizard/comparison/:session_id
 * Retrieve comparison results for review UI
 */
router.get('/comparison/:session_id', async (req, res) => {
  try {
    const [results] = await pool.execute(
      `SELECT r.*, s.subject_name, s.paper_no
       FROM QB_parsed_results r
       JOIN QB_questionP_Structure s ON r.question_number = s.question_number AND r.paper_code = s.paper_code
       WHERE r.parse_session_id = ?
       ORDER BY s.sequence`,
      [req.params.session_id]
    );

    const [session] = await pool.execute(
      `SELECT * FROM QB_parse_sessions WHERE session_id = ?`,
      [req.params.session_id]
    );

    res.json({
      session: session[0] || null,
      results: results,
      red_flags: results.filter(r => r.is_red_flag || r.correction_status === 'manual_review')
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wizard/structure/:paper_code
 * Get expected structure for a paper (for parser reference)
 */
router.get('/structure/:paper_code', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM QB_questionP_Structure WHERE paper_code = ? ORDER BY sequence`,
      [req.params.paper_code]
    );

    res.json({
      paper_code: req.params.paper_code,
      total_items: rows.length,
      total_marks: rows.reduce((s, r) => s + r.expected_marks, 0),
      items: rows
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wizard/structure
 * Add new paper structure (admin only)
 */
router.post('/structure', async (req, res) => {
  try {
    const { paper_code, subject_name, paper_no, exam_year, exam_session, items } = req.body;

    const conn = await pool.getConnection();
    await conn.beginTransaction();

    for (const item of items) {
      await conn.execute(
        `INSERT INTO QB_questionP_Structure 
         (paper_code, subject_name, paper_no, exam_year, exam_session, question_number, 
          question_type, section, expected_marks, sequence, parent_question, is_sub_part)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         expected_marks = VALUES(expected_marks), question_type = VALUES(question_type), 
         section = VALUES(section), updated_at = NOW()`,
        [paper_code, subject_name, paper_no, exam_year, exam_session, item.question_number,
         item.question_type, item.section, item.expected_marks, item.sequence, 
         item.parent_question || null, item.is_sub_part || false]
      );
    }

    await conn.commit();
    conn.release();

    res.json({ success: true, message: 'Structure saved', items_count: items.length });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
