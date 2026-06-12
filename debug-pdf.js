const pdf = require('pdf-parse');
const fs = require('fs');

async function debugPdf(pdfPath) {
  const dataBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  console.log('=== FULL RAW TEXT ===');
  console.log(text);
  console.log('\n=== END OF TEXT ===');
  console.log(`Total length: ${text.length} chars`);

  // Check for key patterns
  console.log('\n=== PATTERN CHECKS ===');
  console.log('Contains "SECTION 4":', text.includes('SECTION 4'));
  console.log('Contains "ASSESSMENT":', /ASSESSMENT/i.test(text));
  console.log('Contains "Programme of Assessment":', /Programme of Assessment/i.test(text));
  console.log('Contains "GRADE 10":', /GRADE 10/i.test(text));
  console.log('Contains "Grade 10":', /Grade 10/i.test(text));
  console.log('Contains "Term":', /Term/i.test(text));
  console.log('Contains "Form of assessment":', /Form of assessment/i.test(text));

  // Show first 2000 chars
  console.log('\n=== FIRST 2000 CHARS ===');
  console.log(text.substring(0, 2000));
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log('Usage: node debug-pdf.js <path-to-pdf>');
  process.exit(1);
}

debugPdf(pdfPath).catch(console.error);
