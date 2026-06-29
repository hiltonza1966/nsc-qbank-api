const mysql = require('mysql2/promise');
const { promoteSessionToItemMaster } = require('./utils/promoteSession');

async function test() {
  const c = await mysql.createConnection({host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'});
  
  const [sessions] = await c.execute('SELECT session_id, paper_code FROM parse_sessions LIMIT 1');
  if (sessions.length === 0) {
    console.log('No sessions found');
    c.end();
    return;
  }
  
  const session = sessions[0];
  console.log('Testing promotion for session:', session.session_id, session.paper_code);
  
  const dimensions = {
    subject_alpha: 'ACCOUNTING',
    paper_no: 1,
    year: 2025,
    language: 'ENG'
  };
  
  try {
    const result = await promoteSessionToItemMaster(c, session.session_id, session.paper_code, dimensions, 1);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  c.end();
}

test().catch(e => console.log(e.message));
