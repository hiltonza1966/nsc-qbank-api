const db = require('./backend/db');
const crypto = require('crypto');

async function bulkImport() {
  const connection = await db.getConnection();
  try {
    // Get all paper codes from parse_results
    const [papers] = await connection.execute(
      'SELECT DISTINCT paper_code FROM parse_results WHERE is_memo = 0 ORDER BY paper_code'
    );

    console.log(`Found ${papers.length} papers to import`);

    // Cache all lookups
    const [subjects] = await connection.execute('SELECT subject_id, subject_official_code, subject_alpha_code FROM lookup_subjects');
    const subjectMap = new Map(subjects.map(s => [s.subject_alpha_code, s]));

    const [years] = await connection.execute('SELECT year_id, year_value FROM lookup_years');
    const yearMap = new Map(years.map(y => [String(y.year_value), y.year_id]));

    const [grades] = await connection.execute('SELECT grade_id, grade_value FROM lookup_grades');
    const gradeMap = new Map(grades.map(g => [String(g.grade_value), g.grade_id]));

    const [paperLookup] = await connection.execute('SELECT paper_id, paper_no FROM lookup_papers');
    const paperMap = new Map(paperLookup.map(p => [p.paper_no, p.paper_id]));

    // Get existing item_codes to avoid duplicates
    const [existing] = await connection.execute('SELECT item_code FROM item_master');
    const existingCodes = new Set(existing.map(e => e.item_code));

    let totalPromoted = 0;
    let totalSkipped = 0;

    for (const paper of papers) {
      const paperCode = paper.paper_code;
      const parts = paperCode.split('_');
      const subjectAlpha = parts[0];
      const paperNo = parts[1];
      const yearValue = parts[2];

      const subject = subjectMap.get(subjectAlpha) || {};
      const yearId = yearMap.get(yearValue) || null;
      const gradeId = gradeMap.get('12') || null;
      const paperId = paperMap.get(paperNo) || null;

      // Get all parse_results for this paper
      const [parseResults] = await connection.execute(
        'SELECT question_number, question_text, expected_marks FROM parse_results WHERE paper_code = ? AND is_memo = 0',
        [paperCode]
      );

      const values = [];
      const params = [];

      for (const item of parseResults) {
        const itemCode = `${paperCode}_${item.question_number}`;

        if (existingCodes.has(itemCode)) {
          totalSkipped++;
          continue;
        }

        const itemId = crypto.randomUUID();
        const itemHash = crypto.randomUUID();
        const marks = item.expected_marks || 0;

        values.push(`(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`);
        params.push(
          itemId, itemHash, itemCode,
          subject.subject_id || null,
          subject.subject_official_code || null,
          subject.subject_alpha_code || null,
          paperNo, yearId, gradeId, paperId,
          1, 1, // assessment_type_id, assessment_body_id
          item.question_number,
          item.question_text || '',
          marks, marks, marks,
          paperCode,
          item.question_number,
          'active'
        );

        existingCodes.add(itemCode);
        totalPromoted++;
      }

      if (values.length > 0) {
        const sql = `INSERT INTO item_master (
          item_id, item_hash, item_code, subject_id, subject_official_code, subject_alpha_code,
          paper_no, year_id, grade_id, paper_id, assessment_type_id, assessment_body_id,
          question_number, question_text, marks, qp_marks, memo_marks, source_paper_code,
          source_question_number, status, created_at, updated_at
        ) VALUES ${values.join(', ')}`;

        await connection.execute(sql, params);
        console.log(`  Imported ${paperCode}: ${values.length} items`);
      } else {
        console.log(`  Skipped ${paperCode}: all items exist`);
      }
    }

    console.log(`\nDone! Promoted: ${totalPromoted}, Skipped: ${totalSkipped}`);
  } catch (error) {
    console.error('Import error:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

bulkImport();
