const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Hilton@66',
    database: 'nsc_qbank'
  });

  await c.execute('SET FOREIGN_KEY_CHECKS = 0');
  await c.execute('TRUNCATE TABLE parse_results');
  await c.execute('TRUNCATE TABLE parse_memos');
  await c.execute('TRUNCATE TABLE parse_sessions');
  await c.execute("DELETE FROM item_attachments WHERE session_id IS NOT NULL");
  await c.execute("DELETE FROM item_master WHERE source_paper_code LIKE 'LIFESCIENCES%' OR source_paper_code LIKE 'TEST%'");
  await c.execute('DELETE FROM item_memos WHERE item_id NOT IN (SELECT item_id FROM item_master)');
  await c.execute('SET FOREIGN_KEY_CHECKS = 1');

  console.log('Reset complete');
  await c.end();
})();
