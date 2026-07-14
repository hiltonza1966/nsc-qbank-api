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

  let language = 'ENG';
  if (/\bAfr\b/i.test(base) || /\bAfrikaans\b/i.test(base)) {
    language = 'AFR';
  } else if (/\bEng\b/i.test(base) || /\bEnglish\b/i.test(base)) {
    language = 'ENG';
  }

  const yearMatch = clean.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;
  const paperMatch = clean.match(/\bP(\d+)\b/i);
  const paperNo = paperMatch ? parseInt(paperMatch[1]) : 1;

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

  const pairs = [];
  const unmatched = [];

  for (const key in qpMap) {
    if (memoMap[key]) {
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

// ============================================
// HELPER: Build allImages array from item data
// ============================================
function buildAllImages(item, paperCode) {
  const allImages = [];
  const imageMetadata = item.image_metadata || [];
  const inheritedImages = item.inherited_images || [];
  const qpImages = item.images || item.qp_images || [];
  const memoImages = item.memo_images || item.images || [];

  // From structured metadata
  for (const img of imageMetadata) {
    allImages.push({
      image_id: img.image_id || null,
      file_path: img.file_path || img,
      file_name: img.file_name || path.basename(img.file_path || img),
      page_num: img.page_num || 0,
      linked_question_number: img.linked_question_number || item.question_number,
      is_inherited: 0
    });
  }
  // From inherited images
  for (const img of inheritedImages) {
    allImages.push({
      image_id: img.image_id || null,
      file_path: img.file_path || img,
      file_name: img.file_name || path.basename(img.file_path || img),
      page_num: img.page_num || 0,
      linked_question_number: img.linked_question_number || item.question_number,
      is_inherited: 1
    });
  }
  // From qp_images (raw paths from Python parser)
  for (const imgPath of qpImages) {
    if (!imgPath) continue;
    if (typeof imgPath === 'string') {
      const normalizedPath = imgPath.replace(/\\/g, '/');
      allImages.push({
        image_id: null,
        file_path: normalizedPath,
        file_name: path.basename(normalizedPath),
        page_num: 0,
        linked_question_number: item.question_number,
        is_inherited: 0
      });
    } else if (typeof imgPath === 'object') {
      // Object format: {filename, page, bbox} from qp_content_parser.py
      const filename = imgPath.filename || imgPath.file_name || '';
      if (filename) {
        allImages.push({
          image_id: null,
          file_path: filename,
          file_name: path.basename(filename),
          page_num: imgPath.page || 0,
          linked_question_number: item.question_number,
          is_inherited: 0
        });
      }
    }
  }
  // From memo_images (raw paths from Python parser)
  for (const imgPath of memoImages) {
    if (!imgPath) continue;
    if (typeof imgPath === 'string') {
      const normalizedPath = imgPath.replace(/\\/g, '/');
      allImages.push({
        image_id: null,
        file_path: normalizedPath,
        file_name: path.basename(normalizedPath),
        page_num: 0,
        linked_question_number: item.question_number,
        is_inherited: 0
      });
    } else if (typeof imgPath === 'object') {
      const filename = imgPath.filename || imgPath.file_name || '';
      if (filename) {
        allImages.push({
          image_id: null,
          file_path: filename,
          file_name: path.basename(filename),
          page_num: imgPath.page || 0,
          linked_question_number: item.question_number,
          is_inherited: 0
        });
      }
    }
  }

  return allImages;
}

// ============================================
// HELPER: Insert attachments for a parse result
// ============================================
async function insertAttachments(db, insertResult, sessionId, item, allImages, now) {
  let insertedCount = 0;
  if (allImages.length === 0) return insertedCount;

  const errors = [];
  let imgIdx = 0;

  for (const img of allImages) {
    if (!img.file_path) continue;

    // Try both forward-slash and backslash paths on Windows
    let resolvedPath = img.file_path;
    if (process.platform === 'win32') {
      resolvedPath = img.file_path.replace(/\//g, '\\');
    }

    const exists = fs.existsSync(resolvedPath);
    const fileSize = exists ? fs.statSync(resolvedPath).size : 0;
    const mimeType = img.mime_type || 'image/png';
    const fileName = img.file_name || path.basename(img.file_path);

    try {
      await db.execute(
        `INSERT INTO item_attachments (
          item_id, result_id, session_id, stimulus_id, file_name, file_path,
          file_size, mime_type, attachment_type, question_number, is_extracted,
          extracted_at, pdf_page_number, image_index, description, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          null,                       // item_id - set during promotion
          insertResult.insertId,      // result_id - link to parse_results
          sessionId,                  // session_id
          null,                       // stimulus_id
          fileName,                   // file_name
          img.file_path,              // file_path (store normalized)
          fileSize,                   // file_size
          mimeType,                   // mime_type
          'image',                    // attachment_type
          item.question_number,       // question_number
          1,                          // is_extracted
          now,                        // extracted_at
          img.page_num || 0,          // pdf_page_number
          imgIdx++,                   // image_index
          null,                       // description
          img.display_order || 0      // display_order
        ]
      );
      insertedCount++;
    } catch (attachErr) {
      errors.push({
        file: fileName,
        error: attachErr.message,
        code: attachErr.code
      });
    }
  }

  if (errors.length > 0) {
    console.error(`[ATTACHMENT ERRORS] Q${item.question_number}: ${errors.length} failures`, errors);
  }

  return insertedCount;
}


// ============================================
// HELPER: Infer item type from parsed data
// FIXED: Properly checks item_answer_json for mcq_single type
// ============================================
function inferItemType(item) {
  // 0. If parser already set item_type_id, trust it
  if (item.item_type_id) return item.item_type_id;

  // 1. Multiple Choice: check item_answer_json for mcq_single type
  if (item.item_answer_json) {
    try {
      const answerJson = typeof item.item_answer_json === 'string'
        ? JSON.parse(item.item_answer_json)
        : item.item_answer_json;

      // Direct type check
      if (answerJson.type === 'mcq_single' || answerJson.type === 'mcq') {
        return 1;
      }

      // Options check: if options object has 2+ entries, it's an MCQ
      if (answerJson.options && typeof answerJson.options === 'object') {
        const optionCount = Object.keys(answerJson.options).length;
        if (optionCount >= 2) {
          return 1;
        }
      }
    } catch (e) {
      // JSON parse failed, ignore
    }
  }

  // 2. Legacy mcq_options check
  if (item.mcq_options) {
    try {
      const opts = typeof item.mcq_options === 'string'
        ? JSON.parse(item.mcq_options)
        : item.mcq_options;
      if (opts && typeof opts === 'object' && Object.keys(opts).length >= 2) {
        return 1;
      }
    } catch (e) {
      // Ignore parse error
    }
  }

  // 3. is_mcq flag from parser
  if (item.is_mcq === 1 || item.is_mcq === true) {
    return 1;
  }

  const marks = item.qp_marks || item.final_marks || item.expected_marks || 0;
  const qn = String(item.question_number || '');
  const section = qn.split('.')[0];
  const hasAttachments = (item.images && item.images.length > 0) ||
                         (item.qp_images && item.qp_images.length > 0) ||
                         (item.image_metadata && item.image_metadata.length > 0);
  const text = (item.question_text || '').toLowerCase();

  // 4. Diagram: has attachments + section 3+ + label/diagram/annotate keywords
  if (hasAttachments && marks >= 1 && marks <= 5) {
    if (section === '3' || section === '4' || section === '5' || section === '6') {
      if (text.includes('diagram') || text.includes('label') || text.includes('annotate') ||
          text.includes('sketch') || text.includes('draw') || text.includes('illustrate')) {
        return 6;
      }
    }
  }

  // 5. Source-Based: comprehension section with source/passage keywords
  if ((section === '3' || section === '4' || section === '5') && marks >= 1 && marks <= 5) {
    if (text.includes('source') || text.includes('passage') || text.includes('text') ||
        text.includes('read') || text.includes('extract')) {
      return 9;
    }
  }

  // 6. Matching: match/column/table structure
  if (text.includes('match') || text.includes('column') || text.includes('table') ||
      text.includes('corresponding') || text.includes('pair')) {
    return 7;
  }

  // 7. Practical: experiment/investigation/practical keywords
  if (text.includes('experiment') || text.includes('investigation') || text.includes('practical') ||
      text.includes('apparatus') || text.includes('method') || text.includes('procedure')) {
    return 8;
  }

  // 8. Marks-based classification for remaining types
  if (marks >= 1 && marks <= 2) return 2;      // Short Answer
  if (marks >= 3 && marks <= 5) return 3;      // Medium Response
  if (marks >= 6 && marks <= 9) return 4;     // Extended Response
  if (marks >= 10) return 5;                   // Essay

  return 2; // Default: Short Answer
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
          [sessionId, yearId, gradeId, subjectId, paperId, languageId, assessmentTypeId, assessmentBodyId, `${paperCode}_QP_Memo_${language}.pdf`, crypto.createHash('sha256').update(paperCode).digest('hex').substring(0, 64), outputDir, 'v38', totalItems, totalMarks, 150, totalMarks, greenCount, 0, totalItems - greenCount, 'imported', null, now, now, paperCode, 0]
        );

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
        let totalAttachmentsInserted = 0;

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

          const allImages = buildAllImages(item, paperCode);
          const imagesJson = allImages.length > 0 ? JSON.stringify(allImages) : '[]';

          if (!isHeader && item.parent_header_q && headerDbIds[item.parent_header_q]) {
            parentHeaderId = headerDbIds[item.parent_header_q];
          }

          // FIXED: Added header_level to INSERT columns and VALUES
          
        // DEBUG LOG
        console.log('[DEBUG parse_results] QN:', item.question_number, 
                    'isHeader:', isHeader, 
                    'headerLevel:', item.header_level || 0,
                    'mcqJson:', item.mcq_json ? 'YES' : 'NO',
                    'images:', allImages.length);
        const [insertResult] = await db.execute(
            `INSERT INTO parse_results (session_id, paper_code, question_number, question_text, answer_text, parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, is_memo, is_header, header_level, parent_header_id, images, item_answer_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, paperCode, item.question_number, item.question_text || null, item.answer_text || null, item.item_type_id || inferItemType(item) || 2, item.section || null, item.qp_marks || item.final_marks || 0, item.expected_marks || item.final_marks || 0, item.final_marks || 0, item.confidence === 'green' ? 'auto_corrected' : 'manual_review', item.final_marks || 0, item.notes || null, isMemo, isHeader, item.header_level || 0, parentHeaderId, imagesJson, item.item_answer_json || null, now, now]
          );

          if (isHeader) {
            headerDbIds[item.question_number] = insertResult.insertId;
          }

          // Insert attachments immediately after parse_results insert
          // const attachCount = await insertAttachments(db, insertResult, sessionId, item, allImages, now);
          // totalAttachmentsInserted += attachCount;
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

          let imagesJson = '[]';
          const memoImageMetadata = item.memo_image_metadata || [];
          if (memoImageMetadata.length > 0) {
            imagesJson = JSON.stringify(memoImageMetadata.map(img => ({
              image_id: img.image_id || null,
              file_path: img.file_path || img,
              file_name: img.file_name || path.basename(img.file_path || img),
              page_num: img.page_num || 0,
              linked_question_number: img.linked_question_number || item.question_number
            })));
          }
          if (!isHeader && item.parent_header_q && headerMemoDbIds[item.parent_header_q]) {
            parentHeaderId = headerMemoDbIds[item.parent_header_q];
          }

          // FIXED: Added header_level to parse_memos INSERT
          const [insertResult] = await db.execute(
            `INSERT INTO parse_memos (session_id, paper_code, question_number, question_text, answer_text, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, is_header, header_level, parent_header_id, images, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, paperCode, item.question_number, item.question_text || null, item.answer_text || null, item.memo_marks || item.final_marks || 0, item.expected_marks || item.final_marks || 0, item.final_marks || 0, item.confidence === 'green' ? 'auto_corrected' : 'manual_review', item.final_marks || 0, item.notes || null, isHeader, item.header_level || 0, parentHeaderId, imagesJson, now, now]
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

        let attachmentResult = null;

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
          attachments_inserted: 0,  // Will be updated after attachmentResult is populated
        });

        // Run attachment integration after parse, before promote
        try {
          const { integrateAttachments } = require('./attachment_integration');
          attachmentResult = await integrateAttachments(db, sessionId, paperCode, qp.fullPath, memo.fullPath);
        } catch (attachIntErr) {
          console.error('Attachment integration error for', paperCode, attachIntErr.message);
        }

        // Auto-promote to production tables if enabled
        let promoteResult = null;
        if (createProductionItems) {
          try {
            promoteResult = await autoPromoteSession(db, sessionId, paperCode, dimensions, parseResult, outputDir);
          } catch (promoteErr) {
            console.error('Auto-promote error for', paperCode, promoteErr.message);
          }
        }

        // FIX: Update attachments_inserted after attachmentResult is populated
        const lastResult = results[results.length - 1];
        lastResult.attachments_inserted = attachmentResult ? attachmentResult.inserted : 0;
        lastResult.promote_status = promoteResult ? (promoteResult.error ? 'failed' : 'success') : 'skipped';
        lastResult.promote_error = promoteResult?.error || null;
        lastResult.promote_items_inserted = promoteResult?.itemsInserted || 0;
        lastResult.promote_attachments_linked = promoteResult?.attachmentsLinked || 0;

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
    const [rows] = await db.execute(`SELECT paper_code, status, total_items_found, total_marks_parser, auto_corrected_count, created_at FROM parse_sessions WHERE parser_version = 'v38' ORDER BY created_at DESC LIMIT 50`);
    res.json({ success: true, batches: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ============================================
// AUTO-PROMOTE: Move parsed items to item_master + item_memos + item_attachments
// FIXED: Uses AUTO_INCREMENT for attachment_id, includes result_id/session_id
// ============================================
async function autoPromoteSession(db, sessionId, paperCode, dimensions, parseResult, outputDir) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let attachmentsLinked = 0;

  try {
    // 1. Get all QP items from parse_results for this session
    const [qpItems] = await db.execute(
      `SELECT result_id, question_number, question_text, expected_marks, auto_corrected_marks,
              is_header, header_level, parent_header_id, parsed_type_id, images, item_answer_json
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
    const resultIdToItemId = new Map();
    const qnToItemId = new Map();

    for (const qp of qpItems) {
      const itemId = uuidv4();
      const memo = memoMap.get(qp.question_number);

      const qnParts = String(qp.question_number).split('.');
      const parentQuestion = qnParts.length > 1 ? qnParts.slice(0, -1).join('.') : null;
      const isSubPart = qnParts.length > 1 ? 1 : 0;

      const qpMarks = qp.expected_marks || 0;
      const memoMarks = memo ? (memo.expected_marks || 0) : null;

      await db.execute("SET @current_user_id = 1, @current_ip = '127.0.0.1'");
      // FIX: Handle null/empty question_text — use placeholder instead of NULL
      // to prevent "Column 'question_text' cannot be null" error
      const safeQuestionText = qp.question_text && qp.question_text.trim().length > 0
        ? qp.question_text
        : (qp.is_header ? `[Header: ${qp.question_number}]` : '[No question text extracted]');

      // FIX: Handle item_answer_json — it's already a JSON string in parse_results,
      // don't double-encode it
      const safeAnswerJson = qp.item_answer_json && typeof qp.item_answer_json === 'string'
        ? qp.item_answer_json
        : (qp.item_answer_json ? JSON.stringify(qp.item_answer_json) : null);

      try {
        await db.execute(
          `INSERT INTO item_master (
            item_id, item_code, subject_official_code, subject_alpha_code, paper_no,
            year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
            language_id, question_number, parent_question, is_sub_part, question_text,
            marks, marks_allocated, qp_marks, memo_marks, item_type_id, cognitive_level_id,
            difficulty_id, status, review_status, source_year, source_paper_code,
            source_question_number, item_answer_json, created_by, user_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            safeQuestionText,
            qpMarks,
            qpMarks,
            qpMarks,
            memoMarks,
            qp.parsed_type_id || 1,
            1,
            1,
            'draft',
            'draft',
            dimensions.year || null,
            paperCode,
            qp.question_number,
            safeAnswerJson,
            1,
            1,
            now,
            now
          ]
        );
      } catch (insertErr) {
        console.error(`[AUTO-PROMOTE] FAILED item ${qp.question_number}: ${insertErr.message}`);
        continue; // Skip this item, continue with others
      }

      resultIdToItemId.set(qp.result_id, itemId);
      qnToItemId.set(qp.question_number, itemId);


      if (memo) {
        const memoId = uuidv4();
        await db.execute(
          `INSERT INTO item_memos (memo_id, item_id, question_number, answer_text, marks, is_current, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
          [memoId, itemId, memo.question_number, memo.answer_text || null, memo.expected_marks || 0, now, now]
        );
      }
    }  // END FIRST LOOP

    // 6.5 Link existing attachments to item_master (UPDATE only, no INSERT)
    // MOVED OUTSIDE THE LOOP — runs exactly once per session
    const [existingAttachments] = await db.execute(
      `SELECT attachment_id, result_id, file_path FROM item_attachments WHERE session_id = ?`,
      [sessionId]
    );

    if (existingAttachments && existingAttachments.length > 0) {
      let loopAttachmentsLinked = 0;
      for (const att of existingAttachments) {
        const resultId = att.result_id;
        if (resultId) {
          const itemId = resultIdToItemId.get(resultId);
          if (itemId) {
            await db.execute(
              `UPDATE item_attachments SET item_id = ?, updated_at = ? WHERE attachment_id = ?`,
              [itemId, now, att.attachment_id]
            );
            loopAttachmentsLinked++;
          }
        }
      }
      attachmentsLinked += loopAttachmentsLinked;
      console.log(`[AUTO-PROMOTE] Linked ${loopAttachmentsLinked} existing attachments to item_master`);
    } else {
      console.log(`[AUTO-PROMOTE] No existing attachments for session ${sessionId} — attachment_integration.js may not have run`);
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
      attachmentsLinked: attachmentsLinked,
      paperCode
    };
  } catch (e) {
    console.error('Auto-promote error for', paperCode, e.message);
    return { error: e.message, paperCode, attachmentsLinked };
  }
}

async function buildRenamePreview(folderPath, db) {
  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.pdf'));

  const renamed = [];
  const skipped = [];
  const errors = [];

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

    if (!subjectCode && (subjectKey === 'sasl' || parsed.subjectName.toUpperCase() === 'SASL')) {
      subjectCode = subjectMap['south african sign language home language'] || 'SOUTHAFRICANSIGNLANGUAGEHOMELANGUAGE';
    }

    if (!subjectCode && parsed.subjectName.length > 2) {
      const subjectWords = parsed.subjectName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      let bestMatch = null;
      let bestScore = 0;

      for (const [name, code] of Object.entries(subjectMap)) {
        const nameWords = name.split(/\s+/).filter(w => w.length > 2);
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
        if (score > bestScore && score >= 0.1) {
          bestScore = score;
          bestMatch = code;
        }
      }
      subjectCode = bestMatch;

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
