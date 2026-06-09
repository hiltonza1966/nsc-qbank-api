const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database pool
let pool;
try {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log('Database pool created successfully');
} catch (e) {
  console.error('Failed to create database pool:', e.message);
  process.exit(1);
}

// Test DB connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('Database connection verified');
  } catch (e) {
    console.error('Database connection failed:', e.message);
    process.exit(1);
  }
})();

// Attach DB to all requests
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Routes - Phase 1 (existing)
const stagingRoutes = require('./routes/staging');
app.use('/api/staging', stagingRoutes);

app.use('/api/qbank/items', require('./routes/items'));
app.use('/api/qbank/papers', require('./routes/papers'));
app.use('/api/qbank/specs', require('./routes/specs'));
app.use('/api/wizard', require('./routes/pdf_parser_structured'));  // Position-based parser
app.use('/api/attachments', require('./routes/attachments'));

// Routes - Phase 1 (comparison engine)
const compareQPRouter = require('./routes/compare-qp');
app.use('/api/wizard', compareQPRouter);

// Routes - Phase 2 (corporate schema)
app.use('/api/items', require('./routes/versions'));      // Item versioning
app.use('/api/items', require('./routes/reviews'));       // Review comments
app.use('/api/items', require('./routes/workflow'));      // Review workflow
app.use('/api/templates', require('./routes/templates')); // Paper templates
app.use('/api/taxonomy', require('./routes/taxonomy'));   // Tag taxonomy
app.use('/api/usage', require('./routes/usage'));         // Exposure tracking
app.use('/api/wizard', require('./routes/memo-parser')); // Memo parser and comparison

// Routes - Phase 2 (lookup tables)
app.get('/api/lookup/:table', async (req, res) => {
  const allowedTables = [
    'lookup_years', 'lookup_grades', 'lookup_subjects', 'lookup_papers',
    'lookup_assessment_types', 'lookup_assessment_bodies',
    'lookup_cognitive_levels', 'lookup_difficulty_levels', 'lookup_item_types',
    'lookup_languages', 'lookup_exam_sessions', 'lookup_marking_schemes',
    'lookup_caps_topics', 'lookup_caps_subtopics', 'lookup_tag_taxonomy'
  ];
  const table = req.params.table;
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: 'Invalid lookup table' });
  }
  try {
    const [rows] = await req.db.execute(`SELECT * FROM ${table} WHERE is_active = 1`);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`QBank API running on port ${PORT}`));


