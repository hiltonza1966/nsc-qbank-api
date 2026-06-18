const express = require('express');
const router = express.Router();

// ============================================================
// LOADED DASHBOARD API
// ============================================================

// GET /api/dashboard/loaded - Summary of all loaded papers
router.get('/loaded', async (req, res) => {
  try {
    const db = req.db;

    // Check if item_attachments table exists
    let hasAttachments = false;
    try {
      await db.query('SELECT 1 FROM item_attachments LIMIT 1');
      hasAttachments = true;
    } catch (e) {
      hasAttachments = false;
    }

    const attachmentJoin = hasAttachments 
      ? 'LEFT JOIN item_attachments att ON im.item_id = att.item_id'
      : '';
    const attachmentCount = hasAttachments 
      ? 'COUNT(DISTINCT att.attachment_id) as attachment_count'
      : '0 as attachment_count';

    const [papers] = await db.query(`
      SELECT 
        im.source_paper_code as paper_code,
        im.subject_alpha_code,
        im.paper_no,
        im.year_id,
        im.grade_id,
        COUNT(DISTINCT im.item_id) as item_count,
        COUNT(DISTINCT imem.memo_id) as memo_count,
        ${attachmentCount},
        SUM(im.marks) as total_marks,
        SUM(im.marks_allocated) as total_allocated,
        MAX(im.created_at) as last_imported
      FROM item_master im
      LEFT JOIN item_memos imem ON im.item_id = imem.item_id
      ${attachmentJoin}
      WHERE im.source_paper_code IS NOT NULL
      GROUP BY im.source_paper_code, im.subject_alpha_code, im.paper_no, im.year_id, im.grade_id
      ORDER BY MAX(im.created_at) DESC
    `);

    res.json({ success: true, papers });
  } catch (error) {
    console.error('Loaded dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/loaded/:paperCode - Items for a specific paper
router.get('/loaded/:paperCode', async (req, res) => {
  try {
    const db = req.db;
    const { paperCode } = req.params;

    // Check if item_attachments table exists
    let hasAttachments = false;
    try {
      await db.query('SELECT 1 FROM item_attachments LIMIT 1');
      hasAttachments = true;
    } catch (e) {
      hasAttachments = false;
    }

    const attachmentJoin = hasAttachments 
      ? 'LEFT JOIN item_attachments att ON im.item_id = att.item_id'
      : '';
    const attachmentCount = hasAttachments 
      ? 'COUNT(att.attachment_id) as attachment_count'
      : '0 as attachment_count';

    const [items] = await db.query(`
      SELECT 
        im.item_id,
        im.item_code,
        im.question_number,
        im.question_text,
        im.marks,
        im.marks_allocated,
        im.status,
        im.review_status,
        im.source_question_number,
        im.created_at,
        MAX(imem.memo_id) as memo_id,
        MAX(imem.answer_text) as memo_answer,
        MAX(imem.marks) as memo_marks,
        MAX(imem.marking_guideline) as marking_guideline,
        ${attachmentCount}
      FROM item_master im
      LEFT JOIN item_memos imem ON im.item_id = imem.item_id
      ${attachmentJoin}
      WHERE im.source_paper_code = ?
      GROUP BY im.item_id
      ORDER BY im.question_number
    `, [paperCode]);

    res.json({ success: true, paperCode, items });
  } catch (error) {
    console.error('Paper items error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/item/:itemId - Full item details
router.get('/item/:itemId', async (req, res) => {
  try {
    const db = req.db;
    const { itemId } = req.params;

    // Get item
    const [items] = await db.query(`
      SELECT * FROM item_master WHERE item_id = ?
    `, [itemId]);

    if (items.length === 0) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const item = items[0];

    // Get memo
    const [memos] = await db.query(`
      SELECT * FROM item_memos WHERE item_id = ? AND is_current = 1
    `, [itemId]);

    // Get attachments
    let attachments = [];
    try {
      const [attRows] = await db.query(`
        SELECT * FROM item_attachments WHERE item_id = ?
      `, [itemId]);
      attachments = attRows || [];
    } catch (e) {
      attachments = [];
    }

    res.json({ 
      success: true, 
      item,
      memo: memos[0] || null,
      attachments
    });
  } catch (error) {
    console.error('Item detail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/dashboard/item/:itemId - Update item (CRUD)
router.put('/item/:itemId', async (req, res) => {
  try {
    const db = req.db;
    const { itemId } = req.params;
    const updates = req.body;

    // Build update query dynamically
    const allowedFields = [
      'question_text', 'marks', 'marks_allocated', 'status', 
      'review_status', 'question_number', 'cognitive_level_id',
      'difficulty_id', 'item_type_id'
    ];

    const fields = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    values.push(itemId);

    await db.query(`
      UPDATE item_master 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE item_id = ?
    `, values);

    // Update memo if provided
    if (updates.memo_answer || updates.memo_marks || updates.marking_guideline) {
      await db.query(`
        UPDATE item_memos 
        SET answer_text = COALESCE(?, answer_text),
            marks = COALESCE(?, marks),
            marking_guideline = COALESCE(?, marking_guideline),
            updated_at = CURRENT_TIMESTAMP
        WHERE item_id = ? AND is_current = 1
      `, [updates.memo_answer, updates.memo_marks, updates.marking_guideline, itemId]);
    }

    res.json({ success: true, message: 'Item updated' });
  } catch (error) {
    console.error('Item update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/dashboard/item/:itemId - Delete single item
router.delete('/item/:itemId', async (req, res) => {
  try {
    const db = req.db;
    const { itemId } = req.params;

    try { await db.query('DELETE FROM item_attachments WHERE item_id = ?', [itemId]); } catch (e) {}
    await db.query('DELETE FROM item_memos WHERE item_id = ?', [itemId]);
    await db.query('DELETE FROM item_master WHERE item_id = ?', [itemId]);

    res.json({ success: true, message: 'Item deleted' });
  } catch (error) {
    console.error('Item delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/dashboard/items - Bulk delete
router.delete('/items', async (req, res) => {
  try {
    const db = req.db;
    const { itemIds } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No items selected' });
    }

    const placeholders = itemIds.map(() => '?').join(',');

    try { await db.query(`DELETE FROM item_attachments WHERE item_id IN (${placeholders})`, itemIds); } catch (e) {}
    await db.query(`DELETE FROM item_memos WHERE item_id IN (${placeholders})`, itemIds);
    await db.query(`DELETE FROM item_master WHERE item_id IN (${placeholders})`, itemIds);

    res.json({ success: true, message: `${itemIds.length} items deleted` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
