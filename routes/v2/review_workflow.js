const express = require('express');
const router = express.Router();

// ============================================
// GET /api/v2/review/items-by-status
// Returns items filtered by status
// ============================================
router.get('/items-by-status', async (req, res) => {
  try {
    const { status, subject_id } = req.query;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status parameter is required' });
    }

    let sql = `
      SELECT 
        item_id,
        question_number,
        question_text,
        status,
        difficulty,
        grade_id,
        subject_official_code,
        subject_alpha_code,
        created_at,
        published_at,
        published_by
      FROM item_master
      WHERE status = ?
    `;

    const params = [status];

    if (subject_id) {
      sql += ' AND subject_id = ?';
      params.push(subject_id);
    }

    sql += ' ORDER BY created_at DESC';

    const [items] = await req.db.execute(sql, params);

    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching items by status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// GET /api/v2/review/workflow-history
// Returns workflow history for an item
// ============================================
router.get('/workflow-history', async (req, res) => {
  try {
    const { item_id } = req.query;

    if (!item_id) {
      return res.status(400).json({ success: false, message: 'item_id is required' });
    }

    const [history] = await req.db.execute(
      `SELECT 
        workflow_id,
        current_state,
        previous_state,
        changed_by_role,
        transition_reason,
        created_at
      FROM review_workflow
      WHERE item_id = ?
      ORDER BY created_at DESC`,
      [item_id]
    );

    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching workflow history:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// POST /api/v2/review/submit-review
// Submit a review (peer, expert, or moderator)
// ============================================
router.post('/submit-review', async (req, res) => {
  const connection = await req.db.getConnection();

  try {
    await connection.beginTransaction();

    const { item_id, reviewer_id, reviewer_role, review_action, review_comment } = req.body;

    if (!item_id || !reviewer_id || !reviewer_role || !review_action) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'item_id, reviewer_id, reviewer_role, and review_action are required' 
      });
    }

    // Get current item status BEFORE updating
    const [itemRows] = await connection.execute(
      'SELECT status, subject_official_code, subject_alpha_code, paper_no FROM item_master WHERE item_id = ?',
      [item_id]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const item = itemRows[0];
    const previous_state = item.status;
    let new_status = previous_state;

    // Determine new status based on reviewer role and action
    if (review_action === 'approve') {
      if (reviewer_role === 'peer_reviewer') {
        new_status = 'peer_approved';
      } else if (reviewer_role === 'subject_expert') {
        new_status = 'expert_approved';
      } else if (reviewer_role === 'moderator') {
        new_status = 'moderated';
      }
    } else if (review_action === 'reject') {
      new_status = 'draft';
    }

    // Update item status
    await connection.execute(
      'UPDATE item_master SET status = ?, updated_at = NOW() WHERE item_id = ?',
      [new_status, item_id]
    );

    // Log workflow transition with CORRECT previous_state (captured BEFORE update)
    await connection.execute(
      `INSERT INTO review_workflow 
       (item_id, subject_official_code, subject_alpha_code, paper_no, current_state, previous_state, changed_by, changed_by_role, transition_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [item_id, item.subject_official_code, item.subject_alpha_code, item.paper_no, new_status, previous_state, reviewer_id, reviewer_role, review_comment || review_action]
    );

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Review submitted successfully',
      new_status,
      previous_status: previous_state
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error submitting review:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// POST /api/v2/review/publish-item
// Publish an item to production (moderator only)
// ============================================
router.post('/publish-item', async (req, res) => {
  const connection = await req.db.getConnection();

  try {
    await connection.beginTransaction();

    const { item_id, moderator_id, publish_reason } = req.body;

    if (!item_id || !moderator_id) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'item_id and moderator_id are required' 
      });
    }

    // Get current status BEFORE updating
    const [itemRows] = await connection.execute(
      'SELECT status, subject_official_code, subject_alpha_code, paper_no FROM item_master WHERE item_id = ?',
      [item_id]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    const item = itemRows[0];
    const previous_state = item.status;

    if (previous_state !== 'moderated') {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Item must be in moderated status before publishing' 
      });
    }

    // Update item to published
    await connection.execute(
      'UPDATE item_master SET status = ?, published_at = NOW(), published_by = ?, updated_at = NOW() WHERE item_id = ?',
      ['published', moderator_id, item_id]
    );

    // Log workflow transition
    await connection.execute(
      `INSERT INTO review_workflow 
       (item_id, subject_official_code, subject_alpha_code, paper_no, current_state, previous_state, changed_by, changed_by_role, transition_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [item_id, item.subject_official_code, item.subject_alpha_code, item.paper_no, 'published', previous_state, moderator_id, 'moderator', publish_reason || 'Published to production']
    );

    await connection.commit();

    res.json({ 
      success: true, 
      message: 'Item published to production',
      new_status: 'published',
      previous_status: previous_state,
      published_at: new Date().toISOString()
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error publishing item:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// ============================================
// GET /api/v2/review/stats
// Dashboard stats for review workflow
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const [results] = await req.db.execute(`
      SELECT 
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'peer_approved' THEN 1 END) as peer_approved_count,
        COUNT(CASE WHEN status = 'expert_approved' THEN 1 END) as expert_approved_count,
        COUNT(CASE WHEN status = 'moderated' THEN 1 END) as moderated_count,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count,
        COUNT(*) as total_count
      FROM item_master
    `);

    res.json({ success: true, stats: results[0] });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
