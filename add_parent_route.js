const fs = require('fs');

const filePath = process.argv[2] || 'routes/attachments.js';
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Check if the route already exists
if (content.includes("/by-question/:paper_code/:question_number")) {
  console.log('Route already exists, skipping');
  process.exit(0);
}

// Find the end of the file to insert the new route
// Insert before module.exports if it exists
const newRoute = `

// GET /api/attachments/by-question/:paper_code/:question_number - List attachments for an item by paper code and question number
router.get('/by-question/:paper_code/:question_number', async (req, res) => {
  try {
    const { paper_code, question_number } = req.params;

    // Find the item by paper_code and question_number
    const [items] = await pool.query(
      \`SELECT item_id FROM \${QBANK_DB}.item_master WHERE source_paper_code = ? AND question_number = ? LIMIT 1\`,
      [paper_code, question_number]
    );

    if (items.length === 0) {
      return res.json({ success: true, count: 0, attachments: [] });
    }

    const item_id = items[0].item_id;

    // Fetch attachments for this item
    const [attachments] = await pool.query(
      \`SELECT attachment_id, item_id, file_name, file_path, file_size, mime_type, description, display_order, created_at 
       FROM \${QBANK_DB}.item_attachments 
       WHERE item_id = ? 
       ORDER BY display_order, file_name\`,
      [item_id]
    );

    res.json({ success: true, count: attachments.length, attachments });
  } catch (err) {
    console.error('Error fetching attachments by question:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
`;

const moduleExportsIdx = content.indexOf('module.exports');
if (moduleExportsIdx !== -1) {
  content = content.substring(0, moduleExportsIdx) + newRoute + '\n' + content.substring(moduleExportsIdx);
} else {
  content += newRoute;
}

const backupPath = filePath + '.bak.parent_' + new Date().toISOString().replace(/[:.]/g, '-');
fs.writeFileSync(backupPath, fs.readFileSync(filePath));
console.log('Backup saved to:', backupPath);

fs.writeFileSync(filePath, content, 'utf8');
console.log('New route added successfully!');
