// test_fs_exists.js
// Test if fs.existsSync works with the actual image paths

const fs = require('fs');
const path = require('path');

// Test path from diagnostic (with forward slash)
const path1 = 'C:\\dev\\nsc-qbank\\uploads\\parser_output\\TEST_DIAGNOSTIC\\memo_images/memo_1_1_p1_img0.png';
console.log('Path with forward slash:', path1);
console.log('existsSync:', fs.existsSync(path1));

// Test path with backslash
const path2 = 'C:\\dev\\nsc-qbank\\uploads\\parser_output\\TEST_DIAGNOSTIC\\memo_images\\memo_1_1_p1_img0.png';
console.log('Path with backslash:', path2);
console.log('existsSync:', fs.existsSync(path2));

// Test path.normalize
const path3 = path.normalize(path1);
console.log('Normalized:', path3);
console.log('existsSync:', fs.existsSync(path3));

// Test path.basename with forward slash
console.log('basename forward slash:', path.basename(path1));
console.log('basename backslash:', path.basename(path2));
