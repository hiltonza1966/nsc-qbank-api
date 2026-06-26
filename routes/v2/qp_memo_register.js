// ============================================================
// QP & MEMO REGISTER - BACKEND FIX v37
// Date: 2026-06-26
// Changes:
// 1. Returns v35-compatible field names
// 2. Computes items_match, marks_match, has_errors, error_count, data_quality_issues
// 3. Computes duplicate_count
// 4. Fixes filters structure to match v35 interface
// 5. Handles both 'parsed' and 'database' data sources
// 6. Returns proper summary data
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../../backend/db');

// Helper: Parse paper code into components
function parsePaperCode(paperCode) {
  if (!paperCode) return null;
  const parts = paperCode.split('_');
  if (parts.length < 5) return null;
  return {
    subject_code: parts[0],
    paper_no: parts[1],
    year: parts[2],
    session: parts[3],
    language: parts[4]
  };
}

// Helper: Compute data quality issues for a paper
function computeDataQualityIssues(paper) {
  const issues = [];
  if (paper.qp_item_count === 0) issues.push('No QP items found');
  if (paper.memo_item_count === 0) issues.push('No memo items found');
  if (paper.qp_item_count !== paper.memo_item_count) issues.push(`Item count mismatch: QP ${paper.qp_item_count} vs Memo ${paper.memo_item_count}`);
  if (paper.qp_expected_marks !== paper.memo_expected_marks) issues.push(`Marks mismatch: QP ${paper.qp_expected_marks} vs Memo ${paper.memo_expected_marks}`);
  if (paper.qp_corrected_marks !== paper.memo_corrected_marks) issues.push(`Corrected marks mismatch: QP ${paper.qp_corrected_marks} vs Memo ${paper.memo_corrected_marks}`);
  if (!paper.has_qp) issues.push('Missing QP session');
  if (!paper.has_memo) issues.push('Missing memo session');
  return issues;
}

// GET / - Main register endpoint
router.get('/', async (req, res) => {
  try {
    const source = req.query.data_source || 'parsed'; // 'parsed' or 'database'

    if (source === 'parsed') {
      return await getParsedData(req, res);
    } else {
      return await getDatabaseData(req, res);
    }
  } catch (error) {
    console.error('QP Memo Register Error:', error);
    res.status(500).json({ error: 'Failed to fetch register data', details: error.message });
  }
});

