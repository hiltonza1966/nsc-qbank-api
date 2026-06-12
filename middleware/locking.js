const express = require('express');

// Check if item is locked (approved or published)
async function checkItemLock(req, res, next) {
  const db = req.db;
  const itemId = req.params.id || req.params.item_id;

  if (!itemId) return next();

  try {
    const [items] = await db.execute(
      'SELECT status FROM item_master WHERE item_id = ?',
      [itemId]
    );

    if (!items.length) return next();

    const status = items[0].status;
    const lockedStatuses = ['approved', 'published', 'archived'];

    if (lockedStatuses.includes(status)) {
      // Check if user is admin (can override)
      const userRole = req.headers['x-user-role'] || 'author';
      if (userRole === 'admin') return next();

      return res.status(423).json({
        success: false,
        error: `Item is locked (status: ${status}). Contact admin to unlock.`,
        status: status
      });
    }

    next();
  } catch (e) {
    next(e);
  }
}

// Check if paper is locked
async function checkPaperLock(req, res, next) {
  const db = req.db;
  const paperId = req.params.id || req.params.paper_id;

  if (!paperId) return next();

  try {
    const [papers] = await db.execute(
      'SELECT status FROM generated_papers WHERE paper_id = ?',
      [paperId]
    );

    if (!papers.length) return next();

    const status = papers[0].status;
    const lockedStatuses = ['print_ready', 'published', 'archived'];

    if (lockedStatuses.includes(status)) {
      const userRole = req.headers['x-user-role'] || 'author';
      if (userRole === 'admin') return next();

      return res.status(423).json({
        success: false,
        error: `Paper is locked (status: ${status}). Contact admin to unlock.`,
        status: status
      });
    }

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { checkItemLock, checkPaperLock };
