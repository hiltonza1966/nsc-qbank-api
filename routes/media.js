const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Helper: generate SHA256 checksum
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ===================== SVG =====================
// GET /api/media/svg/:item_id — Get all SVGs for item
router.get('/svg/:item_id', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT svg_id, item_id, storage_path, width_px, height_px, view_box, created_at FROM items_media_svg WHERE item_id = ? ORDER BY created_at',
      [req.params.item_id]
    );
    res.json({ success: true, svgs: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/media/svg — Upload SVG
router.post('/svg', async (req, res) => {
  const { item_id, svg_content, width_px, height_px, view_box, storage_path } = req.body;
  if (!item_id || !svg_content) {
    return res.status(400).json({ success: false, error: 'item_id and svg_content required' });
  }
  try {
    const checksum = sha256(svg_content);
    const keyId = uuidv4();
    const [result] = await req.db.execute(
      `INSERT INTO items_media_svg (item_id, storage_path, svg_content, width_px, height_px, view_box, encryption_key_id, checksum_sha256, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, storage_path || '', svg_content, width_px || null, height_px || null, view_box || null, keyId, checksum, req.headers['x-user-id'] || 1]
    );
    res.json({ success: true, svg_id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/media/svg/:svg_id
router.delete('/svg/:svg_id', async (req, res) => {
  try {
    await req.db.execute('DELETE FROM items_media_svg WHERE svg_id = ?', [req.params.svg_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ===================== AUDIO =====================
// GET /api/media/audio/:item_id — Get all audio for item
router.get('/audio/:item_id', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT audio_id, item_id, storage_path, duration_seconds, transcript_text, language_code, file_size_bytes, mime_type, created_at FROM items_media_audio WHERE item_id = ? ORDER BY created_at',
      [req.params.item_id]
    );
    res.json({ success: true, audio: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/media/audio — Upload audio metadata
router.post('/audio', async (req, res) => {
  const { item_id, storage_path, duration_seconds, transcript_text, language_code, file_size_bytes, mime_type } = req.body;
  if (!item_id || !storage_path) {
    return res.status(400).json({ success: false, error: 'item_id and storage_path required' });
  }
  try {
    const checksum = sha256(storage_path + Date.now());
    const keyId = uuidv4();
    const [result] = await req.db.execute(
      `INSERT INTO items_media_audio (item_id, storage_path, duration_seconds, transcript_text, language_code, encryption_key_id, checksum_sha256, file_size_bytes, mime_type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, storage_path, duration_seconds || null, transcript_text || null, language_code || 'en', keyId, checksum, file_size_bytes || null, mime_type || null, req.headers['x-user-id'] || 1]
    );
    res.json({ success: true, audio_id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/media/audio/:audio_id
router.delete('/audio/:audio_id', async (req, res) => {
  try {
    await req.db.execute('DELETE FROM items_media_audio WHERE audio_id = ?', [req.params.audio_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ===================== CODE =====================
// GET /api/media/code/:item_id — Get all code snippets for item
router.get('/code/:item_id', async (req, res) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT code_id, item_id, code_content, language, syntax_highlighted, line_count, created_at FROM items_media_code WHERE item_id = ? ORDER BY created_at',
      [req.params.item_id]
    );
    res.json({ success: true, code: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/media/code — Upload code snippet
router.post('/code', async (req, res) => {
  const { item_id, code_content, language, syntax_highlighted, line_count } = req.body;
  if (!item_id || !code_content || !language) {
    return res.status(400).json({ success: false, error: 'item_id, code_content, and language required' });
  }
  try {
    const checksum = sha256(code_content);
    const keyId = uuidv4();
    const [result] = await req.db.execute(
      `INSERT INTO items_media_code (item_id, code_content, language, syntax_highlighted, line_count, encryption_key_id, checksum_sha256, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [item_id, code_content, language, syntax_highlighted || false, line_count || null, keyId, checksum, req.headers['x-user-id'] || 1]
    );
    res.json({ success: true, code_id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/media/code/:code_id
router.delete('/code/:code_id', async (req, res) => {
  try {
    await req.db.execute('DELETE FROM items_media_code WHERE code_id = ?', [req.params.code_id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
