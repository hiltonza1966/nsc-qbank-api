const express = require('express');
const router = express.Router();
const { requireRole, canTransition } = require('../middleware/auth');

// GET /api/qbank/items/:item_id/workflow — Get item workflow history
router.get('/:item_id/workflow', async (req, res) => {
  const db = req.db;
  try {
    const [workflow] = await db.execute(
      `SELECT rw.*, u.username as changed_by_name
       FROM review_workflow rw
       LEFT JOIN qbank_users u ON rw.changed_by = u.user_id
       WHERE rw.item_id = ?
       ORDER BY rw.created_at DESC`,
      [req.params.item_id]
    );
    res.json({ success: true, count: workflow.length, workflow });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/qbank/items/:item_id/transition — Generic workflow transition
router.post('/:item_id/transition', requireRole('author', 'subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const itemId = req.params.item_id;
  const userId = req.user.id;
  const { to_state, reason } = req.body;

  if (!to_state) {
    return res.status(400).json({ success: false, error: 'to_state is required' });
  }

  try {
    const [items] = await db.execute(
      'SELECT status, subject_official_code, subject_alpha_code, paper_no FROM item_master WHERE item_id = ?',
      [itemId]
    );
    if (!items.length) return res.status(404).json({ success: false, error: 'Item not found' });

    const item = items[0];
    const fromState = item.status;

    if (!canTransition('item', fromState, to_state, req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Transition from '${fromState}' to '${to_state}' not authorized for role '${req.user.role}'` 
      });
    }

    await db.execute(
      'UPDATE item_master SET status = ? WHERE item_id = ?',
      [to_state, itemId]
    );

    await db.execute(
      `INSERT INTO review_workflow (item_id, subject_official_code, subject_alpha_code, paper_no, current_state, previous_state, changed_by, changed_by_role, transition_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemId, item.subject_official_code, item.subject_alpha_code, item.paper_no, to_state, fromState, userId, req.user.role, reason || `Transitioned by ${req.user.role}`]
    );

    res.json({ success: true, item_id: itemId, from_state: fromState, to_state: to_state });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/qbank/items/pending — List items pending review for current user role
router.get('/pending', requireRole('subject_specialist', 'peer_reviewer', 'subject_expert', 'moderator', 'qa_reviewer', 'admin'), async (req, res) => {
  const db = req.db;
  const { subject_official_code, paper_no, status } = req.query;

  // Map roles to expected item statuses
  const roleStatusMap = {
    'subject_specialist': 'subject_specialist_review',
    'peer_reviewer': 'pending_review',
    'subject_expert': 'peer_approved',
    'moderator': 'expert_approved',
    'qa_reviewer': 'qa_review',
    'admin': ['pending_review', 'qa_review', 'approved']
  };

  const expectedStatus = roleStatusMap[req.user.role] || 'pending_review';

  let sql = `SELECT im.*, ls.subject_name, lp.paper_code, lp.paper_name
             FROM item_master im
             LEFT JOIN lookup_subjects ls ON im.subject_official_code = ls.subject_official_code
             LEFT JOIN lookup_papers lp ON im.paper_id = lp.paper_id
             WHERE im.status IN (?)`;
  const p = [Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus]];

  if (subject_official_code) { sql += ` AND im.subject_official_code = ?`; p.push(subject_official_code); }
  if (paper_no) { sql += ` AND im.paper_no = ?`; p.push(paper_no); }
  if (status) { sql += ` AND im.status = ?`; p.push(status); }

  sql += ` ORDER BY im.created_at DESC`;

  try {
    const [items] = await db.execute(sql, p.flat());
    res.json({ success: true, count: items.length, role: req.user.role, expected_status: expectedStatus, items });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
