// test_parser_output.js
// Run this in the repo root to see the Python parser output structure

const { spawn } = require('child_process');
const path = require('path');

const PARSERS_DIR = path.join(__dirname, 'backend', 'parsers');
const parserCommand = path.join(PARSERS_DIR, 'parser_api_v2.py');
const outputDir = path.join(__dirname, 'uploads', 'parser_output', 'TEST_DIAGNOSTIC');

const qpPath = 'C:\\dev\\nsc-qbank\\docs\\Question Papers\\ACCOUNTING_P1_2025_NOV_ENG_QP.pdf';
const memoPath = 'C:\\dev\\nsc-qbank\\docs\\Question Papers\\ACCOUNTING_P1_2025_NOV_ENG_Memo_ENG.pdf';
const paperCode = 'ACCOUNTING_P1_2025_NOV_ENG';

console.log('Running Python parser...');
console.log('QP:', qpPath);
console.log('Memo:', memoPath);
console.log('Output:', outputDir);

const python = spawn('python', ['-u', parserCommand, 'parse', qpPath, memoPath, paperCode, outputDir], {
  cwd: PARSERS_DIR,
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
});

let stdout = '';
let stderr = '';

python.stdout.on('data', (data) => {
  stdout += data.toString();
});

python.stderr.on('data', (data) => {
  stderr += data.toString();
});

python.on('close', (code) => {
  console.log('\n=== Python exited with code', code, '===');

  if (stderr) {
    console.log('\n=== STDERR ===');
    console.log(stderr);
  }

  // Parse the last line as JSON
  const lines = stdout.split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1];

  try {
    const result = JSON.parse(lastLine);
    console.log('\n=== JSON STRUCTURE ===');
    console.log('Top-level keys:', Object.keys(result));

    // Check first item structure
    const allItems = [
      ...(result.green_items || []),
      ...(result.yellow_items || []),
      ...(result.red_items || []),
      ...(result.qp_only_items || [])
    ];

    if (allItems.length > 0) {
      const firstItem = allItems[0];
      console.log('\nFirst item keys:', Object.keys(firstItem));
      console.log('qp_images:', firstItem.qp_images);
      console.log('memo_images:', firstItem.memo_images);
      console.log('image_metadata:', firstItem.image_metadata);
      console.log('inherited_images:', firstItem.inherited_images);

      // Count items with images
      let itemsWithImages = 0;
      for (const item of allItems) {
        const hasImages = (item.qp_images && item.qp_images.length > 0) ||
                          (item.memo_images && item.memo_images.length > 0) ||
                          (item.image_metadata && item.image_metadata.length > 0);
        if (hasImages) itemsWithImages++;
      }
      console.log('\nItems with images:', itemsWithImages, '/', allItems.length);
    }

    // Check memo items
    const memoItems = result.memo_items || [];
    if (memoItems.length > 0) {
      console.log('\nFirst memo item keys:', Object.keys(memoItems[0]));
      console.log('memo_images:', memoItems[0].memo_images);
      console.log('qp_images:', memoItems[0].qp_images);
    }

  } catch (e) {
    console.log('\n=== FAILED TO PARSE JSON ===');
    console.log('Last line:', lastLine.substring(0, 200));
    console.log('Error:', e.message);
  }
});
