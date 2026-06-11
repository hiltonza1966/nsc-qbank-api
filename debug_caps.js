
const pdf = require('pdf-parse');
const fs = require('fs');

async function debug() {
  const dataBuffer = fs.readFileSync('caps_test.pdf');
  const data = await pdf(dataBuffer);

  console.log('=== FULL TEXT (first 3000 chars) ===');
  console.log(data.text.substring(0, 3000));

  console.log('\n\n=== SEARCHING FOR SECTION 4 ===');
  const section4Patterns = [
    /SECTION\s+4[:\.]?\s*ASSESSMENT/i,
    /4\.4\s+Programme\s+of\s+Assessment/i,
    /4\.4\s+Assessment\s+Requirements/i,
    /Assessment\s+in\s+.+Grades\s+10[-–]12/i,
    /PROGRAMME\s+OF\s+FORMAL\s+ASSESSMENT/i,
  ];

  for (const p of section4Patterns) {
    const match = data.text.search(p);
    console.log(`Pattern ${p.source}: ${match !== -1 ? 'FOUND at ' + match : 'NOT FOUND'}`);
  }

  console.log('\n=== SEARCHING FOR GRADE HEADERS ===');
  const gradePatterns = [
    /Grade\s+10\s*[:\.]?\s*Programme\s+of\s+(?:Formal\s+)?Assessment/i,
    /Grade\s+11\s*[:\.]?\s*Programme\s+of\s+(?:Formal\s+)?Assessment/i,
    /Grade\s+12\s*[:\.]?\s*Programme\s+of\s+(?:Formal\s+)?Assessment/i,
    /GRADE\s+10\s+PROGRAMME/i,
    /GRADE\s+11\s+PROGRAMME/i,
    /GRADE\s+12\s+PROGRAMME/i,
  ];

  for (const p of gradePatterns) {
    const match = data.text.search(p);
    console.log(`Pattern ${p.source}: ${match !== -1 ? 'FOUND at ' + match : 'NOT FOUND'}`);
  }

  console.log('\n=== RAW TEXT AROUND "Assessment" (first 5 matches) ===');
  let idx = 0;
  let count = 0;
  while ((idx = data.text.indexOf('Assessment', idx)) !== -1 && count < 5) {
    console.log(`\n--- Match ${count + 1} at ${idx} ---`);
    console.log(data.text.substring(Math.max(0, idx - 50), idx + 100));
    idx++;
    count++;
  }

  // Save full text for inspection
  fs.writeFileSync('caps_raw_text.txt', data.text);
  console.log('\nFull text saved to caps_raw_text.txt');
}

debug().catch(console.error);
