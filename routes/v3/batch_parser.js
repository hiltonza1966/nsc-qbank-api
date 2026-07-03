const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { promoteSessionToItemMaster } = require('../../utils/promoteSession');
const { parseMachineFilename, lookupAllIds } = require('./step1_preprocessing');

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
  const paperNo = paperMatch ? parseInt(paperMatch[1]) : 1; // Default to Paper 1

  // Extract session from filename
  let sessionName = 'NOV';
  const sessionPatterns = [
    { pattern: /\bSept(?:ember)?\b/i, name: 'SEPT' },
    { pattern: /\bMay[-\s]?June\b/i, name: 'MAY_JUNE' },
    { pattern: /\bMay\b/i, name: 'MAY_JUNE' },
    { pattern: /\bJune\b/i, name: 'MAY_JUNE' },
    { pattern: /\bNov(?:ember)?\b/i, name: 'NOV' },
    { pattern: /\bFeb(?:ruary)?\b/i, name: 'FEB' },
    { pattern: /\bMar(?:ch)?\b/i, name: 'MARCH' },
    { pattern: /\bAug(?:ust)?\b/i, name: 'AUG' },
    { pattern: /\bOct(?:ober)?\b/i, name: 'OCT' },
    { pattern: /\bDec(?:ember)?\b/i, name: 'DEC' },
  ];
  for (const sp of sessionPatterns) {
    if (sp.pattern.test(clean)) {
      sessionName = sp.name;
      break;
    }
  }

  let subjectName = clean;
  if (paperMatch) {
    const idx = clean.search(/\bP\d+\b/i);
    if (idx > 0) subjectName = clean.substring(0, idx).trim();
  }
  if (yearMatch) subjectName = subjectName.replace(yearMatch[0], '').trim();
  // Remove ALL session names from subject
  subjectName = subjectName.replace(/\b(Nov|November|Feb|February|Jun|June|Mar|March|May|Aug|August|Oct|October|Dec|December|September|Sept|May-June)\b/gi, '').trim();
  const subjectAlpha = subjectName.toUpperCase().replace(/\s+/g, '');
  const paperCode = `${subjectAlpha}_P${paperNo || 1}_${year || 'XXXX'}_${sessionName}_${language}`;
  return { subject_name: subjectName, subject_alpha: subjectAlpha, paper_no: paperNo, year: year, paper_code: paperCode, session_name: sessionName, base_name: clean, language: language };
}

async function pairFiles(folderPath, db, options = {}) {
  const {
    defaultGradeId = 3,
    defaultAssessmentTypeId = 1,
    defaultAssessmentBodyId = 1
  } = options;

  const files = fs.readdirSync(folderPath).filter(f =>
    f.toLowerCase().endsWith('.pdf')).map(f => ({ name: f, fullPath: path.join(folderPath, f) }));

  // Separate QP and Memo files
  const qpFiles = [];
  const memoFiles = [];

  for (const file of files) {
    const parsed = parseMachineFilename(file.name);
    if (parsed.isQP) {
      qpFiles.push({ file, parsed });
    } else if (parsed.isMemo) {
      memoFiles.push({ file, parsed });
    }
  }

  // Build maps by paper key
  const qpMap = {};
  for (const { file, parsed } of qpFiles) {
    const key = `${parsed.subject}_P${parsed.paperNo}_${parsed.year}_${parsed.session}_${parsed.language}`;
    qpMap[key] = { file, parsed };
  }

  const memoMap = {};
  for (const { file, parsed } of memoFiles) {
    const key = `${parsed.subject}_P${parsed.paperNo}_${parsed.year}_${parsed.session}_${parsed.language}`;
    memoMap[key] = { file, parsed };
  }

  // Pair QP and Memo files
  const pairs = [];
  const unmatched = [];

  for (const key in qpMap) {
    if (memoMap[key]) {
      // Look up all IDs from database
      const lookupResult = await lookupAllIds(
        db,
        qpMap[key].parsed,
        defaultGradeId,
        defaultAssessmentTypeId,
        defaultAssessmentBodyId
      );

      if (lookupResult.success) {
        pairs.push({
          qp: qpMap[key].file,
          memo: memoMap[key].file,
          dimensions: {
            paper_code: key,
            subject_id: lookupResult.subject_id,
            subject_official_code: lookupResult.subject_official_code,
            year_id: lookupResult.year_id,
            exam_session_id: lookupResult.exam_session_id,
            paper_id: lookupResult.paper_id,
            language_id: lookupResult.language_id,
            grade_id: lookupResult.grade_id,
            assessment_type_id: lookupResult.assessment_type_id,
            assessment_body_id: lookupResult.assessment_body_id,
            language: qpMap[key].parsed.language,
            subject_name: qpMap[key].parsed.subject,
            paper_no: parseInt(qpMap[key].parsed.paperNo) || 1,
            year: parseInt(qpMap[key].parsed.year) || null,
            session_name: qpMap[key].parsed.session
          }
        });
      } else {
        unmatched.push({
          qp: qpMap[key].file.name,
          memo: memoMap[key].file.name,
          reason: 'Lookup failed: ' + lookupResult.errors.join(', ')
        });
      }
    } else {
      unmatched.push({
        qp: qpMap[key].file.name,
        memo: null,
        reason: 'No matching memo file'
      });
    }
  }

  for (const key in memoMap) {
    if (!qpMap[key]) {
      unmatched.push({
        qp: null,
        memo: memoMap[key].file.name,
        reason: 'No matching QP file'
      });
    }
  }

  return { pairs, unmatched };
}