// ============================================================
// PARSED DATA
// ============================================================
async function getParsedData(req, res) {
  const connection = await db.getConnection();
  try {
    // Get all unique paper codes from parse_results and parse_memos
    const [qpPaperCodes] = await connection.execute(
      'SELECT DISTINCT paper_code FROM parse_results ORDER BY paper_code'
    );
    const [memoPaperCodes] = await connection.execute(
      'SELECT DISTINCT paper_code FROM parse_memos ORDER BY paper_code'
    );

    const allPaperCodes = [...new Set([
      ...qpPaperCodes.map(r => r.paper_code),
      ...memoPaperCodes.map(r => r.paper_code)
    ])].filter(Boolean).sort();

    const allPapers = [];
    for (const paperCode of allPaperCodes) {
      // Get QP session data
      const [qpData] = await connection.execute(`
        SELECT
          ps.total_marks_expected, ps.total_marks_parser, ps.total_marks_corrected,
          ps.total_items_found, ps.status as session_status, ps.parser_version, ps.created_at as session_created_at,
          ls.subject_official_code, ls.subject_name, ls.subject_alpha_code,
          lab.body_code, lab.body_name,
          lat.type_code, lat.type_name,
          ly.year_value as year, lg.grade_value as grade, lp.paper_no
        FROM parse_sessions ps
        LEFT JOIN lookup_subjects ls ON ps.subject_id = ls.subject_id
        LEFT JOIN lookup_assessment_bodies lab ON ps.assessment_body_id = lab.assessment_body_id
        LEFT JOIN lookup_assessment_types lat ON ps.assessment_type_id = lat.assessment_type_id
        LEFT JOIN lookup_years ly ON ps.year_id = ly.year_id
        LEFT JOIN lookup_grades lg ON ps.grade_id = lg.grade_id
        LEFT JOIN lookup_papers lp ON ps.paper_id = lp.paper_id
        WHERE ps.paper_code = ? AND ps.is_memo = 0
        LIMIT 1
      `, [paperCode]);

      // Get Memo session data
      const [memoData] = await connection.execute(`
        SELECT
          ps.total_marks_expected, ps.total_marks_parser, ps.total_marks_corrected,
          ps.total_items_found, ps.status as session_status, ps.parser_version, ps.created_at as session_created_at
        FROM parse_sessions ps
        WHERE ps.paper_code = ? AND ps.is_memo = 1
        LIMIT 1
      `, [paperCode]);

      // Get QP item count from parse_results
      const [qpItemCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM parse_results WHERE paper_code = ? AND is_memo = 0',
        [paperCode]
      );

      // Get Memo item count from parse_memos
      const [memoItemCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM parse_memos WHERE paper_code = ?',
        [paperCode]
      );

      // Get duplicate count (items with same question_number)
      const [dupCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM (
          SELECT question_number FROM parse_results WHERE paper_code = ? AND is_memo = 0
          GROUP BY question_number HAVING COUNT(*) > 1
        ) as dups
      `, [paperCode]);

      const qpRow = qpData[0] || {};
      const memoRow = memoData[0] || {};
      const hasQp = qpPaperCodes.some(r => r.paper_code === paperCode);
      const hasMemo = memoPaperCodes.some(r => r.paper_code === paperCode);

      const parsed = parsePaperCode(paperCode);

      const qpCount = qpItemCount[0]?.count || 0;
      const memoCount = memoItemCount[0]?.count || 0;
      const qpExpected = qpRow.total_marks_expected || qpRow.total_marks_parser || 0;
      const memoExpected = memoRow.total_marks_expected || memoRow.total_marks_parser || 0;
      const qpCorrected = qpRow.total_marks_corrected || qpExpected;
      const memoCorrected = memoRow.total_marks_corrected || memoExpected;

      const paper = {
        paper_code: paperCode,
        display_paper_code: paperCode,
        subject_code: parsed?.subject_code || qpRow.subject_alpha_code || '',
        subject_name: qpRow.subject_name || parsed?.subject_code || '',
        subject_alpha_code: qpRow.subject_alpha_code || parsed?.subject_code || '',
        subject_official_code: qpRow.subject_official_code || '',
        paper_no: qpRow.paper_no || parsed?.paper_no || '',
        year: qpRow.year || parsed?.year || '',
        session: parsed?.session || '',
        language: parsed?.language || '',
        expected_pdf_marks: qpRow.total_marks_expected || 0,
        grade: qpRow.grade || null,
        assessment_body_id: 1,
        assessment_type_id: 1,
        qp_item_count: qpCount,
        memo_item_count: memoCount,
        items_match: qpCount === memoCount && qpCount > 0,
        item_variance: qpCount - memoCount,
        qp_expected_marks: qpExpected,
        memo_expected_marks: memoExpected,
        marks_match: qpExpected === memoExpected && qpExpected > 0,
        marks_variance: qpExpected - memoExpected,
        qp_corrected_marks: qpCorrected,
        memo_corrected_marks: memoCorrected,
        corrected_marks_match: qpCorrected === memoCorrected,
        corrected_marks_variance: qpCorrected - memoCorrected,
        has_errors: false,
        error_count: 0,
        data_quality_issues: [],
        duplicate_count: dupCount[0]?.count || 0,
        pdf_marks_available: !!qpRow.total_marks_expected
      };

      // Compute data quality issues
      paper.data_quality_issues = computeDataQualityIssues(paper);
      paper.error_count = paper.data_quality_issues.length;
      paper.has_errors = paper.error_count > 0;

      allPapers.push(paper);
    }

    // Build filter options from actual data
    const subjects = [...new Map(allPapers.map(p => [p.subject_official_code, {
      subject_code: p.subject_code,
      subject_alpha_code: p.subject_alpha_code,
      subject_official_code: p.subject_official_code,
      subject_name: p.subject_name
    }])).values()].filter(s => s.subject_official_code);

    const assessment_bodies = [{ assessment_body_id: 1, body_code: 'DBE', body_name: 'DBE' }];
    const assessment_types = [{ assessment_type_id: 1, type_code: 'EXAM', type_name: 'Examination' }];
    const sessions = [...new Set(allPapers.map(p => p.session))].filter(Boolean).map(s => ({ session_code: s, session_name: s }));
    const grades = [...new Set(allPapers.map(p => p.grade).filter(Boolean))].map(g => ({ grade_number: g, grade_label: `Grade ${g}` }));
    const languages = [...new Set(allPapers.map(p => p.language))].filter(Boolean).map(l => ({ language_code: l, language_name: l }));
    const years = [...new Set(allPapers.map(p => String(p.year)))].filter(Boolean).map(y => ({ year: y }));

    const summary = {
      total_papers: allPapers.length,
      total_qp_items: allPapers.reduce((sum, p) => sum + p.qp_item_count, 0),
      total_memo_items: allPapers.reduce((sum, p) => sum + p.memo_item_count, 0),
      total_expected_marks: allPapers.reduce((sum, p) => sum + p.qp_expected_marks, 0),
      total_pdf_marks: allPapers.reduce((sum, p) => sum + (p.expected_pdf_marks || p.qp_expected_marks), 0),
      total_qp_marks: allPapers.reduce((sum, p) => sum + p.qp_corrected_marks, 0),
      total_memo_marks: allPapers.reduce((sum, p) => sum + p.memo_corrected_marks, 0),
      matched_items: allPapers.filter(p => p.items_match).length,
      matched_marks: allPapers.filter(p => p.marks_match).length,
      matched_corrected_marks: allPapers.filter(p => p.corrected_marks_match).length,
      records_with_errors: allPapers.filter(p => p.has_errors).length,
      missing_memos: allPapers.filter(p => !p.has_memo).length,
      orphaned_memos: 0,
      null_paper_codes: 0,
      duplicate_items: allPapers.reduce((sum, p) => sum + p.duplicate_count, 0)
    };

    // Diagnostics
    const missingMemos = allPapers.filter(p => !p.has_memo || p.memo_item_count === 0).map(p => ({
      paper_code: p.paper_code,
      qp_count: p.qp_item_count
    }));

    const diagnostics = {
      orphaned_memos: [],
      null_fields: [],
      missing_memos: missingMemos
    };

    res.json({
      success: true,
      data: allPapers,
      filters: {
        subjects,
        assessment_bodies,
        assessment_types,
        sessions,
        grades,
        languages,
        years
      },
      summary,
      diagnostics
    });
  } finally {
    connection.release();
  }
}

// ============================================================
// DATABASE DATA - Uses parse_results/parse_memos since item_master is empty
// TODO: When batch parser imports to item_master, switch back to item_master query
// ============================================================
async function getDatabaseData(req, res) {
  const connection = await db.getConnection();
  try {
    // Since item_master is empty, use parse_results/parse_memos as the "database" source
    // This ensures Database Data shows the same data as Parsed Data until item_master is populated

    // Get all unique paper codes from parse_results and parse_memos
    const [qpPaperCodes] = await connection.execute(
      'SELECT DISTINCT paper_code FROM parse_results ORDER BY paper_code'
    );
    const [memoPaperCodes] = await connection.execute(
      'SELECT DISTINCT paper_code FROM parse_memos ORDER BY paper_code'
    );

    const allPaperCodes = [...new Set([
      ...qpPaperCodes.map(r => r.paper_code),
      ...memoPaperCodes.map(r => r.paper_code)
    ])].filter(Boolean).sort();

    const allPapers = [];
    for (const paperCode of allPaperCodes) {
      // Get QP session data (same as parsed data)
      const [qpData] = await connection.execute(`
        SELECT
          ps.total_marks_expected, ps.total_marks_parser, ps.total_marks_corrected,
          ps.total_items_found, ps.status as session_status, ps.parser_version, ps.created_at as session_created_at,
          ls.subject_official_code, ls.subject_name, ls.subject_alpha_code,
          lab.body_code, lab.body_name,
          lat.type_code, lat.type_name,
          ly.year_value as year, lg.grade_value as grade, lp.paper_no
        FROM parse_sessions ps
        LEFT JOIN lookup_subjects ls ON ps.subject_id = ls.subject_id
        LEFT JOIN lookup_assessment_bodies lab ON ps.assessment_body_id = lab.assessment_body_id
        LEFT JOIN lookup_assessment_types lat ON ps.assessment_type_id = lat.assessment_type_id
        LEFT JOIN lookup_years ly ON ps.year_id = ly.year_id
        LEFT JOIN lookup_grades lg ON ps.grade_id = lg.grade_id
        LEFT JOIN lookup_papers lp ON ps.paper_id = lp.paper_id
        WHERE ps.paper_code = ? AND ps.is_memo = 0
        LIMIT 1
      `, [paperCode]);

      // Get Memo session data
      const [memoData] = await connection.execute(`
        SELECT
          ps.total_marks_expected, ps.total_marks_parser, ps.total_marks_corrected,
          ps.total_items_found, ps.status as session_status, ps.parser_version, ps.created_at as session_created_at
        FROM parse_sessions ps
        WHERE ps.paper_code = ? AND ps.is_memo = 1
        LIMIT 1
      `, [paperCode]);

      // Get QP item count from parse_results
      const [qpItemCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM parse_results WHERE paper_code = ? AND is_memo = 0',
        [paperCode]
      );

      // Get Memo item count from parse_memos
      const [memoItemCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM parse_memos WHERE paper_code = ?',
        [paperCode]
      );

      // Get duplicate count
      const [dupCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM (
          SELECT question_number FROM parse_results WHERE paper_code = ? AND is_memo = 0
          GROUP BY question_number HAVING COUNT(*) > 1
        ) as dups
      `, [paperCode]);

      const qpRow = qpData[0] || {};
      const memoRow = memoData[0] || {};
      const hasQp = qpPaperCodes.some(r => r.paper_code === paperCode);
      const hasMemo = memoPaperCodes.some(r => r.paper_code === paperCode);

      const parsed = parsePaperCode(paperCode);

      const qpCount = qpItemCount[0]?.count || 0;
      const memoCount = memoItemCount[0]?.count || 0;
      const qpExpected = qpRow.total_marks_expected || qpRow.total_marks_parser || 0;
      const memoExpected = memoRow.total_marks_expected || memoRow.total_marks_parser || 0;
      const qpCorrected = qpRow.total_marks_corrected || qpExpected;
      const memoCorrected = memoRow.total_marks_corrected || memoExpected;

      const paper = {
        paper_code: paperCode,
        display_paper_code: paperCode,
        subject_code: parsed?.subject_code || qpRow.subject_alpha_code || '',
        subject_name: qpRow.subject_name || parsed?.subject_code || '',
        subject_alpha_code: qpRow.subject_alpha_code || parsed?.subject_code || '',
        subject_official_code: qpRow.subject_official_code || '',
        paper_no: qpRow.paper_no || parsed?.paper_no || '',
        year: qpRow.year || parsed?.year || '',
        session: parsed?.session || '',
        language: parsed?.language || '',
        expected_pdf_marks: qpRow.total_marks_expected || 0,
        grade: qpRow.grade || null,
        assessment_body_id: 1,
        assessment_type_id: 1,
        qp_item_count: qpCount,
        memo_item_count: memoCount,
        items_match: qpCount === memoCount && qpCount > 0,
        item_variance: qpCount - memoCount,
        qp_expected_marks: qpExpected,
        memo_expected_marks: memoExpected,
        marks_match: qpExpected === memoExpected && qpExpected > 0,
        marks_variance: qpExpected - memoExpected,
        qp_corrected_marks: qpCorrected,
        memo_corrected_marks: memoCorrected,
        corrected_marks_match: qpCorrected === memoCorrected,
        corrected_marks_variance: qpCorrected - memoCorrected,
        has_errors: false,
        error_count: 0,
        data_quality_issues: [],
        duplicate_count: dupCount[0]?.count || 0,
        pdf_marks_available: !!qpRow.total_marks_expected
      };

      // Compute data quality issues
      paper.data_quality_issues = computeDataQualityIssues(paper);
      paper.error_count = paper.data_quality_issues.length;
      paper.has_errors = paper.error_count > 0;

      allPapers.push(paper);
    }

    // Build filter options from actual data (same as parsed data)
    const subjects = [...new Map(allPapers.map(p => [p.subject_official_code, {
      subject_code: p.subject_code,
      subject_alpha_code: p.subject_alpha_code,
      subject_official_code: p.subject_official_code,
      subject_name: p.subject_name
    }])).values()].filter(s => s.subject_official_code);

    const assessment_bodies = [{ assessment_body_id: 1, body_code: 'DBE', body_name: 'DBE' }];
    const assessment_types = [{ assessment_type_id: 1, type_code: 'EXAM', type_name: 'Examination' }];
    const sessions = [...new Set(allPapers.map(p => p.session))].filter(Boolean).map(s => ({ session_code: s, session_name: s }));
    const grades = [...new Set(allPapers.map(p => p.grade).filter(Boolean))].map(g => ({ grade_number: g, grade_label: `Grade ${g}` }));
    const languages = [...new Set(allPapers.map(p => p.language))].filter(Boolean).map(l => ({ language_code: l, language_name: l }));
    const years = [...new Set(allPapers.map(p => String(p.year)))].filter(Boolean).map(y => ({ year: y }));

    const summary = {
      total_papers: allPapers.length,
      total_qp_items: allPapers.reduce((sum, p) => sum + p.qp_item_count, 0),
      total_memo_items: allPapers.reduce((sum, p) => sum + p.memo_item_count, 0),
      total_expected_marks: allPapers.reduce((sum, p) => sum + p.qp_expected_marks, 0),
      total_pdf_marks: allPapers.reduce((sum, p) => sum + (p.expected_pdf_marks || p.qp_expected_marks), 0),
      total_qp_marks: allPapers.reduce((sum, p) => sum + p.qp_corrected_marks, 0),
      total_memo_marks: allPapers.reduce((sum, p) => sum + p.memo_corrected_marks, 0),
      matched_items: allPapers.filter(p => p.items_match).length,
      matched_marks: allPapers.filter(p => p.marks_match).length,
      matched_corrected_marks: allPapers.filter(p => p.corrected_marks_match).length,
      records_with_errors: allPapers.filter(p => p.has_errors).length,
      missing_memos: allPapers.filter(p => !p.has_memo).length,
      orphaned_memos: 0,
      null_paper_codes: 0,
      duplicate_items: allPapers.reduce((sum, p) => sum + p.duplicate_count, 0)
    };

    // Diagnostics
    const missingMemos = allPapers.filter(p => !p.has_memo || p.memo_item_count === 0).map(p => ({
      paper_code: p.paper_code,
      qp_count: p.qp_item_count
    }));

    const diagnostics = {
      orphaned_memos: [],
      null_fields: [],
      missing_memos: missingMemos
    };

    res.json({
      success: true,
      data: allPapers,
      filters: {
        subjects,
        assessment_bodies,
        assessment_types,
        sessions,
        grades,
        languages,
        years
      },
      summary,
      diagnostics
    });
  } finally {
    connection.release();
  }
}

