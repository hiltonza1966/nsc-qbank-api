// routes/curriculum.js
const express = require('express');
const router = express.Router();

// GET /curriculum/papers-with-unlinked
router.get('/papers-with-unlinked', async (req, res) => {
  try {
    const db = req.db;
    const [papers] = await db.query(`
      SELECT DISTINCT p.paper_id, p.paper_code, p.paper_name, p.subject_official_code, p.grade_id
      FROM question_papers p
      INNER JOIN paper_items pi ON p.paper_id = pi.paper_id
      WHERE pi.topic_id IS NULL OR pi.subtopic_id IS NULL
      ORDER BY p.paper_code
    `);
    res.json({ papers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/unlinked/:paperId
router.get('/unlinked/:paperId', async (req, res) => {
  try {
    const db = req.db;
    const [items] = await db.query(`
      SELECT pi.item_id, pi.question_number, pi.question_text, pi.marks, pi.topic_id, pi.subtopic_id
      FROM paper_items pi
      WHERE pi.paper_id = ? AND (pi.topic_id IS NULL OR pi.subtopic_id IS NULL)
      ORDER BY pi.question_number
    `, [req.params.paperId]);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/subjects/:subjectCode/topics
router.get('/subjects/:subjectCode/topics', async (req, res) => {
  try {
    const db = req.db;
    const [topics] = await db.query(`
      SELECT t.topic_id, t.topic_code, t.topic_name, t.grade_id
      FROM lookup_caps_topics t
      WHERE t.subject_official_code = ?
      ORDER BY t.topic_order, t.topic_code
    `, [req.params.subjectCode]);
    res.json({ topics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/subjects/:subjectCode/grades/:grade/topics
router.get('/subjects/:subjectCode/grades/:grade/topics', async (req, res) => {
  try {
    const db = req.db;
    const gradeId = parseInt(req.params.grade) - 9;
    const [topics] = await db.query(`
      SELECT t.topic_id, t.topic_code, t.topic_name, t.grade_id
      FROM lookup_caps_topics t
      WHERE t.subject_official_code = ? AND t.grade_id = ?
      ORDER BY t.topic_order, t.topic_code
    `, [req.params.subjectCode, gradeId]);
    res.json({ topics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/topics/:topicId/items
router.get('/topics/:topicId/items', async (req, res) => {
  try {
    const db = req.db;
    const [items] = await db.query(`
      SELECT pi.item_id, pi.question_number, pi.question_text, pi.marks, pi.topic_id, pi.subtopic_id
      FROM paper_items pi
      WHERE pi.topic_id = ?
      ORDER BY pi.question_number
    `, [req.params.topicId]);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/topics/:topicId/subtopics
router.get('/topics/:topicId/subtopics', async (req, res) => {
  try {
    const db = req.db;
    const [subtopics] = await db.query(`
      SELECT s.subtopic_id, s.subtopic_code, s.subtopic_name, s.topic_id
      FROM lookup_caps_subtopics s
      WHERE s.topic_id = ?
      ORDER BY s.subtopic_order, s.subtopic_code
    `, [req.params.topicId]);
    res.json({ subtopics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /curriculum/bulk-link
router.post('/bulk-link', async (req, res) => {
  try {
    const db = req.db;
    const { links } = req.body;
    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array required' });
    }

    for (const link of links) {
      await db.query(`
        UPDATE paper_items 
        SET topic_id = ?, subtopic_id = ? 
        WHERE item_id = ?
      `, [link.topic_id, link.subtopic_id, link.item_id]);
    }

    res.json({ success: true, updated: links.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/coverage/:subject/:grade
router.get('/coverage/:subject/:grade', async (req, res) => {
  try {
    const db = req.db;
    const gradeId = parseInt(req.params.grade) - 9;
    const [coverage] = await db.query(`
      SELECT 
        t.topic_id,
        t.topic_name,
        COUNT(pi.item_id) as question_count,
        SUM(pi.marks) as total_marks,
        ROUND(COUNT(pi.item_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM paper_items WHERE topic_id IS NOT NULL), 0), 2) as coverage_percent
      FROM lookup_caps_topics t
      LEFT JOIN paper_items pi ON t.topic_id = pi.topic_id
      WHERE t.subject_official_code = ? AND t.grade_id = ?
      GROUP BY t.topic_id, t.topic_name
      ORDER BY t.topic_order
    `, [req.params.subject, gradeId]);
    res.json({ coverage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /curriculum/gaps/:subject/:grade
router.get('/gaps/:subject/:grade', async (req, res) => {
  try {
    const db = req.db;
    const gradeId = parseInt(req.params.grade) - 9;
    const [gaps] = await db.query(`
      SELECT 
        t.topic_id,
        t.topic_name,
        'No questions linked' as gap_type,
        'high' as severity,
        'Add questions covering this topic' as recommended_action
      FROM lookup_caps_topics t
      LEFT JOIN paper_items pi ON t.topic_id = pi.topic_id
      WHERE t.subject_official_code = ? AND t.grade_id = ? AND pi.item_id IS NULL
      ORDER BY t.topic_order
    `, [req.params.subject, gradeId]);
    res.json({ gaps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
