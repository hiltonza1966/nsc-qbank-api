const { requestLogger, errorHandler, wrapRoute, debug } = require('./debug_logger');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const pdfExtractRouter = require('./routes/pdfExtract');
const wizardImportRouter = require('./routes/wizardImport');
const app = express();
const PORT = process.env.PORT || 4000;

// ============================================
// COMPREHENSIVE DEBUG SYSTEM â€” Log ALL requests
// ============================================
app.use(requestLogger);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// STATIC FILE SERVING â€” Uploads folder for images
// ============================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Database pool
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Hilton@66',
  database: process.env.DB_NAME || 'nsc_qbank',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Attach db to requests
app.use((req, res, next) => {
  req.db = dbPool;
  next();
});

// Wizard routes (must be AFTER req.db is set)
app.use('/api/wizard', pdfExtractRouter);
app.use('/api/wizard', wizardImportRouter);

// ============================================
// API ROUTES â€” FIXED PATHS FOR CONSISTENCY
// ============================================

function safeRequire(routePath, mountPath) {
  try {
    const fullPath = path.join(__dirname, routePath);
    if (fs.existsSync(fullPath + '.js')) {
      const route = require(routePath);
      if (typeof route === 'function' || (route && route.use)) {
        app.use(mountPath, route);
        console.log(`Mounted: ${mountPath} -> ${routePath}`);
      } else {
        console.warn(`Skipping ${routePath} - does not export a valid router`);
      }
    } else {
      console.warn(`Missing route file: ${routePath}`);
    }
  } catch (e) {
    console.error(`Error mounting ${routePath}: ${e.message}`);
    debug.error('ROUTE_MOUNT', `Failed to mount ${routePath} at ${mountPath}`, { error: e.message, stack: e.stack });
  }
}

// Item Development Module
safeRequire('./routes/items', '/api/qbank/items');
safeRequire('./routes/versions', '/api/qbank/items');
safeRequire('./routes/reviews', '/api/qbank/items');
safeRequire('./routes/workflow', '/api/qbank/items');

// Question Paper Development Module
safeRequire('./routes/papers', '/api/qbank/papers');
safeRequire('./routes/approvals', '/api/qbank/papers');
safeRequire('./routes/compliance', '/api/qbank/papers');
safeRequire('./routes/media', '/api/media');
safeRequire('./routes/export', '/api/qbank/papers');

// Templates & Specs
safeRequire('./routes/templates', '/api/qbank/templates');
safeRequire('./routes/specs', '/api/qbank/specs');

// CAPS & Curriculum
safeRequire('./routes/capsParser', '/api/caps');
safeRequire('./routes/capsPdfParser', '/api/caps');
safeRequire('./routes/capsTopicParser', '/api/caps');
safeRequire('./routes/curriculum', '/api/curriculum');

// Wizard & Parser Tools

// Loaded Dashboard
safeRequire('./routes/loadedDashboard', '/api/dashboard');

// Parser API for QBank wizard (v20)
safeRequire('./routes/parser', '/api/parser');

// Supporting Modules
safeRequire('./routes/attachments', '/api/attachments');
safeRequire('./routes/taxonomy', '/api/taxonomy');
safeRequire('./routes/usage', '/api/usage');
safeRequire('./routes/dashboard', '/api/dashboard');
safeRequire('./routes/debug', '/api/debug');
safeRequire('./routes/staging', '/api/staging');

// ============================================
// SECURITY-ALIGNED ENDPOINTS
// ============================================

// GET /api/qbank/sandbox-config/:toolName â€” Get CSP policy for tool
app.get('/api/qbank/sandbox-config/:toolName', async (req, res) => {
  try {
    const [configs] = await req.db.execute(
      'SELECT * FROM sandbox_config WHERE tool_name = ? AND is_active = 1',
      [req.params.toolName]
    );
    if (!configs.length) {
      // Return default locked-down config
      return res.json({
        success: true,
        config: {
          tool_name: req.params.toolName,
          csp_policy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self';",
          allow_network: 0,
          allow_clipboard: 0,
          allow_file_system: 0
        }
      });
    }
    res.json({ success: true, config: configs[0] });
  } catch (e) {
    debug.error('SANDBOX_CONFIG', `Error fetching sandbox config: ${e.message}`, { stack: e.stack });
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/subject-tools/:subjectCode â€” Get tools for subject
app.get('/api/qbank/subject-tools/:subjectCode', async (req, res) => {
  try {
    const [tools] = await req.db.execute(
      'SELECT * FROM subject_tool_mapping WHERE subject_official_code = ? AND is_active = 1 ORDER BY is_primary DESC',
      [req.params.subjectCode]
    );
    res.json({ success: true, count: tools.length, tools });
  } catch (e) {
    debug.error('SUBJECT_TOOLS', `Error fetching subject tools: ${e.message}`, { stack: e.stack });
    res.status(500).json({ success: false, error: e.message });
  }
});

// Lookup tables
app.get('/api/lookup/:table', async (req, res) => {
  const allowedTables = [
    'lookup_subjects', 'lookup_papers', 'lookup_grades', 'lookup_years',
    'lookup_assessment_types', 'lookup_assessment_bodies', 'lookup_languages',
    'lookup_item_types', 'lookup_cognitive_levels', 'lookup_difficulty_levels',
    'lookup_marking_schemes', 'lookup_tag_taxonomy', 'lookup_exam_sessions',
    'lookup_caps_topics', 'lookup_caps_subtopics', 'subject_tool_mapping', 'sandbox_config'
  ];
  const table = req.params.table;
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ success: false, error: 'Invalid table name' });
  }
  let query = `SELECT * FROM ${table}`;
  const orderings = [
    `ORDER BY display_order, name`,
    `ORDER BY display_order`,
    `ORDER BY name`,
    `ORDER BY topic_name`,
    `ORDER BY subtopic_name`,
    `ORDER BY subject_name`,
    `ORDER BY paper_title`,
    ``
  ];
  for (const ordering of orderings) {
    try {
      const fullQuery = ordering ? `${query} ${ordering}` : query;
      const [rows] = await req.db.execute(fullQuery);
      return res.json({ success: true, data: rows });
    } catch (e) {
      // Try next ordering
    }
  }
  debug.error('LOOKUP', `Failed to query table ${table}`);
  res.status(500).json({ success: false, error: 'Failed to query table' });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ============================================
// COMPREHENSIVE ERROR HANDLER â€” Catch ALL errors
// ============================================
app.use(errorHandler);

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`QBank API running on port ${PORT}`);
  console.log(`Database: nsc_qbank`);
  console.log(`API Base: http://localhost:${PORT}/api/qbank`);
  console.log(`Uploads: http://localhost:${PORT}/uploads`);
  console.log(`Security: All tools sandboxed, audit logging enabled`);
  console.log(`Debug: Comprehensive logging active â€” check debug.log and /api/debug/logs`);
});

module.exports = app;

