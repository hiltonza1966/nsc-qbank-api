const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [cols] = await c.execute(`SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'item_master' ORDER BY ORDINAL_POSITION`);
  console.log('item_master columns (' + cols.length + '):');
  cols.forEach((col, i) => {
    const nullable = col.IS_NULLABLE === 'YES' ? ' NULL' : ' NOT NULL';
    const def = col.COLUMN_DEFAULT ? ' DEFAULT ' + col.COLUMN_DEFAULT : '';
    const len = col.CHARACTER_MAXIMUM_LENGTH ? '(' + col.CHARACTER_MAXIMUM_LENGTH + ')' : '';
    console.log('  ' + (i+1) + '. ' + col.COLUMN_NAME + ': ' + col.DATA_TYPE + len + nullable + def);
  });
  c.end();
}

check().catch(e => console.log(e.message));
