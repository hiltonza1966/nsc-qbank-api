
const mysql = require('mysql2/promise');

async function seed() {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: 'Hilton@66', database: 'nsc_qbank'
  });

  // Get max subject_id
  const [maxId] = await conn.execute('SELECT MAX(subject_id) as max_id FROM lookup_subjects');
  let nextId = (maxId[0].max_id || 0) + 1;

  // Insert missing subjects
  const subjects = [
    { alpha: 'CIVI', name: 'Civil Technology', official: '20351024' },
    { alpha: 'ELEC', name: 'Electrical Technology', official: '20351054' },
    { alpha: 'ENGI', name: 'Engineering Graphics and Design', official: '20351084' }
  ];

  for (const s of subjects) {
    try {
      await conn.execute(
        'INSERT INTO lookup_subjects (subject_id, subject_alpha_code, subject_name, subject_official_code, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())',
        [nextId++, s.alpha, s.name, s.official]
      );
      console.log('Inserted: ' + s.alpha + ' (' + s.name + ') with ID ' + (nextId - 1));
    } catch (e) {
      console.log('Error inserting ' + s.alpha + ': ' + e.message);
    }
  }

  // Update parse_sessions to link to new subjects
  for (const s of subjects) {
    const [subjId] = await conn.execute(
      'SELECT subject_id FROM lookup_subjects WHERE subject_alpha_code = ?',
      [s.alpha]
    );
    if (subjId.length > 0) {
      const [result] = await conn.execute(
        "UPDATE parse_sessions SET subject_id = ? WHERE SUBSTRING_INDEX(paper_code, '_', 1) = ?",
        [subjId[0].subject_id, s.alpha]
      );
      console.log('Updated ' + s.alpha + ' parse_sessions: ' + result.affectedRows + ' rows');
    }
  }

  await conn.end();
}

seed().catch(e => console.error(e.message));
