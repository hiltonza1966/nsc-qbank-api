const express = require('express');
const router = express.Router();

// POST /api/qbank/papers/:id/validate — Validate paper against blueprint
router.post('/:id/validate', async (req, res) => {
  const db = req.db;
  const paperId = req.params.id;

  try {
    // Get paper details
    const [papers] = await db.execute(
      `SELECT gp.*, pt.template_name, pt.sections_config, pt.total_marks as expected_marks, pt.duration_minutes
       FROM generated_papers gp
       LEFT JOIN paper_templates pt ON gp.template_id = pt.template_id
       WHERE gp.paper_id = ?`,
      [paperId]
    );
    if (!papers.length) return res.status(404).json({ success: false, error: 'Paper not found' });

    const paper = papers[0];

    // Get paper items with metadata
    const [items] = await db.execute(
      `SELECT gpi.*, im.marks, im.cognitive_level, im.difficulty, im.topic, im.caps_subtopic_id, im.caps_reference
       FROM generated_paper_items gpi
       JOIN item_master im ON gpi.item_id = im.item_id
       WHERE gpi.paper_id = ?
       ORDER BY gpi.position`,
      [paperId]
    );

    // Compliance checks
    const checks = {
      total_marks: { expected: paper.expected_marks || 150, actual: items.reduce((sum, i) => sum + (i.marks_allocated || 0), 0), pass: false },
      item_count: { expected: null, actual: items.length, pass: items.length > 0 },
      duration: { expected: paper.duration_minutes || 180, actual: paper.duration_minutes, pass: true },
      cognitive_distribution: {},
      difficulty_distribution: {},
      caps_coverage: {},
      duplicate_items: { pass: true, duplicates: [] }
    };

    // Check total marks
    checks.total_marks.pass = Math.abs(checks.total_marks.actual - checks.total_marks.expected) <= 5;

    // Cognitive level distribution
    const cognitiveLevels = {};
    items.forEach(i => { cognitiveLevels[i.cognitive_level] = (cognitiveLevels[i.cognitive_level] || 0) + (i.marks_allocated || 0); });
    checks.cognitive_distribution = cognitiveLevels;

    // Difficulty distribution
    const difficulties = {};
    items.forEach(i => { difficulties[i.difficulty] = (difficulties[i.difficulty] || 0) + (i.marks_allocated || 0); });
    checks.difficulty_distribution = difficulties;

    // CAPS topic coverage
    const topics = {};
    items.forEach(i => { topics[i.topic || 'Unknown'] = (topics[i.topic || 'Unknown'] || 0) + 1; });
    checks.caps_coverage = topics;

    // Check for duplicate items (same item_id appearing twice)
    const itemIds = items.map(i => i.item_id);
    const duplicates = itemIds.filter((item, index) => itemIds.indexOf(item) !== index);
    if (duplicates.length > 0) {
      checks.duplicate_items.pass = false;
      checks.duplicate_items.duplicates = [...new Set(duplicates)];
    }

    const allPassed = checks.total_marks.pass && checks.item_count.pass && checks.duplicate_items.pass;

    res.json({
      success: true,
      paper_id: paperId,
      paper_title: paper.paper_title,
      compliance_passed: allPassed,
      checks,
      warnings: allPassed ? [] : ['Paper does not meet blueprint requirements']
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/papers/:id/compliance-report — Get detailed compliance report
router.get('/:id/compliance-report', async (req, res) => {
  const db = req.db;
  const paperId = req.params.id;

  try {
    const [items] = await db.execute(
      `SELECT gpi.position, gpi.section_name, im.question_text, im.marks, im.cognitive_level, im.difficulty, im.topic, im.caps_reference
       FROM generated_paper_items gpi
       JOIN item_master im ON gpi.item_id = im.item_id
       WHERE gpi.paper_id = ?
       ORDER BY gpi.position`,
      [paperId]
    );

    res.json({ success: true, paper_id: paperId, items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