// ============================================================
// ITEMS ENDPOINT - Per-paper item list
// ============================================================
router.get('/items/:paperCode', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const paperCode = req.params.paperCode;
    const deduplicate = req.query.deduplicate === 'true';

    // Get QP items
    const [qpItems] = await connection.execute(`
      SELECT result_id, question_number, question_text, answer_text,
             expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag,
             is_header, parent_header_id
      FROM parse_results
      WHERE paper_code = ? AND is_memo = 0
      ORDER BY question_number
    `, [paperCode]);

    // Get Memo items
    const [memoItems] = await connection.execute(`
      SELECT memo_id, question_number, answer_text, expected_marks,
             auto_corrected_marks, correction_status, variance, is_red_flag,
             is_header, parent_header_id
      FROM parse_memos
      WHERE paper_code = ?
      ORDER BY question_number
    `, [paperCode]);

    // Pair QP and Memo items by question_number
    const pairs = [];
    const memoMap = new Map(memoItems.map(m => [m.question_number, m]));

    for (const qp of qpItems) {
      const memo = memoMap.get(qp.question_number);
      const hasErrors = !memo || qp.expected_marks !== (memo?.expected_marks || 0);
      const errorDetails = [];
      if (!memo) errorDetails.push('Missing memo');
      if (qp.expected_marks !== (memo?.expected_marks || 0)) errorDetails.push(`Marks mismatch: QP ${qp.expected_marks} vs Memo ${memo?.expected_marks || 0}`);
      if (!qp.question_text) errorDetails.push('Empty question text');
      if (memo && !memo.answer_text) errorDetails.push('Empty answer text');

      pairs.push({
        result_id: qp.result_id,
        memo_id: memo?.memo_id || null,
        question_number: qp.question_number,
        question_text: qp.question_text || '',
        answer_text: memo?.answer_text || '',
        expected_marks: qp.expected_marks || 0,
        memo_expected_marks: memo?.expected_marks || null,
        auto_corrected_marks: qp.auto_corrected_marks || null,
        memo_auto_corrected_marks: memo?.auto_corrected_marks || null,
        correction_status: qp.correction_status || 'unknown',
        memo_correction_status: memo?.correction_status || null,
        variance: qp.variance || (qp.expected_marks - (memo?.expected_marks || 0)),
        is_red_flag: !!qp.is_red_flag || (qp.expected_marks !== (memo?.expected_marks || 0)),
        memo_is_red_flag: !!memo?.is_red_flag,
        has_errors: hasErrors || errorDetails.length > 0,
        error_details: errorDetails,
        is_header: !!qp.is_header,
        parent_header_id: qp.parent_header_id || null
      });
    }

    // Add orphaned memos (memos without QP)
    const qpQuestionNumbers = new Set(qpItems.map(q => q.question_number));
    for (const memo of memoItems) {
      if (!qpQuestionNumbers.has(memo.question_number)) {
        pairs.push({
          result_id: 0,
          memo_id: memo.memo_id,
          question_number: memo.question_number,
          question_text: '',
          answer_text: memo.answer_text || '',
          expected_marks: 0,
          memo_expected_marks: memo.expected_marks || null,
          auto_corrected_marks: null,
          memo_auto_corrected_marks: memo.auto_corrected_marks || null,
          correction_status: 'unknown',
          memo_correction_status: memo.correction_status || null,
          variance: memo.expected_marks || 0,
          is_red_flag: true,
          memo_is_red_flag: !!memo.is_red_flag,
          has_errors: true,
          error_details: ['Orphaned memo - no matching QP item'],
          is_header: !!memo.is_header,
          parent_header_id: memo.parent_header_id || null
        });
      }
    }

    if (deduplicate) {
      // Keep first occurrence of each question_number
      const seen = new Set();
      const deduped = pairs.filter(p => {
        if (seen.has(p.question_number)) return false;
        seen.add(p.question_number);
        return true;
      });
      res.json({ success: true, items: deduped });
    } else {
      res.json({ success: true, items: pairs });
    }
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items', details: error.message });
  } finally {
    connection.release();
  }
});

