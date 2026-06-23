const express = require('express');
const router = express.Router();

// ============================================
// GET /api/dashboard/stats
// Comprehensive dashboard statistics
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const db = req.db;

    // 1. Total Items
    const [totalItemsResult] = await db.execute('SELECT COUNT(*) as count FROM item_master');
    const totalItems = totalItemsResult[0].count;

    // 2. Total Papers (generated_papers)
    const [totalPapersResult] = await db.execute('SELECT COUNT(*) as count FROM generated_papers');
    const totalPapers = totalPapersResult[0].count;

    // 3. Total Paper Templates
    const [totalTemplatesResult] = await db.execute('SELECT COUNT(*) as count FROM paper_templates');
    const totalTemplates = totalTemplatesResult[0].count;

    // 4. Total Subjects
    const [totalSubjectsResult] = await db.execute('SELECT COUNT(*) as count FROM lookup_subjects WHERE is_active = 1');
    const totalSubjects = totalSubjectsResult[0].count;

    // 5. Total CAPS Topics
    const [totalTopicsResult] = await db.execute('SELECT COUNT(*) as count FROM lookup_caps_topics');
    const totalTopics = totalTopicsResult[0].count;

    // 6. Total CAPS Subtopics
    const [totalSubtopicsResult] = await db.execute('SELECT COUNT(*) as count FROM lookup_caps_subtopics');
    const totalSubtopics = totalSubtopicsResult[0].count;

    // 7. Items by Status
    const [itemsByStatus] = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM item_master
      GROUP BY status
    `);
    const statusMap = {};
    itemsByStatus.forEach(row => { statusMap[row.status] = row.count; });

    // 8. Papers by Status
    const [papersByStatus] = await db.execute(`
      SELECT status, COUNT(*) as count
      FROM generated_papers
      GROUP BY status
    `);
    const paperStatusMap = {};
    papersByStatus.forEach(row => { paperStatusMap[row.status] = row.count; });

    // 9. Items by Assessment Body
    const [itemsByBody] = await db.execute(`
      SELECT ab.assessment_body_name, ab.assessment_origin, COUNT(*) as count
      FROM item_master im
      JOIN lookup_assessment_bodies ab ON im.assessment_body_id = ab.assessment_body_id
      GROUP BY ab.assessment_body_id
      ORDER BY count DESC
    `);

    // 10. Items by Year
    const [itemsByYear] = await db.execute(`
      SELECT ly.year_value, COUNT(*) as count
      FROM item_master im
      JOIN lookup_years ly ON im.year_id = ly.year_id
      GROUP BY ly.year_value
      ORDER BY ly.year_value DESC
    `);

    // 11. Items by Grade
    const [itemsByGrade] = await db.execute(`
      SELECT lg.grade_number, lg.grade_name, COUNT(*) as count
      FROM item_master im
      JOIN lookup_grades lg ON im.grade_id = lg.grade_id
      GROUP BY lg.grade_id
      ORDER BY lg.grade_number
    `);

    // 12. Items by Subject
    const [itemsBySubject] = await db.execute(`
      SELECT ls.subject_alpha_code, ls.subject_name, COUNT(*) as count
      FROM item_master im
      JOIN lookup_subjects ls ON im.subject_id = ls.subject_id
      GROUP BY im.subject_id
      ORDER BY count DESC
    `);

    // 13. Items by Paper
    const [itemsByPaper] = await db.execute(`
      SELECT lp.paper_no, lp.paper_name, COUNT(*) as count
      FROM item_master im
      JOIN lookup_papers lp ON im.paper_id = lp.paper_id
      GROUP BY im.paper_id
      ORDER BY lp.paper_no
    `);

    // 14. Recent Papers (last 5)
    const [recentPapers] = await db.execute(`
      SELECT gp.paper_title, gp.status, gp.total_marks, gp.subject_alpha_code, gp.paper_no,
             ly.year_value, lg.grade_name, ab.assessment_origin,
             gp.assembled_at
      FROM generated_papers gp
      LEFT JOIN lookup_years ly ON gp.year_id = ly.year_id
      LEFT JOIN lookup_grades lg ON gp.grade_id = lg.grade_id
      LEFT JOIN lookup_assessment_bodies ab ON gp.assessment_body_id = ab.assessment_body_id
      ORDER BY gp.assembled_at DESC
      LIMIT 5
    `);

    // 15. Recent Items (last 5)
    const [recentItems] = await db.execute(`
      SELECT im.question_number, im.status, im.subject_alpha_code, im.grade_id,
             im.created_at
      FROM item_master im
      ORDER BY im.created_at DESC
      LIMIT 5
    `);

    // 16. Workflow Summary (last 10 transitions)
    const [recentWorkflow] = await db.execute(`
      SELECT rw.current_state, rw.previous_state, rw.changed_by_role,
             rw.transition_reason, rw.created_at, im.question_number
      FROM review_workflow rw
      LEFT JOIN item_master im ON rw.item_id = im.item_id
      ORDER BY rw.created_at DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      stats: {
        totalItems,
        totalPapers,
        totalTemplates,
        totalSubjects,
        totalTopics,
        totalSubtopics,
        itemsByStatus: statusMap,
        papersByStatus: paperStatusMap,
        itemsByBody,
        itemsByYear,
        itemsByGrade,
        itemsBySubject,
        itemsByPaper,
        recentPapers,
        recentItems,
        recentWorkflow
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
