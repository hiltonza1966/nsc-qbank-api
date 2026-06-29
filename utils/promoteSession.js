const crypto = require('crypto');

/**
 * Shared promotion function - promotes parsed items from parse_results/parse_memos to item_master/item_memos
 * Used by both Import Wizard and Batch Parser
 * 
 * @param {Object} db - Database connection (mysql2/promise)
 * @param {Number} sessionId - parse_sessions.session_id
 * @param {String} paperCode - Paper code (e.g., ACCOUNTING_P1_2025_NOV_ENG)
 * @param {Object} dimensions - Dimension values
 * @param {Number} createdBy - User ID who created the items (default: 1)
 * @returns {Object} - Promotion results { inserted, skipped, total, memo_inserted, memo_skipped }
 */
async function promoteSessionToItemMaster(db, sessionId, paperCode, dimensions, createdBy = 1) {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 1. Look up subject info
    let subjectId = null;
    let subjectOfficialCode = null;
    let subjectAlphaCode = null;

    if (dimensions.subject_id) {
      // Import Wizard - already have subject_id
      const [subjectRows] = await db.execute(
        'SELECT subject_id, subject_official_code, subject_alpha_code FROM lookup_subjects WHERE subject_id = ? LIMIT 1',
        [dimensions.subject_id]
      );
      if (subjectRows.length > 0) {
        subjectId = subjectRows[0].subject_id;
        subjectOfficialCode = subjectRows[0].subject_official_code;
        subjectAlphaCode = subjectRows[0].subject_alpha_code;
      }
    } else if (dimensions.subject_alpha || dimensions.subject_name) {
      // Batch Parser - need to look up from parser_subject_code
      const [subjectRows] = await db.execute(
        'SELECT subject_id, subject_official_code, subject_alpha_code FROM lookup_subjects WHERE UPPER(parser_subject_code) = UPPER(?) OR UPPER(subject_alpha_code) = UPPER(?) OR UPPER(subject_name) = UPPER(?) LIMIT 1',
        [dimensions.subject_alpha || '', dimensions.subject_alpha || '', dimensions.subject_name || '']
      );
      if (subjectRows.length > 0) {
        subjectId = subjectRows[0].subject_id;
        subjectOfficialCode = subjectRows[0].subject_official_code;
        subjectAlphaCode = subjectRows[0].subject_alpha_code;
      }
    }

    // 2. Look up paper_id
    let paperId = null;
    if (dimensions.paper_id) {
      paperId = dimensions.paper_id;
    } else if (dimensions.paper_no) {
      const [paperRows] = await db.execute(
        'SELECT paper_id FROM lookup_papers WHERE paper_no = ? LIMIT 1',
        [dimensions.paper_no]
      );
      if (paperRows.length > 0) paperId = paperRows[0].paper_id;
    }

    // 3. Look up year_id
    let yearId = null;
    if (dimensions.year_id) {
      yearId = dimensions.year_id;
    } else if (dimensions.year) {
      const [yearRows] = await db.execute(
        'SELECT year_id FROM lookup_years WHERE year_value = ? LIMIT 1',
        [dimensions.year]
      );
      if (yearRows.length > 0) yearId = yearRows[0].year_id;
    }

    // 4. Determine language_id
    let languageId = 1; // Default English
    if (dimensions.language) {
      const lang = dimensions.language.toUpperCase();
      if (lang === 'AFR' || lang === 'AFRIKAANS') languageId = 2;
      else if (lang === 'ENG' || lang === 'ENGLISH') languageId = 1;
    }

    // 5. Get grade_id (default to 3 for Grade 12)
    const gradeId = dimensions.grade_id || 3;

    // 6. Get assessment IDs (default to 1)
    const assessmentTypeId = dimensions.assessment_type_id || 1;
    const assessmentBodyId = dimensions.assessment_body_id || 1;

    // 7. Get QP items from parse_results
    const [qpItems] = await db.execute(
      'SELECT result_id, session_id, paper_code, question_number, question_text, answer_text, parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag, user_corrected_marks, reviewer_notes, created_at, updated_at, is_memo, is_header, parent_header_id FROM parse_results WHERE session_id = ? AND (is_memo = 0 OR is_memo IS NULL) ORDER BY question_number',
      [sessionId]
    );

    // 8. Get memo items from parse_memos
    const [memoItems] = await db.execute(
      'SELECT memo_id, session_id, paper_code, question_number, question_text, answer_text, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, variance, is_red_flag, created_at, updated_at, is_header, parent_header_id FROM parse_memos WHERE session_id = ? ORDER BY question_number',
      [sessionId]
    );

    // 9. Create memo lookup by question_number
    const memoLookup = {};
    for (const m of memoItems) {
      memoLookup[m.question_number] = m;
    }

    // 10. Insert into item_master
    let inserted = 0;
    let skipped = 0;

    for (const item of qpItems) {
      const memo = memoLookup[item.question_number];
      const itemHash = crypto.createHash('sha256').update(paperCode + ':' + item.question_number).digest('hex').substring(0, 32);

      // Check if already exists
      const [existing] = await db.execute(
        'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ? LIMIT 1',
        [paperCode, item.question_number]
      );
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const qpMarks = item.parser_extracted_marks || 0;
      const memoMarks = memo ? (memo.auto_corrected_marks || memo.parser_extracted_marks || 0) : 0;
      const finalMarks = item.auto_corrected_marks || item.expected_marks || qpMarks;
      const expectedMarks = item.expected_marks || finalMarks;

      const sql = `INSERT INTO item_master (
        item_hash, subject_official_code, subject_alpha_code, paper_no, year_id, grade_id,
        subject_id, paper_id, assessment_type_id, assessment_body_id, item_code,
        question_number, parent_question, is_sub_part, stimulus_text, stimulus_id,
        question_text, question_text_afr, item_stem_latex, item_stem_html, item_stem_code,
        item_media_svg, item_media_audio, item_media_file, item_rubric_json, item_answer_json,
        tool_required, audit_log_id, item_type_id, cognitive_level_id, cognitive_level,
        difficulty_id, caps_topic_id, difficulty, language_id, marking_scheme_id, marks,
        marks_allocated, caps_subtopic_id, caps_reference, source_year, source_paper_code,
        source_question_number, status, review_status, current_version, exposure_count,
        last_used_date, facility_value, discrimination_index, is_retired, retired_reason,
        retired_at, created_by, created_at, updated_at, qp_marks, memo_marks,
        parser_confidence, published_at, published_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      const values = [
        itemHash, subjectOfficialCode || '', subjectAlphaCode || '', dimensions.paper_no || 0,
        yearId || 0, gradeId, subjectId || 0, paperId || 0,
        assessmentTypeId, assessmentBodyId, paperCode + '_' + item.question_number,
        item.question_number, item.parent_header_id ? item.question_number.split('.')[0] : null,
        item.parent_header_id ? 1 : 0,
        null, null,
        item.question_text || '', null, null, item.question_text || null,
        null, null, null, null, null, null,
        null, null, 1, 1, null, 1,
        null, null, languageId, null, finalMarks, expectedMarks, null,
        null, dimensions.year || '', paperCode, item.question_number, 'draft', 'draft',
        1, 0, null, null, null,
        0, null, null, createdBy, now, now,
        qpMarks, memoMarks,
        item.correction_status === 'auto_corrected' ? 'green' : 'yellow',
        null, null
      ];

      await db.execute(sql, values);
      inserted++;
    }

    // 11. Insert into item_memos
    let memoInserted = 0;
    let memoSkipped = 0;

    for (const item of qpItems) {
      const memo = memoLookup[item.question_number];
      if (!memo) {
        memoSkipped++;
        continue;
      }

      const [itemRows] = await db.execute(
        'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ? LIMIT 1',
        [paperCode, item.question_number]
      );
      if (itemRows.length === 0) {
        memoSkipped++;
        continue;
      }

      const itemId = itemRows[0].item_id;

      const [existingMemo] = await db.execute(
        'SELECT memo_id FROM item_memos WHERE item_id = ? LIMIT 1',
        [itemId]
      );
      if (existingMemo.length > 0) {
        memoSkipped++;
        continue;
      }

      try {
        await db.execute(
          `INSERT INTO item_memos (item_id, question_number, answer_text, marks, marking_scheme_id, cognitive_level_id, has_sub_parts, version_number, is_current, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId, item.question_number, memo.answer_text || null,
            memo.auto_corrected_marks || memo.parser_extracted_marks || 0,
            null, 1, item.parent_header_id ? 1 : 0, 1, 1, now, now
          ]
        );
        memoInserted++;
      } catch (memoErr) {
        console.error('Memo insert error:', paperCode, item.question_number, memoErr.message);
        memoSkipped++;
      }
    }

    return {
      inserted,
      skipped,
      total: qpItems.length,
      memo_inserted: memoInserted,
      memo_skipped: memoSkipped
    };
  } catch (e) {
    console.error('Auto-promote error:', e.message);
    return { error: e.message };
  }
}

module.exports = { promoteSessionToItemMaster };
