const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');
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
          `INSERT INTO parse_sessions (session_id, year_id, grade_id, subject_id, paper_id, language_id, assessment_type_id, assessment_body_id, file_name, file_hash, parser_version, total_items_found, total_marks_parser, total_marks_expected, total_marks_corrected, auto_corrected_count, manual_review_count, missing_count, status, error_message, completed_at, created_at, paper_code, is_memo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessionId, yearId, gradeId, subjectId, paperId, languageId, assessmentTypeId, assessmentBodyId, `${paperCode}_QP_Memo_${language}.pdf`, crypto.createHash('sha256').update(paperCode).digest('hex').substring(0, 64), 'v30-tweaked-batch', totalItems, totalMarks, 150, totalMarks, greenCount, 0, totalItems - greenCount, 'imported', null, now, now, paperCode, 0]
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
// AUTO-PROMOTE: Uses shared promotion function
// ============================================
async function autoPromoteSession(db, sessionId, paperCode, dimensions, parseResult, outputDir) {
  try {
    const result = await promoteSessionToItemMaster(sessionId);
    console.log('Auto-promote result:', paperCode, result);
    return result;
  } catch (e) {
    console.error('Auto-promote error:', e.message);
    return { error: e.message };
  }
}


module.exports = router;

