const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  
  // Check for language lookup table
  const [tables] = await c.execute('SHOW TABLES LIKE "%language%"');
  console.log('Language-related tables:');
  tables.forEach(t => console.log('  - ' + Object.values(t)[0]));
  
  // Check for user-related tables
  const [userTables] = await c.execute('SHOW TABLES LIKE "%user%"');
  console.log('User-related tables:');
  userTables.forEach(t => console.log('  - ' + Object.values(t)[0]));
  
  c.end();
}

check().catch(e => console.log(e.message));
