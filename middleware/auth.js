const express = require('express');

// Role hierarchy for permission checking
const ROLE_HIERARCHY = {
  'author': 1,
  'subject_specialist': 2,
  'peer_reviewer': 3,
  'subject_expert': 4,
  'moderator': 5,
  'qa_reviewer': 6,
  'external_moderator': 7,
  'dbe_approver': 8,
  'admin': 9
};

// Required roles for each workflow transition
const TRANSITION_ROLES = {
  'item': {
    'draft': ['author'],
    'subject_specialist_review': ['author'],
    'pending_review': ['subject_specialist'],
    'revision_required': ['subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer'],
    'peer_approved': ['peer_reviewer'],
    'expert_approved': ['subject_expert'],
    'qa_review': ['moderator'],
    'moderated': ['qa_reviewer'],
    'approved': ['admin'],
    'published': ['admin'],
    'archived': ['admin']
  },
  'paper': {
    'draft': ['author'],
    'assembled': ['author'],
    'internal_moderated': ['moderator'],
    'external_moderated': ['external_moderator'],
    'dbe_approval': ['dbe_approver'],
    'print_ready': ['admin'],
    'reviewed': ['moderator', 'external_moderator'],
    'approved': ['admin'],
    'published': ['admin'],
    'archived': ['admin']
  }
};

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'] || 'author';
    const userId = req.headers['x-user-id'] || 1;

    if (!roles.includes(userRole) && userRole !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: `Role '${userRole}' not authorized. Required: ${roles.join(', ')}` 
      });
    }

    req.user = { id: userId, role: userRole };
    next();
  };
}

function requireAnyRole() {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'] || 'author';
    const userId = req.headers['x-user-id'] || 1;
    req.user = { id: userId, role: userRole };
    next();
  };
}

function canTransition(entityType, fromState, toState, userRole) {
  if (userRole === 'admin') return true;
  const allowed = TRANSITION_ROLES[entityType]?.[toState] || [];
  return allowed.includes(userRole);
}

module.exports = { requireRole, requireAnyRole, canTransition, ROLE_HIERARCHY };
