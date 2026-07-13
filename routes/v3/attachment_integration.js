const express = require('express');
const router = express.Router();
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const PARSERS_DIR = path.join(__dirname, '..', '..', 'backend', 'parsers');

// ============================================
// HELPER: Run Python attachment parser
// ============================================
function runAttachmentParser(pdfPath, paperCode, anchors, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const args = [
      '-u',
      path.join(PARSERS_DIR, 'attachment_parser.py'),
      '--json-mode',
      '--pdf', pdfPath,
      '--paper-code', paperCode
    ];

    const child = spawn(pythonPath, args, {
      cwd: PARSERS_DIR,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 2000);
      reject(new Error(`Attachment parser timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    // Send anchors as JSON to stdin
    if (anchors && anchors.length > 0) {
      child.stdin.write(JSON.stringify(anchors));
    }
    child.stdin.end();

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code !== 0) {
        reject(new Error(`Attachment parser exited with code ${code}. stderr: ${stderr.substring(0, 500)}`));
        return;
      }
      try {
        const marker = 'ATTACHMENT_JSON_OUTPUT:';
        const idx = stdout.lastIndexOf(marker);
        if (idx === -1) {
          reject(new Error(`No ATTACHMENT_JSON_OUTPUT marker found. stdout: ${stdout.substring(0, 500)}`));
          return;
        }
        const jsonStr = stdout.substring(idx + marker.length).trim();
        const result = JSON.parse(jsonStr);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse attachment parser output: ${e.message}. stdout: ${stdout.substring(0, 500)}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start attachment parser: ${err.message}`));
    });
  });
}

// ============================================
// HELPER: Extract anchors from parse_results
// ============================================
async function extractAnchorsFromDb(db, sessionId) {
  const [rows] = await db.execute(
    `SELECT question_number, is_header, header_level, parent_header_id
     FROM parse_results
     WHERE session_id = ? AND is_memo = 0
     ORDER BY question_number`,
    [sessionId]
  );

  const anchors = [];
  for (const row of rows) {
    const qn = row.question_number;
    const parts = String(qn).split('.');
    const isHeader = row.is_header || (parts.length === 2 && !qn.includes('.'));
    const headerLevel = row.header_level || parts.length;

    let parentQuestion = null;
    let hasSubItems = false;

    if (parts.length > 2) {
      parentQuestion = parts.slice(0, 2).join('.');
    } else if (parts.length === 2) {
      // Check if any sub-items exist
      hasSubItems = rows.some(r => 
        String(r.question_number).startsWith(qn + '.') && 
        r.question_number !== qn
      );
    }

    anchors.push({
      question_number: qn,
      page_number: 0,  // Will be filled by attachment_parser.py extract_anchors
      y_position: 0,
      x_position: 0,
      is_header: isHeader,
      header_level: headerLevel,
      parent_question: parentQuestion,
      has_sub_items: hasSubItems
    });
  }

  return anchors;
}

// ============================================
// HELPER: Build result_id map by question number
// ============================================
async function buildResultIdMap(db, sessionId) {
  const [qpRows] = await db.execute(
    `SELECT result_id, question_number FROM parse_results WHERE session_id = ? AND is_memo = 0`,
    [sessionId]
  );
  const [memoRows] = await db.execute(
    `SELECT memo_id, question_number FROM parse_memos WHERE session_id = ?`,
    [sessionId]
  );

  const qpMap = new Map();
  const memoMap = new Map();

  for (const row of qpRows) {
    qpMap.set(row.question_number, row.result_id);
  }
  for (const row of memoRows) {
    memoMap.set(row.question_number, row.memo_id);
  }

  return { qpMap, memoMap };
}

