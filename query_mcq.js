const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Hilton@66',
    database: 'nsc_qbank'
  });

  const [s] = await c.execute('SELECT session_id FROM parse_sessions ORDER BY created_at DESC LIMIT 1');
  const sid = s[0].session_id;

  const [rows] = await c.execute(
    'SELECT question_number, question_text, is_header, header_level, parser_extracted_marks FROM parse_results WHERE session_id = ? AND is_memo = 0 AND (question_number LIKE ? OR question_number LIKE ?) ORDER BY question_number',
    [sid, '1.1.%', '1.2.%']
  );

  console.table(rows);
  await c.end();
})();
