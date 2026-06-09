const express = require('express');
const router = express.Router();

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.db.execute('SELECT * FROM paper_templates WHERE is_active = 1');
    res.json({ success: true, count: rows.length, templates: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/templates/:id
router.get('/:id', async (req, res) => {
  try {
    const [templates] = await req.db.execute('SELECT * FROM paper_templates WHERE template_id = ?', [req.params.id]);
    if (!templates.length) return res.status(404).json({ success: false, error: 'Template not found' });

    const [sections] = await req.db.execute(
      'SELECT * FROM paper_template_sections WHERE template_id = ? ORDER BY section_order',
      [req.params.id]
    );
    res.json({ success: true, template: templates[0], sections });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// POST /api/templates - Create new paper template
router.post('/', async (req, res) => {
  try {
    const {
      template_code, template_name, year_id, grade_id, subject_official_code, paper_no,
      assessment_type_id, assessment_origin, total_marks, total_items,
      duration_minutes, description, created_by
    } = req.body;

    const [result] = await req.db.execute(
      `INSERT INTO paper_templates (
        template_code, template_name, year_id, grade_id, subject_official_code, paper_no,
        assessment_type_id, assessment_origin, total_marks, total_items,
        duration_minutes, description, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [template_code, template_name, year_id, grade_id, subject_official_code, paper_no,
       assessment_type_id, assessment_origin, total_marks, total_items,
       duration_minutes || 180, description, created_by]
    );

    res.json({ success: true, template_id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
