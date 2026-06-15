const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// ============================================================
// POST /api/wizard/import
// Imports validated items from parse_results to item_master + item_memos
// Body: { session_id, paper_code, created_by }
// ============================================================
router.post('/import', async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    const { session_id, paper_code, created_by } = req.body;

    if (!session_id || !paper_code) {
      return res.status(400).json({ error: 'session_id and paper_code required' });
    }

    await conn.beginTransaction();

    // 1. Get all validated QP items from parse_results
    const [qpItems] = await conn.execute(
      `SELECT r.question_number, r.question_text, r.parsed_section,
              r.parser_extracted_marks, r.expected_marks, r.auto_corrected_marks,
              r.user_corrected_marks, r.correction_status,
              e.question_type_id, e.year_id, e.grade_id, e.subject_id,
              e.paper_id, e.assessment_type_id, e.assessment_body_id,
              s.subject_official_code, p.paper_no
       FROM parse_results r
       JOIN parse_expected_structure e ON r.question_number = e.question_number AND r.paper_code = e.paper_code
       LEFT JOIN lookup_subjects s ON e.subject_id = s.subject_id
       LEFT JOIN lookup_papers p ON e.paper_id = p.paper_id
       WHERE r.session_id = ? AND r.paper_code = ? AND r.is_memo = 0
         AND (r.correction_status = 'validated' OR r.correction_status = 'auto_corrected')`,
      [session_id, paper_code]
    );

    if (qpItems.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'No validated QP items found for import. Please review and validate items first.' });
    }

    // 2. Get memo items for linking
    const [memoItems] = await conn.execute(
      `SELECT question_number, question_text, auto_corrected_marks
       FROM parse_results
       WHERE session_id = ? AND paper_code = ? `,
      [session_id, paper_code]
    );
    const memoMap = new Map();
    memoItems.forEach(m => memoMap.set(m.question_number, m));

    // 3. Import each QP item to item_master
    const importedItems = [];
    const typeNameMap = { 1: 'MCQ', 2: 'Short', 3: 'Matching', 4: 'Diagram', 5: 'Extended' };

    for (const item of qpItems) {
      const subjectCode = item.subject_official_code || 'UNKNOWN';
      const paperNo = item.paper_no || 1;
      const itemCode = subjectCode + '_' + paperNo + '_' + crypto.randomBytes(4).toString('hex').toUpperCase();

      const finalMarks = item.user_corrected_marks !== null ? item.user_corrected_marks : item.auto_corrected_marks;
      const typeId = item.question_type_id || 5;
      const yearId = item.year_id || 1;
      const gradeId = item.grade_id || 3;
      const subjectId = item.subject_id || 1;
      const paperId = item.paper_id || 1;
      const assessmentTypeId = item.assessment_type_id || 1;
      const assessmentBodyId = item.assessment_body_id || 1;
      const creator = created_by || 1;
      const cognitiveLevelId = 2;
      const difficultyLevelId = 2;

      await conn.execute(
        `INSERT INTO item_master
         (item_code, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
          language_id, question_number, question_text, marks, marks_allocated, item_type_id,
          cognitive_level_id, difficulty_id, status,
          source_paper_code, source_question_number, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        [
          itemCode, yearId, gradeId, subjectId, paperId, assessmentTypeId, assessmentBodyId,
          1, item.question_number, item.question_text, finalMarks, finalMarks, typeId,
          cognitiveLevelId, difficultyLevelId,
          paper_code, item.question_number, creator
        ]
      );

      // Get inserted item_id
      const [inserted] = await conn.execute(
        'SELECT item_id FROM item_master WHERE item_code = ?',
        [itemCode]
      );
      const itemId = inserted[0].item_id;

      // 4. Insert memo if available
      const memo = memoMap.get(item.question_number);
      if (memo) {
        await conn.execute(
          `INSERT INTO item_memos (item_id, question_number, answer_text, marks)
           VALUES (?, ?, ?, ?)`,
          [itemId, item.question_number, memo.question_text, memo.auto_corrected_marks]
        );
      }

      importedItems.push({
        item_id: itemId,
        item_code: itemCode,
        question_number: item.question_number,
        marks: finalMarks,
        has_memo: !!memo
      });
    }

    // 5. Update session status to imported
    await conn.execute(
      `UPDATE parse_sessions SET status = 'imported' WHERE session_id = ?`,
      [session_id]
    );

    await conn.commit();

    res.json({
      success: true,
      imported_count: importedItems.length,
      items: importedItems
    });

  } catch (error) {
    await conn.rollback();
    console.error('Import Error:', error);
    res.status(500).json({ error: 'Import failed', details: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

