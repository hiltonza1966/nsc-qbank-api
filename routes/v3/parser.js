// ============================================================================
// QBank Wizard Parser v3.1 - FIXED
// Fixes: Actually runs Python parser, creates attachments, proper dimension handling
// Location: routes/v3/parser.js
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../../backend/db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const PARSER_OUTPUT_DIR = path.join(UPLOADS_DIR, 'parser_output');
const PARSERS_DIR = path.join(__dirname, '..', '..', 'backend', 'parsers');

// Ensure directories exist
if (!fs.existsSync(PARSER_OUTPUT_DIR)) {
  fs.mkdirSync(PARSER_OUTPUT_DIR, { recursive: true });
}

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

// ============================================================================
// DIMENSION EXTRACTION FROM PAPER_CODE
// ============================================================================

function extractDimensionsFromPaperCode(paperCode) {
  if (!paperCode) return null;

  const parts = paperCode.split('_');
  if (parts.length < 5) return null;

  let subjectCode = '';
  let paperNo = '1';
  let subjectParts = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const paperMatch = part.match(/^P(\d)$/i);

    if (paperMatch) {
      paperNo = paperMatch[1];
      const remaining = parts.slice(i + 1);
      if (remaining.length >= 3) {
        const year = parseInt(remaining[0]) || null;
        const session = remaining[1];
        const language = remaining[2];

        return {
          subjectCode: subjectParts.join('_'),
          paperNo,
          year,
          session,
          language,
          paperCode
        };
      }
      break;
    } else {
      subjectParts.push(part);
    }
  }

  return null;
}

async function resolveDimensionsFromPaperCode(paperCode, connection) {
  const dims = extractDimensionsFromPaperCode(paperCode);
  if (!dims) return null;

  const { subjectCode, year, paperNo } = dims;

  const [subjects] = await connection.execute(
    `SELECT subject_id, subject_official_code, parser_subject_code 
     FROM lookup_subjects 
     WHERE parser_subject_code = ? OR subject_official_code = ?`,
    [subjectCode, subjectCode]
  );

  let resolvedSubjectId = null;
  let resolvedSubjectCode = subjectCode;

  if (subjects.length > 0) {
    resolvedSubjectId = subjects[0].subject_id;
    resolvedSubjectCode = subjects[0].subject_official_code || subjects[0].parser_subject_code;
  }

  let resolvedYearId = null;
  if (year) {
    const [years] = await connection.execute(
      'SELECT year_id FROM lookup_years WHERE year_value = ?',
      [year]
    );
    if (years.length > 0) {
      resolvedYearId = years[0].year_id;
    }
  }

  let resolvedPaperId = null;
  const [papers] = await connection.execute(
    `SELECT paper_id FROM lookup_papers 
     WHERE paper_no = ? AND subject_id = ?`,
    [paperNo, resolvedSubjectId]
  );
  if (papers.length > 0) {
    resolvedPaperId = papers[0].paper_id;
  }

  return {
    ...dims,
    resolvedSubjectId,
    resolvedSubjectCode,
    resolvedYearId,
    resolvedPaperId
  };
}

