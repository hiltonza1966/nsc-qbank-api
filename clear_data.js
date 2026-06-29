const mysql = require('mysql2/promise');

async function clear() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  await c.execute('SET FOREIGN_KEY_CHECKS = 0');
  const tables = ['parse_results', 'parse_memos', 'parse_sessions', 'item_master', 'item_memos'];
  for (const t of tables) {
    await c.execute('DELETE FROM ' + t);
    console.log('Cleared:', t);
  }
  await c.execute('SET FOREIGN_KEY_CHECKS = 1');
  console.log('Done');
  c.end();
}

clear().catch(e => console.log(e.message));
