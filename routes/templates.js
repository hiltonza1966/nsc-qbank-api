const express = require('express');
const router = express.Router();

// GET /api/qbank/templates — List templates
router.get('/', async (req, res) => {
  const db = req.db;
  const { subject_official_code, paper_no, is_active } = req.query;

  let sql = `SELECT pt.*, ls.subject_name, lp.paper_name
             FROM paper_templates pt
             LEFT JOIN lookup_subjects ls ON pt.subject_official_code = ls.subject_official_code
             LEFT JOIN lookup_papers lp ON pt.paper_no = lp.paper_no
             WHERE 1=1`;
  const p = [];

  if (subject_official_code) { sql += ` AND pt.subject_official_code = ?`; p.push(subject_official_code); }
  if (paper_no) { sql += ` AND pt.paper_no = ?`; p.push(paper_no); }
  if (is_active !== undefined) { sql += ` AND pt.is_active = ?`; p.push(is_active); }

  sql += ` ORDER BY pt.created_at DESC`;

  try {
    const [templates] = await db.execute(sql, p);
    res.json({ success: true, count: templates.length, templates });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/templates/:id — Get single template with sections
router.get('/:id', async (req, res) => {
  const db = req.db;
  try {
    const [templates] = await db.execute(
      `SELECT pt.*, ls.subject_name, lp.paper_name
       FROM paper_templates pt
       LEFT JOIN lookup_subjects ls ON pt.subject_official_code = ls.subject_official_code
       LEFT JOIN lookup_papers lp ON pt.paper_no = lp.paper_no
       WHERE pt.template_id = ?`,
      [req.params.id]
    );
    if (!templates.length) return res.status(404).json({ success: false, error: 'Template not found' });

    const [sections] = await db.execute(
      'SELECT * FROM paper_template_sections WHERE template_id = ? ORDER BY display_order',
      [req.params.id]
    );

    res.json({ success: true, template: templates[0], sections });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/templates — Create template
router.post('/', async (req, res) => {
  const db = req.db;
  const {
    subject_official_code, subject_alpha_code, paper_no, template_name, year_id, grade_id,
    assessment_type_id, assessment_body_id, total_marks, duration_minutes, sections_config
  } = req.body;

  if (!subject_official_code || !paper_no || !template_name) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO paper_templates (subject_official_code, subject_alpha_code, paper_no, template_name, year_id, grade_id, assessment_type_id, assessment_body_id, total_marks, duration_minutes, sections_config, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [subject_official_code, subject_alpha_code || subject_official_code, paper_no, template_name, year_id || 6, grade_id || 1, assessment_type_id || 1, assessment_body_id || 1, total_marks || 150, duration_minutes || 180, JSON.stringify(sections_config || [])]
    );

    res.json({ success: true, template_id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PUT /api/qbank/templates/:id — Update template
router.put('/:id', async (req, res) => {
  const db = req.db;
  const {
    template_name, year_id, grade_id, assessment_type_id, assessment_body_id,
    total_marks, duration_minutes, sections_config, is_active
  } = req.body;

  try {
    await db.execute(
      `UPDATE paper_templates SET
        template_name = COALESCE(?, template_name),
        year_id = COALESCE(?, year_id),
        grade_id = COALESCE(?, grade_id),
        assessment_type_id = COALESCE(?, assessment_type_id),
        assessment_body_id = COALESCE(?, assessment_body_id),
        total_marks = COALESCE(?, total_marks),
        duration_minutes = COALESCE(?, duration_minutes),
        sections_config = COALESCE(?, sections_config),
        is_active = COALESCE(?, is_active),
        updated_at = NOW()
       WHERE template_id = ?`,
      [template_name, year_id, grade_id, assessment_type_id, assessment_body_id, total_marks, duration_minutes, sections_config ? JSON.stringify(sections_config) : null, is_active, req.params.id]
    );

    res.json({ success: true, template_id: req.params.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/qbank/templates/:id — Deactivate template (soft delete)
router.delete('/:id', async (req, res) => {
  const db = req.db;
  try {
    await db.execute(
      'UPDATE paper_templates SET is_active = 0, updated_at = NOW() WHERE template_id = ?',
      [req.params.id]
    );
    res.json({ success: true, template_id: req.params.id, status: 'deactivated' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/templates/:id/clone — Clone template
router.post('/:id/clone', async (req, res) => {
  const db = req.db;
  try {
    const [templates] = await db.execute('SELECT * FROM paper_templates WHERE template_id = ?', [req.params.id]);
    if (!templates.length) return res.status(404).json({ success: false, error: 'Template not found' });

    const original = templates[0];
    const [result] = await db.execute(
      `INSERT INTO paper_templates (subject_official_code, subject_alpha_code, paper_no, template_name, year_id, grade_id, assessment_type_id, assessment_body_id, total_marks, duration_minutes, sections_config, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [original.subject_official_code, original.subject_alpha_code, original.paper_no, `${original.template_name} (Copy)`, original.year_id, original.grade_id, original.assessment_type_id, original.assessment_body_id, original.total_marks, original.duration_minutes, original.sections_config]
    );

    res.json({ success: true, template_id: result.insertId, cloned_from: req.params.id });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
