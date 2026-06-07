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
      `SELECT * FROM qbank_paper_specs WHERE subject_official_code = ? AND paper_no = ?`,
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
    const paper_id = uuidv4();
    await conn.execute(
      `INSERT INTO qbank_papers (paper_id, spec_id, subject_official_code, paper_no, title, total_marks, duration_minutes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', 1)`,
      [paper_id, spec.spec_id, subject_official_code, paper_no, title, spec.total_marks, spec.duration_minutes]
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
        `SELECT COUNT(*) as cnt FROM qbank_items
         WHERE subject_official_code = ? AND paper_no = ? AND status = 'Approved'`,
        [subject_official_code, paper_no]
      );
      const availableItems = countRows[0].cnt;
      const fetchLimit = Math.min(availableItems, Math.max(sectionMarks, 50));

      // CRITICAL FIX: Use query() instead of execute() for RAND() + LIMIT ?
      // MySQL prepared statements don't handle RAND() well with parameterized LIMIT
      const [items] = await conn.query(
        `SELECT i.*, vu.last_used_at
         FROM qbank_items i
         LEFT JOIN v_item_usage vu ON i.item_id = vu.item_id
         WHERE i.subject_official_code = ? AND i.paper_no = ? AND i.status = 'Approved'
         ORDER BY RAND()
         LIMIT ?`,
        [subject_official_code, paper_no, fetchLimit]
      );

      let sectionAllocated = 0;
      let sectionItemCount = 0;

      for (const it of items) {
        // CRITICAL: Skip if item already used in this paper (PK constraint: paper_id + item_id)
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
          `INSERT INTO qbank_paper_items (paper_id, item_id, section_name, position, marks_allocated)
           VALUES (?, ?, ?, ?, ?)`,
          [paper_id, it.item_id, sec.name || 'Section', pos++, allocateMarks]
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
      paper_id,
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
      `SELECT * FROM qbank_papers WHERE paper_id = ?`,
      [req.params.id]
    );
    if (!p.length) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const [items] = await db.execute(
      `SELECT pi.*, i.question_text
       FROM qbank_paper_items pi
       JOIN qbank_items i ON pi.item_id = i.item_id
       WHERE pi.paper_id = ?
       ORDER BY pi.position`,
      [req.params.id]
    );

    res.json({ success: true, ...p[0], items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
