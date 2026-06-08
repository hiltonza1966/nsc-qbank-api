const express = require('express');
const router = express.Router();

// POST /api/wizard/parse-structured
// Receives structured text items with positions from pdf.js getTextContent()
// Returns parsed items with question numbers, text, marks, sections

function parseStructuredText(textItems, type, subject, paperNo) {
  // Step 1: Sort items by page, then y (descending - top to bottom), then x (ascending)
  const sorted = [...textItems].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 5) return b.y - a.y; // Larger y = higher on page (pdf coordinates)
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
        // Sort line items by x
        currentLine.sort((a, b) => a.x - b.x);
        lines.push({
          text: currentLine.map(i => i.text).join(' '),
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
    lines.push({
      text: currentLine.map(i => i.text).join(' '),
      y: currentY,
      page: currentLine[0].page,
      items: currentLine
    });
  }

  // Step 3: Detect sections and question numbers
  const items = [];
  let currentSection = 'Section A';
  let currentQuestion = null;
  let currentText = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();

    // Detect section headers
    const sectionMatch = text.match(/SECTION\s+([A-Z])/i);
    if (sectionMatch) {
      currentSection = 'Section ' + sectionMatch[1];
      continue;
    }

    // Detect question numbers
    // Pattern: X.Y.Z or X.Y at start of line (possibly with some indentation)
    const qnumMatch = text.match(/^(\d+\.\d+\.\d+|\d+\.\d+)\s+/);
    if (qnumMatch) {
      // Save previous question if exists
      if (currentQuestion) {
        items.push({
          question_number: currentQuestion.number,
          question_text: currentQuestion.text.join(' ').trim(),
          marks: currentQuestion.marks || 1,
          section: currentQuestion.section,
          type: currentQuestion.type,
          raw_lines: currentQuestion.text
        });
      }

      // Start new question
      const qnum = qnumMatch[1];
      const remainingText = text.substring(qnumMatch[0].length).trim();

      // Determine type from question number
      const parts = qnum.split('.');
      let itemType = 'Extended';
      if (parts.length === 3) {
        if (parts[0] === '1' && parts[1] === '1') itemType = 'MCQ';
        else if (parts[0] === '1') itemType = 'Short';
        else itemType = 'Sub-part';
      }

      // Extract marks from end of line
      let marks = 1;
      console.log('DEBUG: Question:', qnum, '| remainingText:', remainingText.substring(0, 80));
      const marksMatch = remainingText.match(/\((\d+)\s*x\s*(\d+)\)\s*\((\d+)\)\s*$/);
      if (marksMatch) {
        marks = parseInt(marksMatch[3]);
        console.log('DEBUG: Batch marks found:', marks, 'for', qnum);
      } else {
        const singleMarks = remainingText.match(/\((\d+)\)\s*$/);
        if (singleMarks) {
          marks = parseInt(singleMarks[1]);
          console.log('DEBUG: Single marks found:', marks, 'for', qnum);
        } else {
          console.log('DEBUG: No marks found, default 1 for', qnum);
        }
      }

      currentQuestion = {
        number: qnum,
        text: [remainingText],
        marks: marks,
        section: currentSection,
        type: itemType
      };
    } else if (currentQuestion) {
      // Add text to current question
      currentQuestion.text.push(text);
    }
  }

  // Save last question
  if (currentQuestion) {
    items.push({
      question_number: currentQuestion.number,
      question_text: currentQuestion.text.join(' ').trim(),
      marks: currentQuestion.marks || 1,
      section: currentQuestion.section,
      type: currentQuestion.type,
      raw_lines: currentQuestion.text
    });
  }

  // Step 4: Build parent-child relationships
  // For items like 2.1, 2.2, 3.1, etc. (parents), find their sub-parts (2.1.1, 2.1.2, etc.)
  const parentItems = [];
  const childItems = [];

  for (const item of items) {
    const parts = item.question_number.split('.');
    if (parts.length === 2 && parts[0] in ['2', '3']) {
      parentItems.push(item);
    } else if (parts.length === 3 && parts[0] in ['2', '3']) {
      childItems.push(item);
    } else {
      parentItems.push(item); // Standalone items (1.x.x)
    }
  }

  // Group children under parents
  for (const parent of parentItems) {
    const parentNum = parent.question_number;
    const children = childItems.filter(c => c.question_number.startsWith(parentNum + '.'));
    if (children.length > 0) {
      parent.child_sub_parts = children.map(c => ({
        number: c.question_number,
        text: c.question_text,
        marks: c.marks
      }));
      parent.marks = children.reduce((sum, c) => sum + c.marks, 0);
      parent.type = 'Extended';
    }
  }

  // Step 5: Clean up and finalize
  const finalItems = parentItems.map((item, idx) => ({
    question_number: item.question_number,
    question_text: item.question_text,
    marks: item.marks,
    section: item.section,
    type: item.type,
    sequence: idx + 1,
    images: [],
    sub_parts: [],
    child_sub_parts: item.child_sub_parts || []
  }));

  // DEBUG: Show final items with marks
  console.log('\n=== DEBUG: Final Items ===');
  finalItems.forEach(item => {
    console.log(item.question_number, '|', item.type, '| marks:', item.marks, '|', item.question_text.substring(0, 60));
  });
  console.log('Total marks:', finalItems.reduce((sum, i) => sum + i.marks, 0));
  console.log('========================\n');

  return finalItems;
}

router.post('/parse-structured', async (req, res) => {
  try {
    const { textItems, type, subject, paper_no } = req.body;

    if (!textItems || !Array.isArray(textItems) || textItems.length === 0) {
      return res.status(400).json({ success: false, error: 'No text items provided' });
    }

    const items = parseStructuredText(textItems, type, subject, paper_no);

    res.json({
      success: true,
      extraction_method: 'position-based',
      total_pages: Math.max(...textItems.map(i => i.page || 1)),
      total_items: items.length,
      total_marks: items.reduce((sum, i) => sum + i.marks, 0),
      items: items
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
