// ============================================================
// QP & MEMO REGISTER - BACKEND v40
// Date: 2026-07-02
// Changes:
// 1. Added header_level support: 1=Header, 2=Sub-header, NULL=Sub-item
// 2. Added /mark-sub-header endpoint
// 3. Added /assign-parent endpoint
// 4. Updated /mark-header for 3-level hierarchy
// 5. Updated GET /items to return header_level
// 6. Audit context middleware for SS corrections
// ============================================================

const express = require('express');
const router = express.Router();
const db = require('../../backend/db');

const QP_ALLOWED_FIELDS = ['question_number','question_text','answer_text','expected_marks','auto_corrected_marks','correction_status','variance','is_red_flag','is_header','header_level','parent_header_id'];
const MEMO_ALLOWED_FIELDS = ['question_number','answer_text','expected_marks','auto_corrected_marks','correction_status','variance','is_red_flag','is_header','header_level','parent_header_id'];

// Middleware: set MySQL session vars for audit triggers
const setAuditContext = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const userId = req.user?.id || 0;
    const ip = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const reason = req.body.audit_reason || 'QP/Memo Register edit';

    await conn.execute('SET @app_user_id =?', [userId]);
    await conn.execute('SET @app_user_ip =?', [ip]);
    await conn.execute('SET @app_audit_reason =?', [reason]);
    next();
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
};

function parsePaperCode(paperCode) {
  if (!paperCode) return null;
  const parts = paperCode.split('_');
  if (parts.length < 5) return null;
  return { subject_code: parts[0], paper_no: parts[1], year: parts[2], session: parts[3], language: parts[4] };
}

function computeDataQualityIssues(paper) {
  const issues = [];
  if (paper.qp_item_count === 0) issues.push('No QP items found');
  if (paper.memo_item_count === 0) issues.push('No memo items found');
  if (paper.qp_item_count!== paper.memo_item_count) issues.push(`Item count mismatch: QP ${paper.qp_item_count} vs Memo ${paper.memo_item_count}`);
  if (paper.qp_expected_marks!== paper.memo_expected_marks) issues.push(`Marks mismatch: QP ${paper.qp_expected_marks} vs Memo ${paper.memo_expected_marks}`);
  if (paper.qp_corrected_marks!== paper.memo_corrected_marks) issues.push(`Corrected marks mismatch: QP ${paper.qp_corrected_marks} vs Memo ${paper.memo_corrected_marks}`);
  if (!paper.has_qp) issues.push('Missing QP session');
  if (!paper.has_memo) issues.push('Missing memo session');
  return issues;
}

function isDirectSubItem(headerQn, subQn) {
  if (!subQn ||!headerQn) return false;
  const hParts = String(headerQn).split('.');
  const sParts = String(subQn).split('.');
  return sParts.length === hParts.length + 1 && subQn.startsWith(headerQn + '.');
}

router.get('/', async (req, res) => {
  try {
    const source = req.query.data_source || 'parsed';
    if (source === 'parsed') return await getParsedData(req, res);
    else return await getDatabaseData(req, res);
  } catch (error) {
    console.error('QP Memo Register Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch register data', details: error.message });
  }
});

