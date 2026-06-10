/**
 * ADD TO: routes/curriculum.js
 * =============================
 * New endpoint for admin manual linking interface
 */

// ============================================================
// GET /api/curriculum/unlinked/:paper_code
// Get all unlinked items for a specific paper
// ============================================================
router.get('/unlinked/:paper_code', requireDB, async (req, res) => {
  try {
    const { paper_code } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const [items] = await req.db.execute(`
      SELECT 
        pes.question_number,
        pes.expected_marks,
        pes.section,
        pes.sequence,
        pes.paper_code,
        pes.caps_topic_id,
        pes.caps_subtopic_id,
        pes.caps_reference,
        pes.cognitive_level_weighting,
        pes.assessment_verb,
        pes.source_topic,
        pes.source_subtopic,
        pes.is_anchor_item,
        pes.exposure_limit,
        pes.topic_coverage_required,
        im.item_id,
        im.item_code,
        im.question_text,
        im.marks,
        im.status,
        cl.level_name as cognitive_level,
        dl.level_name as difficulty_level,
        il.level_name as item_type
      FROM parse_expected_structure pes
      LEFT JOIN item_master im ON pes.question_number = im.question_number 
        AND pes.paper_code = im.paper_code
      LEFT JOIN lookup_cognitive_levels cl ON im.cognitive_level_id = cl.cognitive_level_id
      LEFT JOIN lookup_difficulty_levels dl ON im.difficulty_id = dl.difficulty_level_id
      LEFT JOIN lookup_item_types il ON im.item_type_id = il.item_type_id
      WHERE pes.paper_code = ?
        AND (pes.caps_topic_id IS NULL OR pes.caps_reference IS NULL)
      ORDER BY pes.sequence
      LIMIT ? OFFSET ?
    `, [paper_code, parseInt(limit), parseInt(offset)]);

    const [countResult] = await req.db.execute(`
      SELECT COUNT(*) as total 
      FROM parse_expected_structure 
      WHERE paper_code = ? AND (caps_topic_id IS NULL OR caps_reference IS NULL)
    `, [paper_code]);

    res.json({
      success: true,
      paper_code,
      total_unlinked: countResult[0].total,
      returned: items.length,
      items
    });
  } catch (error) {
    console.error('Error fetching unlinked items:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GET /api/curriculum/papers-with-unlinked
// Get list of papers that have unlinked items
// ============================================================
router.get('/papers-with-unlinked', requireDB, async (req, res) => {
  try {
    const [papers] = await req.db.execute(`
      SELECT 
        pes.paper_code,
        COUNT(*) as total_items,
        COUNT(CASE WHEN pes.caps_topic_id IS NULL THEN 1 END) as unlinked_count,
        COUNT(CASE WHEN pes.caps_topic_id IS NOT NULL THEN 1 END) as linked_count,
        ROUND(
          COUNT(CASE WHEN pes.caps_topic_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
          2
        ) as linked_percent
      FROM parse_expected_structure pes
      GROUP BY pes.paper_code
      HAVING unlinked_count > 0
      ORDER BY unlinked_count DESC
    `);

    res.json({
      success: true,
      count: papers.length,
      papers
    });
  } catch (error) {
    console.error('Error fetching papers with unlinked:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// POST /api/curriculum/bulk-link
// Bulk link multiple items to CAPS topics
// ============================================================
router.post('/bulk-link', requireDB, async (req, res) => {
  try {
    const { links } = req.body; // Array of { question_number, paper_code, topic_id, subtopic_id, ... }
    const mapped_by = req.user?.user_id || 1;

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ error: 'links array required' });
    }

    let updated = 0;
    const errors = [];

    for (const link of links) {
      try {
        await req.db.execute(`
          UPDATE parse_expected_structure 
          SET caps_topic_id = ?,
              caps_subtopic_id = ?,
              caps_reference = ?,
              cognitive_level_weighting = ?,
              assessment_verb = ?,
              source_topic = ?,
              source_subtopic = ?,
              topic_coverage_required = 1
          WHERE question_number = ? AND paper_code = ?
        `, [
          link.topic_id,
          link.subtopic_id || null,
          link.caps_reference,
          link.cognitive_level,
          link.assessment_verb,
          link.source_topic,
          link.source_subtopic,
          link.question_number,
          link.paper_code
        ]);
        updated++;
      } catch (err) {
        errors.push({ question_number: link.question_number, error: err.message });
      }
    }

    res.json({
      success: true,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      message: `Linked ${updated} of ${links.length} items`
    });
  } catch (error) {
    console.error('Error bulk linking:', error);
    res.status(500).json({ error: error.message });
  }
});
