const express = require('express');
const router = express.Router();

// ============================================
// GET ITEMS FOR REVIEW (Role-based filtering)
// ============================================
router.get('/items-for-review', async (req, res) => {
  try {
    const db = req.db;
    const { user_id, role, subject_id, status } = req.query;

    if (!user_id || !role) {
      return res.status(400).json({ success: false, error: 'user_id and role required' });
    }

    let whereClause = "WHERE im.status != 'archived' AND im.status != 'published'";
    const params = [];

    // Role-based filtering
    if (role === 'peer_reviewer') {
      whereClause += " AND im.status IN ('draft', 'revision_required')";
      const [assignments] = await db.execute(
        'SELECT subject_id FROM user_subject_assignments WHERE user_id = ?', [user_id]
      );
      const subjectIds = assignments.map(a => a.subject_id);
      if (subjectIds.length > 0) {
        whereClause += ` AND im.subject_id IN (${subjectIds.map(() => '?').join(',')})`;
        params.push(...subjectIds);
      }
    } else if (role === 'subject_expert') {
      whereClause += " AND im.status = 'peer_approved'";
      const [assignments] = await db.execute(
        'SELECT subject_id FROM user_subject_assignments WHERE user_id = ?', [user_id]
      );
      const subjectIds = assignments.map(a => a.subject_id);
      if (subjectIds.length > 0) {
        whereClause += ` AND im.subject_id IN (${subjectIds.map(() => '?').join(',')})`;
        params.push(...subjectIds);
      }
    } else if (role === 'moderator') {
      whereClause += " AND im.status = 'expert_approved'";
    } else if (role === 'admin' || role === 'superadmin') {
      whereClause += " AND im.status IN ('draft', 'peer_approved', 'expert_approved', 'moderated', 'revision_required')";
    }

    if (status) { whereClause += ' AND im.status = ?'; params.push(status); }
    if (subject_id) { whereClause += ' AND im.subject_official_code = ?'; params.push(subject_id); }

    const [items] = await db.execute(
      `SELECT im.item_id, im.item_code, im.question_number, im.question_text, im.marks, im.marks_allocated,
              im.status, im.parser_confidence, im.source_paper_code, im.last_used_date,
              ls.subject_name, ls.subject_alpha_code
       FROM item_master im
       LEFT JOIN lookup_subjects ls ON im.subject_id = ls.subject_id
       ${whereClause}
       ORDER BY im.source_paper_code, im.question_number
       LIMIT 100`, params
    );

    // Get review counts per item
    for (const item of items) {
      const [reviewCounts] = await db.execute(
        `SELECT reviewer_role, COUNT(*) as count FROM item_reviews WHERE item_id = ? GROUP BY reviewer_role`,
        [item.item_id]
      );
      item.review_counts = reviewCounts.reduce((acc, r) => { acc[r.reviewer_role] = r.count; return acc; }, {});
    }

    res.json({ success: true, items });
  } catch (e) {
    console.error('Items for review error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// GET QP & MEMO DATA FOR AN ITEM
// ============================================
router.get('/item-qp-memo/:itemId', async (req, res) => {
  try {
    const db = req.db;
    const { itemId } = req.params;

    // Get item details to find the question_number and source_paper_code
    const [itemRows] = await db.execute(
      'SELECT question_number, source_paper_code, subject_id, paper_no, question_text, marks, marks_allocated FROM item_master WHERE item_id = ?',
      [itemId]
    );

    if (itemRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const item = itemRows[0];

    // Find the parse_result for this question (QP text)
    const [qpResultRows] = await db.execute(
      `SELECT pr.question_text as qp_text, pr.auto_corrected_marks as qp_marks
       FROM parse_results pr
       JOIN parse_sessions ps ON pr.session_id = ps.session_id
       WHERE pr.question_number = ? 
         AND ps.paper_code = ?
         AND (pr.is_memo = 0 OR pr.is_memo IS NULL)
       LIMIT 1`,
      [item.question_number, item.source_paper_code]
    );

    // Find the parse_memo for this question (Memo text)
    const [memoResultRows] = await db.execute(
      `SELECT pm.answer_text as memo_text, pm.auto_corrected_marks as memo_marks
       FROM parse_memos pm
       JOIN parse_sessions ps ON pm.session_id = ps.session_id
       WHERE pm.question_number = ? 
         AND ps.paper_code = ?
       LIMIT 1`,
      [item.question_number, item.source_paper_code]
    );

    const qpData = qpResultRows[0] || { qp_text: item.question_text || 'No QP text available', qp_marks: item.marks || 0 };
    const memoData = memoResultRows[0] || { memo_text: 'No memo text available', memo_marks: item.marks_allocated || 0 };

    res.json({ 
      success: true, 
      qp_memo: {
        qp_text: qpData.qp_text || item.question_text || 'No QP text available',
        memo_text: memoData.memo_text || 'No memo text available',
        qp_marks: qpData.qp_marks || item.marks || 0,
        memo_marks: memoData.memo_marks || item.marks_allocated || 0
      }
    });

  } catch (e) {
    console.error('QP/Memo fetch error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// SUBMIT REVIEW (with state transition)
// ============================================
router.post('/submit-review', async (req, res) => {
  try {
    const db = req.db;
    const { item_id, reviewer_id, reviewer_role, review_type, comment, decision, transition_reason } = req.body;

    if (!item_id || !reviewer_id || !reviewer_role || !decision) {
      return res.status(400).json({ success: false, error: 'item_id, reviewer_id, reviewer_role, decision required' });
    }

    const [itemRows] = await db.execute('SELECT status, subject_id FROM item_master WHERE item_id = ?', [item_id]);
    if (itemRows.length === 0) return res.status(404).json({ success: false, error: 'Item not found' });
    const currentStatus = itemRows[0].status;

    // Determine new status
    let newStatus = currentStatus;
    if (decision === 'approve') {
      if ((reviewer_role === 'peer_reviewer' || reviewer_role === 'admin') && currentStatus === 'draft') newStatus = 'peer_approved';
      else if ((reviewer_role === 'subject_expert' || reviewer_role === 'admin') && currentStatus === 'peer_approved') newStatus = 'expert_approved';
      else if ((reviewer_role === 'moderator' || reviewer_role === 'admin') && currentStatus === 'expert_approved') newStatus = 'moderated';
    } else if (decision === 'reject' || decision === 'request_revision') {
      newStatus = 'revision_required';
    }

    // Insert review comment
    await db.execute(
      `INSERT INTO item_reviews (subject_official_code, subject_alpha_code, paper_no, item_id, reviewer_id, reviewer_role, review_type, comment, status)
       SELECT ls.subject_official_code, ls.subject_alpha_code, im.paper_no, im.item_id, ?, ?, ?, ?, 'open'
       FROM item_master im JOIN lookup_subjects ls ON im.subject_id = ls.subject_id WHERE im.item_id = ?`,
      [reviewer_id, reviewer_role, review_type || 'general', comment || '', item_id]
    );

    // Update item status if changed
    if (newStatus !== currentStatus) {
      await db.execute('UPDATE item_master SET status = ?, review_status = ? WHERE item_id = ?', [newStatus, newStatus, item_id]);
      await db.execute(
        `INSERT INTO review_workflow (subject_official_code, subject_alpha_code, paper_no, item_id, current_state, previous_state, changed_by, changed_by_role, transition_reason)
         SELECT ls.subject_official_code, ls.subject_alpha_code, im.paper_no, im.item_id, ?, ?, ?, ?, ?
         FROM item_master im JOIN lookup_subjects ls ON im.subject_id = ls.subject_id WHERE im.item_id = ?`,
        [newStatus, currentStatus, reviewer_id, reviewer_role, transition_reason || `Reviewed by ${reviewer_role}`, item_id]
      );
    }

    res.json({ success: true, message: 'Review submitted', new_status: newStatus, previous_status: currentStatus });
  } catch (e) {
    console.error('Submit review error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// GET REVIEW THREADS FOR AN ITEM
// ============================================
router.get('/review-threads/:itemId', async (req, res) => {
  try {
    const db = req.db;
    const [reviews] = await db.execute(
      `SELECT ir.*, qu.full_name as reviewer_name FROM item_reviews ir
       LEFT JOIN qbank_users qu ON ir.reviewer_id = qu.user_id
       WHERE ir.item_id = ? ORDER BY ir.created_at DESC`, [req.params.itemId]
    );
    const threads = reviews.reduce((acc, review) => {
      const role = review.reviewer_role;
      if (!acc[role]) acc[role] = [];
      acc[role].push(review);
      return acc;
    }, {});
    res.json({ success: true, threads, total: reviews.length });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// ADMIN: ASSIGN SUBJECTS TO REVIEWERS
// ============================================
router.post('/assign-subject', async (req, res) => {
  try {
    const db = req.db;
    const { user_id, subject_id, grade_id, is_primary_expert } = req.body;
    if (!user_id || !subject_id) return res.status(400).json({ success: false, error: 'user_id and subject_id required' });

    const [existing] = await db.execute(
      'SELECT assignment_id FROM user_subject_assignments WHERE user_id = ? AND subject_id = ?', [user_id, subject_id]
    );

    if (existing.length > 0) {
      await db.execute('UPDATE user_subject_assignments SET grade_id = ?, is_primary_expert = ? WHERE assignment_id = ?',
        [grade_id, is_primary_expert || 0, existing[0].assignment_id]);
    } else {
      await db.execute('INSERT INTO user_subject_assignments (user_id, subject_id, grade_id, is_primary_expert) VALUES (?, ?, ?, ?)',
        [user_id, subject_id, grade_id, is_primary_expert || 0]);
    }
    res.json({ success: true, message: 'Assignment updated' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// ADMIN: GET ALL ASSIGNMENTS
// ============================================
router.get('/assignments', async (req, res) => {
  try {
    const db = req.db;
    const [assignments] = await db.execute(
      `SELECT usa.*, qu.full_name, qu.email, qu.role, ls.subject_name, ls.subject_alpha_code
       FROM user_subject_assignments usa
       JOIN qbank_users qu ON usa.user_id = qu.user_id
       JOIN lookup_subjects ls ON usa.subject_id = ls.subject_id
       ORDER BY ls.subject_name, qu.full_name`
    );
    res.json({ success: true, assignments });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============================================
// GET WORKFLOW HISTORY
// ============================================
router.get('/workflow-history/:itemId', async (req, res) => {
  try {
    const db = req.db;
    const [history] = await db.execute(
      `SELECT rw.*, qu.full_name as changed_by_name FROM review_workflow rw
       LEFT JOIN qbank_users qu ON rw.changed_by = qu.user_id
       WHERE rw.item_id = ? ORDER BY rw.created_at DESC`, [req.params.itemId]
    );
    res.json({ success: true, history });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ============================================
// MODERATOR: PUBLISH ITEM TO PRODUCTION
// ============================================
router.post('/publish-item', async (req, res) => {
  try {
    const db = req.db;
    const { item_id, moderator_id, publish_reason } = req.body;

    if (!item_id || !moderator_id) {
      return res.status(400).json({ success: false, error: 'item_id and moderator_id required' });
    }

    // Get current item status
    const [itemRows] = await db.execute(
      'SELECT status, subject_id, paper_no, question_number FROM item_master WHERE item_id = ?',
      [item_id]
    );
    if (itemRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    const currentStatus = itemRows[0].status;

    // Only allow publishing from expert_approved or moderated status
    if (currentStatus !== 'expert_approved' && currentStatus !== 'moderated') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot publish item with status '${currentStatus}'. Must be 'expert_approved' or 'moderated'.` 
      });
    }

    // Update item status to published
    await db.execute(
      'UPDATE item_master SET status = ?, review_status = ?, published_at = NOW(), published_by = ? WHERE item_id = ?',
      ['published', 'published', moderator_id, item_id]
    );

    // Log workflow transition
    await db.execute(
      `INSERT INTO review_workflow (subject_official_code, subject_alpha_code, paper_no, item_id, current_state, previous_state, changed_by, changed_by_role, transition_reason)
       SELECT ls.subject_official_code, ls.subject_alpha_code, im.paper_no, im.item_id, 'published', im.status, ?, 'moderator', ?
       FROM item_master im
       JOIN lookup_subjects ls ON im.subject_id = ls.subject_id
       WHERE im.item_id = ?`,
      [moderator_id, publish_reason || 'Published to production by moderator', item_id]
    );

    res.json({ 
      success: true, 
      message: 'Item published to production',
      new_status: 'published',
      previous_status: currentStatus,
      published_at: new Date().toISOString()
    });

  } catch (e) {
    console.error('Publish item error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
