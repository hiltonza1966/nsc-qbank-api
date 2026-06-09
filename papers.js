const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/generate', async (req, res) => {
  const db = req.db;
  const { subject_official_code, paper_no, title } = req.body;

  // Validate required fields
  if (!subject_official_code || !paper_no || !title) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: subject_official_code, paper_no, title'
    });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Lookup spec
    const [specs] = await conn.execute(
      `SELECT * FROM paper_templates WHERE subject_official_code = ? AND paper_no = ?`,
      [subject_official_code, paper_no]
    );
    if (!specs.length) {
      throw new Error(`No spec found for ${subject_official_code} Paper ${paper_no}`);
    }
    const spec = specs[0];

    // Parse sections_config (handle both JSON string and already-parsed object)
    let sections;
    try {
      sections = typeof spec.sections_config === 'string'
        ? JSON.parse(spec.sections_config)
        : spec.sections_config || [];
    } catch (e) {
      throw new Error('Invalid sections_config JSON in spec');
    }

    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('Spec has no sections defined');
    }

    // 2. Create paper with spec_id linkage
    const paper_no = uuidv4();
    await conn.execute(
      `INSERT INTO paper_templates (paper_no, spec_id, subject_official_code, paper_no, title, total_marks, duration_minutes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', 1)`,
      [paper_no, spec.spec_id, subject_official_code, paper_no, title, spec.total_marks, spec.duration_minutes]
    );

    // 3. Select items per section (spec-driven, not hardcoded LIMIT 20)
    let pos = 1;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    let warnings = [];
    let totalAllocatedMarks = 0;
    let totalItems = 0;
    const usedItemIds = new Set(); // Track items already used in this paper

    for (const sec of sections) {
      const sectionMarks = parseInt(sec.marks) || 0;
      if (sectionMarks <= 0) continue;

      // Calculate how many items we need (over-fetch by 50% for filtering)
      const [countRows] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM item_master
         WHERE subject_official_code = ? AND paper_no = ? AND status = 'Approved'`,
        [subject_official_code, paper_no]
      );
      const availableItems = countRows[0].cnt;
      const fetchLimit = Math.min(availableItems, Math.max(sectionMarks, 50));

      // CRITICAL FIX: Use query() instead of execute() for RAND() + LIMIT ?
      // MySQL prepared statements don't handle RAND() well with parameterized LIMIT
      const [items] = await conn.query(
        `SELECT i.*, vu.last_used_at
         FROM item_master i
         LEFT JOIN v_item_usage vu ON i.item_id = vu.item_id
         WHERE i.subject_official_code = ? AND i.paper_no = ? AND i.status = 'Approved'
         ORDER BY RAND()
         LIMIT ?`,
        [subject_official_code, paper_no, fetchLimit]
      );

      let sectionAllocated = 0;
      let sectionItemCount = 0;

      for (const it of items) {
        // CRITICAL: Skip if item already used in this paper (PK constraint: paper_no + item_id)
        if (usedItemIds.has(it.item_id)) continue;
        if (sectionAllocated >= sectionMarks) break;

        // Warn if item used within 2 years
        if (it.last_used_at && new Date(it.last_used_at) > twoYearsAgo) {
          warnings.push({
            item_id: it.item_id,
            last_used_at: it.last_used_at,
            reason: 'Used within 2 years'
          });
        }

        const itemMarks = parseInt(it.marks) || 1;
        const allocateMarks = Math.min(itemMarks, sectionMarks - sectionAllocated);

        await conn.execute(
          `INSERT INTO generated_paper_items (paper_no, item_id, section_name, position, marks_allocated)
           VALUES (?, ?, ?, ?, ?)`,
          [paper_no, it.item_id, sec.name || 'Section', pos++, allocateMarks]
        );

        usedItemIds.add(it.item_id); // Mark as used
        sectionAllocated += allocateMarks;
        totalAllocatedMarks += allocateMarks;
        sectionItemCount++;
      }

      totalItems += sectionItemCount;

      // Warning if section couldn't be filled
      if (sectionAllocated < sectionMarks) {
        warnings.push({
          section: sec.name,
          requested_marks: sectionMarks,
          allocated_marks: sectionAllocated,
          reason: 'Insufficient items to fill section marks'
        });
      }
    }

    // 4. Validate total marks against spec
    if (totalAllocatedMarks !== parseInt(spec.total_marks)) {
      warnings.push({
        spec_total_marks: spec.total_marks,
        allocated_total_marks: totalAllocatedMarks,
        reason: 'Total allocated marks do not match spec total_marks'
      });
    }

    await conn.commit();
    res.json({
      success: true,
      paper_no,
      spec_id: spec.spec_id,
      total_items: totalItems,
      total_allocated_marks: totalAllocatedMarks,
      spec_total_marks: spec.total_marks,
      warnings
    });

  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

router.get('/:id', async (req, res) => {
  const db = req.db;
  try {
    const [p] = await db.execute(
      `SELECT * FROM paper_templates WHERE paper_no = ?`,
      [req.params.id]
    );
    if (!p.length) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const [items] = await db.execute(
      `SELECT pi.*, i.question_text
       FROM generated_paper_items pi
       JOIN item_master i ON pi.item_id = i.item_id
       WHERE pi.paper_no = ?
       ORDER BY pi.position`,
      [req.params.id]
    );

    res.json({ success: true, ...p[0], items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// POST /api/papers/assemble - Assemble paper from template
router.post('/assemble', async (req, res) => {
  try {
    const { template_id, year_id, grade_id, subject_official_code, paper_no, assessment_type_id, assessment_origin, paper_title, assembled_by } = req.body;

    // Get template details
    const [templates] = await req.db.execute('SELECT * FROM paper_templates WHERE template_id = ?', [template_id]);
    if (!templates.length) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const template = templates[0];

    // Create generated paper
    const [paperResult] = await req.db.execute(
      `INSERT INTO generated_papers (
        template_id, year_id, grade_id, subject_official_code, paper_no_lookup, assessment_type_id, assessment_origin,
        paper_title, total_marks, assembled_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [template_id, year_id, grade_id, subject_official_code, paper_no, assessment_type_id, assessment_origin,
       paper_title || template.template_name, template.total_marks, assembled_by]
    );

    // Get the UUID of the created paper
    const [papers] = await req.db.execute('SELECT paper_no FROM generated_papers WHERE id = ?', [paperResult.insertId]);
    const paper_uuid = papers[0].paper_no;

    // Get template sections
    const [sections] = await req.db.execute('SELECT * FROM paper_template_sections WHERE template_id = ? ORDER BY section_order', [template_id]);

    // For each section, find suitable items from item_master
    for (const section of sections) {
      const [items] = await req.db.execute(
        `SELECT item_id FROM item_master 
         WHERE year_id = ? AND grade_id = ? AND subject_official_code = ? AND paper_no = ? 
         AND assessment_type_id = ? AND assessment_origin = ?
         AND item_type_id = ? AND status = 'published'
         AND is_retired = 0
         ORDER BY RAND()
         LIMIT ?`,
        [year_id, grade_id, subject_official_code, paper_no, assessment_type_id, assessment_origin, section.item_type_id, section.item_count]
      );

      // Insert items into generated_paper_items
      for (let i = 0; i < items.length; i++) {
        await req.db.execute(
          'INSERT INTO generated_paper_items (paper_no, item_id, section_id, display_order, marks_as_allocated) VALUES (?, ?, ?, ?, ?)',
          [paper_uuid, items[i].item_id, section.section_id, i + 1, 0]
        );
      }
    }

    res.json({ success: true, paper_no: paper_uuid });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
