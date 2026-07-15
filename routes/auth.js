const express = require('express');
const router = express.Router();
const { generateToken, hashPassword, verifyPassword, authenticate } = require('../middleware/auth');

// ============================================
// POST /api/auth/login
// Body: { username, password }
// Returns: { success, token, user: { user_id, username, display_name, role } }
// ============================================
router.post('/login', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }

    const [users] = await db.query(
      'SELECT user_id, username, display_name, password_hash, role, subject_id, is_active FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = users[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        subject_id: user.subject_id
      }
    });
  } catch (error) {
    console.error('[POST /login ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/auth/register
// Body: { username, email, password, display_name?, role?, subject_id? }
// ============================================
router.post('/register', async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const { username, email, password, display_name, role = 'peer_reviewer', subject_id } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await hashPassword(password);

    await db.query(
      'INSERT INTO users (username, email, password_hash, display_name, role, subject_id) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, display_name || username, role, subject_id || null]
    );

    res.json({ success: true, message: 'User registered successfully' });
  } catch (error) {
    console.error('[POST /register ERROR]', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Username or email already exists' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/auth/me
// Returns current user from token
// ============================================
router.get('/me', authenticate, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const db = req.db || req.app.locals.db;
    const [users] = await db.query(
      'SELECT user_id, username, display_name, email, role, subject_id, is_active, last_login FROM users WHERE user_id = ?',
      [req.user.user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: users[0] });
  } catch (error) {
    console.error('[GET /me ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/auth/users
// List all users
// ============================================
router.get('/users', authenticate, async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const [users] = await db.query(
      'SELECT user_id, username, display_name, email, role, subject_id, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('[GET /users ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
