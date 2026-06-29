const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  try {
    const [cols] = await c.execute(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'question_papers'`);
    console.log('question_papers columns:');
    cols.forEach(col => console.log('  ' + col.COLUMN_NAME + ': ' + col.DATA_TYPE + (col.CHARACTER_MAXIMUM_LENGTH ? '(' + col.CHARACTER_MAXIMUM_LENGTH + ')' : '')));
  } catch(e) { console.log('question_papers error:', e.message); }
  try {
    const [count] = await c.execute('SELECT COUNT(*) as c FROM question_papers');
    console.log('question_papers count:', count[0].c);
  } catch(e) { console.log('count error:', e.message); }
  c.end();
}

check().catch(e => console.log(e.message));
