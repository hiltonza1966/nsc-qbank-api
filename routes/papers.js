const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Helper: lookup surrogate IDs from natural keys
async function lookupIds(db, subject_official_code, paper_no) {
  const [subj] = await db.execute('SELECT subject_id FROM lookup_subjects WHERE subject_official_code = ?', [subject_official_code]);
  const [pap] = await db.execute('SELECT paper_id FROM lookup_papers WHERE paper_no = ?', [paper_no]);
  return { subject_id: subj[0]?.subject_id || null, paper_id: pap[0]?.paper_id || null };
}

// GET /api/qbank/papers — List papers by natural keys
router.get('/', async (req, res) => {
  const db = req.db;
  const { subject_official_code, paper_no, status } = req.query;
  let sql = `SELECT gp.*, pt.template_name, ls.subject_name, ls.subject_alpha_code
             FROM generated_papers gp
             LEFT JOIN paper_templates pt ON gp.template_id = pt.template_id
             LEFT JOIN lookup_subjects ls ON gp.subject_official_code = ls.subject_official_code
             WHERE 1=1`;
  const p = [];
  if (subject_official_code) { sql += ` AND gp.subject_official_code = ?`; p.push(subject_official_code); }
  if (paper_no) { sql += ` AND gp.paper_no = ?`; p.push(paper_no); }
  if (status) { sql += ` AND gp.status = ?`; p.push(status); }
  sql += ` ORDER BY gp.created_at DESC`;
  try {
    const [papers] = await db.execute(sql, p);
    res.json({ success: true, count: papers.length, papers });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/papers/:id — Get single paper with items
router.get('/:id', async (req, res) => {
  const db = req.db;
  try {
    const [papers] = await db.execute(
      `SELECT gp.*, pt.template_name, ls.subject_name
       FROM generated_papers gp
       LEFT JOIN paper_templates pt ON gp.template_id = pt.template_id
       LEFT JOIN lookup_subjects ls ON gp.subject_official_code = ls.subject_official_code
       WHERE gp.paper_id = ?`,
      [req.params.id]
    );
    if (!papers.length) return res.status(404).json({ success: false, error: 'Paper not found' });

    const [items] = await db.execute(
      `SELECT gpi.*, im.question_text, im.marks, im.cognitive_level, im.difficulty, im.caps_subtopic_id, im.caps_reference
       FROM generated_paper_items gpi
       JOIN item_master im ON gpi.item_id = im.item_id
       WHERE gpi.paper_id = ? ORDER BY gpi.display_order`,
      [req.params.id]
    );

    res.json({ success: true, paper: papers[0], items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/papers/generate — Generate paper from template
router.post('/generate', async (req, res) => {
  const db = req.db;
  const { subject_official_code, subject_alpha_code, paper_no, title } = req.body;
  if (!subject_official_code || !paper_no || !title) {
    return res.status(400).json({ success: false, error: 'Missing required fields: subject_official_code, paper_no, title' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { subject_id, paper_id } = await lookupIds(conn, subject_official_code, paper_no);
    if (!subject_id) throw new Error(`Invalid subject: ${subject_official_code}`);
    if (!paper_id) throw new Error(`Invalid paper: ${paper_no}`);

    const [specs] = await conn.execute(
      `SELECT * FROM paper_templates WHERE subject_official_code = ? AND paper_no = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1`,
      [subject_official_code, paper_no]
    );
    if (!specs.length) throw new Error(`No template found for ${subject_official_code} Paper ${paper_no}`);
    const spec = specs[0];

    let sections;
    try { sections = typeof spec.sections_config === 'string' ? JSON.parse(spec.sections_config) : spec.sections_config || []; }
    catch (e) { throw new Error('Invalid sections_config JSON'); }
    if (!Array.isArray(sections) || sections.length === 0) throw new Error('Template has no sections');

    const paper_uuid = uuidv4();
    await conn.execute(
      `INSERT INTO generated_papers (paper_id, template_id, subject_official_code, subject_alpha_code, paper_no, subject_id, paper_id_lookup, year_id, grade_id, assessment_type_id, assessment_body_id, paper_title, total_marks, status, assembled_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1)`,
      [paper_uuid, spec.template_id, subject_official_code, subject_alpha_code || subject_official_code, paper_no, subject_id, paper_id, spec.year_id, spec.grade_id, spec.assessment_type_id, spec.assessment_body_id, title, spec.total_marks]
    );

    let pos = 1;
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    let warnings = [], totalAllocatedMarks = 0, totalItems = 0;
    const usedItemIds = new Set();

    for (const sec of sections) {
      const sectionMarks = sec.marks || 0;
      const sectionItems = sec.items || 0;
      const sectionCapsSubtopic = sec.caps_subtopic_id || null;
      const sectionCognitive = sec.cognitive_level || null;
      const sectionDifficulty = sec.difficulty || null;
      const sectionItemType = sec.item_type_id || 1;

      let itemsNeeded = sectionItems;
      let marksNeeded = sectionMarks;
      let sectionAllocated = 0;

      while (itemsNeeded > 0 && marksNeeded > 0) {
        let sql = `SELECT item_id, marks, cognitive_level, difficulty, caps_subtopic_id, caps_reference, item_type_id, status, created_at
                   FROM item_master
                   WHERE subject_official_code = ? AND paper_no = ? AND status IN ('peer_approved', 'expert_approved', 'qa_review', 'approved', 'published')`;
        const p = [subject_official_code, paper_no];

        if (usedItemIds.size > 0) {
          sql += ` AND item_id NOT IN (${Array.from(usedItemIds).map(() => '?').join(',')})`;
          p.push(...Array.from(usedItemIds));
        }

        sql += ` AND (created_at >= ? OR source_year >= ?)`;
        p.push(twoYearsAgo, twoYearsAgo.getFullYear());

        if (sectionCapsSubtopic) { sql += ` AND caps_subtopic_id = ?`; p.push(sectionCapsSubtopic); }
        if (sectionCognitive) { sql += ` AND cognitive_level = ?`; p.push(sectionCognitive); }
        if (sectionDifficulty) { sql += ` AND difficulty = ?`; p.push(sectionDifficulty); }
        if (sectionItemType) { sql += ` AND item_type_id = ?`; p.push(sectionItemType); }

        sql += ` ORDER BY RAND() LIMIT 1`;
        const [candidates] = await conn.execute(sql, p);

        if (!candidates.length) {
          warnings.push(`Section ${sec.name || 'Unknown'}: insufficient items matching criteria (caps_subtopic_id=${sectionCapsSubtopic}, cognitive=${sectionCognitive}, difficulty=${sectionDifficulty})`);
          break;
        }

        const item = candidates[0];
        if (item.marks > marksNeeded) {
          warnings.push(`Section ${sec.name || 'Unknown'}: item ${item.item_id} marks (${item.marks}) exceed remaining marks (${marksNeeded})`);
          break;
        }

        await conn.execute(
          `INSERT INTO generated_paper_items (paper_id, item_id, section_id, display_order, marks_as_allocated, is_anchor_item, is_randomized)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          [paper_uuid, item.item_id, 1, pos, item.marks]
        );

        usedItemIds.add(item.item_id);
        pos++;
        itemsNeeded--;
        marksNeeded -= item.marks;
        sectionAllocated += item.marks;
        totalAllocatedMarks += item.marks;
        totalItems++;
      }
    }

    await conn.execute(`UPDATE generated_papers SET total_marks = ? WHERE paper_id = ?`, [totalAllocatedMarks, paper_uuid]);
    await conn.commit();

    res.json({
      success: true,
      paper_id: paper_uuid,
      total_items: totalItems,
      total_marks: totalAllocatedMarks,
      warnings: warnings.length ? warnings : undefined
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

// POST /api/qbank/papers/assemble — Assemble paper with manual item selection
router.post('/assemble', async (req, res) => {
  const db = req.db;
  const { paper_id, items } = req.body;
  if (!paper_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing paper_id or items array' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Clear existing items
    await conn.execute(`DELETE FROM generated_paper_items WHERE paper_id = ?`, [paper_id]);

    let pos = 1;
    let totalMarks = 0;
    for (const item of items) {
      await conn.execute(
        `INSERT INTO generated_paper_items (paper_id, item_id, section_id, display_order, marks_as_allocated, is_anchor_item, is_randomized)
         VALUES (?, ?, ?, ?, ?, 0, 0)`,
        [paper_id, item.item_id, 1, pos, item.marks_allocated || 0]
      );
      totalMarks += item.marks_allocated || 0;
      pos++;
    }

    await conn.execute(`UPDATE generated_papers SET total_marks = ?, status = 'assembled' WHERE paper_id = ?`, [totalMarks, paper_id]);
    await conn.commit();

    res.json({ success: true, paper_id, total_items: items.length, total_marks: totalMarks });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ success: false, error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
