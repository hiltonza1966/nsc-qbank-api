const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'parser_debug.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = '[' + timestamp + '] ' + msg + '\n';
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function clearLog() {
  fs.writeFileSync(LOG_FILE, 'Parser Debug Log - ' + new Date().toISOString() + '\n');
}

/**
 * Extract marks from a block of text
 * PRIORITY: Item-level marks before section totals
 */
function extractMarksFromBlock(text, questionNumber) {
  // Priority 1: Batch marks with total: (10x 2)(20) or (8x 1)(8)
  const batchTotalMatch = text.match(/\((\d+)\s*x\s*(\d+)\)\s*\((\d+)\)/);
  if (batchTotalMatch) {
    return { marks: parseInt(batchTotalMatch[3]), confidence: 'high', pattern: 'batch_total' };
  }

  // Priority 2: Look for item total (number) BEFORE section total [number]
  // Find all (number) and [number] patterns
  const parenMatches = [...text.matchAll(/\((\d+)\)/g)];
  const bracketMatches = [...text.matchAll(/\[(\d+)\]/g)];
  
  if (parenMatches.length > 0 && bracketMatches.length > 0) {
    // Get positions of last parenthesis match and first bracket match
    const lastParen = parenMatches[parenMatches.length - 1];
    const firstBracket = bracketMatches[0];
    
    const lastParenIndex = lastParen.index;
    const firstBracketIndex = firstBracket.index;
    
    // If last (number) appears BEFORE first [number], it's the item total
    if (lastParenIndex < firstBracketIndex) {
      const marks = parseInt(lastParen[1]);
      if (marks <= 25) {
        return { marks: marks, confidence: 'high', pattern: 'item_total_before_section' };
      }
    }
  }

  // Priority 3: Last (number) if no brackets found
  if (parenMatches.length > 0) {
    const lastMatch = parenMatches[parenMatches.length - 1];
    const marks = parseInt(lastMatch[1]);
    if (marks <= 25) {
      return { marks: marks, confidence: 'high', pattern: 'item_total_last' };
    }
  }

  // Priority 4: Single (number) at end
  const singleMatch = text.match(/\((\d+)\)\s*$/);
  if (singleMatch) {
    const marks = parseInt(singleMatch[1]);
    if (marks <= 25) {
      return { marks: marks, confidence: 'medium', pattern: 'single' };
    }
  }

  // Priority 5: Section total [number] - skip if > 25
  const sectionMatch = text.match(/\[(\d+)\]/);
  if (sectionMatch) {
    const marks = parseInt(sectionMatch[1]);
    log('  WARNING: Section total [' + marks + '] found for ' + questionNumber + ' - using 0');
    return { marks: 0, confidence: 'low', pattern: 'section_total_skipped' };
  }

  return { marks: 0, confidence: 'low', pattern: 'none' };
}

/**
 * Parse structured text from pdf.js getTextContent()
 */