// ============================================
// MAIN: Integrate attachments for a session
// ============================================
async function integrateAttachments(db, sessionId, paperCode, qpPdfPath, memoPdfPath) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let totalInserted = 0;
  let totalSkipped = 0;
  const errors = [];

  console.log(`[AttachmentIntegration] Starting for session ${sessionId}, paper ${paperCode}`);

  // 1. Get anchors from DB (parse_results already have question numbers)
  const anchors = await extractAnchorsFromDb(db, sessionId);
  console.log(`[AttachmentIntegration] Extracted ${anchors.length} anchors from DB`);

  // 2. Build result_id maps
  const { qpMap, memoMap } = await buildResultIdMap(db, sessionId);

  // 3. Process QP PDF
  if (qpPdfPath && fs.existsSync(qpPdfPath)) {
    try {
      console.log(`[AttachmentIntegration] Processing QP: ${qpPdfPath}`);
      const qpResult = await runAttachmentParser(qpPdfPath, paperCode + '_QP', anchors);

      if (qpResult.success && qpResult.records) {
        const relevant = qpResult.records.filter(r => !r.is_noise);
        console.log(`[AttachmentIntegration] QP: ${relevant.length} relevant images from ${qpResult.records.length} total`);

        for (const rec of relevant) {
          const qn = rec.linked_question_number;
          const resultId = qpMap.get(qn);

          if (!resultId) {
            console.log(`[AttachmentIntegration] Warning: No result_id for QN ${qn}`);
            totalSkipped++;
            continue;
          }

          try {
            // Build metadata JSON + individual columns
            const metadataJson = JSON.stringify({
              bbox: rec.bbox || null,
              relevance_score: rec.relevance_score || 0,
              link_method: rec.link_method || '',
              is_inherited: rec.is_inherited || false,
              image_hash: rec.image_hash || '',
              aspect_ratio: rec.aspect_ratio || 0,
              file_size_kb: rec.file_size_kb || 0,
              image_width: rec.image_width || 0,
              image_height: rec.image_height || 0,
              attachment_type: rec.attachment_type || 'diagram',
              page_number: rec.page_number || 0
            });

            const bbox = rec.bbox || [null, null, null, null];

            await db.execute(
              `INSERT INTO item_attachments (
                item_id, result_id, session_id, stimulus_id, file_name, file_path,
                file_size, mime_type, attachment_type, question_number, is_extracted,
                extracted_at, pdf_page_number, image_index, description, display_order,
                attachment_metadata_json,
                bbox_x0, bbox_y0, bbox_x1, bbox_y1,
                relevance_score, link_method, image_hash
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                null,                       // item_id - set during promotion
                resultId,                   // result_id - link to parse_results
                sessionId,                  // session_id
                null,                       // stimulus_id
                rec.file_name,              // file_name
                rec.file_path,              // file_path
                Math.round(rec.file_size_kb * 1024),  // file_size
                'image/png',                // mime_type
                rec.attachment_type || 'diagram',  // attachment_type
                qn,                         // question_number
                1,                          // is_extracted
                now,                        // extracted_at
                rec.page_number || 0,       // pdf_page_number
                0,                          // image_index
                null,                       // description
                0,                          // display_order
                metadataJson,               // attachment_metadata_json
                bbox[0],                    // bbox_x0
                bbox[1],                    // bbox_y0
                bbox[2],                    // bbox_x1
                bbox[3],                    // bbox_y1
                rec.relevance_score || 0,   // relevance_score
                rec.link_method || '',      // link_method
                rec.image_hash || ''        // image_hash
              ]
            );
            totalInserted++;
          } catch (insertErr) {
            console.error(`[AttachmentIntegration] Insert error for QN ${qn}:`, insertErr.message);
            errors.push({ qn, error: insertErr.message });
          }
        }
      }
    } catch (qpErr) {
      console.error('[AttachmentIntegration] QP parser error:', qpErr.message);
      errors.push({ pdf: 'QP', error: qpErr.message });
    }
  }

  // 4. Process Memo PDF (if exists)
  if (memoPdfPath && fs.existsSync(memoPdfPath)) {
    try {
      console.log(`[AttachmentIntegration] Processing Memo: ${memoPdfPath}`);
      const memoResult = await runAttachmentParser(memoPdfPath, paperCode + '_MEMO', anchors);

      if (memoResult.success && memoResult.records) {
        const relevant = memoResult.records.filter(r => !r.is_noise);
        console.log(`[AttachmentIntegration] Memo: ${relevant.length} relevant images from ${memoResult.records.length} total`);

        for (const rec of relevant) {
          const qn = rec.linked_question_number;
          const memoId = memoMap.get(qn);

          if (!memoId) {
            totalSkipped++;
            continue;
          }

          try {
            const metadataJson = JSON.stringify({
              bbox: rec.bbox || null,
              relevance_score: rec.relevance_score || 0,
              link_method: rec.link_method || '',
              is_inherited: rec.is_inherited || false,
              image_hash: rec.image_hash || '',
              aspect_ratio: rec.aspect_ratio || 0,
              file_size_kb: rec.file_size_kb || 0,
              image_width: rec.image_width || 0,
              image_height: rec.image_height || 0,
              attachment_type: rec.attachment_type || 'diagram',
              page_number: rec.page_number || 0
            });

            const bbox = rec.bbox || [null, null, null, null];

            await db.execute(
              `INSERT INTO item_attachments (
                item_id, result_id, session_id, stimulus_id, file_name, file_path,
                file_size, mime_type, attachment_type, question_number, is_extracted,
                extracted_at, pdf_page_number, image_index, description, display_order,
                attachment_metadata_json,
                bbox_x0, bbox_y0, bbox_x1, bbox_y1,
                relevance_score, link_method, image_hash
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                null,
                memoId,                     // result_id points to memo_id for memo attachments
                sessionId,
                null,
                rec.file_name,
                rec.file_path,
                Math.round(rec.file_size_kb * 1024),
                'image/png',
                rec.attachment_type || 'diagram',
                qn,
                1,
                now,
                rec.page_number || 0,
                0,
                null,
                0,
                metadataJson,
                bbox[0],
                bbox[1],
                bbox[2],
                bbox[3],
                rec.relevance_score || 0,
                rec.link_method || '',
                rec.image_hash || ''
              ]
            );
            totalInserted++;
          } catch (insertErr) {
            console.error(`[AttachmentIntegration] Memo insert error for QN ${qn}:`, insertErr.message);
            errors.push({ qn, error: insertErr.message });
          }
        }
      }
    } catch (memoErr) {
      console.error('[AttachmentIntegration] Memo parser error:', memoErr.message);
      errors.push({ pdf: 'MEMO', error: memoErr.message });
    }
  }

  console.log(`[AttachmentIntegration] Complete: ${totalInserted} inserted, ${totalSkipped} skipped, ${errors.length} errors`);
  return { inserted: totalInserted, skipped: totalSkipped, errors };
}

// ============================================
// API ROUTE: POST /api/v3/attachments/integrate
// ============================================
router.post('/integrate', async (req, res) => {
  try {
    const { session_id, paper_code, qp_pdf_path, memo_pdf_path } = req.body;
    const db = req.db;

    if (!session_id || !paper_code || !qp_pdf_path) {
      return res.status(400).json({ success: false, error: 'session_id, paper_code, qp_pdf_path required' });
    }
    if (!db) return res.status(500).json({ success: false, error: 'Database not available' });

    const result = await integrateAttachments(db, session_id, paper_code, qp_pdf_path, memo_pdf_path);
    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[AttachmentIntegration] Route error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Attach integrateAttachments to router for batch_parser.js require
router.integrateAttachments = integrateAttachments;
module.exports = router;
