/**
 * ============================================================================
 * Debug API Route - Comprehensive Error Log Endpoint
 * ============================================================================
 */
const express = require('express');
const router = express.Router();
const { readLogs, clearLogs } = require('../debug_logger');

/**
 * GET /api/debug/logs
 * Query params: ?limit=500&filter=ERROR&level=ERROR&section=DB
 */
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const filter = req.query.filter || req.query.section || null;
    const level = req.query.level || null;

    let logs = readLogs(limit, filter);

    if (level) {
      logs = logs.filter(l => l.level === level.toUpperCase());
    }

    // Group by section for summary
    const summary = {};
    logs.forEach(l => {
      const key = `${l.level || 'INFO'}-${l.section || 'UNKNOWN'}`;
      summary[key] = (summary[key] || 0) + 1;
    });

    res.json({
      success: true,
      count: logs.length,
      summary,
      logs,
      filters: { limit, filter, level }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      logs: []
    });
  }
});

/**
 * GET /api/debug/stats
 * Error statistics
 */
router.get('/stats', (req, res) => {
  try {
    const logs = readLogs(5000);
    const stats = {
      total: logs.length,
      byLevel: {},
      bySection: {},
      recentErrors: logs.filter(l => l.level === 'ERROR').slice(-20),
      recentApiErrors: logs.filter(l => l.level === 'ERROR' && l.section === 'RESPONSE').slice(-10)
    };

    logs.forEach(l => {
      stats.byLevel[l.level || 'INFO'] = (stats.byLevel[l.level || 'INFO'] || 0) + 1;
      stats.bySection[l.section || 'UNKNOWN'] = (stats.bySection[l.section || 'UNKNOWN'] || 0) + 1;
    });

    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/debug/clear
 * Clear all logs
 */
router.post('/clear', (req, res) => {
  const success = clearLogs();
  res.json({ success, message: success ? 'Logs cleared' : 'Failed to clear logs' });
});

/**
 * GET /api/debug/health
 * System health check
 */
router.get('/health', (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development'
  };
  res.json({ success: true, health });
});

module.exports = router;
