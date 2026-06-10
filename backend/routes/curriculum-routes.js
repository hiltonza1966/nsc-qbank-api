/**
 * routes/curriculum.js
 * ===================
 * API endpoints for CAPS curriculum operations
 * 
 * Endpoints:
 * - GET /api/curriculum/subjects/:subject_code/topics
 * - GET /api/curriculum/subjects/:subject_code/grades/:grade/topics
 * - GET /api/curriculum/topics/:topic_id/items
 * - GET /api/curriculum/coverage/:subject_code/:grade
 * - GET /api/curriculum/gaps/:subject_code/:grade
 * - POST /api/curriculum/items/:item_id/map
 * - POST /api/curriculum/assemble-by-caps
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// Middleware: require db connection
const requireDB = (req, res, next) => {
  if (!req.db) {
    return res.status(500).json({ error: 'Database connection not available' });
  }
  next();
};

// ============================================================
// GET /api/curriculum/subjects/:subject_code/topics
// Get all CAPS topics for a subject (all grades)
// ============================================================
router.get('/subjects/:subject_code/topics', requireDB, async (req, res) => {
  try {
    const { subject_code } = req.params;

    const [topics] = await req.db.execute(`
      SELECT 
        t.topic_id,
        t.topic_code,
        t.topic_name,
        t.grade_id,
        t.strand,
        t.term,
        t.topic_weighting,
        t.time_weeks,
        t.paper_no,
        t.description,
        t.display_order,
        COUNT(s.subtopic_id) as subtopic_count
      FROM lookup_caps_topics t
      LEFT JOIN lookup_caps_subtopics s ON t.topic_id = s.topic_id
      WHERE t.subject_official_code = ? AND t.is_active = 1
      GROUP BY t.topic_id
      ORDER BY t.grade_id, t.display_order
    `, [subject_code]);

    res.json({
      success: true,
      subject: subject_code,
      count: topics.length,
      topics
    });
  } catch (error) {
    console.error('Error fetching curriculum topics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/curriculum/subjects/:subject_code/grades/:grade/topics
// Get CAPS topics for a specific subject and grade
// ============================================================
router.get('/subjects/:subject_code/grades/:grade/topics', requireDB, async (req, res) => {
  try {
    const { subject_code, grade } = req.params;

    const [topics] = await req.db.execute(`
      SELECT 
        t.topic_id,
        t.topic_code,
        t.topic_name,
        t.strand,
        t.term,
        t.topic_weighting,
        t.time_weeks,
        t.paper_no,
        t.description,
        t.display_order,
        COUNT(s.subtopic_id) as subtopic_count,
        COUNT(DISTINCT m.item_id) as item_count,
        COALESCE(SUM(im.marks), 0) as total_marks_available
      FROM lookup_caps_topics t
      LEFT JOIN lookup_caps_subtopics s ON t.topic_id = s.topic_id
      LEFT JOIN item_caps_mapping m ON t.topic_id = m.topic_id AND m.is_primary_mapping = 1
      LEFT JOIN item_master im ON m.item_id = im.item_id AND im.is_retired = 0
      WHERE t.subject_official_code = ? AND t.grade_id = ? AND t.is_active = 1
      GROUP BY t.topic_id
      ORDER BY t.display_order
    `, [subject_code, grade]);

    res.json({
      success: true,
      subject: subject_code,
      grade: grade,
      count: topics.length,
      topics
    });
  } catch (error) {
    console.error('Error fetching grade topics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/curriculum/topics/:topic_id/items
// Get all items mapped to a specific CAPS topic
// ============================================================
router.get('/topics/:topic_id/items', requireDB, async (req, res) => {
  try {
    const { topic_id } = req.params;
    const { status = 'published', cognitive_level, difficulty, limit = 50 } = req.query;

    let query = `
      SELECT 
        im.item_id,
        im.item_code,
        im.question_number,
        LEFT(im.question_text, 200) as question_preview,
        im.marks,
        im.status,
        im.exposure_count,
        im.last_used_date,
        im.facility_value,
        im.discrimination_index,
        cl.level_name as cognitive_level,
        dl.level_name as difficulty_level,
        il.level_name as item_type,
        m.mapping_confidence,
        m.mapped_at,
        cs.subtopic_code,
        cs.subtopic_name
      FROM item_master im
      JOIN item_caps_mapping m ON im.item_id = m.item_id
      LEFT JOIN lookup_cognitive_levels cl ON im.cognitive_level_id = cl.cognitive_level_id
      LEFT JOIN lookup_difficulty_levels dl ON im.difficulty_id = dl.difficulty_level_id
      LEFT JOIN lookup_item_types il ON im.item_type_id = il.item_type_id
      LEFT JOIN lookup_caps_subtopics cs ON m.subtopic_id = cs.subtopic_id
      WHERE m.topic_id = ? AND m.is_primary_mapping = 1
        AND im.is_retired = 0
    `;

    const params = [topic_id];

    if (status !== 'all') {
      query += ` AND im.status = ?`;
      params.push(status);
    }

    if (cognitive_level) {
      query += ` AND cl.level_name = ?`;
      params.push(cognitive_level);
    }

    if (difficulty) {
      query += ` AND dl.level_name = ?`;
      params.push(difficulty);
    }

    query += ` ORDER BY im.exposure_count ASC, im.facility_value DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [items] = await req.db.execute(query, params);

    res.json({
      success: true,
      topic_id,
      count: items.length,
      items
    });
  } catch (error) {
    console.error('Error fetching topic items:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/curriculum/coverage/:subject_code/:grade
// Get curriculum coverage analysis
// ============================================================
router.get('/coverage/:subject_code/:grade', requireDB, async (req, res) => {
  try {
    const { subject_code, grade } = req.params;

    const [coverage] = await req.db.execute(`
      SELECT * FROM vw_curriculum_coverage
      WHERE subject_official_code = ? AND grade_id = ?
    `, [subject_code, grade]);

    // Calculate summary statistics
    const totalTopics = coverage.length;
    const wellCovered = coverage.filter(t => t.coverage_status === 'WELL_COVERED').length;
    const adequate = coverage.filter(t => t.coverage_status === 'ADEQUATE').length;
    const insufficient = coverage.filter(t => t.coverage_status === 'INSUFFICIENT').length;
    const noItems = coverage.filter(t => t.coverage_status === 'NO_ITEMS').length;

    res.json({
      success: true,
      subject: subject_code,
      grade: grade,
      summary: {
        total_topics: totalTopics,
        well_covered: wellCovered,
        adequate: adequate,
        insufficient: insufficient,
        no_items: noItems,
        coverage_percent: Math.round(((wellCovered + adequate) / totalTopics) * 100)
      },
      coverage
    });
  } catch (error) {
    console.error('Error fetching coverage:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/curriculum/gaps/:subject_code/:grade
// Get curriculum gaps (topics needing items)
// ============================================================
router.get('/gaps/:subject_code/:grade', requireDB, async (req, res) => {
  try {
    const { subject_code, grade } = req.params;

    const [gaps] = await req.db.execute(`
      SELECT * FROM vw_curriculum_gaps
      WHERE subject_official_code = ? AND grade_id = ?
    `, [subject_code, grade]);

    res.json({
      success: true,
      subject: subject_code,
      grade: grade,
      gap_count: gaps.length,
      gaps
    });
  } catch (error) {
    console.error('Error fetching gaps:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/curriculum/items/:item_id/map
// Map an item to a CAPS topic/subtopic
// ============================================================
router.post('/items/:item_id/map', requireDB, async (req, res) => {
  try {
    const { item_id } = req.params;
    const { topic_id, subtopic_id, cognitive_level, assessment_verb, curriculum_weight, is_primary = true, notes } = req.body;
    const mapped_by = req.user?.user_id || 1; // Default to admin if no auth

    // Validate item exists
    const [items] = await req.db.execute('SELECT item_id FROM item_master WHERE item_id = ?', [item_id]);
    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // If setting as primary, unset other primary mappings
    if (is_primary) {
      await req.db.execute(`
        UPDATE item_caps_mapping 
        SET is_primary_mapping = 0 
        WHERE item_id = ? AND is_primary_mapping = 1
      `, [item_id]);
    }

    // Insert or update mapping
    await req.db.execute(`
      INSERT INTO item_caps_mapping 
      (item_id, topic_id, subtopic_id, cognitive_level, assessment_verb, curriculum_weight, is_primary_mapping, mapped_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      subtopic_id = VALUES(subtopic_id),
      cognitive_level = VALUES(cognitive_level),
      assessment_verb = VALUES(assessment_verb),
      curriculum_weight = VALUES(curriculum_weight),
      is_primary_mapping = VALUES(is_primary_mapping),
      mapped_by = VALUES(mapped_by),
      notes = VALUES(notes),
      mapped_at = CURRENT_TIMESTAMP
    `, [item_id, topic_id, subtopic_id, cognitive_level, assessment_verb, curriculum_weight, is_primary ? 1 : 0, mapped_by, notes]);

    res.json({
      success: true,
      message: 'Item mapped to CAPS curriculum successfully',
      item_id,
      topic_id,
      subtopic_id
    });
  } catch (error) {
    console.error('Error mapping item:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/curriculum/assemble-by-caps
// Assemble a paper using curriculum constraints
// ============================================================
router.post('/assemble-by-caps', requireDB, async (req, res) => {
  try {
    const {
      template_id,
      subject_code,
      grade_id,
      paper_id,
      assessment_type_id,
      assessment_body_id,
      year_id,
      constraints = [], // Array of {topic_id, min_items, max_items, min_marks, cognitive_level}
      exclude_items = [], // Array of item_ids to exclude
      prefer_unused = true
    } = req.body;

    const assembledItems = [];
    const usedItemIds = [...exclude_items];
    let totalMarks = 0;

    // For each curriculum constraint, select items
    for (const constraint of constraints) {
      const { topic_id, min_items, max_items, min_marks, max_marks, cognitive_level } = constraint;

      // Use the database function to get candidate items
      const [candidates] = await req.db.execute(`
        SELECT fn_get_caps_topic_items(?, ?, ?, ?, ?, ?) as items
      `, [topic_id, cognitive_level, null, min_marks || 1, max_marks || 50, JSON.stringify(usedItemIds)]);

      const items = JSON.parse(candidates[0].items);
      const selectedItems = items.slice(0, max_items || items.length);

      for (const item of selectedItems) {
        if (totalMarks + item.marks > (req.body.total_marks || 150)) break;

        assembledItems.push({
          ...item,
          topic_id,
          constraint_type: constraint.type || 'required'
        });

        usedItemIds.push(item.item_id);
        totalMarks += item.marks;
      }
    }

    res.json({
      success: true,
      template_id,
      total_items: assembledItems.length,
      total_marks: totalMarks,
      items: assembledItems,
      coverage: assembledItems.reduce((acc, item) => {
        acc[item.topic_id] = (acc[item.topic_id] || 0) + 1;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Error assembling paper:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/curriculum/paper-structure/:paper_code
// Get paper structure with curriculum details
// ============================================================
router.get('/paper-structure/:paper_code', requireDB, async (req, res) => {
  try {
    const { paper_code } = req.params;

    const [structure] = await req.db.execute(`
      SELECT * FROM vw_paper_structure_curriculum
      WHERE paper_code = ?
      ORDER BY sequence
    `, [paper_code]);

    // Group by section
    const sections = structure.reduce((acc, item) => {
      if (!acc[item.section]) {
        acc[item.section] = { items: [], total_marks: 0 };
      }
      acc[item.section].items.push(item);
      acc[item.section].total_marks += item.expected_marks;
      return acc;
    }, {});

    res.json({
      success: true,
      paper_code,
      sections,
      total_items: structure.length,
      total_marks: structure.reduce((sum, item) => sum + item.expected_marks, 0)
    });
  } catch (error) {
    console.error('Error fetching paper structure:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
