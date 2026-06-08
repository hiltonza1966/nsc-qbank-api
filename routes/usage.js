const express = require('express');
const router = express.Router();

// GET /api/usage/:item_id - Item usage statistics
router.get('/:item_id', async (req, res) => {
  try {
    const { item_id } = req.params;

    const [usage] = await req.db.execute(
      `SELECT COUNT(*) as total_usage, MAX(usage_date) as last_used, MIN(exam_year) as first_used
       FROM qbank_item_usage WHERE item_id = ?`,
      [item_id]
    );

    const [papers] = await req.db.execute(
      `SELECT DISTINCT paper_code, exam_year, exam_session FROM qbank_item_usage WHERE item_id = ? ORDER BY exam_year DESC`,
      [item_id]
    );

    const [stats] = await req.db.execute(
      `SELECT AVG(JSON_EXTRACT(performance_stats, '$.p_value')) as avg_p_value,
              AVG(JSON_EXTRACT(performance_stats, '$.discrimination')) as avg_discrimination
       FROM qbank_item_usage WHERE item_id = ? AND performance_stats IS NOT NULL`,
      [item_id]
    );

    res.json({
      usage: usage[0],
      papers: papers,
      performance: stats[0]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/usage - Record item usage
router.post('/', async (req, res) => {
  const conn = await req.db.getConnection();
  try {
    await conn.beginTransaction();

    const { item_id, paper_id, paper_code, exam_year, exam_session, performance_stats } = req.body;

    const [result] = await conn.execute(
      `INSERT INTO qbank_item_usage (item_id, paper_id, paper_code, exam_year, exam_session, performance_stats)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [item_id, paper_id, paper_code, exam_year, exam_session, JSON.stringify(performance_stats)]
    );

    // Update exposure count on item
    await conn.execute(
      'UPDATE qbank_items SET exposure_count = exposure_count + 1, last_used_date = CURDATE() WHERE id = ?',
      [item_id]
    );

    await conn.commit();
    res.json({ success: true, usage_id: result.insertId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
