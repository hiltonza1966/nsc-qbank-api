const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * Parse memo text items to extract question_number, answer_text, marks
 * Uses same logic as QP parser but looks for answer patterns
 */
function parseMemoItems(textItems) {
  const items = [];

  for (const item of textItems) {
    const text = item.text || '';

    // Look for question number patterns like 1.1.1, 2.1, etc.
    const qMatch = text.match(/^(\d+(?:\.\d+)?)\s*[.\)]?\s*(.*)/);
    if (qMatch) {
      const qnum = qMatch[1];
      const rest = qMatch[2];

      // Extract marks from text: (2) or [2] or 2 marks
      const marksMatch = rest.match(/\((\d+)\)|\[(\d+)\]|(\d+)\s*marks?/i);
      const marks = marksMatch ? parseInt(marksMatch[1] || marksMatch[2] || marksMatch[3]) : 0;

      // Clean answer text (remove marks notation)
      const answerText = rest.replace(/\(\d+\)|\[\d+\]|\d+\s*marks?/gi, '').trim();

      if (answerText.length > 3) {  // Only save if there's actual content
        items.push({
          question_number: qnum,
          answer_text: answerText,
          marks: marks,
          x: item.x,
          y: item.y,
          page: item.page
        });
      }
    }
  }

  return items;
}

/**
 * POST /api/wizard/extract-memo
 * Extracts memo items from PDF and saves to database
 */
router.post('/extract-memo', async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    const { textItems, paper_code, subject_name, paper_no, exam_year, exam_session } = req.body;

    if (!Array.isArray(textItems) || !paper_code) {
      return res.status(400).json({ error: 'textItems and paper_code required' });
    }

    await conn.beginTransaction();

    // 1. Parse memo items
    const memoItems = parseMemoItems(textItems);

    // 2. Get paper dimensions from parse_expected_structure
    const [paperRows] = await conn.execute(
      `SELECT DISTINCT year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id 
       FROM parse_expected_structure WHERE paper_code = ? LIMIT 1`,
      [paper_code]
    );

    const paperDims = paperRows[0] || {};

    // 3. Create memo session
    const sessionId = crypto.randomUUID();
    await conn.execute(
      `INSERT INTO parse_sessions 
       (session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
        file_name, file_hash, parser_version, total_items_found, total_marks_expected, 
        status, paper_code, is_memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'memo-1.0', ?, ?, 'completed', ?, 1)`,
      [
        sessionId,
        paperDims.year_id || null,
        paperDims.grade_id || null,
        paperDims.subject_id || null,
        paperDims.paper_id || null,
        paperDims.assessment_type_id || null,
        paperDims.assessment_body_id || null,
        `${paper_code}_memo`,
        crypto.createHash('sha256').update(JSON.stringify(textItems)).digest('hex'),
        memoItems.length,
        memoItems.reduce((s, i) => s + i.marks, 0),
        paper_code
      ]
    );

    // 4. Load expected structure for matching
    const [expectedRows] = await conn.execute(
      `SELECT question_number, expected_marks FROM parse_expected_structure WHERE paper_code = ?`,
      [paper_code]
    );
    const expectedMap = new Map();
    expectedRows.forEach(row => expectedMap.set(row.question_number, row.expected_marks));

    // 5. Save memo items to parse_results with is_memo flag
    let linked = 0;
    let unlinked = 0;

    for (const item of memoItems) {
      const expectedMarks = expectedMap.get(item.question_number);
      const isLinked = expectedMarks !== undefined;

      if (isLinked) linked++;
      else unlinked++;

      await conn.execute(
        `INSERT INTO parse_results 
         (session_id, paper_code, question_number, question_text, 
          parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, 
          auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, is_memo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          paper_code,
          item.question_number,
          item.answer_text,
          null,  // No type for memo items
          null,  // No section for memo items
          item.marks,
          expectedMarks || 0,
          expectedMarks || 0,
          isLinked ? 'validated' : 'manual_review',
          null,
          isLinked ? 'Memo matched to QP' : 'Memo item not found in QP',
          1
        ]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      session_id: sessionId,
      total_items: memoItems.length,
      linked: linked,
      unlinked: unlinked,
      total_marks: memoItems.reduce((s, i) => s + i.marks, 0),
      message: `Memo parsed: ${memoItems.length} items, ${linked} linked to QP, ${unlinked} unlinked`
    });

  } catch (error) {
    await conn.rollback();
    console.error('Memo extraction error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
