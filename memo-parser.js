const express = require('express');
const router = express.Router();

// POST /api/wizard/extract-memo
router.post('/extract-memo', async (req, res) => {
  try {
    const { textItems, paper_code } = req.body;
    if (!Array.isArray(textItems)) {
      return res.status(400).json({ error: 'textItems array required' });
    }

    // Verify database connection
    await req.db.execute('SELECT 1');

    // Stub: Return empty result for now
    res.json({
      success: true,
      total_items: 0,
      linked: 0,
      unlinked: 0,
      message: 'Memo parser stub - not yet implemented'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
