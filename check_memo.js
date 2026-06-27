const db = require('./backend/db');
async function check() {
  try {
    const [r] = await db.query("SHOW COLUMNS FROM item_master LIKE '%memo%'");
    console.log('Memo columns:', r.map(c => c.Field).join(', '));

    const [s] = await db.query("SHOW COLUMNS FROM item_master LIKE '%is_memo%'");
    console.log('is_memo columns:', s.map(c => c.Field).join(', '));

    const [t] = await db.query("SHOW TABLES LIKE '%memo%'");
    console.log('Memo tables:', t.map(x => Object.values(x)[0]).join(', '));

    const [u] = await db.query("SHOW TABLES LIKE '%item%'");
    console.log('Item tables:', u.map(x => Object.values(x)[0]).join(', '));
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
check();
