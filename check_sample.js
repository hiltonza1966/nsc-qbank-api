const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [items] = await c.execute('SELECT item_code, subject_official_code, paper_no, question_number, marks, source_paper_code FROM item_master LIMIT 5');
  console.log('Sample items:');
  items.forEach(i => console.log('  ', i.item_code, '| subject:', i.subject_official_code, '| paper:', i.paper_no, '| Q:', i.question_number, '| marks:', i.marks));
  c.end();
}

check().catch(e => console.log(e.message));
