const express = require('express');
const router = express.Router();

const VALID_TRANSITIONS = {
  'draft': ['pending_review'],
  'pending_review': ['revision_required', 'peer_approved'],
  'revision_required': ['pending_review'],
  'peer_approved': ['revision_required', 'expert_approved'],
  'expert_approved': ['revision_required', 'moderated'],
  'moderated': ['published', 'revision_required'],
  'published': ['archived'],
  'archived': []
};

const ROLE_TRANSITIONS = {
  'developer': ['draft', 'pending_review'],
  'peer_reviewer': ['pending_review', 'revision_required', 'peer_approved'],
  'subject_expert': ['peer_approved', 'revision_required', 'expert_approved'],
  'moderator': ['expert_approved', 'revision_required', 'moderated', 'published'],
  'admin': ['draft', 'pending_review', 'revision_required', 'peer_approved', 'expert_approved', 'moderated', 'published', 'archived']
};

// POST /api/items/:id/submit - Submit for review
router.post('/:id/submit', async (req, res) => {
  await transitionState(req, res, 'pending_review', 'Item submitted for review');
});

// POST /api/items/:id/approve - Approve item
router.post('/:id/approve', async (req, res) => {
  const { role } = req.body;
  let nextState = 'peer_approved';
  if (role === 'subject_expert') nextState = 'expert_approved';
  if (role === 'moderator') nextState = 'moderated';
  await transitionState(req, res, nextState, `Approved by ${role}`);
});

// POST /api/items/:id/reject - Reject item (back to revision)
router.post('/:id/reject', async (req, res) => {
  await transitionState(req, res, 'revision_required', 'Item rejected - revision required');
});

// POST /api/items/:id/revise - Request revision
router.post('/:id/revise', async (req, res) => {
  await transitionState(req, res, 'revision_required', 'Revision requested');
});

// POST /api/items/:id/publish - Publish item
router.post('/:id/publish', async (req, res) => {
  await transitionState(req, res, 'published', 'Item published');
});

// POST /api/items/:id/archive - Archive item
router.post('/:id/archive', async (req, res) => {
  await transitionState(req, res, 'archived', 'Item archived');
});

// GET /api/items/:id/workflow - Get workflow history
router.get('/:id/workflow', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      `SELECT * FROM qbank_review_workflow WHERE item_id = ? ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ workflow: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function transitionState(req, res, nextState, reason) {
  const conn = await req.db.getConnection();
  try {
    const { id } = req.params;
    const { changed_by, role } = req.body;

    await conn.beginTransaction();

    // Get current state
    const [items] = await conn.execute(
      'SELECT review_status FROM qbank_items WHERE id = ?',
      [id]
    );

    if (items.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const currentState = items[0].review_status;

    // Validate transition
    const validNext = VALID_TRANSITIONS[currentState] || [];
    if (!validNext.includes(nextState) && role !== 'admin') {
      return res.status(400).json({ 
        error: `Invalid transition from ${currentState} to ${nextState}`,
        valid_transitions: validNext
      });
    }

    // Update item state
    await conn.execute(
      'UPDATE qbank_items SET review_status = ? WHERE id = ?',
      [nextState, id]
    );

    // Log workflow transition
    await conn.execute(
      `INSERT INTO qbank_review_workflow (item_id, current_state, previous_state, changed_by, changed_by_role, transition_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, nextState, currentState, changed_by, role, reason]
    );

    await conn.commit();
    res.json({ success: true, new_state: nextState, previous_state: currentState });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
}

module.exports = router;
