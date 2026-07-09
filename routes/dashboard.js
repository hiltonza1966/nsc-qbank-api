const express = require('express');
const router = express.Router();

/**
 * GET /api/dashboard/papers
 * Returns summary of all uploaded papers with item counts
 * Aggregates from parse_sessions, parse_expected_structure, parse_results
 */
router.get('/papers', async (req, res) => {
  try {
    // Get all sessions with their paper codes
    const [sessions] = await req.db.query(`
      SELECT 
        session_id,
        paper_code,
        file_name,
        is_memo,
        total_items_found,
        total_marks_expected,
        total_marks_corrected,
        status,
        created_at,
        completed_at
      FROM parse_sessions
      ORDER BY created_at DESC
    `);

    // Get expected structure counts per paper
    const [expectedCounts] = await req.db.query(`
      SELECT 
        paper_code,
        COUNT(*) as expected_items,
        SUM(expected_marks) as expected_marks
      FROM parse_expected_structure
      GROUP BY paper_code
    `);

    // Get parse results counts per paper (via session join)
    const [resultCounts] = await req.db.query(`
      SELECT 
        ps.paper_code,
        COUNT(pr.result_id) as parsed_items,
        SUM(CASE WHEN pr.correction_status = 'auto_corrected' THEN 1 ELSE 0 END) as auto_corrected,
        SUM(CASE WHEN pr.correction_status = 'manual_review' THEN 1 ELSE 0 END) as manual_review,
        SUM(CASE WHEN pr.correction_status = 'parser_missing' THEN 1 ELSE 0 END) as missing_items
      FROM parse_sessions ps
      LEFT JOIN parse_results pr ON ps.session_id = pr.session_id
      GROUP BY ps.paper_code
    `);

    // Build summary per paper_code
    const paperMap = new Map();

    for (const session of sessions) {
      if (!paperMap.has(session.paper_code)) {
        // Parse paper_code: SUBJECT_PAPER_SESSION_YEAR
        const parts = session.paper_code.split('_');
        const year = parts[parts.length - 1];
        const session_name = parts[parts.length - 2];
        const paper = parts[parts.length - 3];
        const subject = parts.slice(0, parts.length - 3).join('_');

        paperMap.set(session.paper_code, {
          paper_code: session.paper_code,
          subject: subject,
          paper: paper,
          year: year,
          session: session_name,
          file_name: session.file_name,
          latest_session_id: session.session_id,
          status: session.status,
          created_at: session.created_at,
          completed_at: session.completed_at,
          expected_items: 0,
          expected_marks: 0,
          parsed_items: 0,
          auto_corrected: 0,
          manual_review: 0,
          missing_items: 0,
          has_memo: false
        });
      }
    }

    // Add expected structure counts
    for (const ec of expectedCounts) {
      if (paperMap.has(ec.paper_code)) {
        paperMap.get(ec.paper_code).expected_items = ec.expected_items;
        paperMap.get(ec.paper_code).expected_marks = ec.expected_marks;
      }
    }

    // Add parse results counts
    for (const rc of resultCounts) {
      if (paperMap.has(rc.paper_code)) {
        const p = paperMap.get(rc.paper_code);
        p.parsed_items = rc.parsed_items;
        p.auto_corrected = rc.auto_corrected;
        p.manual_review = rc.manual_review;
        p.missing_items = rc.missing_items;
      }
    }

    // Check for memo uploads using is_memo flag
    for (const session of sessions) {
      const p = paperMap.get(session.paper_code);
      if (p && session.is_memo === 1) {
        p.has_memo = true;
      }
    }

    const papers = Array.from(paperMap.values());

    // Get subject names for display
    const [subjects] = await req.db.query(`
      SELECT subject_official_code, subject_name FROM lookup_subjects
    `);
    const subjectMap = {};
    for (const s of subjects) {
      subjectMap[s.subject_official_code] = s.subject_name;
    }

    // Add subject names to papers
    for (const p of papers) {
      p.subject_name = subjectMap[p.subject] || p.subject;
    }

    res.json({
      success: true,
      total_papers: papers.length,
      papers: papers
    });

  } catch (error) {
    console.error('Dashboard papers error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/stats
 * Returns aggregate statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const [paperCounts] = await req.db.query(`
      SELECT 
        COUNT(DISTINCT paper_code) as total_papers,
        COUNT(*) as total_sessions
      FROM parse_sessions
    `);

    const [itemCounts] = await req.db.query(`
      SELECT 
        COUNT(*) as total_expected_items,
        SUM(expected_marks) as total_expected_marks
      FROM parse_expected_structure
    `);

    const [resultCounts] = await req.db.query(`
      SELECT 
        COUNT(*) as total_parsed_items,
        SUM(CASE WHEN correction_status = 'auto_corrected' THEN 1 ELSE 0 END) as auto_corrected,
        SUM(CASE WHEN correction_status = 'manual_review' THEN 1 ELSE 0 END) as manual_review
      FROM parse_results
    `);

    const [attachmentCounts] = await req.db.query(`
      SELECT COUNT(*) as total_attachments FROM item_attachments
    `);

    res.json({
      success: true,
      stats: {
        total_papers: paperCounts[0].total_papers,
        total_sessions: paperCounts[0].total_sessions,
        total_expected_items: itemCounts[0].total_expected_items,
        total_expected_marks: itemCounts[0].total_expected_marks,
        total_parsed_items: resultCounts[0].total_parsed_items,
        auto_corrected: resultCounts[0].auto_corrected,
        manual_review: resultCounts[0].manual_review,
        total_attachments: attachmentCounts[0].total_attachments
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/attachments/count
 * Dedicated endpoint for attachment count to avoid route collision with loadedDashboard.js
 */
router.get('/attachments/count', async (req, res) => {
  try {
    const [attachmentCounts] = await req.db.query(`
      SELECT COUNT(*) as total_attachments FROM item_attachments
    `);

    res.json({
      success: true,
      total_attachments: attachmentCounts[0].total_attachments
    });

  } catch (error) {
    console.error('Dashboard attachments count error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
