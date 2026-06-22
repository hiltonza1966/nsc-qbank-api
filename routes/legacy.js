const express = require('express');
const router = express.Router();
const { isEnabled } = require('../config/features');

// Redirect legacy /api/parser to /api/v2/parser
router.use((req, res, next) => {
  if (!isEnabled('legacy_routes')) {
    return res.status(404).json({ success: false, error: 'Legacy routes disabled' });
  }
  next();
});

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, version: 'v2.0', status: 'operational' });
});

module.exports = router;
