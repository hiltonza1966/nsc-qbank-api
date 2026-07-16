const express = require('express');
const router = express.Router();
const { generateToken, hashPassword, verifyPassword, authenticate, authorize } = require('../middleware/auth');

// ============================================
// POST /api/auth/login
// Body: { username, password }
// Returns: { success, token, user }
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
// Protected: admin only
// ============================================
router.post('/register', authenticate, authorize('admin'), async (req, res) => {
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
// List all users (admin/moderator only)
// ============================================
router.get('/users', authenticate, authorize(['moderator', 'admin']), async (req, res) => {
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

// ============================================
// PUT /api/auth/users/:id
// Update user (admin only)
// Body: { display_name?, role?, subject_id?, is_active? }
// ============================================
router.put('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const userId = req.params.id;
    const { display_name, role, subject_id, is_active } = req.body;
    const updates = [];
    const params = [];
    if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (subject_id !== undefined) { updates.push('subject_id = ?'); params.push(subject_id); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    params.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('[PUT /users/:id ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DELETE /api/auth/users/:id
// Soft delete user (admin only) — sets is_active = 0
// ============================================
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const userId = req.params.id;
    await db.query('UPDATE users SET is_active = 0 WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('[DELETE /users/:id ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/auth/users/:id/reset-password
// Admin resets user password
// Body: { new_password }
// ============================================
router.post('/users/:id/reset-password', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = req.db || req.app.locals.db;
    const userId = req.params.id;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    const passwordHash = await hashPassword(new_password);
    await db.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [passwordHash, userId]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('[POST /reset-password ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
