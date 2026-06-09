const express = require('express');
const router = express.Router();

/**
 * POST /api/wizard/extract-memo
 * Extracts memo items from PDF text
 * Body: { textItems: [...], paper_code: "LIFE_SC_P1_NOV_2025" }
 */
router.post('/extract-memo', async (req, res) => {
  try {
    const { textItems, paper_code } = req.body;
    if (!Array.isArray(textItems)) {
      return res.status(400).json({ error: 'textItems array required' });
    }

    // Load expected structure from database
    const [expectedRows] = await req.db.execute(
      'SELECT question_number, expected_marks FROM parse_expected_structure WHERE paper_code = ? ORDER BY sequence',
      [paper_code]
    );

    const expectedMap = new Map();
    expectedRows.forEach(row => expectedMap.set(row.question_number, row.expected_marks));

    // Extract memo items (simplified - just returns text items for now)
    const memoItems = textItems.map((item, index) => ({
      question_number: item.question_number || `Q${index + 1}`,
      answer_text: item.text || '',
      marks: expectedMap.get(item.question_number) || 0
    }));

    res.json({
      success: true,
      total_items: memoItems.length,
      paper_code,
      items: memoItems
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
