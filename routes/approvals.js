const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { requireRole, requireAnyRole, canTransition } = require('../middleware/auth');
const { checkPaperLock } = require('../middleware/locking');

// POST /api/qbank/papers/:id/submit — Submit paper for review
router.post('/:id/submit', requireRole('author'), checkPaperLock, async (req, res) => {
  const db = req.db;
  const paperId = req.params.id;
  const userId = req.user.id;

  try {
    const [papers] = await db.execute(
      'SELECT status, subject_official_code, subject_alpha_code, paper_no FROM generated_papers WHERE paper_id = ?',
      [paperId]
    );
    if (!papers.length) return res.status(404).json({ success: false, error: 'Paper not found' });

    const paper = papers[0];
    const fromState = paper.status;
    const toState = 'internal_moderated';

    if (!canTransition('paper', fromState, toState, req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this transition' });
    }

    await db.execute(
      'UPDATE generated_papers SET status = ? WHERE paper_id = ?',
      [toState, paperId]
    );

    await db.execute(
      `INSERT INTO paper_workflow (paper_id, subject_official_code, subject_alpha_code, paper_no, current_state, previous_state, changed_by, changed_by_role, transition_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paperId, paper.subject_official_code, paper.subject_alpha_code, paper.paper_no, toState, fromState, userId, req.user.role, req.body.reason || 'Submitted for review']
    );

    res.json({ success: true, paper_id: paperId, status: toState });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/papers/:id/approve — Approve paper at current stage
router.post('/:id/approve', requireRole('moderator', 'external_moderator', 'dbe_approver', 'admin'), checkPaperLock, async (req, res) => {
  const db = req.db;
  const paperId = req.params.id;
  const userId = req.user.id;
  const { approval_stage, comments, signature } = req.body;

  try {
    const [papers] = await db.execute(
      'SELECT status, subject_official_code, subject_alpha_code, paper_no FROM generated_papers WHERE paper_id = ?',
      [paperId]
    );
    if (!papers.length) return res.status(404).json({ success: false, error: 'Paper not found' });

    const paper = papers[0];
    const fromState = paper.status;

    // Determine next state based on current state
    const stateTransitions = {
      'internal_moderated': 'external_moderated',
      'external_moderated': 'dbe_approval',
      'dbe_approval': 'print_ready',
      'print_ready': 'published'
    };

    const toState = stateTransitions[fromState];
    if (!toState) {
      return res.status(400).json({ success: false, error: `Cannot approve from state: ${fromState}` });
    }

    if (!canTransition('paper', fromState, toState, req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized for this transition' });
    }

    await db.execute(
      'UPDATE generated_papers SET status = ? WHERE paper_id = ?',
      [toState, paperId]
    );

    await db.execute(
      `INSERT INTO paper_approvals (paper_id, subject_official_code, subject_alpha_code, paper_no, approval_stage, approver_id, approver_role, signature, comments, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [paperId, paper.subject_official_code, paper.subject_alpha_code, paper.paper_no, 
       approval_stage || fromState, userId, req.user.role, signature || null, comments || null]
    );

    await db.execute(
      `INSERT INTO paper_workflow (paper_id, subject_official_code, subject_alpha_code, paper_no, current_state, previous_state, changed_by, changed_by_role, transition_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paperId, paper.subject_official_code, paper.subject_alpha_code, paper.paper_no, toState, fromState, userId, req.user.role, `Approved by ${req.user.role}`]
    );

    res.json({ success: true, paper_id: paperId, status: toState });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/papers/:id/reject — Reject paper with revision required
router.post('/:id/reject', requireRole('moderator', 'external_moderator', 'dbe_approver', 'admin'), checkPaperLock, async (req, res) => {
  const db = req.db;
  const paperId = req.params.id;
  const userId = req.user.id;
  const { comments, signature } = req.body;

  try {
    const [papers] = await db.execute(
      'SELECT status, subject_official_code, subject_alpha_code, paper_no FROM generated_papers WHERE paper_id = ?',
      [paperId]
    );
    if (!papers.length) return res.status(404).json({ success: false, error: 'Paper not found' });

    const paper = papers[0];
    const fromState = paper.status;
    const toState = 'revision_required';

    await db.execute(
      'UPDATE generated_papers SET status = ? WHERE paper_id = ?',
      [toState, paperId]
    );

    await db.execute(
      `INSERT INTO paper_approvals (paper_id, subject_official_code, subject_alpha_code, paper_no, approval_stage, approver_id, approver_role, signature, comments, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rejected')`,
      [paperId, paper.subject_official_code, paper.subject_alpha_code, paper.paper_no, 
       fromState, userId, req.user.role, signature || null, comments || null]
    );

    await db.execute(
      `INSERT INTO paper_workflow (paper_id, subject_official_code, subject_alpha_code, paper_no, current_state, previous_state, changed_by, changed_by_role, transition_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paperId, paper.subject_official_code, paper.subject_alpha_code, paper.paper_no, toState, fromState, userId, req.user.role, `Rejected: ${comments || 'No reason provided'}`]
    );

    res.json({ success: true, paper_id: paperId, status: toState });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/papers/:id/approvals — Get approval history
router.get('/:id/approvals', requireAnyRole(), async (req, res) => {
  const db = req.db;
  try {
    const [approvals] = await db.execute(
      `SELECT pa.*, u.username as approver_name
       FROM paper_approvals pa
       LEFT JOIN qbank_users u ON pa.approver_id = u.user_id
       WHERE pa.paper_id = ?
       ORDER BY pa.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, count: approvals.length, approvals });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/papers/:id/workflow — Get paper workflow history
router.get('/:id/workflow', requireAnyRole(), async (req, res) => {
  const db = req.db;
  try {
    const [workflow] = await db.execute(
      `SELECT pw.*, u.username as changed_by_name
       FROM paper_workflow pw
       LEFT JOIN qbank_users u ON pw.changed_by = u.user_id
       WHERE pw.paper_id = ?
       ORDER BY pw.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, count: workflow.length, workflow });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
