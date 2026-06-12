const express = require('express');

// Audit logging middleware - logs every tool action
async function auditLog(req, res, next) {
  // Only log tool-related actions (POST/PUT/DELETE on items with tool data)
  if (req.method === 'GET') {
    return next();
  }

  const isToolAction = req.path.includes('/items') && (
    req.body?.item_stem_latex ||
    req.body?.item_stem_html ||
    req.body?.item_stem_code ||
    req.body?.item_media_svg ||
    req.body?.item_media_audio ||
    req.body?.item_rubric_json ||
    req.body?.item_answer_json
  );

  if (!isToolAction) {
    return next();
  }

  // Store audit data for post-response logging
  req.auditData = {
    user_id: req.headers['x-user-id'] || req.user?.id || 1,
    user_role: req.headers['x-user-role'] || req.user?.role || 'author',
    tool_name: detectTool(req.body),
    action: req.method,
    action_details: JSON.stringify({
      endpoint: req.path,
      subject_official_code: req.body?.subject_official_code,
      tool_required: req.body?.tool_required,
      has_latex: !!req.body?.item_stem_latex,
      has_html: !!req.body?.item_stem_html,
      has_code: !!req.body?.item_stem_code,
      has_svg: !!req.body?.item_media_svg,
      has_audio: !!req.body?.item_media_audio,
      has_rubric: !!req.body?.item_rubric_json,
      has_answer: !!req.body?.item_answer_json
    }),
    ip_address: req.ip || req.connection?.remoteAddress,
    user_agent: req.headers['user-agent']
  };

  // Override res.json to capture item_id after creation
  const originalJson = res.json.bind(res);
  res.json = async function(data) {
    if (data?.item_id || req.params?.id || req.params?.item_id) {
      const itemId = data?.item_id || req.params?.id || req.params?.item_id;
      try {
        await req.db.execute(
          `INSERT INTO tool_audit_log (item_id, user_id, user_role, tool_name, action, action_details, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, req.auditData.user_id, req.auditData.user_role, req.auditData.tool_name,
           req.auditData.action, req.auditData.action_details, req.auditData.ip_address, req.auditData.user_agent]
        );
      } catch (e) {
        console.error('Audit log failed:', e.message);
      }
    }
    return originalJson(data);
  };

  next();
}

function detectTool(body) {
  if (body?.item_stem_latex) return 'latex';
  if (body?.item_stem_html) return 'html';
  if (body?.item_stem_code) return 'code';
  if (body?.item_media_svg) return 'svg';
  if (body?.item_media_audio) return 'audio';
  if (body?.item_rubric_json) return 'rubric';
  if (body?.item_answer_json) return 'answer';
  return 'general';
}

// Get audit log for an item
async function getItemAuditLog(db, itemId) {
  const [logs] = await db.execute(
    `SELECT * FROM tool_audit_log WHERE item_id = ? ORDER BY created_at DESC`,
    [itemId]
  );
  return logs;
}

// Get audit log for a user
async function getUserAuditLog(db, userId, limit = 100) {
  const [logs] = await db.execute(
    `SELECT * FROM tool_audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return logs;
}

module.exports = { auditLog, getItemAuditLog, getUserAuditLog };
