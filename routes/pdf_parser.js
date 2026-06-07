const express = require('express');
const multer = require('multer');
const PDFParser = require('pdf2json');
const fs = require('fs');
const router = express.Router();

// Multer setup for PDF uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Extract text from pdf2json data
function extractTextFromPDF2JSON(pdfData) {
  let text = '';
  if (pdfData && pdfData.Pages) {
    pdfData.Pages.forEach(page => {
      if (page.Texts) {
        page.Texts.forEach(textItem => {
          if (textItem.R) {
            textItem.R.forEach(r => {
              text += r.T + ' ';
            });
          }
        });
        text += '\n';
      }
    });
  }
  // Decode URL-encoded text
  text = text.replace(/%20/g, ' ').replace(/%2C/g, ',').replace(/%2E/g, '.').replace(/%3A/g, ':').replace(/%3B/g, ';').replace(/%28/g, '(').replace(/%29/g, ')').replace(/%2F/g, '/').replace(/%3F/g, '?').replace(/%21/g, '!').replace(/%2D/g, '-').replace(/%2B/g, '+').replace(/%3D/g, '=').replace(/%25/g, '%');
  return text;
}

// DBE Question Parser (QP)
function parseDBEQuestions(text) {
  const items = [];
  let seq = 1;

  // Pattern 1: Section headers
  const sectionPattern = /SECTION\s+([A-Z])/g;
  const sections = [];
  let match;
  while ((match = sectionPattern.exec(text)) !== null) {
    sections.push({ name: 'Section ' + match[1], position: match.index });
  }

  // Helper to get section for a position
  function getSection(pos) {
    let section = sections[0] || { name: 'Section A' };
    for (const s of sections) {
      if (s.position <= pos) section = s;
    }
    return section.name;
  }

  // Pattern 2: Multiple choice (1.1.1, 1.1.2, etc.)
  const mcqPattern = /(\d+\.\d+\.\d+)\s*([\s\S]*?(?:A\s+[\s\S]*?B\s+[\s\S]*?C\s+[\s\S]*?D\s+[\s\S]*?)?)\s*\((\d+)\s*x\s*(\d+)\)/gs;

  while ((match = mcqPattern.exec(text)) !== null) {
    const marks = parseInt(match[3]) * parseInt(match[4]);
    items.push({
      question_number: match[1],
      question_text: match[2].trim(),
      marks: marks,
      section: getSection(match.index),
      type: 'MCQ',
      sequence: seq++
    });
  }

  // Pattern 3: Short answer (1.2.1, 1.2.2, etc.)
  const shortPattern = /(\d+\.\d+\.\d+)\s*([\s\S]*?)\s*\((\d+)\s*x\s*(\d+)\)/gs;
  while ((match = shortPattern.exec(text)) !== null) {
    if (items.some(i => i.question_number === match[1])) continue;
    const marks = parseInt(match[3]) * parseInt(match[4]);
    items.push({
      question_number: match[1],
      question_text: match[2].trim(),
      marks: marks,
      section: getSection(match.index),
      type: 'Short',
      sequence: seq++
    });
  }

  // Pattern 4: Long questions (2.1, 2.2, etc.)
  const longPattern = /(\d+\.\d+)\s*([\s\S]*?)\s*\((\d+)\)/gs;
  while ((match = longPattern.exec(text)) !== null) {
    if (items.some(i => i.question_number === match[1])) continue;
    items.push({
      question_number: match[1],
      question_text: match[2].trim(),
      marks: parseInt(match[3]),
      section: getSection(match.index),
      type: 'Extended',
      sequence: seq++
    });
  }

  items.sort((a, b) => a.sequence - b.sequence);
  return items;
}

// DBE Memo Parser (Marking Guidelines)
function parseDBEMemo(text) {
  const items = [];

  // Clean up excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();

  // Pattern: question number followed by answer text until next question number
  // Matches: 1.1.1, 1.2.1, 2.1, 2.2.1, etc.
  const pattern = /(\d+\.\d+\.\d+|\d+\.\d+)\s+([\s\S]*?)(?=\s+\d+\.\d+\.\d+|\s+\d+\.\d+\s|$)/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const questionNumber = match[1];
    let answerText = match[2].trim();

    // Extract marks from end: (3) or (2) or (8x 1)(8)
    let marks = 1;

    // Try composite marks first: (8x 1)(8)
    const compositeMarks = answerText.match(/\((\d+)x\s*(\d+)\)\((\d+)\)\s*$/);
    if (compositeMarks) {
      marks = parseInt(compositeMarks[3]);
      answerText = answerText.substring(0, answerText.lastIndexOf('(')).trim();
      // Remove the (Nx M) part too
      const lastParen = answerText.lastIndexOf('(');
      if (lastParen > 0) answerText = answerText.substring(0, lastParen).trim();
    } else {
      // Try single marks: (3)
      const singleMarks = answerText.match(/\((\d+)\)\s*$/);
      if (singleMarks) {
        marks = parseInt(singleMarks[1]);
        answerText = answerText.substring(0, answerText.lastIndexOf('(')).trim();
      }
    }

    // Skip if answer is too short (likely noise or header)
    if (answerText.length < 1) continue;

    items.push({
      question_number: questionNumber,
      answer_text: answerText,
      marks: marks
    });
  }

  return items;
}

// POST /api/wizard/parse-pdf (QP)
router.post('/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    }

    const pdfFilePath = req.file.path;
    const pdfParser = new PDFParser();

    const parsePromise = new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData);
      });
      pdfParser.on('pdfParser_dataError', (err) => {
        reject(new Error(err.parserError || 'PDF parsing failed'));
      });
    });

    pdfParser.loadPDF(pdfFilePath);

    const pdfData = await parsePromise;
    const text = extractTextFromPDF2JSON(pdfData);
    const numPages = pdfData.Pages ? pdfData.Pages.length : 0;
    const items = parseDBEQuestions(text);

    fs.unlinkSync(pdfFilePath);

    res.json({
      success: true,
      total_pages: numPages,
      total_items: items.length,
      total_marks: items.reduce((sum, i) => sum + i.marks, 0),
      ocr_used: false,
      items: items
    });

  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/wizard/parse-memo (Marking Guidelines)
router.post('/parse-memo', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No memo PDF file uploaded' });
    }

    const pdfFilePath = req.file.path;
    const pdfParser = new PDFParser();

    const parsePromise = new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData);
      });
      pdfParser.on('pdfParser_dataError', (err) => {
        reject(new Error(err.parserError || 'PDF parsing failed'));
      });
    });

    pdfParser.loadPDF(pdfFilePath);

    const pdfData = await parsePromise;
    const text = extractTextFromPDF2JSON(pdfData);
    const numPages = pdfData.Pages ? pdfData.Pages.length : 0;
    const items = parseDBEMemo(text);

    fs.unlinkSync(pdfFilePath);

    res.json({
      success: true,
      total_pages: numPages,
      total_items: items.length,
      total_marks: items.reduce((sum, i) => sum + i.marks, 0),
      ocr_used: false,
      items: items
    });

  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
