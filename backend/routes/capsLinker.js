const express = require('express');
const router = express.Router();
// db extracted from req.db per route

const handleError = (res, err, status = 500) => {
  console.error('[CAPS Linker Error]', err);
  res.status(status).json({ success: false, error: err.message || 'Server error' });
};

// ==================== SUBJECTS MASTER ====================

// GET /api/caps/subjects - All subjects (filtered by user role if needed)
router.get('/subjects', async (req, res) => {
  const db = req.db;
  try {
    const { search, phase, is_active, subject_official_code } = req.query;
    let sql = 'SELECT * FROM caps_subjects_master WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (subject_name LIKE ? OR subject_official_code LIKE ? OR subject_alpha_code LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (phase) {
      sql += ' AND phase = ?';
      params.push(phase);
    }
    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active);
    }
    if (subject_official_code) {
      sql += ' AND subject_official_code = ?';
      params.push(subject_official_code);
    }

    sql += ' ORDER BY subject_name';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/caps/subjects/:subject_official_code - Single subject with counts
router.get('/subjects/:subject_official_code', async (req, res) => {
  const db = req.db;
  try {
    const { subject_official_code } = req.params;
    const [subjects] = await db.query(
      'SELECT * FROM caps_subjects_master WHERE subject_official_code = ?',
      [subject_official_code]
    );
    if (subjects.length === 0) return res.status(404).json({ success: false, error: 'Subject not found' });

    const [atpCount] = await db.query(
      'SELECT COUNT(*) as count FROM caps_atp_content WHERE subject_official_code = ?',
      [subject_official_code]
    );
    const [poaCount] = await db.query(
      'SELECT COUNT(*) as count FROM caps_poa_template WHERE subject_official_code = ?',
      [subject_official_code]
    );

    res.json({ 
      success: true, 
      data: {
        ...subjects[0],
        atp_count: atpCount[0].count,
        poa_count: poaCount[0].count
      }
    });
  } catch (err) {
    handleError(res, err);
  }
});

