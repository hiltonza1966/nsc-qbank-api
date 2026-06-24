const express = require('express');
const router = express.Router();

// ============================================
// GET /api/v2/caps-register
// ============================================
router.get('/caps-register', async (req, res) => {
  try {
    const db = req.db;
    const { subject, grade, paper_no, show_errors_only } = req.query;

    // --- ALL distinct combos ---
    let allCombosQuery = `
      SELECT DISTINCT subject_official_code, \`grade\`, paper_no FROM (
        SELECT subject_official_code, \`grade\`, COALESCE(paper_no, 1) as paper_no FROM caps_atp_content WHERE 1=1
        UNION
        SELECT subject_official_code, \`grade\`, COALESCE(paper_no, 1) as paper_no FROM caps_poa_template WHERE 1=1
        UNION
        SELECT subject_official_code, grade_number as \`grade\`, COALESCE(paper_no, 1) as paper_no FROM lookup_caps_topics WHERE 1=1
      ) combined
      WHERE 1=1
    `;
    const allCombosParams = [];
    if (subject) { allCombosQuery += ' AND subject_official_code = ?'; allCombosParams.push(subject); }
    if (grade) { allCombosQuery += ' AND \`grade\` = ?'; allCombosParams.push(parseInt(grade)); }
    if (paper_no) { allCombosQuery += ' AND paper_no = ?'; allCombosParams.push(parseInt(paper_no)); }
    allCombosQuery += ' ORDER BY subject_official_code, \`grade\`, paper_no';

    const [allCombos] = await db.query(allCombosQuery, allCombosParams);

    // --- ATP Data ---
    let atpQuery = `
      SELECT subject_official_code, MIN(subject_name) as subject_name, \`grade\`,
             COALESCE(paper_no, 1) as paper_no, paper_code,
             COUNT(DISTINCT topic) as atp_topic_count, COUNT(*) as atp_entry_count
      FROM caps_atp_content WHERE 1=1
    `;
    const atpParams = [];
    if (subject) { atpQuery += ' AND subject_official_code = ?'; atpParams.push(subject); }
    if (grade) { atpQuery += ' AND \`grade\` = ?'; atpParams.push(parseInt(grade)); }
    if (paper_no) { atpQuery += ' AND paper_no = ?'; atpParams.push(parseInt(paper_no)); }
    atpQuery += ' GROUP BY subject_official_code, \`grade\`, paper_no, paper_code';
    const [atpData] = await db.query(atpQuery, atpParams);

    // --- POA Data ---
    let poaQuery = `
      SELECT subject_official_code, MIN(subject_name) as subject_name, \`grade\`,
             COALESCE(paper_no, 1) as paper_no, paper_code,
             COUNT(DISTINCT topic) as poa_topic_count, COUNT(*) as poa_entry_count
      FROM caps_poa_template WHERE 1=1
    `;
    const poaParams = [];
    if (subject) { poaQuery += ' AND subject_official_code = ?'; poaParams.push(subject); }
    if (grade) { poaQuery += ' AND \`grade\` = ?'; poaParams.push(parseInt(grade)); }
    if (paper_no) { poaQuery += ' AND paper_no = ?'; poaParams.push(parseInt(paper_no)); }
    poaQuery += ' GROUP BY subject_official_code, \`grade\`, paper_no, paper_code';
    const [poaData] = await db.query(poaQuery, poaParams);

    // --- Topics Data ---
    let topicsQuery = `
      SELECT subject_official_code, grade_number as \`grade\`, COALESCE(paper_no, 1) as paper_no,
             COUNT(*) as topic_count
      FROM lookup_caps_topics WHERE 1=1
    `;
    const topicsParams = [];
    if (subject) { topicsQuery += ' AND subject_official_code = ?'; topicsParams.push(subject); }
    if (grade) { topicsQuery += ' AND grade_number = ?'; topicsParams.push(parseInt(grade)); }
    if (paper_no) { topicsQuery += ' AND paper_no = ?'; topicsParams.push(parseInt(paper_no)); }
    topicsQuery += ' GROUP BY subject_official_code, grade_number, paper_no';
    const [topicsData] = await db.query(topicsQuery, topicsParams);

    // --- Subtopics Data ---
    let subtopicsQuery = `
      SELECT t.subject_official_code, t.grade_number as \`grade\`, COALESCE(t.paper_no, 1) as paper_no, COUNT(*) as subtopic_count
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

    // --- Build register ---
    const registerMap = new Map();
    const buildKey = (subj, grd, pno) => `${subj || 'NULL'}_${grd !== null && grd !== undefined ? grd : 'NULL'}_${pno || 1}`;

    for (const combo of allCombos) {
      const key = buildKey(combo.subject_official_code, combo.grade, combo.paper_no);
      registerMap.set(key, {
        subject_official_code: combo.subject_official_code,
        subject_name: '',
        grade: combo.grade,
        paper_no: combo.paper_no || 1,
        paper_code: '',
        atp_entry_count: 0, atp_topic_count: 0,
        poa_entry_count: 0, poa_topic_count: 0,
        topic_count: 0, subtopic_count: 0,
        data_quality_issues: []
      });
    }

    for (const row of atpData) {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      if (registerMap.has(key)) {
        const rec = registerMap.get(key);
        rec.atp_entry_count = parseInt(row.atp_entry_count) || 0;
        rec.atp_topic_count = parseInt(row.atp_topic_count) || 0;
        rec.subject_name = row.subject_name || rec.subject_name;
        rec.paper_code = row.paper_code || rec.paper_code;
      }
    }

    for (const row of poaData) {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      if (registerMap.has(key)) {
        const rec = registerMap.get(key);
        rec.poa_entry_count = parseInt(row.poa_entry_count) || 0;
        rec.poa_topic_count = parseInt(row.poa_topic_count) || 0;
        rec.subject_name = row.subject_name || rec.subject_name;
        rec.paper_code = row.paper_code || rec.paper_code;
      }
    }

    for (const row of topicsData) {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      const issues = [];
      if (row.subject_official_code === null) issues.push('NULL subject_official_code');
      if (row.grade === null) issues.push('NULL grade');
      if (row.paper_no === null) issues.push('NULL paper_no');
      if (registerMap.has(key)) {
        const rec = registerMap.get(key);
        rec.topic_count = parseInt(row.topic_count) || 0;
        rec.data_quality_issues.push(...issues);
      }
    }

    for (const row of subtopicsData) {
      const key = buildKey(row.subject_official_code, row.grade, row.paper_no);
      if (registerMap.has(key)) {
        registerMap.get(key).subtopic_count = parseInt(row.subtopic_count) || 0;
      }
    }

    const [subjectNames] = await db.query('SELECT subject_official_code, subject_name FROM caps_subjects_master WHERE is_active = 1');
    const subjectNameMap = new Map(subjectNames.map(s => [s.subject_official_code, s.subject_name]));

    let results = Array.from(registerMap.values());

    results = results.map(row => {
      const issues = [...row.data_quality_issues];
      if (!row.subject_name && row.subject_official_code && subjectNameMap.has(row.subject_official_code)) {
        row.subject_name = subjectNameMap.get(row.subject_official_code);
      }
      if (!row.subject_name) issues.push('Missing subject_name');
      if (!row.subject_official_code) issues.push('Missing subject_official_code');
      if (row.grade === null || row.grade === undefined) issues.push('NULL grade');

      if (row.topic_count > 0 && row.atp_topic_count > 0 && row.atp_topic_count !== row.topic_count) {
        const diff = row.atp_topic_count - row.topic_count;
        issues.push(`ATP topic mismatch: ${diff > 0 ? '+' : ''}${diff}`);
      }
      if (row.topic_count > 0 && row.poa_topic_count > 0 && row.poa_topic_count !== row.topic_count) {
        const diff = row.poa_topic_count - row.topic_count;
        issues.push(`POA topic mismatch: ${diff > 0 ? '+' : ''}${diff}`);
      }
      if (row.subtopic_count > 0 && row.atp_entry_count > 0 && row.atp_entry_count !== row.subtopic_count) {
        const diff = row.atp_entry_count - row.subtopic_count;
        issues.push(`ATP subtopic mismatch: ${diff > 0 ? '+' : ''}${diff}`);
      }
      if (row.subtopic_count > 0 && row.poa_entry_count > 0 && row.poa_entry_count !== row.subtopic_count) {
        const diff = row.poa_entry_count - row.subtopic_count;
        issues.push(`POA subtopic mismatch: ${diff > 0 ? '+' : ''}${diff}`);
      }

      if (row.topic_count > 0 && row.atp_entry_count === 0) issues.push('No ATP data for topics');
      if (row.topic_count > 0 && row.poa_entry_count === 0) issues.push('No POA data for topics');
      if (row.atp_entry_count > 0 && row.topic_count === 0) issues.push('ATP exists but no topics');
      if (row.poa_entry_count > 0 && row.topic_count === 0) issues.push('POA exists but no topics');
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

    results.sort((a, b) => {
      const aSubj = a.subject_official_code || 'ZZZZ';
      const bSubj = b.subject_official_code || 'ZZZZ';
      if (aSubj !== bSubj) return aSubj.localeCompare(bSubj);
      const aGrade = a.grade !== null && a.grade !== undefined ? a.grade : 999;
      const bGrade = b.grade !== null && b.grade !== undefined ? b.grade : 999;
      if (aGrade !== bGrade) return aGrade - bGrade;
      return (a.paper_no || 99) - (b.paper_no || 99);
    });

    const [nullTopics] = await db.query(`
      SELECT topic_id, subject_official_code, grade_number, \`term\`, paper_no, topic_name
      FROM lookup_caps_topics
      WHERE subject_official_code IS NULL OR grade_number IS NULL OR \`term\` IS NULL OR paper_no IS NULL
      ORDER BY topic_id
    `);

    const [orphanedSubtopics] = await db.query(`
      SELECT st.subtopic_id, st.topic_id, st.subtopic_code, st.subtopic_name
      FROM lookup_caps_subtopics st
      LEFT JOIN lookup_caps_topics t ON st.topic_id = t.topic_id
      WHERE t.topic_id IS NULL
      ORDER BY st.subtopic_id
    `);

    const [subjects] = await db.query(`SELECT DISTINCT subject_official_code, subject_name FROM caps_subjects_master WHERE is_active = 1 ORDER BY subject_name`);
    const [grades] = await db.query(`SELECT DISTINCT grade_number as grade FROM lookup_caps_topics WHERE grade_number IS NOT NULL ORDER BY grade_number`);
    const [papers] = await db.query(`SELECT DISTINCT paper_no FROM lookup_caps_topics WHERE paper_no IS NOT NULL ORDER BY paper_no`);

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
      records_with_errors: results.filter(r => r.has_errors).length,
      null_topics: nullTopics.length,
      orphaned_subtopics: orphanedSubtopics.length
    };

    res.json({
      success: true,
      data: results,
      summary: summary,
      diagnostics: {
        orphaned_subtopics: orphanedSubtopics,
        null_topics: nullTopics
      },
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
// POST /batch-fix-paper-no
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
// POST /batch-fix-term
// ============================================
router.post('/caps-register/batch-fix-term', async (req, res) => {
  try {
    const db = req.db;
    const { subject, grade, value } = req.body;
    if (value && value.trim() !== '') {
      let query = 'UPDATE lookup_caps_topics SET \`term\` = ? WHERE \`term\` IS NULL OR \`term\` = ""';
      const params = [value.trim()];
      if (subject) { query += ' AND subject_official_code = ?'; params.push(subject); }
      if (grade) { query += ' AND grade_number = ?'; params.push(parseInt(grade)); }
      const [result] = await db.query(query, params);
      return res.json({ success: true, message: `Updated ${result.affectedRows} rows with term = ${value}`, affected_rows: result.affectedRows });
    }
    let updated = 0;
    const [topics] = await db.query('SELECT topic_id, topic_name, \`term\` FROM lookup_caps_topics WHERE \`term\` IS NULL OR \`term\` = ""');
    for (const topic of topics) {
      const name = (topic.topic_name || '').toLowerCase();
      let detectedTerm = null;
      if (name.includes('term 1')) detectedTerm = '1';
      else if (name.includes('term 2')) detectedTerm = '2';
      else if (name.includes('term 3')) detectedTerm = '3';
      else if (name.includes('term 4')) detectedTerm = '4';
      if (detectedTerm) {
        await db.query('UPDATE lookup_caps_topics SET \`term\` = ? WHERE topic_id = ?', [detectedTerm, topic.topic_id]);
        updated++;
      }
    }
    res.json({ success: true, message: `Auto-fixed ${updated} topics with detected term values`, affected_rows: updated });
  } catch (error) {
    console.error('Error batch fixing term:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /auto-fix-term
// ============================================
router.post('/caps-register/auto-fix-term', async (req, res) => {
  try {
    const db = req.db;
    const { subject, grade } = req.body;
    let where = 'WHERE \`term\` IS NULL OR \`term\` = ""';
    const params = [];
    if (subject) { where += ' AND subject_official_code = ?'; params.push(subject); }
    if (grade) { where += ' AND grade_number = ?'; params.push(parseInt(grade)); }
    const [rows] = await db.query(`SELECT topic_id FROM lookup_caps_topics ${where} ORDER BY topic_id`, params);
    const total = rows.length;
    if (total === 0) {
      return res.json({ success: true, message: 'No NULL terms found to fix', affected_rows: 0 });
    }
    const perTerm = Math.ceil(total / 4);
    let updated = 0;
    for (let i = 0; i < total; i++) {
      const termValue = String(Math.min(Math.floor(i / perTerm) + 1, 4));
      await db.query('UPDATE lookup_caps_topics SET \`term\` = ? WHERE topic_id = ?', [termValue, rows[i].topic_id]);
      updated++;
    }
    res.json({ success: true, message: `Auto-fixed ${updated} topics with distributed term values (1-4)`, affected_rows: updated });
  } catch (error) {
    console.error('Error auto fixing term:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /topics-for-edit
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
      `SELECT topic_id, subject_official_code, grade_number, \`term\`, paper_no, topic_code, topic_name, topic_weighting, time_weeks FROM lookup_caps_topics ${where} ORDER BY topic_id LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [countResult] = await db.query(`SELECT COUNT(*) as total FROM lookup_caps_topics ${where}`, params);
    res.json({ success: true, topics: topics, pagination: { page: parseInt(page), limit: parseInt(limit), total: countResult[0].total } });
  } catch (error) {
    console.error('Error fetching topics for edit:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PUT /topic/:topic_id
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
    if (term !== undefined) { updates.push('\`term\` = ?'); params.push(term); }
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
// DELETE /orphaned-subtopic/:subtopic_id
// ============================================
router.delete('/caps-register/orphaned-subtopic/:subtopic_id', async (req, res) => {
  try {
    const db = req.db;
    const { subtopic_id } = req.params;
    const [result] = await db.query('DELETE FROM lookup_caps_subtopics WHERE subtopic_id = ?', [subtopic_id]);
    res.json({ success: true, message: `Deleted subtopic ${subtopic_id}`, affected_rows: result.affectedRows });
  } catch (error) {
    console.error('Error deleting orphaned subtopic:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /corporate-fix
// ============================================
router.post('/caps-register/corporate-fix', async (req, res) => {
  try {
    const db = req.db;
    const results = [];
    const [paperFix] = await db.query('UPDATE lookup_caps_topics SET paper_no = 1 WHERE paper_no IS NULL');
    results.push({ step: 'Fix NULL paper_no', status: `Updated ${paperFix.affectedRows} rows` });
    const [termFix] = await db.query('UPDATE lookup_caps_topics SET \`term\` = 1 WHERE \`term\` IS NULL OR \`term\` = ""');
    results.push({ step: 'Fix NULL term', status: `Updated ${termFix.affectedRows} rows` });
    const [gradeFix] = await db.query('UPDATE lookup_caps_topics SET grade_number = 10 WHERE grade_number IS NULL');
    results.push({ step: 'Fix NULL grade', status: `Updated ${gradeFix.affectedRows} rows` });
    res.json({ success: true, message: 'Corporate fix completed', results: results });
  } catch (error) {
    console.error('Error corporate fix:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
