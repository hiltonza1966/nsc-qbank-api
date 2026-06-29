const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [rows] = await c.execute('SELECT parser_subject_code, subject_alpha_code, subject_name FROM lookup_subjects WHERE parser_subject_code IS NOT NULL ORDER BY parser_subject_code');
  console.log('Subjects with parser_subject_code:');
  rows.forEach(r => {
    const code = r.parser_subject_code;
    const len = code.length;
    const status = len > 10 ? ' TOO LONG for item_master!' : '';
    console.log('  ' + code + ' (len=' + len + ')' + status);
  });
  c.end();
}

check().catch(e => console.log(e.message));
