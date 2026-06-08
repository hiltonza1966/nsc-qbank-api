const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_FILE = path.join(__dirname, '..', 'memo_parser_debug.log');

function log(msg) {
  const timestamp = new Date().toISOString();
  const line = '[' + timestamp + '] ' + msg + '\n';
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function clearLog() {
  fs.writeFileSync(LOG_FILE, 'Memo Parser Debug Log - ' + new Date().toISOString() + '\n');
}

/**
 * Simplified memo parser: Extracts answer text and links to QP items
 * Does NOT extract marks - QP marks are the source of truth
 */
function parseMemoText(textItems, paperCode, subject, paperNo) {
  clearLog();
  log('=== MEMO PARSER START (Simplified - QP Marks as Source of Truth) ===');
  log('Input: ' + textItems.length + ' text items');

  // Sort items by page, then y (descending), then x (ascending)
  const sorted = [...textItems].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
    return a.x - b.x;
  });

  // Group into lines
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

  // Extract memo items: just question_number and answer_text
  // We don't extract marks - QP already has correct marks
  const memoItems = [];
  let currentSection = 'Section A';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();

    // Detect section headers
    const sectionMatch = text.match(/SECTION\s+([A-Z])/i);
    if (sectionMatch) {
      currentSection = 'Section ' + sectionMatch[1];
      log('>>> SECTION: ' + currentSection);
      continue;
    }

    // Try to parse as memo item: just extract question_number and answer_text
    // Pattern: "1.1.1 C" - MCQ answer
    const mcqMatch = text.match(/^(\d+\.\d+\.\d+)\s+([A-D])\b/);
    if (mcqMatch) {
      memoItems.push({
        question_number: mcqMatch[1],
        answer_text: mcqMatch[2],
        section: currentSection,
        type: 'MCQ'
      });
      log('  MEMO MCQ: ' + mcqMatch[1] + ' = ' + mcqMatch[2]);
      continue;
    }
    
    // Pattern: "1.2.1 Progesterone" - Short answer
    const shortMatch = text.match(/^(\d+\.\d+\.\d+)\s+(.+?)$/);
    if (shortMatch) {
      const answerText = shortMatch[2].trim();
      // Skip batch totals and section totals
      if (!answerText.match(/^\(\d+\s*x/) && !answerText.match(/^\[\d+\]$/)) {
        memoItems.push({
          question_number: shortMatch[1],
          answer_text: answerText,
          section: currentSection,
          type: 'Short'
        });
        log('  MEMO SHORT: ' + shortMatch[1] + ' = ' + answerText.substring(0, 50));
      }
      continue;
    }
    
    // Pattern: "2.1.1 -Explanation" - Extended answer
    const extendedMatch = text.match(/^(\d+\.\d+\.\d+)\s+[-–]\s*(.+?)$/);
    if (extendedMatch) {
      memoItems.push({
        question_number: extendedMatch[1],
        answer_text: extendedMatch[2].trim(),
        section: currentSection,
        type: 'Extended'
      });
      log('  MEMO EXTENDED: ' + extendedMatch[1] + ' = ' + extendedMatch[2].substring(0, 50));
      continue;
    }
  }

  log('\n=== MEMO ITEMS: ' + memoItems.length + ' ===');
  log('=== MEMO PARSER END ===\n');

  return memoItems;
}

