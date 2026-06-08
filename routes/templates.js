const express = require('express');
const router = express.Router();

// POST /api/templates - Create template
router.post('/', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    const { template_code, template_name, subject, paper_no, total_marks, total_items, duration_minutes, description, created_by, sections } = req.body;

    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO qbank_paper_templates (template_code, template_name, subject, paper_no, total_marks, total_items, duration_minutes, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [template_code, template_name, subject, paper_no, total_marks, total_items, duration_minutes, description, created_by]
    );

    const templateId = result.insertId;

    // Insert sections
    if (sections && Array.isArray(sections)) {
      for (const section of sections) {
        await conn.execute(
          `INSERT INTO qbank_paper_template_sections (template_id, section_name, section_order, total_marks, item_count, item_type, topic_distribution, difficulty_distribution, cognitive_distribution)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [templateId, section.section_name, section.section_order, section.total_marks, section.item_count, section.item_type, JSON.stringify(section.topic_distribution), JSON.stringify(section.difficulty_distribution), JSON.stringify(section.cognitive_distribution)]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, template_id: templateId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/templates - List templates
router.get('/', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM qbank_paper_templates WHERE is_active = TRUE ORDER BY created_at DESC'
    );
    res.json({ templates: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/templates/:id - Get template with sections
router.get('/:id', async (req, res) => {
  try {
    const [templates] = await req.db.execute(
      'SELECT * FROM qbank_paper_templates WHERE id = ?',
      [req.params.id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const [sections] = await req.db.execute(
      'SELECT * FROM qbank_paper_template_sections WHERE template_id = ? ORDER BY section_order',
      [req.params.id]
    );

    res.json({ template: templates[0], sections });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
