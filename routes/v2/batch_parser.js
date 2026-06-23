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
  const clean = base.replace(/ Eng$/i, '').trim();
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
  const subjectAlpha = subjectName.toUpperCase().replace(/\s+/g, '').substring(0, 4);
  const paperCode = `${subjectAlpha}_P${paperNo || 1}_${year || 'XXXX'}_NOV`;
  return { subject_name: subjectName, subject_alpha: subjectAlpha, paper_no: paperNo, year: year, paper_code: paperCode, session_name: 'Nov', base_name: clean };
}

function pairFiles(folderPath) {
  const files = fs.readdirSync(folderPath).filter(f => f.toLowerCase().endsWith('.pdf')).map(f => ({ name: f, fullPath: path.join(folderPath, f) }));
  const qps = files.filter(f => f.name.toLowerCase().includes(' eng.pdf') && !f.name.toLowerCase().includes(' mg '));
  const memos = files.filter(f => f.name.toLowerCase().includes(' mg ') || f.name.toLowerCase().includes(' memo') || f.name.toLowerCase().includes(' marking'));
  const pairs = [];
  const unmatched = [];
  for (const qp of qps) {
    const qpBase = qp.name.replace(/ Eng\.pdf$/i, '').trim();
    const memo = memos.find(m => {
      const mName = m.name.toLowerCase();
      const qpName = qp.name.toLowerCase().replace(' eng.pdf', '');
      return mName.includes(qpName.replace(' eng', '').toLowerCase()) || mName.includes(qpBase.toLowerCase().replace(' eng', ''));
    });
    if (memo) {
      pairs.push({ qp, memo, dimensions: extractDimensionsFromFilename(qp.name) });
    } else {
      unmatched.push({ qp, reason: 'No matching memo found' });
    }
  }
  for (const memo of memos) {
    const hasPair = pairs.some(p => p.memo.name === memo.name);
    if (!hasPair) unmatched.push({ memo, reason: 'No matching QP found' });
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
          const [subjectRows] = await db.execute('SELECT subject_id FROM lookup_subjects WHERE UPPER(subject_alpha_code) = UPPER(?) OR UPPER(subject_name) = UPPER(?) LIMIT 1', [dimensions.subject_alpha, dimensions.subject_name]);
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
          [sessionId, yearId, gradeId, subjectId, paperId, assessmentTypeId, assessmentBodyId, `${paperCode}_QP_Memo.pdf`, crypto.createHash('sha256').update(paperCode).digest('hex').substring(0, 64), 'v30-batch', totalItems, totalMarks, 150, totalMarks, greenCount, 0, totalItems - greenCount, 'imported', null, now, now, paperCode, 0]
        );

        const items = [
          ...(parseResult.green_items || []),
          ...(parseResult.yellow_items || []),
          ...(parseResult.red_items || []),
          ...(parseResult.qp_only_items || [])
        ];
        for (const item of items) {
          await db.execute(
            `INSERT INTO parse_results (session_id, paper_code, question_number, question_text, answer_text, parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, is_memo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, paperCode, item.question_number, item.question_text || null, item.answer_text || null, null, item.section || null, item.qp_marks || item.final_marks || 0, item.expected_marks || item.final_marks || 0, item.final_marks || 0, item.confidence === 'green' ? 'auto_corrected' : 'manual_review', item.final_marks || 0, item.notes || null, 0, now, now]
          );
        }

        const memoItems = [
          ...(parseResult.green_items || []),
          ...(parseResult.yellow_items || []),
          ...(parseResult.red_items || []),
          ...(parseResult.memo_only_items || [])
        ];
        for (const item of memoItems) {
          await db.execute(
            `INSERT INTO parse_memos (session_id, paper_code, question_number, question_text, answer_text, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, user_corrected_marks, reviewer_notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, paperCode, item.question_number, item.question_text || null, item.answer_text || null, item.memo_marks || item.final_marks || 0, item.expected_marks || item.final_marks || 0, item.final_marks || 0, item.confidence === 'green' ? 'auto_corrected' : 'manual_review', item.final_marks || 0, item.notes || null, now, now]
          );
        }

        results.push({ paper_code: paperCode, subject: dimensions.subject_name, paper_no: dimensions.paper_no, year: dimensions.year, items: totalItems, marks: totalMarks, green: greenCount, session_id: sessionId, status: 'success' });
      } catch (e) {
        failures.push({ paper_code: paperCode, subject: dimensions.subject_name, qp: qp.name, memo: memo.name, error: e.message });
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
    const [rows] = await db.execute(`SELECT paper_code, status, total_items_found, total_marks_parser, auto_corrected_count, created_at FROM parse_sessions WHERE parser_version = 'v30-batch' ORDER BY created_at DESC LIMIT 50`);
    res.json({ success: true, batches: rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;

