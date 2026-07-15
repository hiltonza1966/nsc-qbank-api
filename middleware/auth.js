const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'nsc-qbank-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// ============================================
// AUTHENTICATE MIDDLEWARE — Verify JWT token
// Populates req.user = { user_id, username, role, display_name }
// ============================================
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ============================================
// AUTHORIZE MIDDLEWARE — Check role permissions
// Usage: authorize('moderator') or authorize(['moderator', 'admin'])
// Role hierarchy: admin > moderator > subject_expert > peer_reviewer
// ============================================
function authorize(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const roleHierarchy = {
    'peer_reviewer': 1,
    'subject_expert': 2,
    'moderator': 3,
    'admin': 4
  };

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const minRequiredLevel = Math.min(...roles.map(r => roleHierarchy[r] || 99));

    if (userRoleLevel < minRequiredLevel) {
      return res.status(403).json({ success: false, error: 'Access denied. Required: ' + roles.join(' or ') });
    }

    next();
  };
}

// ============================================
// OPTIONAL AUTH — Populate req.user if token present, don't reject if missing
// ============================================
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Invalid token, but optional so we continue
    }
  }
  next();
}

// ============================================
// GENERATE TOKEN — Create JWT for user
// ============================================
function generateToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      subject_id: user.subject_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// ============================================
// HASH PASSWORD — bcrypt wrapper
// ============================================
async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

// ============================================
// VERIFY PASSWORD — bcrypt wrapper
// ============================================
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  generateToken,
  hashPassword,
  verifyPassword,
  JWT_SECRET,
  requireRole: authorize,
  requireAnyRole: authorize
};