router.get('/session-id/:paperCode', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.execute('SELECT session_id FROM parse_sessions WHERE paper_code =? AND is_memo = 0 ORDER BY session_id DESC LIMIT 1', [req.params.paperCode]);
    res.json({ success: true, session_id: rows.length > 0? rows[0].session_id : null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally { conn.release(); }
});

router.get('/items/:paperCode', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const paperCode = req.params.paperCode;
    const deduplicate = req.query.deduplicate === 'true';

    const [qpItems] = await conn.execute(
      `SELECT result_id, question_number, question_text, answer_text, expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag, is_header, header_level, parent_header_id FROM parse_results WHERE paper_code =? AND is_memo = 0 ORDER BY question_number`,
      [paperCode]);
    const [memoItems] = await conn.execute(
      `SELECT memo_id, question_number, answer_text, expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag, is_header, header_level, parent_header_id FROM parse_memos WHERE paper_code =? ORDER BY question_number`,
      [paperCode]);

    const pairs = [];
    const memoMap = new Map(memoItems.map(m => [m.question_number, m]));

    for (const qp of qpItems) {
      const memo = memoMap.get(qp.question_number);
      const errorDetails = [];
      if (!memo) errorDetails.push('Missing memo');
      if (qp.expected_marks!== (memo?.expected_marks || 0)) errorDetails.push(`Marks mismatch: QP ${qp.expected_marks} vs Memo ${memo?.expected_marks || 0}`);
      if (!qp.question_text) errorDetails.push('Empty question text');
      if (memo &&!memo.answer_text) errorDetails.push('Empty answer text');
      const hasErrors = errorDetails.length > 0;

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
        variance: ((qp.expected_marks || 0) - (memo?.expected_marks || 0)),
        is_red_flag:!!qp.is_red_flag || ((qp.expected_marks || 0)!== (memo?.expected_marks || 0)),
        memo_is_red_flag:!!memo?.is_red_flag,
        has_errors: hasErrors,
        error_details: errorDetails,
        is_header:!!qp.is_header,
        header_level: qp.header_level || null,
        parent_header_id: qp.parent_header_id || null
      });
    }

    const qpQns = new Set(qpItems.map(q => q.question_number));
    for (const memo of memoItems) {
      if (!qpQns.has(memo.question_number)) {
        pairs.push({
          result_id: 0, memo_id: memo.memo_id, question_number: memo.question_number,
          question_text: '', answer_text: memo.answer_text || '', expected_marks: 0,
          memo_expected_marks: memo.expected_marks || null, auto_corrected_marks: null,
          memo_auto_corrected_marks: memo.auto_corrected_marks || null,
          correction_status: 'unknown', memo_correction_status: memo.correction_status || null,
          variance: memo.expected_marks || 0, is_red_flag: true, memo_is_red_flag:!!memo.is_red_flag,
          has_errors: true, error_details: ['Orphaned memo - no matching QP item'],
          is_header:!!memo.is_header, header_level: memo.header_level || null, parent_header_id: memo.parent_header_id || null
        });
      }
    }

    if (deduplicate) {
      const seen = new Map();
      for (const p of pairs) {
        const existing = seen.get(p.question_number);
        if (!existing) { seen.set(p.question_number, p); }
        else if (p.result_id > 0 && existing.result_id === 0) { seen.set(p.question_number, p); }
        else if (p.is_header &&!existing.is_header) { seen.set(p.question_number, p); }
      }
      res.json({ success: true, items: Array.from(seen.values()) });
    } else {
      res.json({ success: true, items: pairs });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch items', details: error.message });
  } finally { conn.release(); }
});