function parseStructuredText(textItems, type, subject, paperNo) {
  clearLog();
  log('=== PARSER START (Item Total Before Section) ===');
  log('Input: ' + textItems.length + ' text items');

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

  log('Grouped into ' + lines.length + ' lines');

  // Step 3: First pass - detect ALL question numbers and their positions
  const questionPositions = [];
  let currentSection = 'Section A';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();

    // Detect section headers
    const sectionMatch = text.match(/SECTION\s+([A-Z])/i);
    if (sectionMatch) {
      currentSection = 'Section ' + sectionMatch[1];
      log('>>> SECTION HEADER: ' + currentSection);
      continue;
    }

    // Detect Question 2 / Question 3 headers
    if (text.match(/^QUESTION\s*2\b/i)) {
      currentSection = 'Section B';
      log('>>> QUESTION 2 HEADER -> Section B');
      continue;
    }
    if (text.match(/^QUESTION\s*3\b/i)) {
      currentSection = 'Section C';
      log('>>> QUESTION 3 HEADER -> Section C');
      continue;
    }

    // Match question number pattern at start of line
    const qMatch = text.match(/^(\d+\.\d+(?:\.\d+)?)\s*(.*)/);
    if (qMatch) {
      const qnum = qMatch[1];
      const rest = qMatch[2];
      const parts = qnum.split('.');
      const majorQuestion = parseInt(parts[0]);

      // Infer section from major question number
      if (majorQuestion === 2 && currentSection === 'Section A') {
        currentSection = 'Section B';
        log('>>> INFERRED Section B from question ' + qnum);
      }
      if (majorQuestion === 3 && currentSection !== 'Section C') {
        currentSection = 'Section C';
        log('>>> INFERRED Section C from question ' + qnum);
      }

      questionPositions.push({
        number: qnum,
        text: rest,
        fullText: text,
        section: currentSection,
        lineIndex: i,
        parts: parts
      });
    }
  }

  log('Detected ' + questionPositions.length + ' question positions');

  // Step 4: Identify parent questions (X.Y) and their sub-parts (X.Y.Z)
  const parentNumbers = new Set();
  for (const q of questionPositions) {
    if (q.parts.length === 3) {
      parentNumbers.add(q.parts[0] + '.' + q.parts[1]);
    }
  }
  log('Parent numbers with sub-parts: ' + Array.from(parentNumbers).join(', '));

  // Step 5: Extract marks for each parent question from its block
  const parentMarks = {};

  for (let i = 0; i < questionPositions.length; i++) {
    const q = questionPositions[i];
    const parts = q.parts;

    // Only process parent-level questions (X.Y)
    if (parts.length === 2) {
      const parentNum = q.number;
      
      // Find the next parent or section boundary
      let endIndex = lines.length;
      for (let j = i + 1; j < questionPositions.length; j++) {
        const nextQ = questionPositions[j];
        if (nextQ.parts.length === 2) {
          endIndex = nextQ.lineIndex;
          break;
        }
      }

      // Extract text block from this parent to next parent
      let blockText = '';
      for (let k = q.lineIndex; k < endIndex && k < lines.length; k++) {
        blockText += lines[k].text + ' ';
      }

      // Extract marks from this block
      const marksResult = extractMarksFromBlock(blockText, parentNum);
      parentMarks[parentNum] = marksResult;
      
      log('  PARENT ' + parentNum + ' marks: ' + marksResult.marks + ' (confidence: ' + marksResult.confidence + ', pattern: ' + marksResult.pattern + ')');
    }
  }

  // Step 6: Build atomic items
  const atomicItems = [];
  const parentItems = {};
  const standaloneItems = [];
  let sequence = 1;

  // Categorize each detected question
  for (const q of questionPositions) {
    const parts = q.parts;

    if (parts.length === 3) {
      const parentNum = parts[0] + '.' + parts[1];
      
      if (parentNumbers.has(parentNum)) {
        if (!parentItems[parentNum]) {
          parentItems[parentNum] = {
            text: '',
            subParts: [],
            section: q.section,
            marks: 0
          };
        }
        parentItems[parentNum].subParts.push({
          number: q.number,
          text: q.text,
          section: q.section
        });
      }
    } else if (parts.length === 2) {
      const parentNum = q.number;
      
      if (parentNumbers.has(parentNum)) {
        if (!parentItems[parentNum]) {
          parentItems[parentNum] = {
            text: q.text,
            subParts: [],
            section: q.section,
            marks: parentMarks[parentNum] ? parentMarks[parentNum].marks : 0
          };
        } else {
          parentItems[parentNum].text = q.text;
          parentItems[parentNum].marks = parentMarks[parentNum] ? parentMarks[parentNum].marks : 0;
        }
      } else {
        const marksResult = parentMarks[parentNum] || { marks: 0, confidence: 'low' };
        standaloneItems.push({
          number: q.number,
          text: q.text,
          section: q.section,
          marks: marksResult.marks,
          marksConfidence: marksResult.confidence
        });
      }
    }
  }

  // Build final items
  for (const [parentNum, parentInfo] of Object.entries(parentItems)) {
    const parts = parentNum.split('.');
    const isStandaloneParent = ['1.1', '1.2', '1.3'].includes(parentNum);
    
    if (isStandaloneParent) {
      const parentMarks = parentInfo.marks;
      const subPartCount = parentInfo.subParts.length;
      const marksPerSubPart = subPartCount > 0 && parentMarks > 0 ? Math.floor(parentMarks / subPartCount) : 0;
      
      for (const sp of parentInfo.subParts.sort((a, b) => a.number.localeCompare(b.number))) {
        let itemType = 'Extended';
        if (parentNum === '1.1') itemType = 'MCQ';
        else if (parentNum === '1.2') itemType = 'Short';
        else if (parentNum === '1.3') itemType = 'Matching';

        atomicItems.push({
          question_number: sp.number,
          question_text: sp.text,
          marks: marksPerSubPart,
          section: sp.section,
          type: itemType,
          sequence: sequence++,
          images: [],
          parent: null,
          sub_parts: [],
          has_sub_parts: false,
          is_standalone: true
        });
        
        log('  STANDALONE ITEM ' + sp.number + ' | ' + itemType + ' | ' + sp.section + ' | Marks: ' + marksPerSubPart);
      }
    } else {
      let itemType = 'Extended';
      if (parts[0] === '1') itemType = 'Diagram';

      let fullText = parentInfo.text || '';
      if (parentInfo.subParts.length > 0) {
        fullText += '\n\nSub-parts:\n';
        for (const sp of parentInfo.subParts.sort((a, b) => a.number.localeCompare(b.number))) {
          fullText += '[' + sp.number + '] ' + sp.text + '\n';
        }
      }

      atomicItems.push({
        question_number: parentNum,
        question_text: fullText,
        marks: parentInfo.marks,
        section: parentInfo.section,
        type: itemType,
        sequence: sequence++,
        images: [],
        parent: null,
        sub_parts: parentInfo.subParts.map(sp => sp.number),
        has_sub_parts: parentInfo.subParts.length > 0,
        is_standalone: false
      });

      log('  PARENT ITEM ' + parentNum + ' | ' + itemType + ' | ' + parentInfo.section + ' | Marks: ' + parentInfo.marks + ' | ' + parentInfo.subParts.length + ' sub-parts');
    }
  }

  // Add standalone parents
  for (const item of standaloneItems) {
    let itemType = 'Extended';
    const parts = item.number.split('.');
    if (parts[0] === '1') itemType = 'Diagram';

    atomicItems.push({
      question_number: item.number,
      question_text: item.text,
      marks: item.marks,
      section: item.section,
      type: itemType,
      sequence: sequence++,
      images: [],
      parent: null,
      sub_parts: [],
      has_sub_parts: false,
      is_standalone: true
    });

    log('  STANDALONE PARENT ' + item.number + ' | ' + itemType + ' | ' + item.section + ' | Marks: ' + item.marks);
  }

  // Sort by sequence
  atomicItems.sort((a, b) => a.sequence - b.sequence);
  
  sequence = 1;
  for (const item of atomicItems) {
    item.sequence = sequence++;
  }

  const totalMarks = atomicItems.reduce((sum, item) => sum + item.marks, 0);

  log('\n=== ATOMIC ITEMS: ' + atomicItems.length + ' ===');
  log('  Standalone: ' + atomicItems.filter(i => i.is_standalone).length);
  log('  Parent (grouped): ' + atomicItems.filter(i => !i.is_standalone).length);
  log('  Section A: ' + atomicItems.filter(i => i.section === 'Section A').length);
  log('  Section B: ' + atomicItems.filter(i => i.section === 'Section B').length);
  log('  Section C: ' + atomicItems.filter(i => i.section === 'Section C').length);
  log('  TOTAL MARKS: ' + totalMarks);
  log('=== PARSER END ===\n');

  return atomicItems;
}

