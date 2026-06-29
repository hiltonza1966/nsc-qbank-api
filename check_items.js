const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [items] = await c.execute('SELECT COUNT(*) as c FROM item_master');
  const [memos] = await c.execute('SELECT COUNT(*) as c FROM item_memos');
  console.log('item_master:', items[0].c);
  console.log('item_memos:', memos[0].c);
  c.end();
}

check().catch(e => console.log(e.message));
