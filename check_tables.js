const db = require('./backend/db');
async function check() {
  try {
    const [tables] = await db.query("SHOW TABLES LIKE 'parse%'");
    console.log('Parse tables:', tables.map(x => Object.values(x)[0]).join(', '));

    const [itemTables] = await db.query("SHOW TABLES LIKE 'item%'");
    console.log('Item tables:', itemTables.map(x => Object.values(x)[0]).join(', '));

    const [counts] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM parse_results) as parse_results,
        (SELECT COUNT(*) FROM parse_memos) as parse_memos,
        (SELECT COUNT(*) FROM parse_sessions) as parse_sessions,
        (SELECT COUNT(*) FROM item_master) as item_master
    `);
    console.log('\nRow counts:', counts[0]);
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
check();
