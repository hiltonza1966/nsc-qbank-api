const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PARSERS_DIR = path.join(__dirname, '..', '..', 'backend', 'parsers');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

function runPythonScript(args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const spawnEnv = Object.assign({}, process.env);
    const pathKey = Object.keys(process.env).find(k => k.toLowerCase() === 'path') || 'PATH';
    const currentPath = process.env[pathKey] || '';
    if (!currentPath.includes('Tesseract-OCR')) {
      spawnEnv[pathKey] = currentPath + ';C:\\Program Files\\Tesseract-OCR';
    }
    const child = spawn(pythonPath, ['-u', path.join(PARSERS_DIR, 'parser_api_v2.py'), ...args], {
      cwd: PARSERS_DIR,
      env: spawnEnv,
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 2000);
      reject(new Error(`Python script timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}. stderr: ${stderr.substring(0, 500)}`));
        return;
      }
      try {
        const lines = stdout.trim().split('\n').filter(line => line.trim());
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}. stdout: ${stdout.substring(0, 500)}`));
      }
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

function extractDimensionsFromFilename(qpFilename) {
  const base = path.basename(qpFilename, '.pdf');
  const clean = base.replace(/ Eng$/i, '').replace(/ Afr$/i, '').trim();

  // Detect language from filename
  let language = 'ENG';
  if (/\bAfr\b/i.test(base) || /\bAfrikaans\b/i.test(base)) {
    language = 'AFR';
  } else if (/\bEng\b/i.test(base) || /\bEnglish\b/i.test(base)) {
    language = 'ENG';
  }

  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  const paperMatch = clean.match(/\bP(\d+)\b/i);
  const paperNo = paperMatch ? parseInt(paperMatch[1]) : null;
  let subjectName = clean;
  if (paperMatch) {
    const idx = clean.search(/\bP\d+\b/i);
    if (idx > 0) subjectName = clean.substring(0, idx).trim();
  }
  if (yearMatch) subjectName = subjectName.replace(yearMatch[0], '').trim();
  subjectName = subjectName.replace(/\b(Nov|Feb|Jun|Mar|May|Aug|Oct|Dec)\b/gi, '').trim();
  const subjectAlpha = subjectName.toUpperCase().replace(/\s+/g, '');
  const paperCode = `${subjectAlpha}_P${paperNo || 1}_${year || 'XXXX'}_NOV_${language}`;
  return { subject_name: subjectName, subject_alpha: subjectAlpha, paper_no: paperNo, year: year, paper_code: paperCode, session_name: 'Nov', base_name: clean, language: language };
}

function pairFiles(folderPath) {
  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.pdf')).map(f => ({ name: f, fullPath: path.join(folderPath, f) }));

  // Separate QPs and Memos, and detect language
  const qps = [];
  const memos = [];

  for (const f of files) {
    const nameLower = f.name.toLowerCase();
    // Detect language
    let lang = 'ENG';
    if (/\bafr\b/.test(nameLower) || /\bafrikaans\b/.test(nameLower)) {
      lang = 'AFR';
    }

    // QP: ends with ' eng.pdf' or ' afr.pdf', but NOT 'mg' or 'memo' or 'marking'
    const isMemo = nameLower.includes(' mg ') || nameLower.includes(' memo') || nameLower.includes(' marking') || nameLower.includes(' nasien');
    const isQP = !isMemo && (nameLower.endsWith(' eng.pdf') || nameLower.endsWith(' afr.pdf') || nameLower.endsWith(' english.pdf') || nameLower.endsWith(' afrikaans.pdf'));

    if (isQP) {
      qps.push({ ...f, language: lang });
    } else if (isMemo) {
      memos.push({ ...f, language: lang });
    }
  }

  const pairs = [];
  const unmatched = [];

  for (const qp of qps) {
    const qpBase = qp.name.replace(/\s+(Eng|Afr|English|Afrikaans)\.pdf$/i, '').trim();
    const qpLang = qp.language;

    // Find matching memo with same language
    const memo = memos.find(m => {
      const mName = m.name.toLowerCase();
      const mLang = m.language;
      // Must match language
      if (mLang !== qpLang) return false;

      // Check if memo filename contains the QP base name (without language suffix)
      const qpBaseLower = qpBase.toLowerCase();
      return mName.includes(qpBaseLower.replace(' eng', '').replace(' afr', '').trim()) ||
             mName.includes(qpBaseLower.replace(/\s+(eng|afr)$/i, '').trim());
    });

    if (memo) {
      pairs.push({ qp, memo, dimensions: extractDimensionsFromFilename(qp.name) });
    } else {
      unmatched.push({ qp, reason: `No matching ${qpLang} memo found` });
    }
  }

  for (const memo of memos) {
    const hasPair = pairs.some(p => p.memo.name === memo.name);
    if (!hasPair) unmatched.push({ memo, reason: `No matching ${memo.language} QP found` });
  }

  return { pairs, unmatched };
}

router.post('/batch', async (req, res) => {
  try {
    const folderPath = req.body.folder_path || req.body.folderPath;
    const yearId = req.body.year_id || null;
    const gradeId = req.body.grade_id || null;
    const assessmentTypeId = req.body.assessment_type_id || null;
    const assessmentBodyId = req.body.assessment_body_id || null;
    const createProductionItems = req.body.create_production_items === true;

    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'Valid folder_path required' });
    }
    const db = req.db;
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const { pairs, unmatched } = pairFiles(folderPath);
    if (pairs.length === 0) {
      return res.status(400).json({ success: false, error: 'No QP+Memo pairs found in folder', unmatched: unmatched.map(u => ({ file: u.qp?.name || u.memo?.name, reason: u.reason })) });
    }

    const results = [];
    const failures = [];

    for (const pair of pairs) {
      const { qp, memo, dimensions } = pair;
      const paperCode = dimensions.paper_code;
      const language = dimensions.language;

      try {
        const outputDir = path.join(UPLOADS_DIR, 'parser_output', paperCode);
        fs.mkdirSync(outputDir, { recursive: true });
        const parseResult = await runPythonScript(['parse', qp.fullPath, memo.fullPath, paperCode, outputDir], 120000);
        if (parseResult.status === 'error') throw new Error(parseResult.error);

        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        let subjectId = null;
        let paperId = null;
        try {
          const [subjectRows] = await db.execute('SELECT subject_id FROM lookup_subjects WHERE UPPER(subject_alpha_code) = UPPER(?) OR UPPER(subject_name) = UPPER(?) LIMIT 1', [dimensions.subject_alpha, dimensions.subject_alpha, dimensions.subject_name]);
          if (subjectRows.length > 0) subjectId = subjectRows[0].subject_id;
          const [paperRows] = await db.execute('SELECT paper_id FROM lookup_papers WHERE paper_no = ? LIMIT 1', [dimensions.paper_no]);
          if (paperRows.length > 0) paperId = paperRows[0].paper_id;
        } catch (e) { /* Non-fatal */ }

        const totalItems = parseResult.matched || 0;
        const totalMarks = parseResult.total_marks || 0;
        const greenCount = parseResult.green_count || 0;

        await db.execute(
          `INSERT INTO parse_sessions (session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, file_name, file_hash, parser_version, total_items_found, total_marks_parser, total_marks_expected, total_marks_corrected, auto_corrected_count, manual_review_count, missing_count, status, error_message, completed_at, created_at, paper_code, is_memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessionId, yearId, gradeId, subjectId, paperId, assessmentTypeId, assessmentBodyId, `${paperCode}_QP_Memo_${language}.pdf`, crypto.createHash('sha256').update(paperCode).digest('hex').substring(0, 64), 'v30-tweaked-batch', totalItems, totalMarks, 150, totalMarks, greenCount, 0, totalItems - greenCount, 'imported', null, now, now, paperCode, 0]
        );

        // === HEADER DETECTION: Build header ID map for parent_header_id linkage ===
        const headerMap = parseResult.header_map || {};
        const headerDbIds = {};
        const headerMemoDbIds = {};

        const allItems = [
          ...(parseResult.green_items || []),
          ...(parseResult.yellow_items || []),
          ...(parseResult.red_items || []),
          ...(parseResult.qp_only_items || [])
        ];

        const insertedQpKeys = new Set();
        const insertedMemoKeys = new Set();
        let qpDuplicatesSkipped = 0;
        let memoDuplicatesSkipped = 0;

        // First pass: Insert QP items (headers first, then non-headers)
        for (const item of allItems) {
          const isHeader = item.is_header || 0;
          const isMemo = 0;
          const dupKey = `${paperCode}:${item.question_number}:${isMemo}`;

          if (insertedQpKeys.has(dupKey)) {
            qpDuplicatesSkipped++;
            continue;
          }
          insertedQpKeys.add(dupKey);

          let parentHeaderId = null;
          if (!isHeader && item.parent_header_q && headerDbIds[item.parent_header_q]) {
            parentHeaderId = headerDbIds[item.parent_header_q];
          }

          const [insertResult] = await db.execute(
            `INSERT INTO parse_results (session_id, paper_code, question_number, question_text, answer_text, parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, is_memo, is_header, parent_header_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, paperCode, item.question_number, item.question_text || null, item.answer_text || null, null, item.section || null, item.qp_marks || item.final_marks || 0, item.expected_marks || item.final_marks || 0, item.final_marks || 0, item.confidence === 'green' ? 'auto_corrected' : 'manual_review', item.final_marks || 0, item.notes || null, isMemo, isHeader, parentHeaderId, now, now]
          );

          if (isHeader) {
            headerDbIds[item.question_number] = insertResult.insertId;
          }
        }

        // Second pass: Insert Memo items
        const memoItems = [
          ...(parseResult.green_items || []),
          ...(parseResult.yellow_items || []),
          ...(parseResult.red_items || []),
          ...(parseResult.memo_only_items || [])
        ];

        for (const item of memoItems) {
          const isHeader = item.is_header || 0;
          const isMemo = 1;
          const dupKey = `${paperCode}:${item.question_number}:${isMemo}`;

          if (insertedMemoKeys.has(dupKey)) {
            memoDuplicatesSkipped++;
            continue;
          }
          insertedMemoKeys.add(dupKey);

          let parentHeaderId = null;
          if (!isHeader && item.parent_header_q && headerMemoDbIds[item.parent_header_q]) {
            parentHeaderId = headerMemoDbIds[item.parent_header_q];
          }

          const [insertResult] = await db.execute(
            `INSERT INTO parse_memos (session_id, paper_code, question_number, question_text, answer_text, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, is_header, parent_header_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, paperCode, item.question_number, item.question_text || null, item.answer_text || null, item.memo_marks || item.final_marks || 0, item.expected_marks || item.final_marks || 0, item.final_marks || 0, item.confidence === 'green' ? 'auto_corrected' : 'manual_review', item.final_marks || 0, item.notes || null, isHeader, parentHeaderId, now, now]
          );

          if (isHeader) {
            headerMemoDbIds[item.question_number] = insertResult.insertId;
          }
        }

        // Update parent_header_id for sub-items that were inserted before their header
        for (const [headerQ, headerId] of Object.entries(headerDbIds)) {
          await db.execute(
            'UPDATE parse_results SET parent_header_id = ? WHERE paper_code = ? AND question_number LIKE ? AND question_number != ? AND parent_header_id IS NULL',
            [headerId, paperCode, headerQ + '.%', headerQ]
          );
        }
        for (const [headerQ, headerId] of Object.entries(headerMemoDbIds)) {
          await db.execute(
            'UPDATE parse_memos SET parent_header_id = ? WHERE paper_code = ? AND question_number LIKE ? AND question_number != ? AND parent_header_id IS NULL',
            [headerId, paperCode, headerQ + '.%', headerQ]
          );
        }

        results.push({ 
          paper_code: paperCode, 
          subject: dimensions.subject_name, 
          paper_no: dimensions.paper_no, 
          year: dimensions.year, 
          language: language,
          items: totalItems, 
          marks: totalMarks, 
          green: greenCount, 
          session_id: sessionId, 
          status: 'success',
          headers_detected: Object.keys(headerMap).length,
          qp_duplicates_skipped: qpDuplicatesSkipped,
          memo_duplicates_skipped: memoDuplicatesSkipped
        });

        // Auto-promote to production tables if enabled
        let promoteResult = null;
        if (createProductionItems) {
          try {
            promoteResult = await autoPromoteSession(db, sessionId, paperCode, dimensions, parseResult, outputDir);
          } catch (promoteErr) {
            console.error('Auto-promote error for', paperCode, promoteErr.message);
          }
        }

      } catch (e) {
        failures.push({ paper_code: paperCode, subject: dimensions.subject_name, language: language, qp: qp.name, memo: memo.name, error: e.message });
      }
    }

    res.json({ success: true, summary: { total_pairs: pairs.length, successful: results.length, failed: failures.length, unmatched: unmatched.length }, results, failures, unmatched: unmatched.map(u => ({ file: u.qp?.name || u.memo?.name, reason: u.reason })) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/batch/status', async (req, res) => {
  try {
    const db = req.db;
    const [rows] = await db.execute(`SELECT paper_code, status, total_items_found, total_marks_parser, auto_corrected_count, created_at FROM parse_sessions WHERE parser_version = 'v30-tweaked-batch' ORDER BY created_at DESC LIMIT 50`);
    res.json({ success: true, batches: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ============================================
// AUTO-PROMOTE: Move parsed items to item_master + item_memos
// Called after batch insert when createProductionItems=true
// ============================================
async function autoPromoteSession(db, sessionId, paperCode, dimensions, parseResult, outputDir) {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const crypto = require('crypto');
    
    let subjectId = null;
    let paperId = null;
    let subjectOfficialCode = null;
    let subjectAlphaCode = null;
    let yearId = null;
    try {
      const [subjectRows] = await db.execute('SELECT subject_id, subject_official_code, subject_alpha_code FROM lookup_subjects WHERE UPPER(parser_subject_code) = UPPER(?) OR UPPER(subject_alpha_code) = UPPER(?) OR UPPER(subject_name) = UPPER(?) LIMIT 1', [dimensions.subject_alpha, dimensions.subject_alpha, dimensions.subject_name]);
      if (subjectRows.length > 0) {
        subjectId = subjectRows[0].subject_id;
        subjectOfficialCode = subjectRows[0].subject_official_code;
        subjectAlphaCode = subjectRows[0].subject_alpha_code;
      }
      const [paperRows] = await db.execute('SELECT paper_id FROM lookup_papers WHERE paper_no = ? LIMIT 1', [dimensions.paper_no]);
      if (paperRows.length > 0) paperId = paperRows[0].paper_id;
      const [yearRows] = await db.execute('SELECT year_id FROM lookup_years WHERE year_value = ? LIMIT 1', [dimensions.year]);
      if (yearRows.length > 0) yearId = yearRows[0].year_id;
    } catch (e) { }

    const [qpItems] = await db.execute(
      'SELECT result_id, session_id, paper_code, question_number, question_text, answer_text, parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, variance, is_red_flag, user_corrected_marks, reviewer_notes, created_at, updated_at, is_memo, is_header, parent_header_id FROM parse_results WHERE session_id = ? AND is_memo = 0 ORDER BY question_number',
      [sessionId]
    );

    const [memoItems] = await db.execute(
      'SELECT memo_id, session_id, paper_code, question_number, question_text, answer_text, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, variance, is_red_flag, created_at, updated_at, is_header, parent_header_id FROM parse_memos WHERE session_id = ? ORDER BY question_number',
      [sessionId]
    );

    const memoLookup = {};
    for (const m of memoItems) {
      memoLookup[m.question_number] = m;
    }

    let inserted = 0;
    let skipped = 0;

    for (const item of qpItems) {
      const memo = memoLookup[item.question_number];
      const itemHash = crypto.createHash('sha256').update(paperCode + ':' + item.question_number).digest('hex').substring(0, 32);
      
      const [existing] = await db.execute(
        'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ? LIMIT 1',
        [paperCode, item.question_number]
      );
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const qpMarks = item.parser_extracted_marks || 0;
      const memoMarks = memo ? (memo.auto_corrected_marks || memo.parser_extracted_marks || 0) : 0;
      const finalMarks = item.auto_corrected_marks || item.expected_marks || qpMarks;
      const expectedMarks = item.expected_marks || finalMarks;

      const sql = 'INSERT INTO item_master (item_hash, subject_official_code, subject_alpha_code, paper_no, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, item_code, question_number, parent_question, is_sub_part, stimulus_text, stimulus_id, question_text, question_text_afr, item_stem_latex, item_stem_html, item_stem_code, item_media_svg, item_media_audio, item_media_file, item_rubric_json, item_answer_json, tool_required, audit_log_id, item_type_id, cognitive_level_id, cognitive_level, difficulty_id, caps_topic_id, difficulty, language_id, marking_scheme_id, marks, marks_allocated, caps_subtopic_id, caps_reference, source_year, source_paper_code, source_question_number, status, review_status, current_version, exposure_count, last_used_date, facility_value, discrimination_index, is_retired, retired_reason, retired_at, created_by, created_at, updated_at, qp_marks, memo_marks, parser_confidence, published_at, published_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      const values = [
        itemHash, subjectOfficialCode || '', subjectAlphaCode || dimensions.subject_alpha, dimensions.paper_no || 0,
        yearId || dimensions.year || 0, 3, subjectId || 0, paperId || 0,
        1, 1, paperCode + '_' + item.question_number, item.question_number,
        item.parent_header_id ? item.question_number.split('.')[0] : null,
        item.parent_header_id ? 1 : 0,
        null, null,
        item.question_text || '', null, null, item.question_text || null,
        null, null, null, null, null, null,
        null, null, 1, 1, null, 1,
        null, null, 1, null, finalMarks, expectedMarks, null,
        null, dimensions.year, paperCode, item.question_number, 'draft', 'pending',
        1, 0, null, null, null,
        0, null, null, 1, now, now,
        qpMarks, memoMarks,
        item.correction_status === 'auto_corrected' ? 'green' : 'yellow',
        null, null
      ];

      await db.execute(sql, values);
      inserted++;
    }

        // Insert memo data into item_memos
    let memoInserted = 0;
    let memoSkipped = 0;
    for (const item of qpItems) {
      const memo = memoLookup[item.question_number];
      if (!memo) {
        memoSkipped++;
        continue;
      }

      const [itemRows] = await db.execute(
        'SELECT item_id FROM item_master WHERE source_paper_code = ? AND source_question_number = ? LIMIT 1',
        [paperCode, item.question_number]
      );
      if (itemRows.length === 0) {
        memoSkipped++;
        continue;
      }

      const itemId = itemRows[0].item_id;

      const [existingMemo] = await db.execute(
        'SELECT memo_id FROM item_memos WHERE item_id = ? LIMIT 1',
        [itemId]
      );
      if (existingMemo.length > 0) {
        memoSkipped++;
        continue;
      }

      try {
        await db.execute(
          'INSERT INTO item_memos (item_id, question_number, answer_text, marks, marking_scheme_id, cognitive_level_id, has_sub_parts, version_number, is_current, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            itemId, item.question_number, memo.answer_text || null,
            memo.auto_corrected_marks || memo.parser_extracted_marks || 0,
            null, 1, item.parent_header_id ? 1 : 0, 1, 1, now, now
          ]
        );
        memoInserted++;
      } catch (memoErr) {
        console.error('Memo insert error:', paperCode, item.question_number, memoErr.message);
        memoSkipped++;
      }
    }

    return { inserted, skipped, total: qpItems.length, memo_inserted: memoInserted, memo_skipped: memoSkipped };
  } catch (e) {
    console.error('Auto-promote error:', e.message);
    return { error: e.message };
  }
}

module.exports = router;