// ============================================================================
// HELPER: Insert attachments for parse result
// ============================================================================
async function insertAttachmentsForResult(db, resultId, sessionId, item, allImages, now) {
  let insertedCount = 0;
  if (!allImages || allImages.length === 0) return insertedCount;

  let imgIdx = 0;
  for (const img of allImages) {
    if (!img.file_path) continue;

    const normalizedPath = img.file_path.replace(/\\/g, '/');
    let resolvedPath = normalizedPath;
    if (process.platform === 'win32') {
      resolvedPath = normalizedPath.replace(/\//g, '\\');
    }

    const exists = fs.existsSync(resolvedPath);
    const fileSize = exists ? fs.statSync(resolvedPath).size : 0;
    const mimeType = img.mime_type || 'image/png';
    const fileName = img.file_name || path.basename(normalizedPath);

    try {
      await db.execute(
        `INSERT INTO item_attachments (
          item_id, result_id, session_id, stimulus_id, file_name, file_path,
          file_size, mime_type, attachment_type, question_number, is_extracted,
          extracted_at, pdf_page_number, image_index, description, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          null,
          resultId,
          sessionId,
          null,
          fileName,
          normalizedPath,
          fileSize,
          mimeType,
          'image',
          item.question_number,
          1,
          now,
          img.page_num || 0,
          imgIdx++,
          null,
          img.display_order || 0
        ]
      );
      insertedCount++;
    } catch (err) {
      console.error('[WIZARD ATTACHMENT ERROR]', item.question_number, fileName, err.message);
    }
  }

  return insertedCount;
}

// ============================================================================
// MAIN PARSER ROUTE - FIXED: Actually runs Python parser
// ============================================================================

router.post('/parse', async (req, res) => {
  const { 
    filePath, 
    memoPath,
    paperCode, 
    subjectId, 
    yearId, 
    paperId, 
    language, 
    sessionType,
    isMemo = false 
  } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  if (!paperCode) {
    return res.status(400).json({ error: 'paper_code is required' });
  }

  const connection = await db.getConnection();

  try {
    const resolvedDims = await resolveDimensionsFromPaperCode(paperCode, connection);

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Create parse session
    await connection.execute(
      `INSERT INTO parse_sessions 
       (session_id, paper_code, subject_id, year_id, paper_id, language, session_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?)`,
      [
        sessionId,
        paperCode,
        resolvedDims?.resolvedSubjectId || subjectId || null,
        resolvedDims?.resolvedYearId || yearId || null,
        resolvedDims?.resolvedPaperId || paperId || null,
        resolvedDims?.language || language || 'ENG',
        resolvedDims?.session || sessionType || 'NOV',
        now,
        now
      ]
    );

    // FIXED: Actually run the Python parser
    const outputDir = path.join(PARSER_OUTPUT_DIR, paperCode);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let parseResult;
    if (memoPath && fs.existsSync(memoPath)) {
      // Parse both QP and Memo
      parseResult = await runPythonScript(['parse', filePath, memoPath, paperCode, outputDir], 120000);
    } else {
      // Parse QP only
      parseResult = await runPythonScript(['parse-qp', filePath, paperCode, outputDir], 120000);
    }

    if (parseResult.status === 'error') {
      throw new Error(parseResult.error || 'Parser returned error status');
    }

    // Insert QP items with attachments
    const allItems = [
      ...(parseResult.green_items || []),
      ...(parseResult.yellow_items || []),
      ...(parseResult.red_items || []),
      ...(parseResult.qp_only_items || [])
    ];

    let totalAttachments = 0;
    const insertedQpKeys = new Set();
    const headerDbIds = {};

    for (const item of allItems) {
      const isHeader = item.is_header || 0;
      const dupKey = `${paperCode}:${item.question_number}:0`;
      if (insertedQpKeys.has(dupKey)) continue;
      insertedQpKeys.add(dupKey);

      let parentHeaderId = null;
      if (!isHeader && item.parent_header_q && headerDbIds[item.parent_header_q]) {
        parentHeaderId = headerDbIds[item.parent_header_q];
      }

      // Build all images from all sources
      const allImages = [];
      const imageMetadata = item.image_metadata || [];
      const inheritedImages = item.inherited_images || [];
      const qpImages = item.qp_images || [];
      const memoImages = item.memo_images || [];

      for (const img of imageMetadata) {
        allImages.push({
          image_id: img.image_id || null,
          file_path: img.file_path || img,
          file_name: img.file_name || path.basename(img.file_path || img),
          page_num: img.page_num || 0,
          mime_type: img.mime_type || 'image/png'
        });
      }
      for (const img of inheritedImages) {
        allImages.push({
          image_id: img.image_id || null,
          file_path: img.file_path || img,
          file_name: img.file_name || path.basename(img.file_path || img),
          page_num: img.page_num || 0,
          mime_type: img.mime_type || 'image/png'
        });
      }
      for (const imgPath of qpImages) {
        if (imgPath && typeof imgPath === 'string') {
          allImages.push({
            file_path: imgPath.replace(/\\/g, '/'),
            file_name: path.basename(imgPath),
            page_num: 0,
            mime_type: 'image/png'
          });
        }
      }
      for (const imgPath of memoImages) {
        if (imgPath && typeof imgPath === 'string') {
          allImages.push({
            file_path: imgPath.replace(/\\/g, '/'),
            file_name: path.basename(imgPath),
            page_num: 0,
            mime_type: 'image/png'
          });
        }
      }

      const imagesJson = allImages.length > 0 ? JSON.stringify(allImages) : '[]';

      const [insertResult] = await connection.execute(
        `INSERT INTO parse_results 
         (session_id, paper_code, question_number, question_text, answer_text, 
          parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status,
          is_memo, is_header, parent_header_id, images, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          paperCode,
          item.question_number,
          item.question_text || null,
          item.answer_text || null,
          item.qp_marks || item.final_marks || 0,
          item.expected_marks || item.final_marks || 0,
          item.final_marks || 0,
          item.confidence === 'green' ? 'auto_corrected' : 'manual_review',
          0,
          isHeader,
          parentHeaderId,
          imagesJson,
          now,
          now
        ]
      );

      if (isHeader) {
        headerDbIds[item.question_number] = insertResult.insertId;
      }

      // Insert attachments
      const attachCount = await insertAttachmentsForResult(connection, insertResult.insertId, sessionId, item, allImages, now);
      totalAttachments += attachCount;
    }

    // Insert memo items
    const memoItems = [
      ...(parseResult.green_items || []),
      ...(parseResult.yellow_items || []),
      ...(parseResult.red_items || []),
      ...(parseResult.memo_only_items || [])
    ];

    const insertedMemoKeys = new Set();
    const headerMemoDbIds = {};

    for (const item of memoItems) {
      const isHeader = item.is_header || 0;
      const dupKey = `${paperCode}:${item.question_number}:1`;
      if (insertedMemoKeys.has(dupKey)) continue;
      insertedMemoKeys.add(dupKey);

      let parentHeaderId = null;
      if (!isHeader && item.parent_header_q && headerMemoDbIds[item.parent_header_q]) {
        parentHeaderId = headerMemoDbIds[item.parent_header_q];
      }

      let imagesJson = '[]';
      const memoImageMetadata = item.memo_image_metadata || [];
      if (memoImageMetadata.length > 0) {
        imagesJson = JSON.stringify(memoImageMetadata.map(img => ({
          image_id: img.image_id || null,
          file_path: img.file_path || img,
          file_name: img.file_name || path.basename(img.file_path || img),
          page_num: img.page_num || 0
        })));
      }

      const [insertResult] = await connection.execute(
        `INSERT INTO parse_memos 
         (session_id, paper_code, question_number, question_text, answer_text,
          parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status,
          is_header, parent_header_id, images, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          paperCode,
          item.question_number,
          item.question_text || null,
          item.answer_text || null,
          item.memo_marks || item.final_marks || 0,
          item.expected_marks || item.final_marks || 0,
          item.final_marks || 0,
          item.confidence === 'green' ? 'auto_corrected' : 'manual_review',
          isHeader,
          parentHeaderId,
          imagesJson,
          now,
          now
        ]
      );

      if (isHeader) {
        headerMemoDbIds[item.question_number] = insertResult.insertId;
      }
    }

    // Update parent_header_id for sub-items
    for (const [headerQ, headerId] of Object.entries(headerDbIds)) {
      await connection.execute(
        'UPDATE parse_results SET parent_header_id = ? WHERE session_id = ? AND question_number LIKE ? AND question_number != ? AND parent_header_id IS NULL',
        [headerId, sessionId, headerQ + '.%', headerQ]
      );
    }
    for (const [headerQ, headerId] of Object.entries(headerMemoDbIds)) {
      await connection.execute(
        'UPDATE parse_memos SET parent_header_id = ? WHERE session_id = ? AND question_number LIKE ? AND question_number != ? AND parent_header_id IS NULL',
        [headerId, sessionId, headerQ + '.%', headerQ]
      );
    }

    res.json({
      success: true,
      sessionId,
      paperCode,
      dimensions: resolvedDims,
      parserResult: {
        matched: parseResult.matched || 0,
        qp_only: parseResult.qp_only || 0,
        memo_only: parseResult.memo_only || 0,
        total_marks: parseResult.total_marks || 0,
        green_count: parseResult.green_count || 0,
        yellow_count: parseResult.yellow_count || 0,
        red_count: parseResult.red_count || 0
      },
      attachmentsInserted: totalAttachments,
      qpItemsInserted: allItems.length,
      memoItemsInserted: memoItems.length
    });

  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  } finally {
    connection.release();
  }
});

module.exports = router;
