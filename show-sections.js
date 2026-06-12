const fs = require('fs');

const rawText = fs.readFileSync('temp/diagnose-raw.txt', 'utf8');

console.log('=== SECTION 4 AREA (index 5727) ===');
console.log(rawText.substring(5700, 6200));

console.log('\n=== PROGRAMME OF ASSESSMENT AREA (index 6093) ===');
console.log(rawText.substring(6050, 6500));

console.log('\n=== TOTAL MARKS AREA (index 30619) ===');
console.log(rawText.substring(30500, 31000));

console.log('\n=== SEARCH FOR WEIGHTING PATTERNS ===');
const weightPatterns = [
  'Convert to a mark',
  'Convert to',
  'mark out of',
  'weighting',
  'Converted to',
  'Convert'
];
for (const pattern of weightPatterns) {
  const idx = rawText.search(new RegExp(pattern, 'i'));
  if (idx !== -1) {
    console.log(`\n"${pattern}" found at ${idx}:`);
    console.log(rawText.substring(idx, idx + 200));
  }
}