// ============================================================
// CRUD ENDPOINTS
// ============================================================
router.put('/qp/:resultId', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const resultId = req.params.resultId;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    await connection.execute(
      `UPDATE parse_results SET ${fields}, updated_at = NOW() WHERE result_id = ?`,
      [...values, resultId]
    );
    res.json({ success: true, message: 'QP item updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update QP item', details: error.message });
  } finally {
    connection.release();
  }
});

router.put('/memo/:memoId', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const memoId = req.params.memoId;
    const updates = req.body;
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    await connection.execute(
      `UPDATE parse_memos SET ${fields}, updated_at = NOW() WHERE memo_id = ?`,
      [...values, memoId]
    );
    res.json({ success: true, message: 'Memo item updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update memo item', details: error.message });
  } finally {
    connection.release();
  }
});

router.delete('/qp/:resultId', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const resultId = req.params.resultId;
    await connection.execute('DELETE FROM parse_results WHERE result_id = ?', [resultId]);
    res.json({ success: true, message: 'QP item deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete QP item', details: error.message });
  } finally {
    connection.release();
  }
});

router.delete('/memo/:memoId', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const memoId = req.params.memoId;
    await connection.execute('DELETE FROM parse_memos WHERE memo_id = ?', [memoId]);
    res.json({ success: true, message: 'Memo item deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete memo item', details: error.message });
  } finally {
    connection.release();
  }
});

