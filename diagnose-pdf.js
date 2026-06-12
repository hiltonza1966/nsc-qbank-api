const pdf = require('pdf-parse');
const fs = require('fs');

async function diagnose(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdf(dataBuffer);
  
  // Save raw text
  const rawPath = 'temp/diagnose-raw.txt';
  fs.writeFileSync(rawPath, pdfData.text, 'utf8');
  
  console.log('=== PDF DIAGNOSIS ===');
  console.log('Total text length:', pdfData.text.length);
  console.log('Total lines:', pdfData.text.split('\n').length);
  
  // Show first 100 lines
  console.log('\n=== FIRST 100 LINES ===');
  const lines = pdfData.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  lines.slice(0, 100).forEach((line, i) => {
    console.log(`${i.toString().padStart(3)}: ${line}`);
  });
  
  // Search for key patterns
  console.log('\n=== PATTERN SEARCH ===');
  const patterns = [
    'SECTION 4',
    'SECTiON 4',
    'Programme of assessment',
    'Grade 10',
    'Grade 11', 
    'Grade 12',
    'Term 1',
    'Assessment',
    'Total marks',
    'Convert to a mark'
  ];
  
  for (const pattern of patterns) {
    const idx = pdfData.text.search(new RegExp(pattern, 'i'));
    console.log(`"${pattern}": ${idx !== -1 ? 'FOUND at ' + idx : 'NOT FOUND'}`);
  }
  
  console.log('\nRaw text saved to:', rawPath);
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log('Usage: node diagnose-pdf.js <path-to-pdf>');
  process.exit(1);
}

diagnose(pdfPath).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});