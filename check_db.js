const db = require('./backend/db');
async function check() {
  try {
    const [r] = await db.query('SHOW COLUMNS FROM item_master');
    console.log('Columns:', r.map(c => c.Field).join(', '));

    const [d] = await db.query('SELECT * FROM item_master LIMIT 3');
    console.log('\nSample data:', JSON.stringify(d, null, 2));

    const [c] = await db.query('SELECT COUNT(*) as count FROM item_master');
    console.log('\nTotal rows:', c[0].count);

    const [p] = await db.query("SELECT DISTINCT source_paper_code FROM item_master WHERE source_paper_code IS NOT NULL AND source_paper_code != '' LIMIT 10");
    console.log('\nPaper codes:', p.map(x => x.source_paper_code).join(', '));
  } catch(e) {
    console.log('Error:', e.message);
  }
  process.exit(0);
}
check();
