const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'parser_debug.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function clearLog() {
  fs.writeFileSync(LOG_FILE, `Parser Debug Log - ${new Date().toISOString()}\n`);
}

/**
 * Parse structured text from pdf.js getTextContent()
 * SIMPLIFIED: Extracts question numbers and text only
 * Marks come from QB_questionP_Structure (database), NOT parser
 */
function parseStructuredText(textItems, type, subject, paperNo) {
  clearLog();
  log(`=== PARSER START ===`);
  log(`Input: ${textItems.length} text items`);

  // Step 1: Sort items by page, then y (descending), then x (ascending)
  const sorted = [...textItems].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
    return a.x - b.x;
  });

  // Step 2: Group items into lines by y-position proximity
  const lines = [];
  let currentLine = [];
  let currentY = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) < 5) {
      currentLine.push(item);
      currentY = item.y;
    } else {
      if (currentLine.length > 0) {
        currentLine.sort((a, b) => a.x - b.x);
        const lineText = currentLine.map(i => i.text).join(' ');
        lines.push({
          text: lineText,
          y: currentY,
          page: currentLine[0].page,
          items: currentLine
        });
      }
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    const lineText = currentLine.map(i => i.text).join(' ');
    lines.push({
      text: lineText,
      y: currentY,
      page: currentLine[0].page,
      items: currentLine
    });
  }

  log(`Grouped into ${lines.length} lines`);

  // Step 3: Extract question items (numbers and text only, NO marks)
  const rawItems = [];
  let currentSection = 'Section A';
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();

    // Detect section headers
    const sectionMatch = text.match(/SECTION\s+([A-Z])/i);
    if (sectionMatch) {
      currentSection = 'Section ' + sectionMatch[1];
      currentQuestion = null;
      log(`>>> SECTION: ${currentSection}`);
      continue;
    }

    // Detect Question 2 / Question 3 headers
    if (text.match(/QUESTION\s*2/i)) {
      currentQuestion = 'Q2';
      log(`>>> QUESTION 2`);
      continue;
    }
    if (text.match(/QUESTION\s*3/i)) {
      currentQuestion = 'Q3';
      log(`>>> QUESTION 3`);
      continue;
    }

    // Detect sub-part questions: 1.1.1, 2.1.1, 3.1.1 etc.
    const subPartMatch = text.match(/^(\d+\.\d+\.\d+)\s+(.+)/);
    if (subPartMatch) {
      const qnum = subPartMatch[1];
      const rest = subPartMatch[2];
      const parts = qnum.split('.');

      if (parts.length === 3) {
        // Determine type from section and number pattern
        let itemType = 'Extended';
        if (parts[0] === '1') {
          if (parts[1] === '1') itemType = 'MCQ';
          else if (parts[1] === '2') itemType = 'Short';
          else if (parts[1] === '3') itemType = 'Matching';
          else itemType = 'Diagram';
        }

        rawItems.push({
          question_number: qnum,
          question_text: rest,
          marks: 0, // Marks come from database, NOT parser
          section: currentSection,
          type: itemType,
          parent: parts[0] + '.' + parts[1]
        });
      }
      continue;
    }

    // Detect parent questions: 1.1, 2.1, 3.1 etc. (no sub-parts)
    const parentMatch = text.match(/^(\d+\.\d+)\s+(.+)/);
    if (parentMatch) {
      const parentNum = parentMatch[1];
      const parts = parentNum.split('.');
      if (parts.length === 2) {
        // Check if next lines have sub-parts
        let hasSubParts = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].text.match(new RegExp(`^${parentNum}\\.\\d+`))) {
            hasSubParts = true;
            break;
          }
        }

        if (!hasSubParts) {
          // This is a standalone parent question (like 3.3)
          let itemType = parts[0] === '1' ? 'Diagram' : 'Extended';
          rawItems.push({
            question_number: parentNum,
            question_text: parentMatch[2],
            marks: 0,
            section: currentSection,
            type: itemType,
            parent: null
          });
          log(`  STANDALONE PARENT ${parentNum}: no sub-parts`);
        }
      }
    }
  }

  log(`\n=== RAW ITEMS: ${rawItems.length} ===`);

  // Step 4: Build final items
  const finalItems = [];
  let sequence = 1;

  for (const item of rawItems) {
    finalItems.push({
      question_number: item.question_number,
      question_text: item.question_text,
      marks: 0, // NO marks from parser - will be auto-corrected by compare-qp
      section: item.section,
      type: item.type,
      sequence: sequence++,
      images: [],
      parent: item.parent
    });
  }

  log(`=== PARSER END: ${finalItems.length} items ===\n`);
  return finalItems;
}

// ============================================
// ROUTE: POST /api/wizard/parse
// Body: { textItems: [...], type: 'QP', subject: 'LIFE_SC', paper_no: 'P1' }
// ============================================
router.post('/parse', (req, res) => {
  try {
    const { textItems, type, subject, paper_no } = req.body;
    
    if (!Array.isArray(textItems)) {
      return res.status(400).json({ error: 'textItems array required' });
    }

    const questions = parseStructuredText(textItems, type || 'QP', subject, paper_no);
    
    res.json({
      success: true,
      questions: questions,
      total_items: questions.length,
      note: 'Marks are placeholder (0) - will be auto-corrected by comparison engine'
    });

  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTE: POST /api/wizard/extract-structure
// Saves detected structure to QB_questionP_Structure
// ============================================
router.post('/extract-structure', async (req, res) => {
  const conn = await req.db.getConnection();
  
  try {
    const { textItems, paper_code, subject_name, paper_no, exam_year, exam_session } = req.body;
    
    if (!Array.isArray(textItems) || !paper_code) {
      return res.status(400).json({ error: 'textItems and paper_code required' });
    }

    // Parse to get question numbers
    const questions = parseStructuredText(textItems, 'QP', subject_name, paper_no);
    
    await conn.beginTransaction();

    // Clear existing structure for this paper
    await conn.execute(
      'DELETE FROM QB_questionP_Structure WHERE paper_code = ?',
      [paper_code]
    );

    // Insert detected structure (marks will be set to 0, user must correct via ReviewPanel)
    let sequence = 1;
    for (const q of questions) {
      const parts = q.question_number.split('.');
      const isSubPart = parts.length === 3;
      const parentQuestion = isSubPart ? parts[0] + '.' + parts[1] : null;

      await conn.execute(
        `INSERT INTO QB_questionP_Structure 
         (paper_code, subject_name, paper_no, exam_year, exam_session, 
          question_number, question_type, section, expected_marks, sequence, 
          parent_question, is_sub_part)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          paper_code, subject_name, paper_no, exam_year, exam_session,
          q.question_number, q.type, q.section, 0, sequence++,
          parentQuestion, isSubPart
        ]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      total_items: questions.length,
      total_marks: 0,
      message: 'Structure extracted. Marks are set to 0 - use ReviewPanel to set correct marks.'
    });

  } catch (error) {
    await conn.rollback();
    console.error('Extract structure error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
