// ============================================================================
// QBank Wizard Parser v3 - FIXED
// Fixes: Dimension extraction from paper_code, image storage in INSERT
// Location: routes/v3/parser.js
// ============================================================================

const express = require('express');
const router = express.Router();
const db = require('../../backend/db');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
const PARSER_OUTPUT_DIR = path.join(UPLOADS_DIR, 'parser_output');

// Ensure directories exist
if (!fs.existsSync(PARSER_OUTPUT_DIR)) {
  fs.mkdirSync(PARSER_OUTPUT_DIR, { recursive: true });
}

// ============================================================================
// DIMENSION EXTRACTION FROM PAPER_CODE
// ============================================================================

/**
 * Extract dimensions from paper_code string
 * Format: SUBJECT_P{NO}_{YEAR}_{SESSION}_{LANGUAGE}
 * Example: ACCO_P1_2025_NOV_ENG
 */
function extractDimensionsFromPaperCode(paperCode) {
  if (!paperCode) return null;

  const parts = paperCode.split('_');
  if (parts.length < 5) return null;

  // Extract subject code (everything before _P{NO})
  let subjectCode = '';
  let paperNo = '1';
  let subjectParts = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const paperMatch = part.match(/^P(\d)$/i);

    if (paperMatch) {
      paperNo = paperMatch[1];
      // Remaining parts after P{NO}
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

/**
 * Resolve dimensions from database using paper_code
 */
async function resolveDimensionsFromPaperCode(paperCode, connection) {
  const dims = extractDimensionsFromPaperCode(paperCode);
  if (!dims) return null;

  const { subjectCode, year, paperNo } = dims;

  // Resolve subject
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

  // Resolve year
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

  // Resolve paper
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

/**
 * Verify frontend dimensions against paper_code
 * Returns corrected dimensions or throws error
 */
async function verifyDimensions(paperCode, frontendDims, connection) {
  const fromCode = await resolveDimensionsFromPaperCode(paperCode, connection);

  if (!fromCode) {
    throw new Error(`Could not extract dimensions from paper_code: ${paperCode}`);
  }

  // If frontend dimensions are provided, validate against paper_code
  if (frontendDims) {
    const mismatches = [];

    if (frontendDims.year && fromCode.year && frontendDims.year !== fromCode.year) {
      mismatches.push(`Year mismatch: frontend=${frontendDims.year}, paper_code=${fromCode.year}`);
    }
    if (frontendDims.paperNo && fromCode.paperNo && frontendDims.paperNo !== fromCode.paperNo) {
      mismatches.push(`Paper mismatch: frontend=${frontendDims.paperNo}, paper_code=${fromCode.paperNo}`);
    }
    if (frontendDims.language && fromCode.language && frontendDims.language !== fromCode.language) {
      mismatches.push(`Language mismatch: frontend=${frontendDims.language}, paper_code=${fromCode.language}`);
    }

    if (mismatches.length > 0) {
      console.warn('Dimension mismatches:', mismatches);
      // Use paper_code values as authoritative
    }
  }

  return fromCode;
}

// ============================================================================
// IMAGE HANDLING
// ============================================================================

/**
 * Collect images from parser output directory
 */
function collectImages(paperCode, outputDir) {
  const images = [];
  const paperDir = path.join(outputDir || PARSER_OUTPUT_DIR, paperCode);

  if (!fs.existsSync(paperDir)) return images;

  const files = fs.readdirSync(paperDir);
  for (const file of files) {
    if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
      images.push({
        filename: file,
        path: path.join(paperDir, file),
        relativePath: path.join(paperCode, file).replace(/\\/g, '/')
      });
    }
  }

  return images;
}

// ============================================================================
// MAIN PARSER ROUTE
// ============================================================================

router.post('/parse', async (req, res) => {
  const { 
    filePath, 
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
    // Verify dimensions from paper_code (authoritative)
    const frontendDims = { subjectId, yearId, paperId, language, sessionType };
    const resolvedDims = await verifyDimensions(paperCode, frontendDims, connection);

    // Create parse session
    const [sessionResult] = await connection.execute(
      `INSERT INTO parse_sessions 
       (paper_code, subject_id, year_id, paper_id, language, session_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'parsed', NOW(), NOW())`,
      [
        paperCode,
        resolvedDims.resolvedSubjectId,
        resolvedDims.resolvedYearId,
        resolvedDims.resolvedPaperId,
        resolvedDims.language,
        resolvedDims.session
      ]
    );

    const sessionId = sessionResult.insertId;

    // Run parser (Python script)
    const outputDir = path.join(PARSER_OUTPUT_DIR, paperCode);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // ... parser execution logic ...
    // After parsing, collect images
    const images = collectImages(paperCode, outputDir);

    // Insert results with images
    if (isMemo) {
      await connection.execute(
        `INSERT INTO parse_memos 
         (session_id, paper_code, question_number, memo_text, marks, 
          images, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [sessionId, paperCode, '1', 'Parsed memo text', 0, JSON.stringify(images)]
      );
    } else {
      await connection.execute(
        `INSERT INTO parse_results 
         (session_id, paper_code, question_number, question_text, marks, 
          answer_text, topic_id, subtopic_id, images, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [sessionId, paperCode, '1', 'Parsed question text', 0, 'Parsed answer', null, null, JSON.stringify(images)]
      );
    }

    res.json({
      success: true,
      sessionId,
      paperCode,
      dimensions: resolvedDims,
      images: images.length
    });

  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
