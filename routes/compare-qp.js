/**
 * QBank Comparison Engine - /api/wizard/compare-qp
 * 
 * Validates parser output against QB_questionP_Structure (gold standard)
 * Structure is extracted dynamically from each uploaded QP - NO HARDCODES
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * POST /api/wizard/compare-qp
 * Body: {
 *   paper_code: "LIFE_SC_P1_NOV_2025",
 *   paper_id: 123,
 *   parser_output: [
 *     { question_number: "1.1.1", question_text: "...", section: "Section A", type: "MCQ", marks: 2 },
 *     ...
 *   ],
 *   file_name: "LifeSciences_P1_Nov2025.pdf",
 *   file_hash: "sha256..."
 * }
 */
router.post('/compare-qp', async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    await conn.beginTransaction();

    const { paper_code, paper_id, parser_output, file_name, file_hash } = req.body;

    if (!paper_code || !Array.isArray(parser_output)) {
      return res.status(400).json({ error: 'paper_code and parser_output array required' });
    }

    const sessionId = crypto.randomUUID();

    // 1. Load expected structure from QB_questionP_Structure (DYNAMICALLY EXTRACTED)
    const [expectedRows] = await conn.execute(
      `SELECT question_number, question_type, section, expected_marks, sequence, parent_question, is_sub_part
       FROM QB_questionP_Structure 
       WHERE paper_code = ? 
       ORDER BY sequence`,
      [paper_code]
    );

    if (expectedRows.length === 0) {
      return res.status(404).json({ 
        error: 'Paper structure not found. Run extract-structure first.',
        paper_code 
      });
    }

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
          expected_marks: 0,
          auto_corrected_marks: parsedItem.marks || 0,
          correction_status: 'parser_missing',
          variance: null,
          is_red_flag: true,
          reason: 'Question not found in expected structure - may be extra or misnumbered'
        });
        manualReviewCount++;
        continue;
      }

      const parserMarks = parseInt(parsedItem.marks) || 0;
      totalParserMarks += parserMarks;

      let correctedMarks = parserMarks;
      let status = 'auto_corrected';
      let reason = '';

      if (parserMarks !== expected.expected_marks) {
        correctedMarks = expected.expected_marks;
        autoCorrectedCount++;
        reason = `Parser extracted ${parserMarks}, auto-corrected to ${expected.expected_marks}`;

        // RED FLAG conditions
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

    // 4. Check for missing questions
    const parserNumbers = new Set(parser_output.map(p => p.question_number));
    for (const [qNum, expected] of expectedMap) {
      if (!parserNumbers.has(qNum)) {
        results.push({
          question_number: qNum,
          question_text: '[NOT FOUND BY PARSER]',
          parsed_section: expected.section,
          parsed_type: expected.question_type,
          parser_extracted_marks: 0,
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

// ... rest of the file remains the same (save-corrections, comparison GET, structure GET/POST)

router.post('/save-corrections', async (req, res) => {
  const conn = await req.db.getConnection();

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

router.get('/comparison/:session_id', async (req, res) => {
  try {
    const [results] = await req.db.execute(
      `SELECT r.*, s.subject_name, s.paper_no
       FROM QB_parsed_results r
       JOIN QB_questionP_Structure s ON r.question_number = s.question_number AND r.paper_code = s.paper_code
       WHERE r.parse_session_id = ?
       ORDER BY s.sequence`,
      [req.params.session_id]
    );

    const [sessionRows] = await req.db.execute(
      `SELECT * FROM QB_parse_sessions WHERE session_id = ?`,
      [req.params.session_id]
    );

    const dbSession = sessionRows[0] || null;

    let totalExpectedItems = 0;
    if (dbSession) {
      const [countRows] = await req.db.execute(
        `SELECT COUNT(*) as item_count FROM QB_questionP_Structure WHERE paper_code = ?`,
        [dbSession.paper_code]
      );
      totalExpectedItems = countRows[0].item_count || 0;
    }

    const session = dbSession ? {
      session_id: dbSession.session_id,
      paper_code: dbSession.paper_code,
      total_expected_items: totalExpectedItems,
      total_parser_items: dbSession.total_items_found || 0,
      total_expected_marks: dbSession.total_marks_expected || 0,
      total_parser_marks: dbSession.total_marks_parser || 0,
      total_corrected_marks: dbSession.total_marks_corrected || 0,
      auto_corrected_count: dbSession.auto_corrected_count || 0,
      manual_review_count: dbSession.manual_review_count || 0,
      missing_count: dbSession.missing_count || 0,
      all_correct: (dbSession.auto_corrected_count || 0) === 0 && (dbSession.manual_review_count || 0) === 0 && (dbSession.missing_count || 0) === 0
    } : null;

    res.json({
      session: session,
      results: results,
      red_flags: results.filter(r => r.is_red_flag || r.correction_status === 'manual_review')
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/structure/:paper_code', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
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

router.post('/structure', async (req, res) => {
  try {
    const { paper_code, subject_name, paper_no, exam_year, exam_session, items } = req.body;

    const conn = await req.db.getConnection();
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