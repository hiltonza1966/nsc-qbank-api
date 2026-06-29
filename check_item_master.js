const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [cols] = await c.execute(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'item_master' AND COLUMN_NAME IN ('subject_alpha_code', 'subject_official_code', 'subject_name')`);
  console.log('item_master columns:');
  cols.forEach(col => console.log('  ' + col.COLUMN_NAME + ': ' + col.DATA_TYPE + (col.CHARACTER_MAXIMUM_LENGTH ? '(' + col.CHARACTER_MAXIMUM_LENGTH + ')' : '') + ' nullable=' + col.IS_NULLABLE));
  c.end();
}

check().catch(e => console.log(e.message));
