const express = require('express');
const router = express.Router();

// POST /api/qbank/papers/:id/export — Export paper to various formats
router.post('/:id/export', async (req, res) => {
  const db = req.db;
  const paperId = req.params.id;
  const { format = 'pdf', include_memo = true, watermark = true } = req.body;

  try {
    // Get paper details
    const [papers] = await db.execute(
      `SELECT gp.*, ls.subject_name, lp.paper_name
       FROM generated_papers gp
       LEFT JOIN lookup_subjects ls ON gp.subject_official_code = ls.subject_official_code
       LEFT JOIN lookup_papers lp ON gp.paper_id_lookup = lp.paper_id
       WHERE gp.paper_id = ?`,
      [paperId]
    );
    if (!papers.length) return res.status(404).json({ success: false, error: 'Paper not found' });

    const paper = papers[0];

    // Get paper items
    const [items] = await db.execute(
      `SELECT gpi.position, gpi.section_name, gpi.marks_allocated, im.question_text, im.question_text_afr, im.marks, im.cognitive_level, im.difficulty
       FROM generated_paper_items gpi
       JOIN item_master im ON gpi.item_id = im.item_id
       WHERE gpi.paper_id = ?
       ORDER BY gpi.position`,
      [paperId]
    );

    // Get memo items if requested
    let memoItems = [];
    if (include_memo) {
      const [memos] = await db.execute(
        `SELECT gpi.position, im.question_text, imem.memo_text, imem.marks as memo_marks
         FROM generated_paper_items gpi
         JOIN item_master im ON gpi.item_id = im.item_id
         JOIN item_memos imem ON im.item_id = imem.item_id AND imem.is_current = 1
         WHERE gpi.paper_id = ?
         ORDER BY gpi.position`,
        [paperId]
      );
      memoItems = memos;
    }

    // Generate export metadata
    const exportData = {
      paper_id: paperId,
      paper_title: paper.paper_title,
      subject: paper.subject_name,
      paper_name: paper.paper_name,
      grade: paper.grade_id,
      year: paper.year_id,
      total_marks: paper.total_marks,
      format: format,
      watermark: watermark ? `CONFIDENTIAL - ${paper.subject_name} ${paper.paper_name}` : null,
      generated_at: new Date().toISOString(),
      items: items.map((item, idx) => ({
        question_number: idx + 1,
        position: item.position,
        section: item.section_name,
        question_text: item.question_text,
        question_text_afr: item.question_text_afr,
        marks: item.marks_allocated || item.marks,
        cognitive_level: item.cognitive_level,
        difficulty: item.difficulty
      })),
      memo: include_memo ? memoItems.map((m, idx) => ({
        question_number: idx + 1,
        memo_text: m.memo_text,
        marks: m.memo_marks
      })) : null
    };

    // In production, this would generate actual PDF/Word/QTI files
    // For now, return structured data for frontend processing
    res.json({
      success: true,
      paper_id: paperId,
      format: format,
      download_url: `/api/qbank/papers/${paperId}/download?format=${format}`,
      data: exportData
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/papers/:id/download — Download exported file
router.get('/:id/download', async (req, res) => {
  const { format = 'pdf' } = req.query;

  // Placeholder: In production, generate and stream actual file
  res.json({
    success: true,
    message: `Download ${format} for paper ${req.params.id} - implement file generation`,
    paper_id: req.params.id,
    format: format
  });
});

module.exports = router;
