const express = require('express');
const router = express.Router();
router.get('/', async (req, res) => {
  const [rows] = await req.db.query('SELECT * FROM qbank_paper_specs');
  res.json(rows);
});
module.exports = router;