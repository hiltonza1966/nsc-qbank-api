const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  
  // Check lookup_languages
  const [langs] = await c.execute('SELECT * FROM lookup_languages');
  console.log('lookup_languages:');
  langs.forEach(l => console.log('  id=' + l.language_id + ', code=' + l.language_code + ', name=' + l.language_name));
  
  // Check qbank_users (first few)
  const [users] = await c.execute('SELECT id, username, email FROM qbank_users LIMIT 5');
  console.log('\\nqbank_users (first 5):');
  users.forEach(u => console.log('  id=' + u.id + ', username=' + u.username));
  
  c.end();
}

check().catch(e => console.log(e.message));
