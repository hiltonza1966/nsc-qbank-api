const mysql = require('mysql2/promise');

async function check() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  const [users] = await c.execute('SELECT user_id, username, email FROM qbank_users LIMIT 5');
  console.log('qbank_users (first 5):');
  users.forEach(u => console.log('  id=' + u.user_id + ', username=' + u.username));
  c.end();
}

check().catch(e => console.log(e.message));