// ============================================
// ROUTE: POST /api/wizard/parse-memo
// Parse memo PDF and extract marking guidelines (answer text only)
// ============================================
router.post('/parse-memo', (req, res) => {
  try {
    const { textItems, paper_code, subject, paper_no } = req.body;
    
    if (!Array.isArray(textItems)) {
      return res.status(400).json({ error: 'textItems array required' });
    }

    const memoItems = parseMemoText(textItems, paper_code || 'UNKNOWN', subject, paper_no);
    
    res.json({
      success: true,
      memo_items: memoItems,
      total_items: memoItems.length,
      note: 'Memo parser extracted ' + memoItems.length + ' items with answer text. QP marks are source of truth.'
    });

  } catch (error) {
    console.error('Parse memo error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTE: POST /api/wizard/extract-memo
// Save memo items to database, linked to QP items
// Uses QP marks as source of truth
// ============================================
router.post('/extract-memo', async (req, res) => {
  const conn = await req.db.getConnection();
  
  try {
    const { textItems, paper_code, subject_name, paper_no, exam_year, exam_session } = req.body;
    
    // Parse paper_no to numeric (handle 'P1' -> 1)
    const parsedPaperNo = typeof paper_no === 'string' ? parseInt(paper_no.replace('P', '')) || 1 : (parseInt(paper_no) || 1);

    if (!Array.isArray(textItems) || !paper_code) {
      return res.status(400).json({ error: 'textItems and paper_code required' });
    }

    // Parse memo items (answer text only, no marks)
    const memoItems = parseMemoText(textItems, paper_code, subject_name, paper_no);
    
    // Get QP structure to validate linking and get marks
    const [qpItems] = await conn.execute(
      'SELECT question_number, expected_marks, question_type, section, sequence ' +
      'FROM QB_questionP_Structure WHERE paper_code = ? ORDER BY sequence',
      [paper_code]
    );

    if (qpItems.length === 0) {
      return res.status(404).json({
        error: 'QP structure not found for this paper. Upload QP first.',
        paper_code: paper_code
      });
    }

    // Create QP lookup map
    const qpMap = {};
    const qpParentMap = {}; // Maps parent number to QP item
    for (const qp of qpItems) {
      qpMap[qp.question_number] = qp;
      // For parent items (like 1.4, 2.1), map sub-parts to parent
      const parts = qp.question_number.split('.');
      if (parts.length === 2) {
        qpParentMap[qp.question_number] = qp;
      }
    }

    // Lookup subject_official_code from v_subject_structure
    let subjectOfficialCode = null;
    try {
      const [subjectRows] = await conn.execute(
        'SELECT subject_official_code FROM v_subject_structure WHERE subject_name_eng = ? AND paper_no = ? LIMIT 1',
        [subject_name, parsedPaperNo]
      );
      if (subjectRows.length > 0) {
        subjectOfficialCode = subjectRows[0].subject_official_code;
        log('Subject lookup: ' + subject_name + ' -> ' + subjectOfficialCode);
      }
    } catch (lookupErr) {
      log('Subject lookup failed: ' + lookupErr.message);
    }

    // Fallback to hardcoded mapping if lookup fails
    if (!subjectOfficialCode) {
      const subjectMap = {
        'Life Sciences': '19351084',
        'Mathematics': '19351041',
        'Physical Sciences': '19351063',
        'Accounting': '19351021'
      };
      subjectOfficialCode = subjectMap[subject_name] || '19351084';
      log('Subject fallback: ' + subject_name + ' -> ' + subjectOfficialCode);
    }

    await conn.beginTransaction();

    // Clear existing memo items for this paper
    await conn.execute(
      'DELETE FROM qbank_item_memos WHERE source_paper_code = ?',
      [paper_code]
    );

    let linked = 0;
    let unlinked = 0;

    // Insert memo items, linked to QP (using QP marks as source of truth)
    for (const memo of memoItems) {
      let qpItem = qpMap[memo.question_number];
      let linkedQuestionNumber = memo.question_number;
      
      // If not found directly, try to find parent item for sub-parts
      if (!qpItem) {
        const parts = memo.question_number.split('.');
        if (parts.length === 3) {
          const parentNum = parts[0] + '.' + parts[1];
          qpItem = qpParentMap[parentNum];
          if (qpItem) {
            linkedQuestionNumber = parentNum; // Link to parent
          }
        }
      }
      
      let status = 'linked';
      let marks = null; // Use QP marks as source of truth
      let notes = '';

      if (qpItem) {
        marks = qpItem.expected_marks; // Use QP marks
        linked++;
        notes = 'Linked to QP item. Marks from QP: ' + qpItem.expected_marks;
      } else {
        status = 'unlinked';
        notes = 'No matching QP item found for ' + memo.question_number;
        unlinked++;
      }

      const memoId = crypto.randomUUID();

      await conn.execute(
        'INSERT INTO qbank_item_memos ' +
        '(memo_id, question_number, answer_text, marks, source_year, ' +
        'source_exam_board, source_paper_code, subject_official_code, ' +
        'paper_no, status, live_item_id, version_number) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          memoId, memo.question_number, memo.answer_text, marks,
          exam_year || 2025, 'DBE', paper_code, subjectOfficialCode,
          parsedPaperNo, status, null, 1
        ]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      total_items: memoItems.length,
      linked: linked,
      unlinked: unlinked,
      qp_total_marks: qpItems.reduce((sum, q) => sum + q.expected_marks, 0),
      message: 'Memo extracted: ' + memoItems.length + ' items, ' + linked + ' linked to QP, ' + unlinked + ' unlinked. QP marks used as source of truth.'
    });

  } catch (error) {
    await conn.rollback();
    console.error('Extract memo error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

// ============================================
// ROUTE: GET /api/wizard/memo/:paper_code
// Get memo items for a paper, linked to QP
// ============================================
router.get('/memo/:paper_code', async (req, res) => {
  const conn = await req.db.getConnection();
  
  try {
    const { paper_code } = req.params;
    
    // Get memo items with QP data
    const [rows] = await conn.execute(
      'SELECT m.*, q.question_text as qp_question_text, q.expected_marks as qp_marks, ' +
      'q.question_type as qp_type, q.section as qp_section ' +
      'FROM qbank_item_memos m ' +
      'LEFT JOIN QB_questionP_Structure q ' +
      'ON m.question_number = q.question_number AND m.source_paper_code = q.paper_code ' +
      'WHERE m.source_paper_code = ? ' +
      'ORDER BY q.sequence, m.question_number',
      [paper_code]
    );

    res.json({
      success: true,
      paper_code: paper_code,
      total_items: rows.length,
      items: rows
    });

  } catch (error) {
    console.error('Get memo error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

// ============================================
// ROUTE: GET /api/wizard/compare-qp-memo/:paper_code
// Compare QP marks vs Memo marks side by side
// ============================================
router.get('/compare-qp-memo/:paper_code', async (req, res) => {
  const conn = await req.db.getConnection();
  
  try {
    const { paper_code } = req.params;
    
    // Get all QP items with their memo counterparts
    const [rows] = await conn.execute(
      'SELECT q.question_number, q.question_text, q.question_type, q.section, ' +
      'q.expected_marks as qp_marks, m.marks as memo_marks, m.answer_text, ' +
      'm.status as memo_status, m.memo_id ' +
      'FROM QB_questionP_Structure q ' +
      'LEFT JOIN qbank_item_memos m ' +
      'ON q.question_number = m.question_number AND q.paper_code = m.source_paper_code ' +
      'WHERE q.paper_code = ? ' +
      'ORDER BY q.sequence',
      [paper_code]
    );

    const comparison = [];
    let linked = 0;
    let unlinked = 0;

    for (const row of rows) {
      const hasMemo = row.memo_id !== null;
      
      if (hasMemo) {
        linked++;
      } else {
        unlinked++;
      }

      comparison.push({
        question_number: row.question_number,
        question_text: row.question_text,
        section: row.section,
        type: row.question_type,
        qp_marks: row.qp_marks || 0,
        memo_marks: row.memo_marks || 0,
        answer_text: row.answer_text || '',
        status: hasMemo ? 'linked' : 'missing_memo'
      });
    }

    res.json({
      success: true,
      paper_code: paper_code,
      total_items: rows.length,
      linked: linked,
      unlinked: unlinked,
      comparison: comparison
    });

  } catch (error) {
    console.error('Compare QP-Memo error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
});

module.exports = router;

