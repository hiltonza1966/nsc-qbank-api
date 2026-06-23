const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// PROMOTE: Move auto_corrected items from parse_results to item_master
router.post('/promote', async (req, res) => {
  try {
    const db = req.db;
    const { session_ids } = req.body;
    
    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'session_ids array required' });
    }

    const results = [];
    let totalPromoted = 0;
    let totalSkipped = 0;

    for (const sessionId of session_ids) {
      const [sessionRows] = await db.execute(
        'SELECT * FROM parse_sessions WHERE session_id = ?', [sessionId]
      );
      if (sessionRows.length === 0) {
        results.push({ session_id: sessionId, status: 'skipped', reason: 'Session not found' });
        continue;
      }
      const session = sessionRows[0];

      // Get green items
      const [greenItems] = await db.execute(
        `SELECT * FROM parse_results 
         WHERE session_id = ? AND correction_status = 'auto_corrected' AND is_memo = 0`,
        [sessionId]
      );

      let promoted = 0;
      let skipped = 0;

      for (const item of greenItems) {
        // Check if already promoted
        const [existing] = await db.execute(
          'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ?',
          [session.paper_code, item.question_number]
        );
        if (existing.length > 0) { skipped++; continue; }

        // Parse paper_code
        const parts = session.paper_code.split('_');
        const subjectAlpha = parts[0];
        const paperNo = parseInt(parts[1].replace('P', '')) || 1;
        const year = parseInt(parts[2]) || 2024;

        // Lookups
        let subjectId = null, paperId = null, yearId = null;
        const [subjectRows] = await db.execute(
          'SELECT subject_id FROM lookup_subjects WHERE UPPER(subject_alpha_code) = UPPER(?) LIMIT 1',
          [subjectAlpha]
        );
        if (subjectRows.length > 0) subjectId = subjectRows[0].subject_id;

        const [paperRows] = await db.execute(
          'SELECT paper_id FROM lookup_papers WHERE paper_no = ? LIMIT 1', [paperNo]
        );
        if (paperRows.length > 0) paperId = paperRows[0].paper_id;

        const [yearRows] = await db.execute(
          'SELECT year_id FROM lookup_years WHERE year_value = ? LIMIT 1', [year]
        );
        if (yearRows.length > 0) yearId = yearRows[0].year_id;

        const itemId = crypto.randomUUID();
        const itemCode = `${session.paper_code}_${item.question_number}`;

        await db.execute(
          `INSERT INTO item_master (
            item_id, subject_official_code, subject_alpha_code, paper_no,
            year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
            item_code, question_number, question_text, marks, marks_allocated,
            source_paper_code, source_question_number, status, review_status,
            parser_confidence, qp_marks, memo_marks, created_by, last_used_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId, subjectAlpha, subjectAlpha, paperNo, yearId, 12, subjectId, paperId, 1, 1,
            itemCode, item.question_number, item.question_text || '',
            item.auto_corrected_marks || item.parser_extracted_marks || 0,
            item.expected_marks || item.auto_corrected_marks || 0,
            session.paper_code, item.question_number, 'draft', 'draft',
            'green', item.parser_extracted_marks, item.memo_marks || 0,
            1, new Date(session.created_at).toISOString().slice(0, 10)
          ]
        );

        await db.execute(
          'UPDATE parse_results SET correction_status = ? WHERE result_id = ?',
          ['validated', item.result_id]
        );

        promoted++;
      }

      totalPromoted += promoted;
      totalSkipped += skipped;
      results.push({ session_id: sessionId, paper_code: session.paper_code, status: 'success', promoted, skipped });
    }

    res.json({ success: true, summary: { total_sessions: session_ids.length, total_promoted: totalPromoted, total_skipped: totalSkipped }, results });

  } catch (e) {
    console.error('Promote error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET REVIEW ITEMS
router.get('/review-items', async (req, res) => {
  try {
    const db = req.db;
    const { paper_code, status, page = 1, limit = 50 } = req.query;
    let whereClause = "WHERE correction_status IN ('manual_review', 'parser_missing') AND is_memo = 0";
    const params = [];

    if (paper_code) { whereClause += ' AND paper_code = ?'; params.push(paper_code); }
    if (status) { whereClause += ' AND correction_status = ?'; params.push(status); }

    const [paperCodes] = await db.execute(
      `SELECT DISTINCT paper_code FROM parse_results WHERE correction_status IN ('manual_review', 'parser_missing') AND is_memo = 0 ORDER BY paper_code`
    );

    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM parse_results ${whereClause}`, params);
    const total = countRows[0].total;

    const [items] = await db.execute(
      `SELECT pr.*, ps.subject_name, ps.year, ps.paper_no
       FROM parse_results pr LEFT JOIN parse_sessions ps ON pr.session_id = ps.session_id
       ${whereClause} ORDER BY pr.paper_code, pr.question_number LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]
    );

    res.json({ success: true, total, page: parseInt(page), limit: parseInt(limit), paper_codes: paperCodes.map(p => p.paper_code), items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// UPDATE REVIEW ITEM
router.put('/review-items/:resultId', async (req, res) => {
  try {
    const db = req.db;
    const { resultId } = req.params;
    const updates = [];
    const params = [];
    const fields = ['question_text', 'answer_text', 'parser_extracted_marks', 'expected_marks', 'correction_status', 'reviewer_notes', 'user_corrected_marks'];
    
    for (const field of fields) {
      if (req.body[field] !== undefined) { updates.push(`${field} = ?`); params.push(req.body[field]); }
    }
    
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'No fields to update' });
    params.push(resultId);
    await db.execute(`UPDATE parse_results SET ${updates.join(', ')}, updated_at = NOW() WHERE result_id = ?`, params);
    res.json({ success: true, message: 'Item updated' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE REVIEW ITEM
router.delete('/review-items/:resultId', async (req, res) => {
  try {
    const db = req.db;
    await db.execute('DELETE FROM parse_results WHERE result_id = ?', [req.params.resultId]);
    res.json({ success: true, message: 'Item deleted' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET PROMOTED ITEMS
router.get('/promoted-items', async (req, res) => {
  try {
    const db = req.db;
    const { paper_code, page = 1, limit = 50 } = req.query;
    let whereClause = "WHERE parser_confidence IS NOT NULL";
    const params = [];
    if (paper_code) { whereClause += ' AND source_paper_code = ?'; params.push(paper_code); }
    
    const [countRows] = await db.execute(`SELECT COUNT(*) as total FROM item_master ${whereClause}`, params);
    const [items] = await db.execute(
      `SELECT item_id, item_code, question_number, question_text, marks, marks_allocated, source_paper_code, parser_confidence, status, last_used_date, created_at FROM item_master ${whereClause} ORDER BY source_paper_code, question_number LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]
    );
    res.json({ success: true, total: countRows[0].total, page: parseInt(page), limit: parseInt(limit), items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
