/**
 * CAPS Curriculum Verification Script
 * ====================================
 * Run after seeding to verify curriculum integrity
 * 
 * Usage: node verify-caps.js [subject_code] [grade]
 * Example: node verify-caps.js LIFE_SC 12
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyCAPS(subjectCode = 'LIFE_SC', grade = null) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Hilton@66',
    database: process.env.DB_NAME || 'nsc_qbank'
  });

  console.log(`\n🔍 CAPS Verification for ${subjectCode}${grade ? ` Grade ${grade}` : ''}`);
  console.log('=' .repeat(60));

  // 1. Verify topic counts
  const [topicCounts] = await connection.execute(`
    SELECT grade_id, COUNT(*) as count, SUM(topic_weighting) as total_weighting
    FROM lookup_caps_topics
    WHERE subject_official_code = ?
    ${grade ? 'AND grade_id = ?' : ''}
    GROUP BY grade_id
    ORDER BY grade_id
  `, grade ? [subjectCode, grade] : [subjectCode]);

  console.log('\n📊 Topic Counts by Grade:');
  for (const row of topicCounts) {
    const expected = row.grade_id === 10 ? 13 : row.grade_id === 11 ? 10 : 11;
    const status = row.count === expected ? '✅' : '⚠️';
    console.log(`  ${status} Grade ${row.grade_id}: ${row.count} topics (expected ~${expected}), weighting: ${row.total_weighting}%`);
  }

  // 2. Verify strand coverage
  const [strandCoverage] = await connection.execute(`
    SELECT strand, COUNT(*) as topic_count, 
           GROUP_CONCAT(DISTINCT grade_id ORDER BY grade_id) as grades
    FROM lookup_caps_topics
    WHERE subject_official_code = ?
    ${grade ? 'AND grade_id = ?' : ''}
    GROUP BY strand
    ORDER BY strand
  `, grade ? [subjectCode, grade] : [subjectCode]);

  console.log('\n🧬 Strand Coverage:');
  for (const row of strandCoverage) {
    console.log(`  • ${row.strand}: ${row.topic_count} topics (Grades: ${row.grades})`);
  }

  // 3. Verify term distribution
  const [termDist] = await connection.execute(`
    SELECT grade_id, term, COUNT(*) as count
    FROM lookup_caps_topics
    WHERE subject_official_code = ?
    ${grade ? 'AND grade_id = ?' : ''}
    GROUP BY grade_id, term
    ORDER BY grade_id, term
  `, grade ? [subjectCode, grade] : [subjectCode]);

  console.log('\n📅 Term Distribution:');
  for (const row of termDist) {
    console.log(`  • Grade ${row.grade_id} ${row.term}: ${row.count} topics`);
  }

  // 4. Verify paper allocation
  const [paperAlloc] = await connection.execute(`
    SELECT grade_id, paper_no, COUNT(*) as count, SUM(topic_weighting) as weighting
    FROM lookup_caps_topics
    WHERE subject_official_code = ?
    ${grade ? 'AND grade_id = ?' : ''}
    GROUP BY grade_id, paper_no
    ORDER BY grade_id, paper_no
  `, grade ? [subjectCode, grade] : [subjectCode]);

  console.log('\n📄 Paper Allocation:');
  for (const row of paperAlloc) {
    console.log(`  • Grade ${row.grade_id} Paper ${row.paper_no}: ${row.count} topics, ${row.weighting}% weighting`);
  }

  // 5. Verify subtopics exist
  const [subtopicCounts] = await connection.execute(`
    SELECT t.topic_code, t.topic_name, COUNT(s.subtopic_id) as subtopic_count
    FROM lookup_caps_topics t
    LEFT JOIN lookup_caps_subtopics s ON t.topic_id = s.topic_id
    WHERE t.subject_official_code = ?
    ${grade ? 'AND t.grade_id = ?' : ''}
    GROUP BY t.topic_id
    HAVING subtopic_count = 0
    ORDER BY t.grade_id, t.display_order
  `, grade ? [subjectCode, grade] : [subjectCode]);

  if (subtopicCounts.length > 0) {
    console.log('\n⚠️ Topics Missing Subtopics:');
    for (const row of subtopicCounts) {
      console.log(`  • ${row.topic_code}: ${row.topic_name}`);
    }
  } else {
    console.log('\n✅ All topics have subtopics defined');
  }

  // 6. Check for orphaned subtopics
  const [orphaned] = await connection.execute(`
    SELECT s.subtopic_code, s.subtopic_name
    FROM lookup_caps_subtopics s
    LEFT JOIN lookup_caps_topics t ON s.topic_id = t.topic_id
    WHERE t.topic_id IS NULL
  `);

  if (orphaned.length > 0) {
    console.log('\n🚨 Orphaned Subtopics (no parent topic):');
    for (const row of orphaned) {
      console.log(`  • ${row.subtopic_code}: ${row.subtopic_name}`);
    }
  }

  // 7. Verify curriculum weighting totals 100% per grade
  const [weightingCheck] = await connection.execute(`
    SELECT grade_id, SUM(topic_weighting) as total_weighting
    FROM lookup_caps_topics
    WHERE subject_official_code = ?
    ${grade ? 'AND grade_id = ?' : ''}
    GROUP BY grade_id
    HAVING total_weighting NOT BETWEEN 99.5 AND 100.5
  `, grade ? [subjectCode, grade] : [subjectCode]);

  if (weightingCheck.length > 0) {
    console.log('\n⚠️ Weighting Issues (not ~100%):');
    for (const row of weightingCheck) {
      console.log(`  • Grade ${row.grade_id}: ${row.total_weighting}% (expected 100%)`);
    }
  } else {
    console.log('\n✅ All grade weightings total ~100%');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification Complete\n');

  await connection.end();
}

// Run if called directly
if (require.main === module) {
  const subjectCode = process.argv[2] || 'LIFE_SC';
  const grade = process.argv[3] ? parseInt(process.argv[3]) : null;
  verifyCAPS(subjectCode, grade).catch(console.error);
}

module.exports = verifyCAPS;
