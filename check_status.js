const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [sessions] = await c.execute('SELECT COUNT(*) as c FROM parse_sessions');
  const [results] = await c.execute('SELECT COUNT(*) as c FROM parse_results');
  const [memos] = await c.execute('SELECT COUNT(*) as c FROM parse_memos');
  const [items] = await c.execute('SELECT COUNT(*) as c FROM item_master');
  const [itemMemos] = await c.execute('SELECT COUNT(*) as c FROM item_memos');
  console.log('parse_sessions:', sessions[0].c);
  console.log('parse_results:', results[0].c);
  console.log('parse_memos:', memos[0].c);
  console.log('item_master:', items[0].c);
  console.log('item_memos:', itemMemos[0].c);
  c.end();
}

check().catch(e => console.log(e.message));
