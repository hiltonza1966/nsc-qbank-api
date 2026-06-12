// routes/curriculum.js
const express = require('express');
const router = express.Router();

// GET /api/curriculum/papers-with-unlinked
// Updated: uses lookup_papers + item_master + lookup_subjects, filters by subject
router.get('/papers-with-unlinked', async (req, res) => {
  try {
    const db = req.db;
    const subjectCode = req.query.subject;
    let query = `
      SELECT DISTINCT lp.paper_id, lp.paper_code, lp.paper_name, ls.subject_official_code, im.grade_id
      FROM lookup_papers lp
      JOIN item_master im ON lp.paper_id = im.paper_id
      JOIN lookup_subjects ls ON im.subject_id = ls.subject_id
      WHERE (im.caps_subtopic_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM item_caps_mapping icm WHERE icm.item_id = im.item_id
      ))
      AND im.status != 'archived'
    `;
    const params = [];
    if (subjectCode) {
      query += ' AND ls.subject_official_code = ?';
      params.push(subjectCode);
    }
    query += ' ORDER BY lp.display_order';
    const [papers] = await db.query(query, params);
    res.json({ papers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/curriculum/unlinked/:paperId
// Updated: uses item_master with UUID item_id
router.get('/unlinked/:paperId', async (req, res) => {
  try {
    const db = req.db;
    const [items] = await db.query(`
      SELECT im.item_id, im.question_number, im.question_text, im.marks,
             NULL as topic_id, NULL as subtopic_id
      FROM item_master im
      WHERE im.paper_id = ?
        AND (im.caps_subtopic_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM item_caps_mapping icm WHERE icm.item_id = im.item_id
        ))
        AND im.status != 'archived'
      ORDER BY im.question_number
    `, [req.params.paperId]);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/curriculum/subjects/:subjectCode/topics
// UNCHANGED - already works with lookup_caps_topics
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

// GET /api/curriculum/subjects/:subjectCode/grades/:grade/topics
// UNCHANGED - already works with lookup_caps_topics
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

// GET /api/curriculum/topics/:topicId/items
// Updated: uses item_master + item_caps_mapping
router.get('/topics/:topicId/items', async (req, res) => {
  try {
    const db = req.db;
    const [items] = await db.query(`
      SELECT im.item_id, im.question_number, im.question_text, im.marks,
             icm.topic_id, icm.subtopic_id
      FROM item_master im
      JOIN item_caps_mapping icm ON im.item_id = icm.item_id
      WHERE icm.topic_id = ?
      ORDER BY im.question_number
    `, [req.params.topicId]);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/curriculum/topics/:topicId/subtopics
// UNCHANGED - already works with lookup_caps_subtopics
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

// POST /api/curriculum/bulk-link
// Updated: inserts into item_caps_mapping and updates item_master.caps_subtopic_id
router.post('/bulk-link', async (req, res) => {
  try {
    const db = req.db;
    const { links } = req.body;
    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array required' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const link of links) {
        // Get item details for item_caps_mapping
        const [itemRows] = await connection.query(
          'SELECT grade_id, paper_id FROM item_master WHERE item_id = ?',
          [link.item_id]
        );
        const item = itemRows[0];

        if (item) {
          // Insert into item_caps_mapping
          await connection.query(`
            INSERT INTO item_caps_mapping 
            (item_id, topic_id, subtopic_id, grade_id, paper_id, mapped_at, is_primary_mapping)
            VALUES (?, ?, ?, ?, ?, NOW(), 1)
            ON DUPLICATE KEY UPDATE
            subtopic_id = VALUES(subtopic_id),
            mapped_at = VALUES(mapped_at)
          `, [link.item_id, link.topic_id, link.subtopic_id || null, item.grade_id, item.paper_id]);
        }

        // Update item_master.caps_subtopic_id
        await connection.query(
          'UPDATE item_master SET caps_subtopic_id = ? WHERE item_id = ?',
          [link.subtopic_id || link.topic_id, link.item_id]
        );
      }

      await connection.commit();
      res.json({ success: true, updated: links.length });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/curriculum/coverage/:subject/:grade
// UNCHANGED - uses lookup_caps_topics + item_caps_mapping
router.get('/coverage/:subject/:grade', async (req, res) => {
  try {
    const db = req.db;
    const gradeId = parseInt(req.params.grade) - 9;
    const [coverage] = await db.query(`
      SELECT 
        t.topic_id,
        t.topic_name,
        COUNT(icm.mapping_id) as question_count,
        SUM(im.marks) as total_marks,
        ROUND(COUNT(icm.mapping_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM item_caps_mapping WHERE grade_id = ?), 0), 2) as coverage_percent
      FROM lookup_caps_topics t
      LEFT JOIN item_caps_mapping icm ON t.topic_id = icm.topic_id AND icm.grade_id = ?
      LEFT JOIN item_master im ON icm.item_id = im.item_id
      WHERE t.subject_official_code = ? AND t.grade_id = ?
      GROUP BY t.topic_id, t.topic_name
      ORDER BY t.topic_order
    `, [gradeId, gradeId, req.params.subject, gradeId]);
    res.json({ coverage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/curriculum/gaps/:subject/:grade
// UNCHANGED - uses lookup_caps_topics + item_caps_mapping
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
      LEFT JOIN item_caps_mapping icm ON t.topic_id = icm.topic_id AND icm.grade_id = ?
      WHERE t.subject_official_code = ? AND t.grade_id = ? AND icm.mapping_id IS NULL
      ORDER BY t.topic_order
    `, [gradeId, req.params.subject, gradeId]);
    res.json({ gaps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