// PUT /api/caps/subjects/:subject_official_code - Update subject
router.put('/subjects/:subject_official_code', async (req, res) => {
  const db = req.db;
  try {
    const { subject_official_code } = req.params;
    const { subject_name, subject_alpha_code, subject_short_code, phase, grades, is_active, reg_type } = req.body;

    const [result] = await db.query(
      `UPDATE caps_subjects_master SET 
        subject_name = ?, subject_alpha_code = ?, subject_short_code = ?, 
        phase = ?, grades = ?, is_active = ?, reg_type = ?
        WHERE subject_official_code = ?`,
      [subject_name, subject_alpha_code, subject_short_code, phase, grades, is_active, reg_type, subject_official_code]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Subject not found' });
    res.json({ success: true, message: 'Subject updated' });
  } catch (err) {
    handleError(res, err);
  }
});

// ==================== ATP CONTENT ====================

// GET /api/caps/atp - All ATP content with filters
router.get('/atp', async (req, res) => {
  const db = req.db;
  try {
    const { subject_official_code, grade, term, paper_no, search } = req.query;
    let sql = 'SELECT * FROM caps_atp_content WHERE 1=1';
    const params = [];

    if (subject_official_code) {
      sql += ' AND subject_official_code = ?';
      params.push(subject_official_code);
    }
    if (grade) {
      sql += ' AND grade = ?';
      params.push(grade);
    }
    if (term) {
      sql += ' AND term = ?';
      params.push(term);
    }
    if (paper_no) {
      sql += ' AND paper_no = ?';
      params.push(paper_no);
    }
    if (search) {
      sql += ' AND (topic LIKE ? OR subtopic LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    sql += ' ORDER BY grade, term, week_range, topic';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/caps/atp/:content_id - Single ATP
router.get('/atp/:content_id', async (req, res) => {
  const db = req.db;
  try {
    const { content_id } = req.params;
    const [rows] = await db.query(
      'SELECT * FROM caps_atp_content WHERE content_id = ?',
      [content_id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'ATP record not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/caps/atp - Create ATP
router.post('/atp', async (req, res) => {
  const db = req.db;
  try {
    const { subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url } = req.body;

    const [result] = await db.query(
      `INSERT INTO caps_atp_content 
       (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url]
    );

    res.json({ success: true, data: { content_id: result.insertId } });
  } catch (err) {
    handleError(res, err);
  }
});

// PUT /api/caps/atp/:content_id - Update ATP
router.put('/atp/:content_id', async (req, res) => {
  const db = req.db;
  try {
    const { content_id } = req.params;
    const { subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url } = req.body;

    const [result] = await db.query(
      `UPDATE caps_atp_content SET 
        subject_official_code = ?, subject_alpha_code = ?, subject_name = ?, 
        grade = ?, term = ?, week_range = ?, paper_no = ?, paper_code = ?, 
        topic = ?, subtopic = ?, caps_ref = ?, source_url = ?
        WHERE content_id = ?`,
      [subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url, content_id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'ATP record not found' });
    res.json({ success: true, message: 'ATP updated' });
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/caps/atp/:content_id - Delete ATP
router.delete('/atp/:content_id', async (req, res) => {
  const db = req.db;
  try {
    const { content_id } = req.params;
    const [result] = await db.query('DELETE FROM caps_atp_content WHERE content_id = ?', [content_id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'ATP record not found' });
    res.json({ success: true, message: 'ATP deleted' });
  } catch (err) {
    handleError(res, err);
  }
});

// ==================== POA TEMPLATE ====================

// GET /api/caps/poa - All POA with filters
router.get('/poa', async (req, res) => {
  const db = req.db;
  try {
    const { subject_official_code, grade, term, paper_no, search } = req.query;
    let sql = 'SELECT * FROM caps_poa_template WHERE 1=1';
    const params = [];

    if (subject_official_code) {
      sql += ' AND subject_official_code = ?';
      params.push(subject_official_code);
    }
    if (grade) {
      sql += ' AND grade = ?';
      params.push(grade);
    }
    if (term) {
      sql += ' AND term = ?';
      params.push(term);
    }
    if (paper_no) {
      sql += ' AND paper_no = ?';
      params.push(paper_no);
    }
    if (search) {
      sql += ' AND (topic LIKE ? OR subtopic LIKE ? OR programme_of_assessment LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY grade, term, week_range, topic';

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    handleError(res, err);
  }
});

// GET /api/caps/poa/:poa_id - Single POA
router.get('/poa/:poa_id', async (req, res) => {
  const db = req.db;
  try {
    const { poa_id } = req.params;
    const [rows] = await db.query('SELECT * FROM caps_poa_template WHERE poa_id = ?', [poa_id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'POA record not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/caps/poa - Create POA
router.post('/poa', async (req, res) => {
  const db = req.db;
  try {
    const { subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url, programme_of_assessment, weight_sba_pct, cognitive_level } = req.body;

    const [result] = await db.query(
      `INSERT INTO caps_poa_template 
       (subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url, programme_of_assessment, weight_sba_pct, cognitive_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url, programme_of_assessment, weight_sba_pct, cognitive_level]
    );

    res.json({ success: true, data: { poa_id: result.insertId } });
  } catch (err) {
    handleError(res, err);
  }
});

// PUT /api/caps/poa/:poa_id - Update POA
router.put('/poa/:poa_id', async (req, res) => {
  const db = req.db;
  try {
    const { poa_id } = req.params;
    const { subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url, programme_of_assessment, weight_sba_pct, cognitive_level } = req.body;

    const [result] = await db.query(
      `UPDATE caps_poa_template SET 
        subject_official_code = ?, subject_alpha_code = ?, subject_name = ?, 
        grade = ?, term = ?, week_range = ?, paper_no = ?, paper_code = ?, 
        topic = ?, subtopic = ?, caps_ref = ?, source_url = ?, 
        programme_of_assessment = ?, weight_sba_pct = ?, cognitive_level = ?
        WHERE poa_id = ?`,
      [subject_official_code, subject_alpha_code, subject_name, grade, term, week_range, paper_no, paper_code, topic, subtopic, caps_ref, source_url, programme_of_assessment, weight_sba_pct, cognitive_level, poa_id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'POA record not found' });
    res.json({ success: true, message: 'POA updated' });
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/caps/poa/:poa_id - Delete POA
router.delete('/poa/:poa_id', async (req, res) => {
  const db = req.db;
  try {
    const { poa_id } = req.params;
    const [result] = await db.query('DELETE FROM caps_poa_template WHERE poa_id = ?', [poa_id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'POA record not found' });
    res.json({ success: true, message: 'POA deleted' });
  } catch (err) {
    handleError(res, err);
  }
});

// ==================== ITEM CAPS MAPPING ====================

// GET /api/caps/item-mappings/:item_id
router.get('/item-mappings/:item_id', async (req, res) => {
  const db = req.db;
  try {
    const { item_id } = req.params;
    const [rows] = await db.query(
      `SELECT m.*, c.topic, c.subtopic, s.subject_name 
       FROM item_caps_mapping m
       LEFT JOIN caps_atp_content c ON m.topic_id = c.content_id
       LEFT JOIN caps_subjects_master s ON c.subject_official_code = s.subject_official_code
        WHERE m.item_id = ?`,
      [item_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/caps/item-mappings
router.post('/item-mappings', async (req, res) => {
  const db = req.db;
  try {
    const { item_id, topic_id, subtopic_id, strand_id, grade_id, term_id, paper_id, cognitive_level, assessment_verb, curriculum_weight, is_primary_mapping, mapped_by, notes } = req.body;

    const [result] = await db.query(
      `INSERT INTO item_caps_mapping 
       (item_id, topic_id, subtopic_id, strand_id, grade_id, term_id, paper_id, cognitive_level, assessment_verb, curriculum_weight, is_primary_mapping, mapped_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, topic_id, subtopic_id, strand_id, grade_id, term_id, paper_id, cognitive_level, assessment_verb, curriculum_weight, is_primary_mapping || 1, mapped_by, notes]
    );

    res.json({ success: true, data: { mapping_id: result.insertId } });
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/caps/item-mappings/:mapping_id
router.delete('/item-mappings/:mapping_id', async (req, res) => {
  const db = req.db;
  try {
    const { mapping_id } = req.params;
    const [result] = await db.query('DELETE FROM item_caps_mapping WHERE mapping_id = ?', [mapping_id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Mapping not found' });
    res.json({ success: true, message: 'Mapping deleted' });
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;