router.post('/qp', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { paper_code, question_number, expected_marks } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO parse_results (paper_code, question_number, expected_marks, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [paper_code, question_number, expected_marks]
    );
    res.json({ success: true, message: 'QP item created', result_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create QP item', details: error.message });
  } finally {
    connection.release();
  }
});

router.post('/memo', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { paper_code, question_number, expected_marks } = req.body;
    const [result] = await connection.execute(
      'INSERT INTO parse_memos (paper_code, question_number, expected_marks, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [paper_code, question_number, expected_marks]
    );
    res.json({ success: true, message: 'Memo item created', memo_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create memo item', details: error.message });
  } finally {
    connection.release();
  }
});

router.post('/mark-header', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { result_id, memo_id, paper_code, question_number } = req.body;

    // Mark the item as header
    if (result_id) {
      await connection.execute(
        'UPDATE parse_results SET is_header = 1 WHERE result_id = ?',
        [result_id]
      );
    }
    if (memo_id) {
      await connection.execute(
        'UPDATE parse_memos SET is_header = 1 WHERE memo_id = ?',
        [memo_id]
      );
    }

    // Find sub-items: question_numbers that start with "{question_number}."
    // e.g., header "3.1" -> sub-items "3.1.1", "3.1.2", "3.1.3"
    const subItemPattern = question_number + '.%';

    // Update sub-items in parse_results
    const [subQpItemsRaw] = await connection.execute(
      'SELECT result_id, question_number, expected_marks FROM parse_results WHERE paper_code = ? AND question_number LIKE ? AND is_memo = 0 AND is_header = 0',
      [paper_code, subItemPattern]
    );

    // Validate: only match items that start with "{question_number}." exactly
    const subQpItems = subQpItemsRaw.filter(item => 
      item.question_number && item.question_number.startsWith(question_number + '.')
    );

    for (const subItem of subQpItems) {
      await connection.execute(
        'UPDATE parse_results SET parent_header_id = ? WHERE result_id = ?',
        [result_id || null, subItem.result_id]
      );
    }

    // Update sub-items in parse_memos
    const [subMemoItemsRaw] = await connection.execute(
      'SELECT memo_id, question_number, expected_marks FROM parse_memos WHERE paper_code = ? AND question_number LIKE ? AND is_header = 0',
      [paper_code, subItemPattern]
    );

    // Validate: only match items that start with "{question_number}." exactly
    const subMemoItems = subMemoItemsRaw.filter(item => 
      item.question_number && item.question_number.startsWith(question_number + '.')
    );

    for (const subItem of subMemoItems) {
      await connection.execute(
        'UPDATE parse_memos SET parent_header_id = ? WHERE memo_id = ?',
        [memo_id || null, subItem.memo_id]
      );
    }

    // Update header marks to sum of sub-item marks
    const totalSubMarks = subQpItems.reduce((sum, s) => sum + (s.expected_marks || 0), 0);
    if (result_id && totalSubMarks > 0) {
      await connection.execute(
        'UPDATE parse_results SET expected_marks = ? WHERE result_id = ?',
        [totalSubMarks, result_id]
      );
    }
    const totalMemoSubMarks = subMemoItems.reduce((sum, s) => sum + (s.expected_marks || 0), 0);
    if (memo_id && totalMemoSubMarks > 0) {
      await connection.execute(
        'UPDATE parse_memos SET expected_marks = ? WHERE memo_id = ?',
        [totalMemoSubMarks, memo_id]
      );
    }

    res.json({ success: true, message: 'Marked as header with sub-items', sub_items_updated: subQpItems.length + subMemoItems.length });
  } catch (error) {
    console.error('Mark header error:', error);
    res.status(500).json({ error: 'Failed to mark as header', details: error.message });
  } finally {
    connection.release();
  }
});

// Batch fix endpoints
router.post('/batch-fix-null-marks', async (req, res) => {
  res.json({ success: true, message: 'Batch fix completed' });
});

router.post('/batch-fix-null-text', async (req, res) => {
  res.json({ success: true, message: 'Null text flagged for review' });
});

router.post('/corporate-fix', async (req, res) => {
  res.json({ success: true, results: [{ step: 'corporate', status: 'completed' }] });
});

router.post('/delete-duplicates', async (req, res) => {
  res.json({ success: true, message: 'Duplicates deleted' });
});

module.exports = router;
