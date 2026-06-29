const fs = require('fs');

const file = 'routes/v3/parser_review.js';
let content = fs.readFileSync(file, 'utf8');

// Replace the old promote endpoint with the new one
const oldPromote = `// PROMOTE: Move auto_corrected items from parse_results to item_master
router.post('/promote', async (req, res) => {
  try {
    const db = req.db;
    const { session_ids } = req.body;

    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'session_ids array required' });
    }

    const results = [];
    let totalPromoted = 0;
    let totalSkipped = 0;

    for (const sessionId of session_ids) {
      const [sessionRows] = await db.execute(
        'SELECT * FROM parse_sessions WHERE session_id = ?', [sessionId]
      );
      if (sessionRows.length === 0) {
        results.push({ session_id: sessionId, status: 'skipped', reason: 'Session not found' });
        continue;
      }
      const session = sessionRows[0];

      // Get green items
      const [greenItems] = await db.execute(
        `SELECT * FROM parse_results
         WHERE session_id = ? AND correction_status = 'auto_corrected' AND is_memo = 0`,
        [sessionId]
      );

      let promoted = 0;
      let skipped = 0;

      for (const item of greenItems) {
        // Check if already promoted
        const [existing] = await db.execute(
          'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ?',
          [session.paper_code, item.question_number]
        );
        if (existing.length > 0) { skipped++; continue; }

        // Parse paper_code
        const parts = session.paper_code.split('_');
        const subjectAlpha = parts[0];
        const paperNo = parseInt(parts[1].replace('P', '')) || 1;
        const year = parseInt(parts[2]) || 2024;

        // Lookups
        let subjectId = null, paperId = null, yearId = null;
        const [subjectRows] = await db.execute(
          'SELECT subject_id FROM lookup_subjects WHERE UPPER(subject_alpha_code) = UPPER(?) LIMIT 1',
          [subjectAlpha]
        );
        if (subjectRows.length > 0) subjectId = subjectRows[0].subject_id;

        const [paperRows] = await db.execute(
          'SELECT paper_id FROM lookup_papers WHERE paper_no = ? LIMIT 1', [paperNo]
        );
        if (paperRows.length > 0) paperId = paperRows[0].paper_id;

        const [yearRows] = await db.execute(
          'SELECT year_id FROM lookup_years WHERE year_value = ? LIMIT 1', [year]
        );
        if (yearRows.length > 0) yearId = yearRows[0].year_id;

        const itemId = crypto.randomUUID();
        const itemCode = `${session.paper_code}_${item.question_number}`;

        await db.execute(
          `INSERT INTO item_master (
            item_id, subject_official_code, subject_alpha_code, paper_no,
            year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
            item_code, question_number, question_text, marks, marks_allocated,
            source_paper_code, source_question_number, status, review_status,
            parser_confidence, qp_marks, memo_marks, created_by, last_used_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId, subjectAlpha, subjectAlpha, paperNo, yearId, 12, subjectId, paperId, 1, 1,
            itemCode, item.question_number, item.question_text || '',
            item.auto_corrected_marks || item.parser_extracted_marks || 0,
            item.expected_marks || item.auto_corrected_marks || 0,
            session.paper_code, item.question_number, 'draft', 'draft',
            'green', item.parser_extracted_marks, item.memo_marks || 0,
            1, new Date(session.created_at).toISOString().slice(0, 10)
          ]
        );

        await db.execute(
          'UPDATE parse_results SET correction_status = ? WHERE result_id = ?',
          ['validated', item.result_id]
        );

        promoted++;
      }

      totalPromoted += promoted;
      totalSkipped += skipped;
      results.push({ session_id: sessionId, paper_code: session.paper_code, status: 'success', promoted, skipped });
    }

    res.json({ success: true, summary: { total_sessions: session_ids.length, total_promoted: totalPromoted, total_skipped: totalSkipped }, results });

  } catch (e) {
    console.error('Promote error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});`;

const newPromote = `// PROMOTE: Uses shared promotion function
router.post('/promote', async (req, res) => {
  try {
    const db = req.db;
    const { session_ids } = req.body;
    
    if (!session_ids || !Array.isArray(session_ids) || session_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'session_ids array required' });
    }

    const results = [];
    let totalPromoted = 0;
    let totalSkipped = 0;

    for (const sessionId of session_ids) {
      const [sessionRows] = await db.execute(
        'SELECT * FROM parse_sessions WHERE session_id = ?', [sessionId]
      );
      if (sessionRows.length === 0) {
        results.push({ session_id: sessionId, status: 'skipped', reason: 'Session not found' });
        continue;
      }
      const session = sessionRows[0];

      // Build dimensions from session
      const dimensions = {
        subject_id: session.subject_id,
        paper_id: session.paper_id,
        year_id: session.year_id,
        grade_id: session.grade_id,
        assessment_type_id: session.assessment_type_id,
        assessment_body_id: session.assessment_body_id,
        paper_no: session.paper_no,
        year: session.year,
        language: session.language
      };

      // Get paper_no from lookup_papers if not in session
      if (!dimensions.paper_no && dimensions.paper_id) {
        const [paperRows] = await db.execute(
          'SELECT paper_no FROM lookup_papers WHERE paper_id = ? LIMIT 1', [dimensions.paper_id]
        );
        if (paperRows.length > 0) dimensions.paper_no = paperRows[0].paper_no;
      }

      // Get year from lookup_years if not in session
      if (!dimensions.year && dimensions.year_id) {
        const [yearRows] = await db.execute(
          'SELECT year_value FROM lookup_years WHERE year_id = ? LIMIT 1', [dimensions.year_id]
        );
        if (yearRows.length > 0) dimensions.year = yearRows[0].year_value;
      }

      // Call shared promotion function
      const result = await promoteSessionToItemMaster(db, sessionId, session.paper_code, dimensions, 1);

      const promoted = result.inserted || 0;
      const skipped = result.skipped || 0;

      // Update parse_results status to 'validated' for promoted items
      if (promoted > 0) {
        await db.execute(
          'UPDATE parse_results SET correction_status = ? WHERE session_id = ? AND correction_status = ?',
          ['validated', sessionId, 'auto_corrected']
        );
      }

      totalPromoted += promoted;
      totalSkipped += skipped;
      results.push({ session_id: sessionId, paper_code: session.paper_code, status: 'success', promoted, skipped });
    }

    res.json({ success: true, summary: { total_sessions: session_ids.length, total_promoted: totalPromoted, total_skipped: totalSkipped }, results });

  } catch (e) {
    console.error('Promote error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});`;

if (content.includes(oldPromote)) {
  content = content.replace(oldPromote, newPromote);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Replaced promote endpoint successfully');
} else {
  console.log('Could not find old promote endpoint - may already be updated');
}