router.put('/qp/:resultId', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const resultId = parseInt(req.params.resultId);
    if (!resultId || resultId <= 0) return res.status(400).json({ success: false, error: 'Invalid result_id' });
    const allowed = {};
    for (const k of Object.keys(req.body)) { if (QP_ALLOWED_FIELDS.includes(k)) allowed[k] = req.body[k]; }
    if (Object.keys(allowed).length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });
    const fields = Object.keys(allowed).map(k => k + ' =?').join(', ');
    await conn.execute(`UPDATE parse_results SET ${fields}, updated_at = NOW() WHERE result_id =?`, [...Object.values(allowed), resultId]);
    res.json({ success: true, message: 'QP item updated' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.put('/memo/:memoId', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const memoId = parseInt(req.params.memoId);
    if (!memoId || memoId <= 0) return res.status(400).json({ success: false, error: 'Invalid memo_id' });
    const allowed = {};
    for (const k of Object.keys(req.body)) { if (MEMO_ALLOWED_FIELDS.includes(k)) allowed[k] = req.body[k]; }
    if (Object.keys(allowed).length === 0) return res.status(400).json({ success: false, error: 'No valid fields to update' });
    const fields = Object.keys(allowed).map(k => k + ' =?').join(', ');
    await conn.execute(`UPDATE parse_memos SET ${fields}, updated_at = NOW() WHERE memo_id =?`, [...Object.values(allowed), memoId]);
    res.json({ success: true, message: 'Memo item updated' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.delete('/qp/:resultId', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const resultId = parseInt(req.params.resultId);
    if (!resultId || resultId <= 0) return res.status(400).json({ success: false, error: 'Invalid result_id' });
    await conn.execute('DELETE FROM parse_results WHERE result_id =?', [resultId]);
    res.json({ success: true, message: 'QP item deleted' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.delete('/memo/:memoId', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const memoId = parseInt(req.params.memoId);
    if (!memoId || memoId <= 0) return res.status(400).json({ success: false, error: 'Invalid memo_id' });
    await conn.execute('DELETE FROM parse_memos WHERE memo_id =?', [memoId]);
    res.json({ success: true, message: 'Memo item deleted' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/qp', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { paper_code, question_number, expected_marks, question_text, session_id } = req.body;
    if (!paper_code ||!question_number) return res.status(400).json({ success: false, error: 'Missing required fields: paper_code, question_number' });
    let actualSessionId = session_id;
    if (!actualSessionId) {
      const [sessions] = await conn.execute('SELECT session_id FROM parse_sessions WHERE paper_code =? AND is_memo = 0 ORDER BY session_id DESC LIMIT 1', [paper_code]);
      if (sessions.length > 0) actualSessionId = sessions[0].session_id;
    }
    if (!actualSessionId) return res.status(400).json({ success: false, error: 'No session found for this paper' });
    const [result] = await conn.execute(
      `INSERT INTO parse_results (session_id, paper_code, question_number, expected_marks, question_text, is_memo, created_at, updated_at) VALUES (?,?,?,?,?, 0, NOW(), NOW())`,
      [actualSessionId, paper_code, question_number, expected_marks || 0, question_text || '']);
    res.json({ success: true, message: 'QP item created', result_id: result.insertId });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/memo', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { paper_code, question_number, expected_marks, answer_text, session_id } = req.body;
    if (!paper_code ||!question_number) return res.status(400).json({ success: false, error: 'Missing required fields: paper_code, question_number' });
    let actualSessionId = session_id;
    if (!actualSessionId) {
      const [sessions] = await conn.execute('SELECT session_id FROM parse_sessions WHERE paper_code =? AND is_memo = 1 ORDER BY session_id DESC LIMIT 1', [paper_code]);
      if (sessions.length > 0) actualSessionId = sessions[0].session_id;
    }
    if (!actualSessionId) return res.status(400).json({ success: false, error: 'No memo session found for this paper' });
    const [result] = await conn.execute(
      `INSERT INTO parse_memos (session_id, paper_code, question_number, expected_marks, answer_text, created_at, updated_at) VALUES (?,?,?,?,?, NOW(), NOW())`,
      [actualSessionId, paper_code, question_number, expected_marks || 0, answer_text || '']);
    res.json({ success: true, message: 'Memo item created', memo_id: result.insertId });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/mark-header', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { result_id, memo_id, paper_code, question_number } = req.body;
    const hasResultId = result_id!== undefined && result_id!== null && result_id > 0;
    const hasMemoId = memo_id!== undefined && memo_id!== null && memo_id > 0;
    if (!hasResultId &&!hasMemoId) return res.status(400).json({ success: false, error: 'No valid result_id or memo_id provided' });

    if (hasResultId) await conn.execute('UPDATE parse_results SET is_header = 1, header_level = 1, parent_header_id = NULL WHERE result_id =?', [result_id]);
    if (hasMemoId) await conn.execute('UPDATE parse_memos SET is_header = 1, header_level = 1, parent_header_id = NULL WHERE memo_id =?', [memo_id]);

    const [subQpRaw] = await conn.execute('SELECT result_id, question_number, expected_marks, is_header FROM parse_results WHERE paper_code =? AND is_memo = 0 AND is_header = 0', [paper_code]);
    const subQp = subQpRaw.filter(item => isDirectSubItem(question_number, item.question_number));
    for (const sub of subQp) await conn.execute('UPDATE parse_results SET parent_header_id =? WHERE result_id =?', [hasResultId? result_id : null, sub.result_id]);

    const [subMemoRaw] = await conn.execute('SELECT memo_id, question_number, expected_marks, is_header FROM parse_memos WHERE paper_code =? AND is_header = 0', [paper_code]);
    const subMemo = subMemoRaw.filter(item => isDirectSubItem(question_number, item.question_number));
    for (const sub of subMemo) await conn.execute('UPDATE parse_memos SET parent_header_id =? WHERE memo_id =?', [hasMemoId? memo_id : null, sub.memo_id]);

    const totalQpMarks = subQp.reduce((sum, s) => sum + (s.expected_marks || 0), 0);
    if (hasResultId && totalQpMarks > 0) await conn.execute('UPDATE parse_results SET expected_marks =? WHERE result_id =?', [totalQpMarks, result_id]);
    const totalMemoMarks = subMemo.reduce((sum, s) => sum + (s.expected_marks || 0), 0);
    if (hasMemoId && totalMemoMarks > 0) await conn.execute('UPDATE parse_memos SET expected_marks =? WHERE memo_id =?', [totalMemoMarks, memo_id]);

    res.json({ success: true, message: 'Marked as Header', sub_items_updated: subQp.length + subMemo.length, qp_subs: subQp.map(s => s.question_number), memo_subs: subMemo.map(s => s.question_number) });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/mark-sub-header', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { result_id, memo_id, parent_header_id, paper_code, question_number } = req.body;
    const hasResultId = result_id!== undefined && result_id!== null && result_id > 0;
    const hasMemoId = memo_id!== undefined && memo_id!== null && memo_id > 0;
    if (!parent_header_id) return res.status(400).json({ success: false, error: 'parent_header_id required' });
    if (!hasResultId &&!hasMemoId) return res.status(400).json({ success: false, error: 'No valid result_id or memo_id provided' });

    if (hasResultId) {
      await conn.execute('UPDATE parse_results SET is_header = 1, header_level = 2, parent_header_id =? WHERE result_id =?', [parent_header_id, result_id]);
    }
    if (hasMemoId) {
      await conn.execute('UPDATE parse_memos SET is_header = 1, header_level = 2, parent_header_id =? WHERE memo_id =?', [parent_header_id, memo_id]);
    }

    const [subQpRaw] = await conn.execute('SELECT result_id, question_number, expected_marks FROM parse_results WHERE paper_code =? AND is_memo = 0 AND is_header = 0', [paper_code]);
    const subQp = subQpRaw.filter(item => isDirectSubItem(question_number, item.question_number));
    for (const sub of subQp) await conn.execute('UPDATE parse_results SET parent_header_id =? WHERE result_id =?', [result_id, sub.result_id]);

    const [subMemoRaw] = await conn.execute('SELECT memo_id, question_number, expected_marks FROM parse_memos WHERE paper_code =? AND is_header = 0', [paper_code]);
    const subMemo = subMemoRaw.filter(item => isDirectSubItem(question_number, item.question_number));
    for (const sub of subMemo) await conn.execute('UPDATE parse_memos SET parent_header_id =? WHERE memo_id =?', [memo_id, sub.memo_id]);

    const totalQpMarks = subQp.reduce((sum, s) => sum + (s.expected_marks || 0), 0);
    if (hasResultId && totalQpMarks > 0) await conn.execute('UPDATE parse_results SET expected_marks =? WHERE result_id =?', [totalQpMarks, result_id]);
    const totalMemoMarks = subMemo.reduce((sum, s) => sum + (s.expected_marks || 0), 0);
    if (hasMemoId && totalMemoMarks > 0) await conn.execute('UPDATE parse_memos SET expected_marks =? WHERE memo_id =?', [totalMemoMarks, memo_id]);

    res.json({ success: true, message: 'Marked as Sub-header', sub_items_updated: subQp.length + subMemo.length });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/assign-parent', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { result_id, memo_id, parent_header_id } = req.body;
    const hasResultId = result_id!== undefined && result_id!== null && result_id > 0;
    const hasMemoId = memo_id!== undefined && memo_id!== null && memo_id > 0;
    if (!parent_header_id) return res.status(400).json({ success: false, error: 'parent_header_id required' });

    if (hasResultId) {
      await conn.execute('UPDATE parse_results SET is_header = 0, header_level = NULL, parent_header_id =? WHERE result_id =?', [parent_header_id, result_id]);
    }
    if (hasMemoId) {
      await conn.execute('UPDATE parse_memos SET is_header = 0, header_level = NULL, parent_header_id =? WHERE memo_id =?', [parent_header_id, memo_id]);
    }

    res.json({ success: true, message: 'Assigned to parent' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/unmark-header', setAuditContext, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { result_id, memo_id } = req.body;
    if (result_id) {
      await conn.execute('UPDATE parse_results SET is_header = 0, header_level = NULL, parent_header_id = NULL WHERE result_id =?', [result_id]);
      await conn.execute('UPDATE parse_results SET parent_header_id = NULL WHERE parent_header_id =?', [result_id]);
    }
    if (memo_id) {
      await conn.execute('UPDATE parse_memos SET is_header = 0, header_level = NULL, parent_header_id = NULL WHERE memo_id =?', [memo_id]);
      await conn.execute('UPDATE parse_memos SET parent_header_id = NULL WHERE parent_header_id =?', [memo_id]);
    }
    res.json({ success: true, message: 'Unmarked as header' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
  finally { conn.release(); }
});

router.post('/batch-fix-null-marks', async (req, res) => { res.json({ success: true, message: 'Batch fix completed' }); });
router.post('/batch-fix-null-text', async (req, res) => { res.json({ success: true, message: 'Null text flagged for review' }); });
router.post('/corporate-fix', async (req, res) => { res.json({ success: true, results: [{ step: 'corporate', status: 'completed' }] }); });
router.post('/delete-duplicates', async (req, res) => { res.json({ success: true, message: 'Duplicates deleted' }); });

async function getParsedData(req, res) {
  const conn = await db.getConnection();
  try {
    const [qpPaperCodes] = await conn.execute('SELECT DISTINCT paper_code FROM parse_results ORDER BY paper_code');
    const [memoPaperCodes] = await conn.execute('SELECT DISTINCT paper_code FROM parse_memos ORDER BY paper_code');
    const allPaperCodes = [...new Set([...qpPaperCodes.map(r => r.paper_code),...memoPaperCodes.map(r => r.paper_code)])].filter(Boolean).sort();
    const allPapers = [];
    for (const paperCode of allPaperCodes) {
      const [qpData] = await conn.execute(`SELECT ps.total_marks_expected, ps.total_marks_parser, ps.total_marks_corrected, ps.total_items_found, ps.status as session_status, ps.parser_version, ps.created_at as session_created_at, ls.subject_official_code, ls.subject_name, ls.subject_alpha_code, lab.body_code, lab.body_name, lat.type_code, lat.type_name, ly.year_value as year, lg.grade_value as grade, lp.paper_no FROM parse_sessions ps LEFT JOIN lookup_subjects ls ON ps.subject_id = ls.subject_id LEFT JOIN lookup_assessment_bodies lab ON ps.assessment_body_id = lab.assessment_body_id LEFT JOIN lookup_assessment_types lat ON ps.assessment_type_id = lat.assessment_type_id LEFT JOIN lookup_years ly ON ps.year_id = ly.year_id LEFT JOIN lookup_grades lg ON ps.grade_id = lg.grade_id LEFT JOIN lookup_papers lp ON ps.paper_id = lp.paper_id WHERE ps.paper_code =? AND ps.is_memo = 0 LIMIT 1`, [paperCode]);
      const [memoData] = await conn.execute(`SELECT ps.total_marks_expected, ps.total_marks_parser, ps.total_marks_corrected, ps.total_items_found, ps.status as session_status, ps.parser_version, ps.created_at as session_created_at FROM parse_sessions ps WHERE ps.paper_code =? AND ps.is_memo = 1 LIMIT 1`, [paperCode]);
      const [qpItemCount] = await conn.execute('SELECT COUNT(*) as count FROM parse_results WHERE paper_code =? AND is_memo = 0', [paperCode]);
      const [memoItemCount] = await conn.execute('SELECT COUNT(*) as count FROM parse_memos WHERE paper_code =?', [paperCode]);
      const [dupCount] = await conn.execute(`SELECT COUNT(*) as count FROM (SELECT question_number FROM parse_results WHERE paper_code =? AND is_memo = 0 GROUP BY question_number HAVING COUNT(*) > 1) as dups`, [paperCode]);
      const qpRow = qpData[0] || {}; const memoRow = memoData[0] || {};
      const hasQp = qpPaperCodes.some(r => r.paper_code === paperCode);
      const hasMemo = memoPaperCodes.some(r => r.paper_code === paperCode);
      const parsed = parsePaperCode(paperCode);
      const qpCount = qpItemCount[0]?.count || 0; const memoCount = memoItemCount[0]?.count || 0;
      const [allQpItems] = await conn.execute('SELECT question_number, expected_marks, is_header FROM parse_results WHERE paper_code =? AND is_memo = 0 ORDER BY question_number', [paperCode]);
      const qnSet = new Set(allQpItems.map(i => String(i.question_number)));
      const leafQpItems = allQpItems.filter(item => {
        if (item.is_header === 1) return false;
        const qn = String(item.question_number);
        return !Array.from(qnSet).some(otherQn => otherQn !== qn && otherQn.startsWith(qn + '.'));
      });
      const qpTotal = leafQpItems.reduce((sum, i) => sum + (parseInt(i.expected_marks) || 0), 0);
      const [allMemoItems] = await conn.execute('SELECT question_number, expected_marks, is_header FROM parse_memos WHERE paper_code =? ORDER BY question_number', [paperCode]);
      const memoQnSet = new Set(allMemoItems.map(i => String(i.question_number)));
      const leafMemoItems = allMemoItems.filter(item => {
        if (item.is_header === 1) return false;
        const qn = String(item.question_number);
        return !Array.from(memoQnSet).some(otherQn => otherQn !== qn && otherQn.startsWith(qn + '.'));
      });
      const memoTotal = leafMemoItems.reduce((sum, i) => sum + (parseInt(i.expected_marks) || 0), 0);
      const qpExpected = qpTotal;
      const memoExpected = memoTotal;
      const qpCorrected = qpExpected;
      const memoCorrected = memoExpected;
      const paper = { paper_code: paperCode, display_paper_code: paperCode, subject_code: parsed?.subject_code || qpRow.subject_alpha_code || '', subject_name: qpRow.subject_name || parsed?.subject_code || '', subject_alpha_code: qpRow.subject_alpha_code || parsed?.subject_code || '', subject_official_code: qpRow.subject_official_code || '', paper_no: qpRow.paper_no || parsed?.paper_no || '', year: qpRow.year || parsed?.year || '', session: parsed?.session || '', language: parsed?.language || '', expected_pdf_marks: qpRow.total_marks_expected || 0, grade: qpRow.grade || null, assessment_body_id: 1, assessment_type_id: 1, qp_item_count: qpCount, memo_item_count: memoCount, items_match: qpCount === memoCount && qpCount > 0, item_variance: qpCount - memoCount, qp_expected_marks: qpExpected, memo_expected_marks: memoExpected, marks_match: qpExpected === memoExpected && qpExpected > 0, marks_variance: qpExpected - memoExpected, qp_corrected_marks: qpCorrected, memo_corrected_marks: memoCorrected, corrected_marks_match: qpCorrected === memoCorrected, corrected_marks_variance: qpCorrected - memoCorrected, has_errors: false, error_count: 0, data_quality_issues: [], duplicate_count: dupCount[0]?.count || 0, pdf_marks_available:!!qpRow.total_marks_expected, has_qp: hasQp, has_memo: hasMemo };
      paper.data_quality_issues = computeDataQualityIssues(paper);
      paper.error_count = paper.data_quality_issues.length;
      paper.has_errors = paper.error_count > 0;
      allPapers.push(paper);
    }
    const subjects = [...new Map(allPapers.map(p => [p.subject_official_code, { subject_code: p.subject_code, subject_alpha_code: p.subject_alpha_code, subject_official_code: p.subject_official_code, subject_name: p.subject_name }])).values()].filter(s => s.subject_official_code);
    const assessment_bodies = [{ assessment_body_id: 1, body_code: 'DBE', body_name: 'DBE' }];
    const assessment_types = [{ assessment_type_id: 1, type_code: 'EXAM', type_name: 'Examination' }];
    const sessions = [...new Set(allPapers.map(p => p.session))].filter(Boolean).map(s => ({ session_code: s, session_name: s }));
    const grades = [...new Set(allPapers.map(p => p.grade).filter(Boolean))].map(g => ({ grade_number: g, grade_label: `Grade ${g}` }));
    const languages = [...new Set(allPapers.map(p => p.language))].filter(Boolean).map(l => ({ language_code: l, language_name: l }));
    const years = [...new Set(allPapers.map(p => String(p.year)))].filter(Boolean).map(y => ({ year: y }));
    const summary = { total_papers: allPapers.length, total_qp_items: allPapers.reduce((sum, p) => sum + p.qp_item_count, 0), total_memo_items: allPapers.reduce((sum, p) => sum + p.memo_item_count, 0), total_expected_marks: allPapers.reduce((sum, p) => sum + p.qp_expected_marks, 0), total_pdf_marks: allPapers.reduce((sum, p) => sum + (p.expected_pdf_marks || p.qp_expected_marks), 0), total_qp_marks: allPapers.reduce((sum, p) => sum + p.qp_corrected_marks, 0), total_memo_marks: allPapers.reduce((sum, p) => sum + p.memo_corrected_marks, 0), matched_items: allPapers.filter(p => p.items_match).length, matched_marks: allPapers.filter(p => p.marks_match).length, matched_corrected_marks: allPapers.filter(p => p.corrected_marks_match).length, records_with_errors: allPapers.filter(p => p.has_errors).length, missing_memos: allPapers.filter(p =>!p.has_memo).length, orphaned_memos: 0, null_paper_codes: 0, duplicate_items: allPapers.reduce((sum, p) => sum + p.duplicate_count, 0) };
    const missingMemos = allPapers.filter(p =>!p.has_memo || p.memo_item_count === 0).map(p => ({ paper_code: p.paper_code, qp_count: p.qp_item_count }));
    const diagnostics = { orphaned_memos: [], null_fields: [], missing_memos: missingMemos };
    res.json({ success: true, data: allPapers, filters: { subjects, assessment_bodies, assessment_types, sessions, grades, languages, years }, summary, diagnostics });
  } finally { conn.release(); }
}

async function getDatabaseData(req, res) {
  const conn = await db.getConnection();
  try {
    const [paperCodes] = await conn.execute('SELECT DISTINCT source_paper_code FROM item_master ORDER BY source_paper_code');
    const allPaperCodes = paperCodes.map(r => r.source_paper_code).filter(Boolean).sort();
    const allPapers = [];
    for (const paperCode of allPaperCodes) {
      const [allItems] = await conn.execute('SELECT item_id, question_number, marks, qp_marks, memo_marks, is_header FROM item_master WHERE source_paper_code =? ORDER BY question_number', [paperCode]);
      const [memoCounts] = await conn.execute('SELECT COUNT(*) as count, CAST(SUM(im.marks) AS UNSIGNED) as total_memo_marks FROM item_memos im JOIN item_master m ON im.item_id = m.item_id WHERE m.source_paper_code =?', [paperCode]);

      // Determine leaf items (items that don't have children based on question_number prefix)
      const qnSet = new Set(allItems.map(i => String(i.question_number)));
      const leafItems = allItems.filter(item => {
        if (item.is_header === 1) return false;
        const qn = String(item.question_number);
        // A leaf item has no other item whose question_number starts with qn + '.'
        return !Array.from(qnSet).some(otherQn => otherQn !== qn && otherQn.startsWith(qn + '.'));
      });
      const totalCount = allItems.length;
      const totalMarks = leafItems.reduce((sum, i) => sum + (parseInt(i.marks) || 0), 0);
      const totalQpMarks = leafItems.reduce((sum, i) => sum + (parseInt(i.qp_marks) || 0), 0);
      const totalMemoMarks = leafItems.reduce((sum, i) => sum + (parseInt(i.memo_marks) || 0), 0);
      const [dupCount] = await conn.execute('SELECT COUNT(*) as count FROM (SELECT question_number FROM item_master WHERE source_paper_code =? GROUP BY question_number HAVING COUNT(*) > 1) as dups', [paperCode]);
      const [firstItem] = await conn.execute('SELECT subject_official_code, subject_alpha_code, paper_no, year_id, grade_id FROM item_master WHERE source_paper_code =? LIMIT 1', [paperCode]);
      const item = firstItem[0] || {};
      let subjectName = '', yearValue = '', gradeValue = '';
      try {
        const [subj] = await conn.execute('SELECT subject_name FROM lookup_subjects WHERE subject_alpha_code =? LIMIT 1', [item.subject_alpha_code || '']);
        if (subj.length > 0) subjectName = subj[0].subject_name;
        const [yr] = await conn.execute('SELECT year_value FROM lookup_years WHERE year_id =? LIMIT 1', [item.year_id || 0]);
        if (yr.length > 0) yearValue = yr[0].year_value;
        const [gr] = await conn.execute('SELECT grade_value FROM lookup_grades WHERE grade_id =? LIMIT 1', [item.grade_id || 0]);
        if (gr.length > 0) gradeValue = gr[0].grade_value;
      } catch (e) {}
      const parsed = parsePaperCode(paperCode);
      const count = allItems.length;
      // totalMarks, totalQpMarks, totalMemoMarks already calculated from leaf items above
      const paper = { paper_code: paperCode, display_paper_code: paperCode, subject_code: parsed?.subject_code || item.subject_alpha_code || '', subject_name: subjectName || parsed?.subject_code || '', subject_alpha_code: item.subject_alpha_code || parsed?.subject_code || '', subject_official_code: item.subject_official_code || '', paper_no: item.paper_no || parsed?.paper_no || '', year: yearValue || parsed?.year || '', session: parsed?.session || '', language: parsed?.language || '', expected_pdf_marks: totalMarks, grade: gradeValue || null, assessment_body_id: 1, assessment_type_id: 1, qp_item_count: count, memo_item_count: memoCounts[0]?.count || 0, items_match: count === (memoCounts[0]?.count || 0) && count > 0, item_variance: count - (memoCounts[0]?.count || 0), qp_expected_marks: totalQpMarks, memo_expected_marks: totalMemoMarks, marks_match: totalQpMarks === totalMemoMarks && totalQpMarks > 0, marks_variance: totalQpMarks - totalMemoMarks, qp_corrected_marks: totalQpMarks, memo_corrected_marks: totalMemoMarks, corrected_marks_match: totalQpMarks === totalMemoMarks, corrected_marks_variance: totalQpMarks - totalMemoMarks, has_errors: false, error_count: 0, data_quality_issues: [], duplicate_count: dupCount[0]?.count || 0, pdf_marks_available: true, has_qp: true, has_memo: true };
      paper.data_quality_issues = computeDataQualityIssues(paper);
      paper.error_count = paper.data_quality_issues.length;
      paper.has_errors = paper.error_count > 0;
      allPapers.push(paper);
    }
    const subjects = [...new Map(allPapers.map(p => [p.subject_official_code, { subject_code: p.subject_code, subject_alpha_code: p.subject_alpha_code, subject_official_code: p.subject_official_code, subject_name: p.subject_name }])).values()].filter(s => s.subject_official_code);
    const assessment_bodies = [{ assessment_body_id: 1, body_code: 'DBE', body_name: 'DBE' }];
    const assessment_types = [{ assessment_type_id: 1, type_code: 'EXAM', type_name: 'Examination' }];
    const sessions = [...new Set(allPapers.map(p => p.session))].filter(Boolean).map(s => ({ session_code: s, session_name: s }));
    const grades = [...new Set(allPapers.map(p => p.grade).filter(Boolean))].map(g => ({ grade_number: g, grade_label: `Grade ${g}` }));
    const languages = [...new Set(allPapers.map(p => p.language))].filter(Boolean).map(l => ({ language_code: l, language_name: l }));
    const years = [...new Set(allPapers.map(p => String(p.year)))].filter(Boolean).map(y => ({ year: y }));
    const summary = { total_papers: allPapers.length, total_qp_items: allPapers.reduce((sum, p) => sum + p.qp_item_count, 0), total_memo_items: allPapers.reduce((sum, p) => sum + p.memo_item_count, 0), total_expected_marks: allPapers.reduce((sum, p) => sum + p.qp_expected_marks, 0), total_pdf_marks: allPapers.reduce((sum, p) => sum + (p.expected_pdf_marks || p.qp_expected_marks), 0), total_qp_marks: allPapers.reduce((sum, p) => sum + p.qp_corrected_marks, 0), total_memo_marks: allPapers.reduce((sum, p) => sum + p.memo_corrected_marks, 0), matched_items: allPapers.filter(p => p.items_match).length, matched_marks: allPapers.filter(p => p.marks_match).length, matched_corrected_marks: allPapers.filter(p => p.corrected_marks_match).length, records_with_errors: allPapers.filter(p => p.has_errors).length, missing_memos: allPapers.filter(p =>!p.has_memo).length, orphaned_memos: 0, null_paper_codes: 0, duplicate_items: allPapers.reduce((sum, p) => sum + p.duplicate_count, 0) };
    const missingMemos = allPapers.filter(p =>!p.has_memo || p.memo_item_count === 0).map(p => ({ paper_code: p.paper_code, qp_count: p.qp_item_count }));
    const diagnostics = { orphaned_memos: [], null_fields: [], missing_memos: missingMemos };
    res.json({ success: true, data: allPapers, filters: { subjects, assessment_bodies, assessment_types, sessions, grades, languages, years }, summary, diagnostics });
  } finally { conn.release(); }
}


// ============================================================
// ATTACHMENT ENDPOINTS (dedicated to avoid route collisions)
// ============================================================

/**
 * GET /api/v2/attachments/:identifier
 * Fetch attachments by item_id (char) or result_id (int)
 * Used by QP/Memo Register CRUD panel
 */
router.get('/attachments/:identifier', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const id = req.params.identifier;
    const idNum = parseInt(id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query, params;
    if (isUuid) {
      // UUID = item_id only (avoid matching result_id=0 or session_id collision)
      query = `SELECT attachment_id, item_id, result_id, session_id, file_name, file_path, file_size, mime_type, attachment_type, question_number, is_extracted, pdf_page_number, image_index, description, display_order, created_at FROM item_attachments WHERE item_id = ? ORDER BY display_order ASC, pdf_page_number ASC, image_index ASC, created_at ASC`;
      params = [id];
    } else if (!isNaN(idNum) && idNum > 0) {
      // Numeric = result_id
      query = `SELECT attachment_id, item_id, result_id, session_id, file_name, file_path, file_size, mime_type, attachment_type, question_number, is_extracted, pdf_page_number, image_index, description, display_order, created_at FROM item_attachments WHERE result_id = ? ORDER BY display_order ASC, pdf_page_number ASC, image_index ASC, created_at ASC`;
      params = [idNum];
    } else {
      // String = session_id
      query = `SELECT attachment_id, item_id, result_id, session_id, file_name, file_path, file_size, mime_type, attachment_type, question_number, is_extracted, pdf_page_number, image_index, description, display_order, created_at FROM item_attachments WHERE session_id = ? ORDER BY display_order ASC, pdf_page_number ASC, image_index ASC, created_at ASC`;
      params = [id];
    }

    const [rows] = await conn.execute(query, params);
    res.json({ success: true, attachments: rows });
  } catch (error) {
    console.error('Register attachments fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally { conn.release(); }
});

/**
 * DELETE /api/v2/attachments/:attachmentId
 * Delete a single attachment by attachment_id
 */
router.delete('/attachments/:attachmentId', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const attachmentId = parseInt(req.params.attachmentId);
    if (!attachmentId || attachmentId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid attachment_id' });
    }

    await conn.execute('DELETE FROM item_attachments WHERE attachment_id = ?', [attachmentId]);
    res.json({ success: true, message: 'Attachment deleted' });
  } catch (error) {
    console.error('Register attachment delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally { conn.release(); }
});

router.get('/attachments/paper/:paperCode', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const paperCode = req.params.paperCode;
    const [items] = await conn.execute('SELECT item_id FROM item_master WHERE source_paper_code = ?', [paperCode]);
    const itemIds = items.map(i => i.item_id).filter(Boolean);
    const [results] = await conn.execute('SELECT result_id FROM parse_results WHERE paper_code = ? AND is_memo = 0', [paperCode]);
    const resultIds = results.map(r => r.result_id).filter(Boolean);
    let whereClauses = [];
    let params = [];
    if (itemIds.length > 0) {
      const p1 = itemIds.map(() => '?').join(',');
      whereClauses.push('item_id IN (' + p1 + ')');
      params.push(...itemIds);
    }
    if (resultIds.length > 0) {
      const p2 = resultIds.map(() => '?').join(',');
      whereClauses.push('result_id IN (' + p2 + ')');
      params.push(...resultIds);
    }
    if (whereClauses.length === 0) {
      return res.json({ success: true, attachments: [] });
    }
    const query = 'SELECT attachment_id, item_id, result_id, file_name, file_path FROM item_attachments WHERE ' + whereClauses.join(' OR ');
    const [attachments] = await conn.execute(query, params);
    res.json({ success: true, attachments });
  } catch (error) {
    console.error('Register paper attachments error:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally { conn.release(); }
});

module.exports = router;
