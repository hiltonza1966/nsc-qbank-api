const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Hilton@66',
    database: 'nsc_qbank'
  });

  try {
    // Step 1: Add column (handle BOM by trimming)
    console.log('Step 1: Adding parser_subject_code column...');
    await conn.execute('ALTER TABLE lookup_subjects ADD COLUMN parser_subject_code VARCHAR(10) NULL AFTER subject_alpha_code');
    console.log('OK: Column added');
  } catch (e) {
    console.log('Column add result: ' + e.message);
  }

  // Step 2: Update mappings
  const mappings = [
    { parser: 'ACCO', alpha: 'ACCN' },
    { parser: 'AGRI', alpha: 'AGRS' },
    { parser: 'BUSI', alpha: 'BSTD' },
    { parser: 'CIVI', alpha: 'CVTV' },
    { parser: 'COMP', alpha: 'CATN' },
    { parser: 'CONS', alpha: 'CNST' },
    { parser: 'DANC', alpha: 'DNCE' },
    { parser: 'DESI', alpha: 'DSGN' },
    { parser: 'ELEC', alpha: 'ELTE' },
    { parser: 'ENGI', alpha: 'GRDS' },
    { parser: 'INFO', alpha: 'INFT' }
  ];

  for (const m of mappings) {
    try {
      await conn.execute(
        'UPDATE lookup_subjects SET parser_subject_code = ? WHERE subject_alpha_code = ?',
        [m.parser, m.alpha]
      );
      console.log('OK: Mapped ' + m.parser + ' -> ' + m.alpha);
    } catch (e) {
      console.log('ERR: ' + m.parser + ' -> ' + e.message);
    }
  }

  // Step 3: Update parse_sessions
  try {
    console.log('Step 3: Updating parse_sessions...');
    await conn.execute(`
      UPDATE parse_sessions ps
      JOIN lookup_subjects ls ON ls.parser_subject_code = SUBSTRING_INDEX(ps.paper_code, '_', 1)
      SET ps.subject_id = ls.subject_id
      WHERE ps.subject_id IS NULL OR ps.subject_id = 0
    `);
    console.log('OK: parse_sessions updated');
  } catch (e) {
    console.log('ERR: parse_sessions update: ' + e.message);
  }

  // Step 4: Verify
  console.log('\n=== VERIFICATION ===');
  const [rows] = await conn.execute(`
    SELECT ls.parser_subject_code, ls.subject_alpha_code, ls.subject_name, ls.subject_official_code
    FROM lookup_subjects
    WHERE parser_subject_code IS NOT NULL
    ORDER BY parser_subject_code
  `);
  rows.forEach(r => console.log(r.parser_subject_code + ' | ' + r.subject_alpha_code + ' | ' + r.subject_name));

  await conn.end();
}

run().catch(e => console.error(e.message));
