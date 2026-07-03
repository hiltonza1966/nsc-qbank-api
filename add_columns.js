const mysql = require('mysql2/promise');

async function addColumns() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Hilton@66',
    database: 'nsc_qbank'
  });

  try {
    // Check and add has_errors to parse_results
    try {
      await conn.execute('ALTER TABLE parse_results ADD COLUMN has_errors TINYINT(1) NOT NULL DEFAULT 0');
      console.log('✓ Added has_errors to parse_results');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ has_errors already exists in parse_results');
      } else {
        console.log('✗ Error adding has_errors to parse_results:', e.message);
      }
    }

    // Check and add variance to parse_results
    try {
      await conn.execute('ALTER TABLE parse_results ADD COLUMN variance INT DEFAULT 0');
      console.log('✓ Added variance to parse_results');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ variance already exists in parse_results');
      } else {
        console.log('✗ Error adding variance to parse_results:', e.message);
      }
    }

    // Check and add has_errors to parse_memos
    try {
      await conn.execute('ALTER TABLE parse_memos ADD COLUMN has_errors TINYINT(1) NOT NULL DEFAULT 0');
      console.log('✓ Added has_errors to parse_memos');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ has_errors already exists in parse_memos');
      } else {
        console.log('✗ Error adding has_errors to parse_memos:', e.message);
      }
    }

    // Check and add variance to parse_memos
    try {
      await conn.execute('ALTER TABLE parse_memos ADD COLUMN variance INT DEFAULT 0');
      console.log('✓ Added variance to parse_memos');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✓ variance already exists in parse_memos');
      } else {
        console.log('✗ Error adding variance to parse_memos:', e.message);
      }
    }

    console.log('\n=== DONE ===');
  } finally {
    await conn.end();
  }
}

addColumns().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
