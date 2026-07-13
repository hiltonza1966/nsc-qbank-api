const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'items');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const itemId = req.params.item_id || req.body.item_id || 'temp';
    const itemDir = path.join(UPLOAD_DIR, itemId);
    if (!fs.existsSync(itemDir)) {
      fs.mkdirSync(itemDir, { recursive: true });
    }
    cb(null, itemDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const attachmentId = uuidv4();
    cb(null, attachmentId + ext);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed (JPEG, PNG, GIF, WebP, SVG)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const QBANK_DB = process.env.DB_NAME || 'nsc_qbank';

// POST /api/attachments/upload - Upload image (used by wizard before staging import)
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const attachmentId = path.basename(req.file.filename, path.extname(req.file.filename));
    const filePath = req.file.path.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');

    res.json({
      success: true,
      attachment_id: attachmentId,
      file_path: filePath,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/attachments/:item_id - Upload image linked to specific item
router.post('/:item_id', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const itemId = req.params.item_id;
    const attachmentId = path.basename(req.file.filename, path.extname(req.file.filename));
    const filePath = req.file.path.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');

    // Save to database
    await req.db.query(
      `INSERT INTO ${QBANK_DB}.item_attachments
       (attachment_id, item_id, attachment_type, file_name, file_path, mime_type, file_size, caption, created_at)
       VALUES (?, ?, 'image', ?, ?, ?, ?, ?, NOW())`,
      [attachmentId, itemId, req.file.originalname, filePath, req.file.mimetype, req.file.size, req.body.caption || null]
    );

    res.json({
      success: true,
      attachment_id: attachmentId,
      item_id: itemId,
      file_path: filePath,
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/attachments/:attachment_id - Download image
router.get('/:attachment_id', async (req, res) => {
  try {
    const [rows] = await req.db.query(
      `SELECT * FROM ${QBANK_DB}.item_attachments WHERE attachment_id = ?`,
      [req.params.attachment_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    const attachment = rows[0];
    const filePath = path.join(process.cwd(), attachment.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Disposition', 'inline; filename="' + attachment.file_name + '"');
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/attachments/:attachment_id - Delete image
router.delete('/:attachment_id', async (req, res) => {
  try {
    const [rows] = await req.db.query(
      `SELECT * FROM ${QBANK_DB}.item_attachments WHERE attachment_id = ?`,
      [req.params.attachment_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    const attachment = rows[0];
    const filePath = path.join(process.cwd(), attachment.file_path);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await req.db.query(
      `DELETE FROM ${QBANK_DB}.item_attachments WHERE attachment_id = ?`,
      [req.params.attachment_id]
    );

    res.json({ success: true, message: 'Attachment deleted' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/attachments/item/:item_id - List attachments for an item
router.get('/item/:item_id', async (req, res) => {
  try {
    const [rows] = await req.db.query(
      `SELECT attachment_id, attachment_type, file_name, file_path, mime_type, file_size, caption, created_at
       FROM ${QBANK_DB}.item_attachments
       WHERE item_id = ? OR staging_item_id = ?
       ORDER BY created_at`,
      [req.params.item_id, req.params.item_id]
    );

    res.json({ success: true, count: rows.length, attachments: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});



// GET /api/attachments/by-question/:paper_code/:question_number - List attachments for an item by paper code and question number
router.get('/by-question/:paper_code/:question_number', async (req, res) => {
  try {
    const { paper_code, question_number } = req.params;

    // Find the item by paper_code and question_number
    const [items] = await pool.query(
      `SELECT item_id FROM ${QBANK_DB}.item_master WHERE source_paper_code = ? AND question_number = ? LIMIT 1`,
      [paper_code, question_number]
    );

    if (items.length === 0) {
      return res.json({ success: true, count: 0, attachments: [] });
    }

    const item_id = items[0].item_id;

    // Fetch attachments for this item
    const [attachments] = await pool.query(
      `SELECT attachment_id, item_id, file_name, file_path, file_size, mime_type, description, display_order, created_at 
       FROM ${QBANK_DB}.item_attachments 
       WHERE item_id = ? 
       ORDER BY display_order, file_name`,
      [item_id]
    );

    res.json({ success: true, count: attachments.length, attachments });
  } catch (err) {
    console.error('Error fetching attachments by question:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