// ============================================
// ROUTE: POST /api/wizard/parse
// ============================================
router.post('/parse', (req, res) => {
  try {
    const { textItems, type, subject, paper_no } = req.body;
    
    if (!Array.isArray(textItems)) {
      return res.status(400).json({ error: 'textItems array required' });
    }

    const questions = parseStructuredText(textItems, type || 'QP', subject, paper_no);
    const totalMarks = questions.reduce((sum, item) => sum + item.marks, 0);
    
    res.json({
      success: true,
      questions: questions,
      total_items: questions.length,
      total_marks: totalMarks,
      note: 'Dynamic extraction with item-total marks. Total marks found: ' + totalMarks
    });

  } catch (error) {
    console.error('Parse error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTE: POST /api/wizard/extract-structure
// ============================================
router.post('/extract-structure', async (req, res) => {
  const conn = await req.db.getConnection();
  
  try {
    const { textItems, paper_code, subject_name, paper_no, exam_year, exam_session } = req.body;
    
    if (!Array.isArray(textItems) || !paper_code) {
      return res.status(400).json({ error: 'textItems and paper_code required' });
    }

    const questions = parseStructuredText(textItems, 'QP', subject_name, paper_no);
    const totalMarks = questions.reduce((sum, item) => sum + item.marks, 0);
    
    await conn.beginTransaction();

    // Clear existing structure for this paper
    await conn.execute(
      'DELETE FROM parse_expected_structure WHERE paper_code = ?',
      [paper_code]
    );

    // Insert detected items WITH EXTRACTED MARKS
    let sequence = 1;
    for (const q of questions) {
      // Map question type string to ID
      const typeMap = { 'MCQ': 1, 'Short': 2, 'Matching': 3, 'Diagram': 4, 'Extended': 5 };
      const questionTypeId = typeMap[q.type] || 5;

      await conn.execute(
        'INSERT INTO parse_expected_structure ' +
        '(paper_code, question_number, question_type_id, section, expected_marks, sequence, parent_question, is_sub_part) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          paper_code, q.question_number, questionTypeId, q.section, q.marks, sequence++, q.parent || null, q.has_sub_parts ? 1 : 0
        ]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      total_items: questions.length,
      total_marks: totalMarks,
      message: 'Structure extracted: ' + questions.length + ' items, ' + totalMarks + ' marks found from PDF.'
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
