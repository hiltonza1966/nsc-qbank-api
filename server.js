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

// Routes
const stagingRoutes = require('./routes/staging');
app.use('/api/staging', stagingRoutes);

app.use('/api/qbank/items', require('./routes/items'));
app.use('/api/qbank/papers', require('./routes/papers'));
app.use('/api/qbank/specs', require('./routes/specs'));
app.use('/api/wizard', require('./routes/pdf_parser_structured'));  // Position-based parser (CORRECT)
app.use('/api/attachments', require('./routes/attachments'));

// QP Comparison Engine routes
const compareQPRouter = require('./routes/compare-qp');
app.use('/api/wizard', compareQPRouter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`QBank API running on port ${PORT}`));
