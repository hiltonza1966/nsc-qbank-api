const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * POST /api/wizard/compare-memo
 * Compares memo output against QP structure for alignment
 * Body: {
 *   paper_code: "LIFE_SC_P1_NOV_2025",
 *   paper_id: 123,
 *   memo_output: [
 *     { question_number: "1.1.1", answer_text: "...", marks: 2 },
 *     ...
 *   ],
 *   file_name: "Memo.pdf",
 *   file_hash: "sha256..."
 * }
 */
router.post('/compare-memo', async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    await conn.beginTransaction();

    const { paper_code, paper_id, memo_output, file_name, file_hash } = req.body;

    if (!paper_code || !Array.isArray(memo_output)) {
      return res.status(400).json({ error: 'paper_code and memo_output array required' });
    }

    const sessionId = crypto.randomUUID();

    // 1. Load QP structure (gold standard)
    const [expectedRows] = await conn.execute(
      `SELECT question_number, question_type, section, expected_marks, sequence
       FROM QB_questionP_Structure WHERE paper_code = ? ORDER BY sequence`,
      [paper_code]
    );

    if (expectedRows.length === 0) {
      return res.status(404).json({ error: 'Paper structure not found', paper_code });
    }

    const expectedMap = new Map();
    expectedRows.forEach(row => expectedMap.set(row.question_number, row));

    // 2. Create session
    await conn.execute(
      `INSERT INTO QB_parse_sessions (session_id, paper_code, file_name, file_hash, parser_version, total_marks_expected, status)
       VALUES (?, ?, ?, ?, 'memo-1.0', ?, 'comparing')`,
      [sessionId, paper_code, file_name || 'unknown', file_hash || 'unknown', expectedRows.reduce((s, r) => s + r.expected_marks, 0)]
    );

    // 3. Compare memo against QP structure
    const results = [];
    let alignedCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;

    for (const memoItem of memo_output) {
      const qNum = memoItem.question_number;
      const expected = expectedMap.get(qNum);

      if (!expected) {
        results.push({
          question_number: qNum,
          status: 'memo_extra',
          reason: 'Memo item not found in QP structure'
        });
        mismatchCount++;
        continue;
      }

      const memoMarks = parseInt(memoItem.marks) || 0;
      const status = memoMarks === expected.expected_marks ? 'aligned' : 'marks_mismatch';

      if (status === 'aligned') alignedCount++;
      else mismatchCount++;

      results.push({
        question_number: qNum,
        qp_marks: expected.expected_marks,
        memo_marks: memoMarks,
        status: status,
        reason: status === 'aligned' ? 'QP and Memo marks match' : `Memo marks (${memoMarks}) differ from QP (${expected.expected_marks})`
      });
    }

    // Check for missing memo items
    const memoNumbers = new Set(memo_output.map(m => m.question_number));
    for (const [qNum, expected] of expectedMap) {
      if (!memoNumbers.has(qNum)) {
        results.push({
          question_number: qNum,
          qp_marks: expected.expected_marks,
          memo_marks: null,
          status: 'memo_missing',
          reason: 'Memo missing for this question'
        });
        missingCount++;
      }
    }

    // 4. Update session
    await conn.execute(
      `UPDATE QB_parse_sessions SET total_items_found = ?, auto_corrected_count = ?, manual_review_count = ?, missing_count = ?, status = 'completed' WHERE session_id = ?`,
      [memo_output.length, alignedCount, mismatchCount, missingCount, sessionId]
    );

    await conn.commit();

    res.json({
      success: true,
      session_id: sessionId,
      summary: {
        total_expected: expectedRows.length,
        total_memo_items: memo_output.length,
        aligned: alignedCount,
        mismatches: mismatchCount,
        missing: missingCount,
        all_aligned: mismatchCount === 0 && missingCount === 0
      },
      results: results
    });

  } catch (error) {
    await conn.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
