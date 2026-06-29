const mysql = require('mysql2/promise');

async function clear() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  
  console.log('Clearing tables...');
  
  await c.execute('SET FOREIGN_KEY_CHECKS = 0');
  
  const tables = [
    'parse_results',
    'parse_memos',
    'parse_sessions',
    'item_master',
    'item_memos',
    'item_attachments'
  ];
  
  for (const t of tables) {
    try {
      await c.execute(`DELETE FROM ${t}`);
      console.log(`Cleared: ${t}`);
    } catch(e) {
      console.log(`Error clearing ${t}:`, e.message);
    }
  }
  
  await c.execute('SET FOREIGN_KEY_CHECKS = 1');
  
  console.log('Done clearing tables');
  c.end();
}

clear().catch(e => console.log(e.message));
