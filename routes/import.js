const express = require('express');
const router = express.Router();
const crypto = require('crypto');

/**
 * POST /api/wizard/import
 * Moves validated staging data to production tables:
 * - parse_results (is_memo=0, correction_status IN ('validated','auto_corrected')) → item_master
 * - parse_results (is_memo=1) → item_memos (linked by question_number)
 * - Updates parse_sessions status to 'imported'
 */
router.post('/import', async (req, res) => {
  const conn = await req.db.getConnection();

  try {
    await conn.beginTransaction();

    const { session_id, paper_code } = req.body;

    if (!session_id || !paper_code) {
      return res.status(400).json({ error: 'session_id and paper_code required' });
    }

    // 1. Verify session is completed (review done)
    const [sessionRows] = await conn.execute(
      `SELECT * FROM parse_sessions WHERE session_id = ? AND status = 'completed'`,
      [session_id]
    );

    if (sessionRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Session not ready for import. Complete review first.',
        session_id
      });
    }

    const session = sessionRows[0];

    // 2. Derive lookup IDs from multiple sources
    // Priority: parse_sessions columns → lookup tables → defaults
    let yearId = null, gradeId = null, subjectId = null, paperId = null;
    let assessmentTypeId = null, assessmentBodyId = null;
    let subjectOfficialCode = paper_code.split('_')[0] || '';
    let subjectAlphaCode = paper_code.split('_')[0] || '';

    // Try parse_sessions first (may have these columns from memo-parser)
    if (session.year_id != null) yearId = session.year_id;
    if (session.grade_id != null) gradeId = session.grade_id;
    if (session.subject_id != null) subjectId = session.subject_id;
    if (session.paper_id != null) paperId = session.paper_id;
    if (session.assessment_type_id != null) assessmentTypeId = session.assessment_type_id;
    if (session.assessment_body_id != null) assessmentBodyId = session.assessment_body_id;

    // Fallback to lookup tables
    if (!subjectId || !subjectOfficialCode) {
      const [subjRows] = await conn.execute(
        `SELECT subject_id, subject_official_code, subject_alpha_code FROM lookup_subjects WHERE subject_code = ? OR subject_alpha_code = ? OR subject_official_code = ? LIMIT 1`,
        [paper_code.split('_')[0], paper_code.split('_')[0], paper_code.split('_')[0]]
      );
      if (subjRows.length > 0) {
        subjectId = subjRows[0].subject_id;
        subjectOfficialCode = subjRows[0].subject_official_code || subjectOfficialCode;
        subjectAlphaCode = subjRows[0].subject_alpha_code || subjectAlphaCode;
      }
    }

    if (!yearId) {
      const yearMatch = paper_code.match(/_(\d{4})$/);
      if (yearMatch) {
        const [yearRows] = await conn.execute(
          `SELECT year_id FROM lookup_years WHERE year_value = ? LIMIT 1`,
          [parseInt(yearMatch[1])]
        );
        if (yearRows.length > 0) yearId = yearRows[0].year_id;
      }
    }

    if (!gradeId) {
      const [gradeRows] = await conn.execute(
        `SELECT grade_id FROM lookup_grades WHERE grade_number = 12 LIMIT 1`
      );
      if (gradeRows.length > 0) gradeId = gradeRows[0].grade_id;
    }

    if (!assessmentTypeId) {
      const [typeRows] = await conn.execute(
        `SELECT assessment_type_id FROM lookup_assessment_types WHERE type_code = 'EXAM' LIMIT 1`
      );
      if (typeRows.length > 0) assessmentTypeId = typeRows[0].assessment_type_id;
    }

    if (!assessmentBodyId) {
      const [bodyRows] = await conn.execute(
        `SELECT assessment_body_id FROM lookup_assessment_bodies WHERE body_code = 'DBE' LIMIT 1`
      );
      if (bodyRows.length > 0) assessmentBodyId = bodyRows[0].assessment_body_id;
    }

    const paperNo = parseInt(session.paper_code?.split('_')[1]?.replace('P', '')) || parseInt(paper_code.split('_')[1]?.replace('P', '')) || 1;
    const sourceYear = parseInt(session.paper_code?.split('_').pop()) || parseInt(paper_code.split('_').pop()) || new Date().getFullYear();
    const userId = req.user?.user_id || req.user?.id || 1;

    // 3. Get all validated QP items from parse_results
    const [qpItems] = await conn.execute(
      `SELECT * FROM parse_results
       WHERE session_id = ? AND is_memo = 0
       AND correction_status IN ('validated', 'auto_corrected')
       ORDER BY question_number`,
      [session_id]
    );

    if (qpItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'No validated QP items found for import' });
    }

    // 4. Get all memo items for this session
    const [memoItems] = await conn.execute(
      `SELECT * FROM parse_results WHERE session_id = ? AND is_memo = 1`,
      [session_id]
    );

    const memoMap = new Map();
    memoItems.forEach(m => memoMap.set(m.question_number, m));

    // 5. Import each QP item to item_master
    const importedItems = [];
    const importedMemos = [];
    const skippedItems = [];

    for (const qpItem of qpItems) {
      // Check if item already exists (by source_paper_code + question_number)
      const [existingItems] = await conn.execute(
        `SELECT item_id FROM item_master
         WHERE source_paper_code = ? AND question_number = ?
         LIMIT 1`,
        [paper_code, qpItem.question_number]
      );

      if (existingItems.length > 0) {
        skippedItems.push({
          question_number: qpItem.question_number,
          reason: 'Item already exists in item_master',
          existing_item_id: existingItems[0].item_id
        });
        continue;
      }

      // Generate item_id and item_code
      const itemId = crypto.randomUUID();
      const itemCode = `${subjectOfficialCode}_${paperNo}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

      // Generate item_hash (SHA256 of question_text + question_number)
      const itemHash = crypto.createHash('sha256')
        .update(`${qpItem.question_text || ''}:${qpItem.question_number}`)
        .digest('hex');

      const marks = qpItem.user_corrected_marks || qpItem.auto_corrected_marks || qpItem.expected_marks || 0;

      // Determine item_type_id from parsed_type_id
      let itemTypeId = qpItem.parsed_type_id || 5;

      // Try to get question-specific metadata from expected structure
      let cognitiveLevelId = 2; // Understanding (default)
      let difficultyId = 2; // Medium (default)
      let capsSubtopicId = null;
      let capsReference = null;

      try {
        const [expectedItem] = await conn.execute(
          `SELECT cognitive_level_id, difficulty_id, caps_subtopic_id, caps_reference
           FROM parse_expected_structure
           WHERE paper_code = ? AND question_number = ?
           LIMIT 1`,
          [paper_code, qpItem.question_number]
        );
        if (expectedItem.length > 0) {
          if (expectedItem[0].cognitive_level_id != null) cognitiveLevelId = expectedItem[0].cognitive_level_id;
          if (expectedItem[0].difficulty_id != null) difficultyId = expectedItem[0].difficulty_id;
          if (expectedItem[0].caps_subtopic_id != null) capsSubtopicId = expectedItem[0].caps_subtopic_id;
          if (expectedItem[0].caps_reference != null) capsReference = expectedItem[0].caps_reference;
        }
      } catch (e) {
        // parse_expected_structure may not have these columns - use defaults
        console.warn('Expected structure columns missing, using defaults:', e.message);
      }

      // Build parent_question and is_sub_part from question_number
      const qParts = String(qpItem.question_number || '').split('.');
      const parentQuestion = qParts.length > 2 ? qParts.slice(0, -1).join('.') : null;
      const isSubPart = qParts.length > 2 ? 1 : 0;

      // Insert into item_master
      await conn.execute(
        `INSERT INTO item_master
         (item_id, item_hash, subject_official_code, subject_alpha_code, paper_no,
          year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
          item_code, question_number, parent_question, is_sub_part,
          question_text, marks, marks_allocated, item_type_id,
          cognitive_level_id, difficulty_id, language_id, status, review_status,
          source_year, source_paper_code, source_question_number, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          itemHash,
          subjectOfficialCode,
          subjectAlphaCode,
          paperNo,
          yearId,
          gradeId,
          subjectId,
          paperId,
          assessmentTypeId,
          assessmentBodyId,
          itemCode,
          qpItem.question_number,
          parentQuestion,
          isSubPart,
          qpItem.question_text || '[No text]',
          marks,
          marks, // marks_allocated = marks
          itemTypeId,
          cognitiveLevelId,
          difficultyId,
          1, // English
          'draft',
          'draft',
          sourceYear,
          paper_code,
          qpItem.question_number,
          userId
        ]
      );

      importedItems.push({
        item_id: itemId,
        item_code: itemCode,
        question_number: qpItem.question_number,
        marks: marks
      });

      // 6. Link memo if exists
      const memo = memoMap.get(qpItem.question_number);
      if (memo) {
        const memoId = crypto.randomUUID();
        await conn.execute(
          `INSERT INTO item_memos
           (memo_id, item_id, question_number, answer_text, marks, marking_guideline, is_current)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            memoId,
            itemId,
            memo.question_number,
            memo.question_text || '[No answer text]',
            memo.parser_extracted_marks || memo.expected_marks || 0,
            memo.question_text || null,
            1
          ]
        );
        importedMemos.push({
          memo_id: memoId,
          item_id: itemId,
          question_number: memo.question_number
        });
      }
    }

    // 7. Update session status to imported
    await conn.execute(
      `UPDATE parse_sessions SET status = 'imported' WHERE session_id = ?`,
      [session_id]
    );

    await conn.commit();

    res.json({
      success: true,
      message: 'Items imported to production database',
      session_id,
      paper_code,
      imported: {
        items: importedItems.length,
        memos: importedMemos.length,
        skipped: skippedItems.length,
        item_details: importedItems,
        memo_details: importedMemos,
        skipped_details: skippedItems
      }
    });

  } catch (error) {
    await conn.rollback();
    console.error('Import Error:', error);
    res.status(500).json({ error: 'Import failed', details: error.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/wizard/import-status/:session_id
 * Check if a session has been imported
 */
router.get('/import-status/:session_id', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT status FROM parse_sessions WHERE session_id = ?`,
      [req.params.session_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      session_id: req.params.session_id,
      status: rows[0].status,
      imported: rows[0].status === 'imported'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
