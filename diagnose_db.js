const mysql = require('mysql2/promise');

async function diagnose() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Hilton@66',
    database: 'nsc_qbank'
  });

  console.log('=== DATABASE DIAGNOSTIC ===');

  const [papers] = await connection.execute('SELECT COUNT(*) as count FROM papers');
  console.log('Papers in database:', papers[0].count);

  const [items] = await connection.execute('SELECT COUNT(*) as count FROM item_master');
  console.log('Items in item_master:', items[0].count);

  const [memos] = await connection.execute('SELECT COUNT(*) as count FROM item_memos');
  console.log('Items in item_memos:', memos[0].count);

  const [parseResults] = await connection.execute('SELECT COUNT(*) as count FROM parse_results');
  console.log('Parse results:', parseResults[0].count);

  const [sessions] = await connection.execute('SELECT COUNT(*) as count FROM parse_sessions');
  console.log('Parse sessions:', sessions[0].count);

  const [paperList] = await connection.execute(`
    SELECT p.paper_code, COUNT(DISTINCT im.id) as item_count, COUNT(DISTINCT memo.id) as memo_count
    FROM papers p
    LEFT JOIN item_master im ON im.paper_code = p.paper_code
    LEFT JOIN item_memos memo ON memo.paper_code = p.paper_code
    GROUP BY p.paper_code
    ORDER BY p.paper_code
  `);
  console.log('\\nPapers with data:', paperList.length);
  paperList.forEach(p => {
    console.log(p.paper_code + ': items=' + p.item_count + ', memos=' + p.memo_count);
  });

  const [emptyPapers] = await connection.execute(`
    SELECT p.paper_code FROM papers p
    LEFT JOIN item_master im ON im.paper_code = p.paper_code
    WHERE im.id IS NULL
  `);
  console.log('\\nPapers with NO items:', emptyPapers.length);

  const [noMemoPapers] = await connection.execute(`
    SELECT p.paper_code FROM papers p
    LEFT JOIN item_memos memo ON memo.paper_code = p.paper_code
    WHERE memo.id IS NULL
  `);
  console.log('Papers with NO memos:', noMemoPapers.length);

  await connection.end();
}

diagnose().catch(e => console.error('Error:', e.message));