router.post('/batch', async (req, res) => {
  try {
    const folderPath = req.body.folder_path || req.body.folderPath;
    let yearId = req.body.year_id || null;
    let gradeId = req.body.grade_id || null;
    const assessmentTypeId = req.body.assessment_type_id || null;
    const assessmentBodyId = req.body.assessment_body_id || null;
    const createProductionItems = req.body.create_production_items === true;

    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'Valid folder_path required' });
    }
    const db = req.db;
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const { pairs, unmatched } = await pairFiles(folderPath, db, {
      defaultGradeId: gradeId || 3,
      defaultAssessmentTypeId: assessmentTypeId || 1,
      defaultAssessmentBodyId: assessmentBodyId || 1
    });
    if (pairs.length === 0) {
      return res.status(400).json({ success: false, error: 'No QP+Memo pairs found in folder', unmatched: unmatched.map(u => ({ file: u.qp || u.memo, reason: u.reason })) });
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

        // Use lookup values directly from dimensions (already resolved in Step 1)
        const subjectId = dimensions.subject_id || null;
        const paperId = dimensions.paper_id || null;
        const languageId = dimensions.language_id || null;
        const yearId = dimensions.year_id || req.body.year_id || null;
        const gradeId = dimensions.grade_id || req.body.grade_id || null;
        const assessmentTypeId = dimensions.assessment_type_id || req.body.assessment_type_id || null;
        const assessmentBodyId = dimensions.assessment_body_id || req.body.assessment_body_id || null;

        const totalItems = parseResult.matched || 0;
        const totalMarks = parseResult.total_marks || 0;
        const greenCount = parseResult.green_count || 0;
        
        await db.execute(
          `INSERT INTO parse_sessions (session_id, year_id, grade_id, subject_id, paper_id, language_id, assessment_type_id, assessment_body_id, file_name, file_hash, output_folder_path, parser_version, total_items_found, total_marks_parser, total_marks_expected, total_marks_corrected, auto_corrected_count, manual_review_count, missing_count, status, error_message, completed_at, created_at, paper_code, is_memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessionId, yearId, gradeId, subjectId, paperId, languageId, assessmentTypeId, assessmentBodyId, `${paperCode}_QP_Memo_${language}.pdf`, crypto.createHash('sha256').update(paperCode).digest('hex').substring(0, 64), outputDir, 'v30-tweaked-batch', totalItems, totalMarks, 150, totalMarks, greenCount, 0, totalItems - greenCount, 'imported', null, now, now, paperCode, 0]
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
          memo_duplicates_skipped: memoDuplicatesSkipped,
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
        
        // Update result with promote status
        if (results.length > 0) {
          const lastResult = results[results.length - 1];
          lastResult.promote_status = promoteResult ? (promoteResult.error ? 'failed' : 'success') : 'skipped';
          lastResult.promote_error = promoteResult?.error || null;
        }

      } catch (e) {
        failures.push({ paper_code: paperCode, subject: dimensions.subject_name, language: language, qp: qp.name, memo: memo.name, error: e.message });
      }
    }

    res.json({ success: true, summary: { total_pairs: pairs.length, successful: results.length, failed: failures.length, unmatched: unmatched.length }, results, failures, unmatched: unmatched.map(u => ({ file: u.qp || u.memo, reason: u.reason })) });
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
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  try {
    // 1. Get all QP items from parse_results for this session
    const [qpItems] = await db.execute(
      `SELECT result_id, question_number, question_text, expected_marks, auto_corrected_marks,
              is_header, header_level, parent_header_id, parsed_type_id
       FROM parse_results WHERE session_id = ? AND is_memo = 0 ORDER BY result_id`,
      [sessionId]
    );

    // 2. Get all memo items from parse_memos for this session
    const [memoItems] = await db.execute(
      `SELECT memo_id, question_number, answer_text, expected_marks, auto_corrected_marks,
              is_header, header_level, parent_header_id
       FROM parse_memos WHERE session_id = ? ORDER BY memo_id`,
      [sessionId]
    );

    if (qpItems.length === 0) {
      return { error: 'No QP items found for session ' + sessionId };
    }

    // 3. Build memo map by question_number
    const memoMap = new Map();
    for (const memo of memoItems) {
      memoMap.set(memo.question_number, memo);
    }

    // 4. Get subject_alpha_code from database
    let subjectAlphaCode = dimensions.subject_official_code || '';
    if (dimensions.subject_id) {
      const [subjRows] = await db.execute(
        'SELECT subject_alpha_code FROM lookup_subjects WHERE subject_id = ? LIMIT 1',
        [dimensions.subject_id]
      );
      if (subjRows.length > 0 && subjRows[0].subject_alpha_code) {
        subjectAlphaCode = subjRows[0].subject_alpha_code;
      }
    }

    // 5. First pass: Insert ALL QP items into item_master
    const resultIdToItemId = new Map(); // parse_results.result_id -> item_master.item_id
    const qnToItemId = new Map();         // question_number -> item_master.item_id

    for (const qp of qpItems) {
      const itemId = uuidv4();
      const memo = memoMap.get(qp.question_number);

      // Derive parent_question and is_sub_part from question_number dots
      const qnParts = String(qp.question_number).split('.');
      const parentQuestion = qnParts.length > 1 ? qnParts.slice(0, -1).join('.') : null;
      const isSubPart = qnParts.length > 1 ? 1 : 0;

      // Marks: expected_marks is the authoritative value
      const qpMarks = qp.expected_marks || 0;
      const memoMarks = memo ? (memo.expected_marks || 0) : null;

      await db.execute(
        `INSERT INTO item_master (
          item_id, item_code, subject_official_code, subject_alpha_code, paper_no,
          year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
          language_id, question_number, parent_question, is_sub_part, question_text,
          marks, marks_allocated, qp_marks, memo_marks, item_type_id, cognitive_level_id,
          difficulty_id, status, review_status, source_year, source_paper_code,
          source_question_number, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          paperCode + '_' + String(qp.question_number).replace(/\./g, '_'),
          dimensions.subject_official_code || null,
          subjectAlphaCode || null,
          dimensions.paper_no || null,
          dimensions.year_id || null,
          dimensions.grade_id || null,
          dimensions.subject_id || null,
          dimensions.paper_id || null,
          dimensions.assessment_type_id || null,
          dimensions.assessment_body_id || null,
          dimensions.language_id || null,
          qp.question_number,
          parentQuestion,
          isSubPart,
          qp.question_text || null,
          qpMarks,
          qpMarks,
          qpMarks,
          memoMarks,
          qp.parsed_type_id || 1,
          1, // cognitive_level_id default
          1, // difficulty_id default
          'draft',
          'draft',
          dimensions.year || null,
          paperCode,
          qp.question_number,
          1, // created_by
          now,
          now
        ]
      );

      resultIdToItemId.set(qp.result_id, itemId);
      qnToItemId.set(qp.question_number, itemId);

      // 6. Insert memo if a matching memo exists
      if (memo) {
        const memoId = uuidv4();
        await db.execute(
          `INSERT INTO item_memos (memo_id, item_id, question_number, answer_text, marks, is_current, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
          [memoId, itemId, memo.question_number, memo.answer_text || null, memo.expected_marks || 0, now, now]
        );
      }
    }

    // 7. Second pass: Link parent_item_id for sub-items based on parent_header_id
    for (const qp of qpItems) {
      if (qp.parent_header_id) {
        const parentItemId = resultIdToItemId.get(qp.parent_header_id);
        const childItemId = resultIdToItemId.get(qp.result_id);
        if (parentItemId && childItemId) {
          await db.execute(
            'UPDATE item_master SET parent_item_id = ? WHERE item_id = ?',
            [parentItemId, childItemId]
          );
        }
      }
    }

    return {
      success: true,
      itemsInserted: qpItems.length,
      memosInserted: memoItems.length,
      paperCode
    };
  } catch (e) {
    console.error('Auto-promote error for', paperCode, e.message);
    return { error: e.message, paperCode };
  }
}




// ============================================
// MACHINE RENAME: Convert old-format filenames to machine format
// ============================================

/**
 * Detect if a filename is old-format (human-readable) or machine-format
 * Machine format: SUBJECT_P1_2025_NOV_ENG_QP.pdf
 * Old format: "Mathematical Literacy P1 Nov 2025 Eng.pdf"
 */
function isMachineFormat(filename) {
  const name = filename.replace('.pdf', '');
  return name.includes('_P') && /_\d{4}_/.test(name) && /^[A-Z0-9_&-]+$/i.test(name) && !name.includes(' ');
}

/**
 * Extract components from old-format filename
 */
function parseOldFormatFilename(filename) {
  const base = filename.replace('.pdf', '');

  // Detect type
  let type = 'QP';
  let typeSuffix = '';

  if (/\bMG\b/i.test(base) || /\bMemorandum\b/i.test(base)) {
    type = 'Memo';
  } else if (/\bAddendum\b/i.test(base)) {
    type = 'Addendum';
  } else if (/\bTranscription\b/i.test(base)) {
    type = 'QP';
    typeSuffix = 'Transcription';
  } else if (/\bAnswer Book\b/i.test(base)) {
    type = 'AnswerBook';
  }

  // Extract paper number
  const paperMatch = base.match(/\bP(\d+)\b/i);
  const paperNo = paperMatch ? paperMatch[1] : '1';

  // Extract year
  const yearMatch = base.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : '2025';

  // Extract session
  let session = 'NOV';
  if (/May-June|May\s*June/i.test(base)) session = 'MAY_JUNE';
  else if (/Sept/i.test(base)) session = 'SEPT';
  else if (/Nov/i.test(base)) session = 'NOV';
  else if (/Feb/i.test(base)) session = 'FEB';
  else if (/Mar/i.test(base)) session = 'MARCH';

  // Extract languages
  const languages = [];
  if (/\bAfr\b/i.test(base) || /\bAfrikaans\b/i.test(base)) languages.push('AFR');
  if (/\bEng\b/i.test(base) || /\bEnglish\b/i.test(base)) languages.push('ENG');
  if (/\bIsiNdebele\b/i.test(base)) languages.push('ISINDEBELE');
  if (/\bIsiXhosa\b/i.test(base)) languages.push('ISIXHOSA');
  if (/\bIsiZulu\b/i.test(base)) languages.push('ISIZULU');
  if (/\bSepedi\b/i.test(base)) languages.push('SEPEDI');
  if (/\bSesotho\b/i.test(base)) languages.push('SESOTHO');
  if (/\bSetswana\b/i.test(base)) languages.push('SETSWANA');
  if (/\bSiSwati\b/i.test(base)) languages.push('SISWATI');
  if (/\bTshivenda\b/i.test(base)) languages.push('TSHIVENDA');
  if (/\bXitsonga\b/i.test(base)) languages.push('XITSONGA');
  if (/\bSASL\b/i.test(base)) languages.push('SASL');

  // Extract assessment type (FAL, HL, SAL)
  let assessmentType = '';
  const atMatch = base.match(/\b(FAL|HL|SAL)\b/i);
  if (atMatch) assessmentType = atMatch[1].toUpperCase();

  // Extract subject name - IMPROVED
  // Step 1: Remove everything from the paper number onwards
  let subjectName = base;
  const paperIdx = subjectName.search(/\bP\d+\b/i);
  if (paperIdx > 0) {
    subjectName = subjectName.substring(0, paperIdx).trim();
  }

  // Step 2: Remove assessment type (but keep it as separate field)
  subjectName = subjectName.replace(/\b(FAL|HL|SAL)\b/gi, '').trim();

  // Step 3: Remove type markers (MG, Memorandum, Addendum, etc.)
  subjectName = subjectName.replace(/\b(MG|Memorandum|Addendum|Transcription|Answer Book)\b/gi, '').trim();

  // Step 4: Remove language names

  // Step 5: Remove session names
  subjectName = subjectName.replace(/\b(Nov|May-June|September|Feb|Mar)\b/gi, '').trim();

  // Step 6: Remove year
  subjectName = subjectName.replace(/\b\d{4}\b/, '').trim();

  // Step 7: Clean up extra spaces (keep & as part of subject name)
  subjectName = subjectName.replace(/\s+/g, ' ').trim();

  return {
    subjectName,
    paperNo,
    year,
    session,
    languages,
    assessmentType,
    type,
    typeSuffix,
    original: filename
  };
}

/**
 * Build machine-format filename from parsed components
 */
function buildMachineFilename(parsed, subjectCode, language, type, typeSuffix) {
  let base = subjectCode;

  if (parsed.assessmentType) {
    base += '_' + parsed.assessmentType;
  }

  base += '_P' + parsed.paperNo + '_' + parsed.year + '_' + parsed.session;

  if (type === 'Addendum') {
    base += '_' + language + '_Addendum_' + language;
  } else if (type === 'QP' && typeSuffix) {
    base += '_' + language + '_QP_' + typeSuffix;
  } else if (type === 'Memo') {
    base += '_' + language + '_Memo_' + language;
  } else if (type === 'QP') {
    base += '_' + language + '_QP';
  } else {
    base += '_' + language;
  }

  return base + '.pdf';
}

/**
 * Scan folder and build rename preview
 */
async function buildRenamePreview(folderPath, db) {
  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.pdf'));

  const renamed = [];
  const skipped = [];
  const errors = [];

  // Get all subjects from database for fuzzy matching
  let subjectMap = {};
  try {
    const [subjectRows] = await db.execute('SELECT subject_name, parser_subject_code FROM lookup_subjects WHERE parser_subject_code IS NOT NULL');
    for (const row of subjectRows) {
      if (row.subject_name && row.parser_subject_code) {
        subjectMap[row.subject_name.toLowerCase()] = row.parser_subject_code;
      }
    }
  } catch (e) {
    errors.push('Failed to load subject map: ' + e.message);
  }

  for (const file of files) {
    if (isMachineFormat(file)) {
      skipped.push({ original: file, reason: 'Already machine format' });
      continue;
    }

    const parsed = parseOldFormatFilename(file);

    if (parsed.type === 'AnswerBook') {
      skipped.push({ original: file, reason: 'Answer book - skipped' });
      continue;
    }

    const subjectKey = parsed.subjectName.toLowerCase();
    let subjectCode = subjectMap[subjectKey];
    // Hardcoded alias for SASL (South African Sign Language Home Language)
    // SASL is always Home Language and the short name does not fuzzy-match the full name
    if (!subjectCode && (subjectKey === 'sasl' || parsed.subjectName.toUpperCase() === 'SASL')) {
      subjectCode = subjectMap['south african sign language home language'] || 'SOUTHAFRICANSIGNLANGUAGEHOMELANGUAGE';
    }

    // Try strict word-level fuzzy match if exact not found
    if (!subjectCode && parsed.subjectName.length > 2) {
      const subjectWords = parsed.subjectName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let bestMatch = null;
      let bestScore = 0;

      for (const [name, code] of Object.entries(subjectMap)) {
        const nameWords = name.split(/\s+/).filter(w => w.length > 2);
        // Count how many words match
        let matchCount = 0;
        for (const sw of subjectWords) {
          for (const nw of nameWords) {
            if (sw === nw || (sw.length > 3 && nw.includes(sw)) || (nw.length > 3 && sw.includes(nw))) {
              matchCount++;
              break;
            }
          }
        }
        const score = matchCount / Math.max(subjectWords.length, nameWords.length);
        if (score > bestScore && score >= 0.1) { // At least 50% word match
          bestScore = score;
          bestMatch = code;
        }
      }
      subjectCode = bestMatch;

    // Fix: Ensure matched subject matches the assessment type (HL/FAL/SAL)
    if (subjectCode && parsed.assessmentType) {
      const expectedSuffix = parsed.assessmentType.toUpperCase();
      const hasHLSuffix = /HOMELANGUAGE$/.test(subjectCode);
      const hasFALSuffix = /FIRSTADDITIONALLANGUAGE$/.test(subjectCode);
      const hasSALSuffix = /SECONDADDITIONALLANGUAGE$/.test(subjectCode);
      
      let needsFix = false;
      if (expectedSuffix === 'HL' && !hasHLSuffix) needsFix = true;
      if (expectedSuffix === 'FAL' && !hasFALSuffix) needsFix = true;
      if (expectedSuffix === 'SAL' && !hasSALSuffix) needsFix = true;
      
      if (needsFix) {
        let targetSuffix = '';
        if (expectedSuffix === 'HL') targetSuffix = 'HOMELANGUAGE';
        else if (expectedSuffix === 'FAL') targetSuffix = 'FIRSTADDITIONALLANGUAGE';
        else if (expectedSuffix === 'SAL') targetSuffix = 'SECONDADDITIONALLANGUAGE';
        
        const baseName = subjectCode.replace(/(HOMELANGUAGE|FIRSTADDITIONALLANGUAGE|SECONDADDITIONALLANGUAGE)$/, '');
        const correctedCode = baseName + targetSuffix;
        
        const codeExists = Object.values(subjectMap).includes(correctedCode);
        if (codeExists) {
          subjectCode = correctedCode;
        }
      }
    }
    }

    if (!subjectCode) {
      errors.push({ original: file, reason: 'Subject not found: ' + parsed.subjectName });
      continue;
    }

    if (parsed.languages.length === 0) {
      parsed.languages.push('ENG');
    }

    if (parsed.type === 'Memo' && parsed.languages.length > 1) {
      for (const lang of parsed.languages) {
        const newName = buildMachineFilename(parsed, subjectCode, lang, 'Memo', '');
        renamed.push({ original: file, newName, language: lang, type: 'Memo' });
      }
    } else if (parsed.type === 'Addendum') {
      for (const lang of parsed.languages) {
        const newName = buildMachineFilename(parsed, subjectCode, lang, 'Addendum', '');
        renamed.push({ original: file, newName, language: lang, type: 'Addendum' });
      }
    } else {
      const lang = parsed.languages[0];
      const newName = buildMachineFilename(parsed, subjectCode, lang, parsed.type, parsed.typeSuffix);
      renamed.push({ original: file, newName, language: lang, type: parsed.type });
    }
  }

  return { renamed, skipped, errors };
}

router.post('/rename-preview', async (req, res) => {
  try {
    const folderPath = req.body.folder_path || req.body.folderPath;
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'Valid folder_path required' });
    }
    const db = req.db;
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const preview = await buildRenamePreview(folderPath, db);
    res.json({ success: true, ...preview });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/rename-apply', async (req, res) => {
  try {
    const folderPath = req.body.folder_path || req.body.folderPath;
    const renames = req.body.renames || [];
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'Valid folder_path required' });
    }

    const applied = [];
    const failed = [];

    for (const rename of renames) {
      const oldPath = path.join(folderPath, rename.original);
      const newPath = path.join(folderPath, rename.newName);

      try {
        if (fs.existsSync(newPath)) {
          failed.push({ original: rename.original, newName: rename.newName, reason: 'Target file already exists' });
          continue;
        }
        fs.renameSync(oldPath, newPath);
        applied.push({ original: rename.original, newName: rename.newName });
      } catch (e) {
        failed.push({ original: rename.original, newName: rename.newName, reason: e.message });
      }
    }

    const logPath = path.join(folderPath, 'rename_log_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    try {
      fs.writeFileSync(logPath, JSON.stringify({ applied, failed, timestamp: new Date().toISOString() }, null, 2));
    } catch (e) {
      console.error('Failed to write rename log:', e.message);
    }

    res.json({ success: true, applied, failed, logPath });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


module.exports = router;



