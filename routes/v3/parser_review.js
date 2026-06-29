const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { promoteSessionToItemMaster } = require('../../utils/promoteSession');

// PROMOTE: Uses shared promotion function
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

      // Build dimensions from session
      const dimensions = {
        subject_id: session.subject_id,
        paper_id: session.paper_id,
        year_id: session.year_id,
        grade_id: session.grade_id,
        assessment_type_id: session.assessment_type_id,
        assessment_body_id: session.assessment_body_id,
        paper_no: session.paper_no,
        year: session.year,
        language: session.language
      };

      // Get paper_no from lookup_papers if not in session
      if (!dimensions.paper_no && dimensions.paper_id) {
        const [paperRows] = await db.execute(
          'SELECT paper_no FROM lookup_papers WHERE paper_id = ? LIMIT 1', [dimensions.paper_id]
        );
        if (paperRows.length > 0) dimensions.paper_no = paperRows[0].paper_no;
      }

      // Get year from lookup_years if not in session
      if (!dimensions.year && dimensions.year_id) {
        const [yearRows] = await db.execute(
          'SELECT year_value FROM lookup_years WHERE year_id = ? LIMIT 1', [dimensions.year_id]
        );
        if (yearRows.length > 0) dimensions.year = yearRows[0].year_value;
      }

      // Call shared promotion function
      const result = await promoteSessionToItemMaster(db, sessionId, session.paper_code, dimensions, 1);

      const promoted = result.inserted || 0;
      const skipped = result.skipped || 0;

      // Update parse_results status to 'validated' for promoted items
      if (promoted > 0) {
        await db.execute(
          'UPDATE parse_results SET correction_status = ? WHERE session_id = ? AND correction_status = ?',
          ['validated', sessionId, 'auto_corrected']
        );
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

// GET PROMOTED ITEMS// GET PROMOTED ITEMS
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
