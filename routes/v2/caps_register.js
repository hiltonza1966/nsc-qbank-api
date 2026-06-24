const express = require('express');
const router = express.Router();

// ============================================
// GET /api/v2/caps-register
// CAPS ATP & POA Register — Data Quality Dashboard
// Groups by Subject, Grade, Paper (NOT term)
// Topics and Subtopics shown regardless of term
// Term is only relevant for ATP/POA comparison
// ============================================
router.get('/caps-register', async (req, res) => {
  try {
    const db = req.db;
    const { subject, grade, paper_no, show_errors_only } = req.query;

    // --- ATP Data: Count entries per subject/grade/paper from caps_atp_content ---
    let atpQuery = `
      SELECT
        subject_official_code,
        MIN(subject_name) as subject_name,
        grade,
        COALESCE(paper_no, 1) as paper_no,
        paper_code,
        COUNT(DISTINCT topic) as atp_topic_count,
        COUNT(*) as atp_entry_count
      FROM caps_atp_content
      WHERE 1=1
    `;
    const atpParams = [];
    if (subject) { atpQuery += ' AND subject_official_code = ?'; atpParams.push(subject); }
    if (grade) { atpQuery += ' AND grade = ?'; atpParams.push(parseInt(grade)); }
    if (paper_no) { atpQuery += ' AND paper_no = ?'; atpParams.push(parseInt(paper_no)); }
    atpQuery += ' GROUP BY subject_official_code, grade, paper_no, paper_code ORDER BY subject_official_code, grade, paper_no';

    const [atpData] = await db.query(atpQuery, atpParams);

    // --- POA Data: Count entries per subject/grade/paper from caps_poa_template ---
    let poaQuery = `
      SELECT
        subject_official_code,
        MIN(subject_name) as subject_name,
        grade,
        COALESCE(paper_no, 1) as paper_no,
        paper_code,
        COUNT(DISTINCT topic) as poa_topic_count,
        COUNT(*) as poa_entry_count
      FROM caps_poa_template
      WHERE 1=1
    `;
    const poaParams = [];
    if (subject) { poaQuery += ' AND subject_official_code = ?'; poaParams.push(subject); }
    if (grade) { poaQuery += ' AND grade = ?'; poaParams.push(parseInt(grade)); }
    if (paper_no) { poaQuery += ' AND paper_no = ?'; poaParams.push(parseInt(paper_no)); }
    poaQuery += ' GROUP BY subject_official_code, grade, paper_no, paper_code ORDER BY subject_official_code, grade, paper_no';

    const [poaData] = await db.query(poaQuery, poaParams);

    // --- Topics Data: Count topics per subject/grade/paper (ignoring term) ---
    let topicsQuery = `
      SELECT
        subject_official_code,
        grade_number as grade,
        COALESCE(paper_no, 1) as paper_no,
        COUNT(*) as topic_count
      FROM lookup_caps_topics
      WHERE 1=1
    `;
    const topicsParams = [];
    if (subject) { topicsQuery += ' AND subject_official_code = ?'; topicsParams.push(subject); }
    if (grade) { topicsQuery += ' AND grade_number = ?'; topicsParams.push(parseInt(grade)); }
    if (paper_no) { topicsQuery += ' AND paper_no = ?'; topicsParams.push(parseInt(paper_no)); }
    topicsQuery += ' GROUP BY subject_official_code, grade_number, paper_no';

    const [topicsData] = await db.query(topicsQuery, topicsParams);

    // --- Subtopics Data: Count subtopics per subject/grade/paper (ignoring term) ---
    let subtopicsQuery = `
      SELECT
        t.subject_official_code,
        t.grade_number as grade,
        COALESCE(t.paper_no, 1) as paper_no,
        COUNT(*) as subtopic_count
      FROM lookup_caps_subtopics st
      INNER JOIN lookup_caps_topics t ON st.topic_id = t.topic_id
      WHERE 1=1
    `;
    const subtopicsParams = [];
    if (subject) { subtopicsQuery += ' AND t.subject_official_code = ?'; subtopicsParams.push(subject); }
    if (grade) { subtopicsQuery += ' AND t.grade_number = ?'; subtopicsParams.push(parseInt(grade)); }
    if (paper_no) { subtopicsQuery += ' AND t.paper_no = ?'; subtopicsParams.push(parseInt(paper_no)); }
    subtopicsQuery += ' GROUP BY t.subject_official_code, t.grade_number, t.paper_no';

    const [subtopicsData] = await db.query(subtopicsQuery, subtopicsParams);

    // --- Combine all data into a unified register ---
    const registerMap = new Map();
    const buildKey = (subj, grd, pno) => `${subj || 'NULL'}_${grd !== null ? grd : 'NULL'}_${pno || 1}`;

    // Process ATP data
    atpData.forEach(row => {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      registerMap.set(key, {
        subject_official_code: row.subject_official_code,
        subject_name: row.subject_name || '',
        grade: row.grade,
        paper_no: row.paper_no || 1,
        paper_code: row.paper_code || '',
        atp_entry_count: parseInt(row.atp_entry_count) || 0,
        atp_topic_count: parseInt(row.atp_topic_count) || 0,
        poa_entry_count: 0,
        poa_topic_count: 0,
        topic_count: 0,
        subtopic_count: 0,
        data_quality_issues: []
      });
    });

    // Process POA data
    poaData.forEach(row => {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      if (registerMap.has(key)) {
        const existing = registerMap.get(key);
        existing.poa_entry_count = parseInt(row.poa_entry_count) || 0;
        existing.poa_topic_count = parseInt(row.poa_topic_count) || 0;
      } else {
        registerMap.set(key, {
          subject_official_code: row.subject_official_code,
          subject_name: row.subject_name || '',
          grade: row.grade,
          paper_no: row.paper_no || 1,
          paper_code: row.paper_code || '',
          atp_entry_count: 0,
          atp_topic_count: 0,
          poa_entry_count: parseInt(row.poa_entry_count) || 0,
          poa_topic_count: parseInt(row.poa_topic_count) || 0,
          topic_count: 0,
          subtopic_count: 0,
          data_quality_issues: []
        });
      }
    });

    // Process Topics data
    topicsData.forEach(row => {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      const issues = [];
      if (row.subject_official_code === null) issues.push('NULL subject_official_code');
      if (row.grade === null) issues.push('NULL grade');
      if (row.paper_no === null) issues.push('NULL paper_no');
      if (registerMap.has(key)) {
        const existing = registerMap.get(key);
        existing.topic_count = parseInt(row.topic_count) || 0;
        existing.data_quality_issues.push(...issues);
      } else {
        registerMap.set(key, {
          subject_official_code: row.subject_official_code,
          subject_name: '',
          grade: row.grade,
          paper_no: row.paper_no || 1,
          paper_code: '',
          atp_entry_count: 0,
          atp_topic_count: 0,
          poa_entry_count: 0,
          poa_topic_count: 0,
          topic_count: parseInt(row.topic_count) || 0,
          subtopic_count: 0,
          data_quality_issues: issues
        });
      }
    });

    // Process Subtopics data
    subtopicsData.forEach(row => {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      if (registerMap.has(key)) {
        registerMap.get(key).subtopic_count = parseInt(row.subtopic_count) || 0;
      } else {
        registerMap.set(key, {
          subject_official_code: row.subject_official_code,
          subject_name: '',
          grade: row.grade,
          paper_no: row.paper_no || 1,
          paper_code: '',
          atp_entry_count: 0,
          atp_topic_count: 0,
          poa_entry_count: 0,
          poa_topic_count: 0,
          topic_count: 0,
          subtopic_count: parseInt(row.subtopic_count) || 0,
          data_quality_issues: []
        });
      }
    });

    // Convert to array and calculate match indicators
    let results = Array.from(registerMap.values());

    results = results.map(row => {
      const issues = [...row.data_quality_issues];
      if (!row.subject_name) issues.push('Missing subject_name');
      if (!row.subject_official_code) issues.push('Missing subject_official_code');
      if (row.grade === null || row.grade === undefined) issues.push('NULL grade');

      // ATP vs Topics match
      const atpTopicDiff = row.atp_topic_count - row.topic_count;
      if (row.topic_count > 0 && atpTopicDiff !== 0) {
        issues.push(`ATP topic mismatch: ${atpTopicDiff > 0 ? '+' : ''}${atpTopicDiff}`);
      }

      // POA vs Topics match
      const poaTopicDiff = row.poa_topic_count - row.topic_count;
      if (row.topic_count > 0 && poaTopicDiff !== 0) {
        issues.push(`POA topic mismatch: ${poaTopicDiff > 0 ? '+' : ''}${poaTopicDiff}`);
      }

      // ATP vs Subtopics match
      const atpSubtopicDiff = row.atp_entry_count - row.subtopic_count;
      if (row.subtopic_count > 0 && atpSubtopicDiff !== 0) {
        issues.push(`ATP subtopic mismatch: ${atpSubtopicDiff > 0 ? '+' : ''}${atpSubtopicDiff}`);
      }

      // POA vs Subtopics match
      const poaSubtopicDiff = row.poa_entry_count - row.subtopic_count;
      if (row.subtopic_count > 0 && poaSubtopicDiff !== 0) {
        issues.push(`POA subtopic mismatch: ${poaSubtopicDiff > 0 ? '+' : ''}${poaSubtopicDiff}`);
      }

      // Missing data checks
      if (row.topic_count > 0 && row.atp_entry_count === 0) issues.push('No ATP data for topics');
      if (row.topic_count > 0 && row.poa_entry_count === 0) issues.push('No POA data for topics');
      if (row.atp_entry_count > 0 && row.topic_count === 0) issues.push('ATP exists but no topics');
      if (row.topic_count > 0 && row.subtopic_count === 0) issues.push('Topics exist but no subtopics');

      return {
        ...row,
        atp_topic_variance: row.atp_topic_count - row.topic_count,
        poa_topic_variance: row.poa_topic_count - row.topic_count,
        atp_subtopic_variance: row.atp_entry_count - row.subtopic_count,
        poa_subtopic_variance: row.poa_entry_count - row.subtopic_count,
        atp_topic_match: row.atp_topic_count === row.topic_count && row.topic_count > 0,
        poa_topic_match: row.poa_topic_count === row.topic_count && row.topic_count > 0,
        atp_subtopic_match: row.atp_entry_count === row.subtopic_count && row.subtopic_count > 0,
        poa_subtopic_match: row.poa_entry_count === row.subtopic_count && row.subtopic_count > 0,
        has_errors: issues.length > 0,
        error_count: issues.length,
        data_quality_issues: issues
      };
    });

    if (show_errors_only === 'true') {
      results = results.filter(r => r.has_errors);
    }

    // Sort by subject, grade, paper
    results.sort((a, b) => {
      const aSubj = a.subject_official_code || 'ZZZZ';
      const bSubj = b.subject_official_code || 'ZZZZ';
      if (aSubj !== bSubj) return aSubj.localeCompare(bSubj);
      const aGrade = a.grade !== null && a.grade !== undefined ? a.grade : 999;
      const bGrade = b.grade !== null && b.grade !== undefined ? b.grade : 999;
      if (aGrade !== bGrade) return aGrade - bGrade;
      return (a.paper_no || 99) - (b.paper_no || 99);
    });

    // Get filter options
    const [subjects] = await db.query(`SELECT DISTINCT subject_official_code, subject_name FROM caps_subjects_master WHERE is_active = 1 ORDER BY subject_name`);
    const [grades] = await db.query(`SELECT DISTINCT grade_number as grade FROM lookup_caps_topics WHERE grade_number IS NOT NULL ORDER BY grade_number`);
    const [papers] = await db.query(`SELECT DISTINCT paper_no FROM lookup_caps_topics WHERE paper_no IS NOT NULL ORDER BY paper_no`);

    // Summary stats
    const summary = {
      total_records: results.length,
      total_atp_entries: results.reduce((sum, r) => sum + r.atp_entry_count, 0),
      total_poa_entries: results.reduce((sum, r) => sum + r.poa_entry_count, 0),
      total_topics: results.reduce((sum, r) => sum + r.topic_count, 0),
      total_subtopics: results.reduce((sum, r) => sum + r.subtopic_count, 0),
      atp_topic_matches: results.filter(r => r.atp_topic_match).length,
      poa_topic_matches: results.filter(r => r.poa_topic_match).length,
      atp_subtopic_matches: results.filter(r => r.atp_subtopic_match).length,
      poa_subtopic_matches: results.filter(r => r.poa_subtopic_match).length,
      records_with_errors: results.filter(r => r.has_errors).length
    };

    res.json({
      success: true,
      data: results,
      summary: summary,
      filters: {
        subjects: subjects,
        grades: grades.map(g => ({ grade_number: g.grade, grade_label: `Grade ${g.grade}` })),
        papers: papers
      }
    });
  } catch (error) {
    console.error('Error fetching CAPS Register:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/v2/caps-register/batch-fix-paper-no
// ============================================
router.post('/caps-register/batch-fix-paper-no', async (req, res) => {
  try {
    const db = req.db;
    const { subject, grade, value } = req.body;
    let query = 'UPDATE lookup_caps_topics SET paper_no = ? WHERE paper_no IS NULL';
    const params = [value || 1];
    if (subject) { query += ' AND subject_official_code = ?'; params.push(subject); }
    if (grade) { query += ' AND grade_number = ?'; params.push(parseInt(grade)); }
    const [result] = await db.query(query, params);
    res.json({ success: true, message: `Updated ${result.affectedRows} rows`, affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error batch fixing paper_no:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/v2/caps-register/topics-for-edit
// ============================================
router.get('/caps-register/topics-for-edit', async (req, res) => {
  try {
    const db = req.db;
    const { subject, grade, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = 'WHERE 1=1';
    const params = [];
    if (subject) { where += ' AND subject_official_code = ?'; params.push(subject); }
    if (grade) { where += ' AND grade_number = ?'; params.push(parseInt(grade)); }

    const [topics] = await db.query(
      `SELECT topic_id, subject_official_code, grade_number, term, paper_no, topic_code, topic_name, topic_weighting, time_weeks
       FROM lookup_caps_topics ${where}
       ORDER BY topic_id
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM lookup_caps_topics ${where}`,
      params
    );

    res.json({
      success: true,
      topics: topics,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total }
    });
  } catch (error) {
    console.error('Error fetching topics for edit:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PUT /api/v2/caps-register/topic/:topic_id
// ============================================
router.put('/caps-register/topic/:topic_id', async (req, res) => {
  try {
    const db = req.db;
    const { topic_id } = req.params;
    const { subject_official_code, grade_number, term, paper_no, topic_name } = req.body;

    const updates = [];
    const params = [];
    if (subject_official_code !== undefined) { updates.push('subject_official_code = ?'); params.push(subject_official_code); }
    if (grade_number !== undefined) { updates.push('grade_number = ?'); params.push(grade_number); }
    if (term !== undefined) { updates.push('term = ?'); params.push(term); }
    if (paper_no !== undefined) { updates.push('paper_no = ?'); params.push(paper_no); }
    if (topic_name !== undefined) { updates.push('topic_name = ?'); params.push(topic_name); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(topic_id);
    const query = `UPDATE lookup_caps_topics SET ${updates.join(', ')} WHERE topic_id = ?`;
    const [result] = await db.query(query, params);

    res.json({ success: true, message: 'Topic updated', affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error updating topic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============================================
// GET /api/v2/caps-register/subtopics/:topic_id
// Get all subtopics for a specific topic
// ============================================
router.get('/caps-register/subtopics/:topic_id', async (req, res) => {
  try {
    const db = req.db;
    const { topic_id } = req.params;

    const [subtopics] = await db.query(
      'SELECT subtopic_id, topic_id, subtopic_code, subtopic_name, created_at, updated_at FROM lookup_caps_subtopics WHERE topic_id = ? ORDER BY subtopic_id',
      [topic_id]
    );

    res.json({ success: true, subtopics: subtopics });
  } catch (error) {
    console.error('Error fetching subtopics:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PUT /api/v2/caps-register/subtopic/:subtopic_id
// Update a subtopic
// ============================================
router.put('/caps-register/subtopic/:subtopic_id', async (req, res) => {
  try {
    const db = req.db;
    const { subtopic_id } = req.params;
    const { subtopic_code, subtopic_name } = req.body;

    const updates = [];
    const params = [];

    if (subtopic_code !== undefined) { updates.push('subtopic_code = ?'); params.push(subtopic_code); }
    if (subtopic_name !== undefined) { updates.push('subtopic_name = ?'); params.push(subtopic_name); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(subtopic_id);
    const query = `UPDATE lookup_caps_subtopics SET ${updates.join(', ')} WHERE subtopic_id = ?`;
    const [result] = await db.query(query, params);

    res.json({ success: true, message: 'Subtopic updated', affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error updating subtopic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/v2/caps-register/topic
// Create a new topic
// ============================================
router.post('/caps-register/topic', async (req, res) => {
  try {
    const db = req.db;
    const { subject_official_code, grade_number, term, paper_no, topic_code, topic_name, topic_weighting, time_weeks } = req.body;

    const [result] = await db.query(
      'INSERT INTO lookup_caps_topics (subject_official_code, grade_number, term, paper_no, topic_code, topic_name, topic_weighting, time_weeks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [subject_official_code, grade_number, term, paper_no, topic_code, topic_name, topic_weighting || 0, time_weeks || 0]
    );

    res.json({ success: true, message: 'Topic created', topic_id: result.insertId });
  } catch (error) {
    console.error('Error creating topic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/v2/caps-register/subtopic
// Create a new subtopic
// ============================================
router.post('/caps-register/subtopic', async (req, res) => {
  try {
    const db = req.db;
    const { topic_id, subtopic_code, subtopic_name } = req.body;

    const [result] = await db.query(
      'INSERT INTO lookup_caps_subtopics (topic_id, subtopic_code, subtopic_name, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [topic_id, subtopic_code, subtopic_name]
    );

    res.json({ success: true, message: 'Subtopic created', subtopic_id: result.insertId });
  } catch (error) {
    console.error('Error creating subtopic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DELETE /api/v2/caps-register/topic/:topic_id
// Delete a topic (and its subtopics)
// ============================================
router.delete('/caps-register/topic/:topic_id', async (req, res) => {
  try {
    const db = req.db;
    const { topic_id } = req.params;

    // First delete subtopics
    await db.query('DELETE FROM lookup_caps_subtopics WHERE topic_id = ?', [topic_id]);
    // Then delete topic
    const [result] = await db.query('DELETE FROM lookup_caps_topics WHERE topic_id = ?', [topic_id]);

    res.json({ success: true, message: 'Topic and subtopics deleted', affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error deleting topic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// DELETE /api/v2/caps-register/subtopic/:subtopic_id
// Delete a subtopic
// ============================================
router.delete('/caps-register/subtopic/:subtopic_id', async (req, res) => {
  try {
    const db = req.db;
    const { subtopic_id } = req.params;

    const [result] = await db.query('DELETE FROM lookup_caps_subtopics WHERE subtopic_id = ?', [subtopic_id]);
    res.json({ success: true, message: 'Subtopic deleted', affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error deleting subtopic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/v2/caps-register/bulk-fix-term
// Bulk fix NULL terms for all topics
// ============================================
router.post('/caps-register/bulk-fix-term', async (req, res) => {
  try {
    const db = req.db;
    const { term_value, subject, grade } = req.body;

    let query = 'UPDATE lookup_caps_topics SET `term` = ? WHERE `term` IS NULL OR `term` = ""';
    const params = [term_value];

    if (subject) { query += ' AND subject_official_code = ?'; params.push(subject); }
    if (grade) { query += ' AND grade_number = ?'; params.push(parseInt(grade)); }

    const [result] = await db.query(query, params);
    res.json({ success: true, message: `Updated ${result.affectedRows} topics with term = ${term_value}`, affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error bulk fixing term:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
