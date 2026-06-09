const express = require('express');
const router = express.Router();

// GET /api/usage/:item_id
router.get('/:item_id', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT exposure_count, last_used_date, facility_value, discrimination_index FROM item_master WHERE item_id = ?',
      [req.params.item_id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Item not found' });
    res.json({ success: true, usage: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
