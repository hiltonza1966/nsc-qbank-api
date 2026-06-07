const express = require('express');
const multer = require('multer');
const PDFParser = require('pdf2json');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const router = express.Router();

const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

function safeDecode(text) {
  try { return decodeURIComponent(text); } catch (e) { return text; }
}

function extractTextFromPDF2JSON(pdfData) {
  let text = '';
  if (pdfData && pdfData.Pages) {
    pdfData.Pages.forEach(page => {
      if (page.Texts) {
        page.Texts.forEach(textItem => {
          if (textItem.R) {
            textItem.R.forEach(r => { text += safeDecode(r.T) + ' '; });
          }
        });
        text += '\n';
      }
    });
  }
  return text;
}

async function extractTextWithPdfParse(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

async function extractTextFromPDF(filePath) {
  let text = '', method = '';
  try {
    text = await extractTextWithPdfParse(filePath);
    if (text && text.trim().length > 100) { method = 'pdf-parse'; return { text, method, success: true }; }
  } catch (e) { console.log('pdf-parse failed:', e.message); }
  try {
    const pdfParser = new PDFParser();
    const parsePromise = new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => resolve(pdfData));
      pdfParser.on('pdfParser_dataError', (err) => reject(new Error(err.parserError || 'PDF parsing failed')));
    });
    pdfParser.loadPDF(filePath);
    const pdfData = await parsePromise;
    text = extractTextFromPDF2JSON(pdfData);
    if (text && text.trim().length > 100) { method = 'pdf2json'; return { text, method, success: true }; }
  } catch (e) { console.log('pdf2json failed:', e.message); }
  return { text: '', method: 'none', success: false, error: 'Could not extract text from PDF. PDF may be image-based (scanned).' };
}

function normalizeText(text) {
  return text
    .replace(/(\d)\s*\.\s*(\d)\s*\.\s*(\d)/g, '$1.$2.$3')
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
    .replace(/\(\s*(\d+)\s*x\s*(\d+)\s*\)/g, '($1x$2)')
    .replace(/\(\s*(\d+)\s*\)/g, '($1)')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectImagePlaceholders(text) {
  const images = [];
  const patterns = [
    /DIAGRAM\s*\d+/gi, /FIGURE\s*\d+/gi, /GRAPH\s*\d+/gi, /TABLE\s*\d+/gi,
    /MAP\s*\d+/gi, /PICTURE\s*\d+/gi, /IMAGE\s*\d+/gi,
    /\[IMAGE[:\s]*[^\]]+\]/gi, /\[DIAGRAM[^\]]*\]/gi, /\[FIGURE[^\]]*\]/gi,
    /\(SEE\s+FIGURE\s*\d+\)/gi, /\(SEE\s+DIAGRAM\s*\d+\)/gi, /\(SEE\s+GRAPH\s*\d+\)/gi
  ];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      images.push({ type: 'reference', text: match[0], position: match.index });
    }
  });
  return images;
}

function findSections(text) {
  const sections = [];
  const sectionPattern = /SECTION\s+([A-Z])\s*(?:\[|\{|\(|\:|\n|$)/gi;
  let match;
  while ((match = sectionPattern.exec(text)) !== null) {
    sections.push({ name: 'Section ' + match[1], position: match.index, letter: match[1] });
  }
  if (sections.length === 0) sections.push({ name: 'Section A', position: 0, letter: 'A' });
  for (let i = 0; i < sections.length; i++) {
    sections[i].endPosition = (i < sections.length - 1) ? sections[i + 1].position : text.length;
  }
  return sections;
}

function getSectionForPosition(sections, position) {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].position <= position) return sections[i].name;
  }
  return sections[0] ? sections[0].name : 'Section A';
}

function extractChildMarks(childText, isLastChild) {
  let text = childText;
  let marks = 1;

  text = text.replace(/\(\d+x\s*\d+\)\s*\(\d+\)\s*$/, '').trim();

  const allMarks = [...text.matchAll(/(?<![\d.])\((\d+)\)(?![\d.])/g)];

  if (allMarks.length > 0) {
    if (isLastChild && allMarks.length > 1) {
      const lastMark = parseInt(allMarks[allMarks.length - 1][1]);
      const otherMarks = allMarks.slice(0, -1).map(m => parseInt(m[1]));
      const otherSum = otherMarks.reduce((a, b) => a + b, 0);

      if (lastMark > otherSum || lastMark === otherSum) {
        marks = otherMarks.length > 0 ? otherMarks[otherMarks.length - 1] : 1;
        text = text.substring(0, allMarks[allMarks.length - 2] ? allMarks[allMarks.length - 2].index : allMarks[0].index).trim();
      } else {
        marks = lastMark;
        text = text.substring(0, allMarks[allMarks.length - 1].index).trim();
      }
    } else {
      marks = parseInt(allMarks[allMarks.length - 1][1]);
      text = text.substring(0, allMarks[allMarks.length - 1].index).trim();
    }
  }

  text = text.replace(/\(\d+\)\s*$/, '').trim();
  return { marks, text };
}

function parseDBEQuestions(text) {
  const items = [];
  let seq = 1;
  text = normalizeText(text);
  const sections = findSections(text);

  const qnumPattern = /(?<![\d.])(\d+\.\d+\.\d+|\d+\.\d+)(?![\d.])/g;
  const matches = [...text.matchAll(qnumPattern)];

  if (matches.length === 0) return items;

  const rawItems = [];
  for (let i = 0; i < matches.length; i++) {
    const qnum = matches[i][1];
    const start = matches[i].index + matches[i][0].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    let itemText = text.substring(start, end).trim();

    const parts = qnum.split('.');
    let itemType = 'Extended';
    if (parts.length === 3) {
      if (parts[0] === '1' && parts[1] === '1') itemType = 'MCQ';
      else if (parts[0] === '1') itemType = 'Short';
      else itemType = 'Sub-part';
    }

    rawItems.push({ question_number: qnum, type: itemType, text: itemText, parts, position: matches[i].index });
  }

  const groupMarks = {};
  for (const item of rawItems) {
    const compositeMatch = item.text.match(/\((\d+)x\s*(\d+)\)\s*\((\d+)\)/);
    if (compositeMatch) {
      const count = parseInt(compositeMatch[1]);
      const each = parseInt(compositeMatch[2]);
      const total = parseInt(compositeMatch[3]);
      if (item.type === 'MCQ') groupMarks['1.1'] = { count, each, total };
      else if (item.type === 'Short') {
        const parent = item.parts.slice(0, 2).join('.');
        groupMarks[parent] = { count, each, total };
      }
    }
  }

  const parents = {};
  const standalone = [];

  for (const item of rawItems) {
    const parts = item.parts;
    if (parts.length === 3 && parts[0] in ['2', '3']) {
      const parentQnum = parts.slice(0, 2).join('.');
      if (!parents[parentQnum]) parents[parentQnum] = [];
      parents[parentQnum].push(item);
    } else {
      standalone.push(item);
    }
  }

  for (const item of standalone) {
    const qnum = item.question_number;
    const parts = item.parts;
    const itemType = item.type;
    let itemText = item.text;
    let marks = 1;

    itemText = itemText.replace(/\(\d+x\s*\d+\)\s*\(\d+\)\s*$/, '').trim();

    if (itemType === 'MCQ') marks = 2;
    else if (itemType === 'Short') {
      const parent = parts.slice(0, 2).join('.');
      marks = groupMarks[parent]?.each || 1;
    } else if (itemType === 'Extended') marks = 0;

    itemText = itemText.replace(/\(\d+\)\s*$/, '').trim();
    itemText = itemText.replace(/\(\d+\)(?=\s|$)/g, '').trim();

    const subParts = [];
    const subMatches = [...itemText.matchAll(/\(([a-e])\)\s*(.*?)(?=\([a-e]\)|$)/gs)];
    for (const sub of subMatches) {
      let subText = sub[2].trim().replace(/\(\d+\)\s*$/, '').trim();
      subParts.push({ letter: sub[1], text: subText, marks: 1 });
    }
    if (subMatches.length > 0) itemText = itemText.substring(0, subMatches[0].index).trim();

    const childItems = parents[qnum] || [];

    const finalItem = {
      question_number: qnum,
      question_text: itemText,
      marks: marks,
      section: getSectionForPosition(sections, item.position),
      type: itemType,
      sequence: seq++,
      images: detectImagePlaceholders(itemText),
      sub_parts: subParts
    };

    if (childItems.length > 0) {
      const childSubParts = [];
      for (let idx = 0; idx < childItems.length; idx++) {
        const child = childItems[idx];
        const isLast = (idx === childItems.length - 1);
        const result = extractChildMarks(child.text, isLast);

        childSubParts.push({
          number: child.question_number,
          text: result.text,
          marks: result.marks
        });
      }

      finalItem.marks = childSubParts.reduce((sum, c) => sum + c.marks, 0);
      finalItem.child_sub_parts = childSubParts;
    }

    items.push(finalItem);
  }

  items.sort((a, b) => a.sequence - b.sequence);
  return items;
}

function parseDBEMemo(text) {
  const items = [];
  text = normalizeText(text);

  const qnumPattern = /(?<![\d.])(\d+\.\d+\.\d+|\d+\.\d+)(?![\d.])/g;
  const matches = [...text.matchAll(qnumPattern)];

  if (matches.length === 0) return items;

  const rawItems = [];
  for (let i = 0; i < matches.length; i++) {
    const qnum = matches[i][1];
    const start = matches[i].index + matches[i][0].length;
    const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
    let itemText = text.substring(start, end).trim();

    const parts = qnum.split('.');
    let itemType = 'Extended';
    if (parts.length === 3) {
      if (parts[0] === '1' && parts[1] === '1') itemType = 'MCQ';
      else if (parts[0] === '1') itemType = 'Short';
      else itemType = 'Sub-part';
    }

    rawItems.push({ question_number: qnum, type: itemType, text: itemText, parts });
  }

  // Group sub-parts under parents (same as QP parser)
  const parents = {};
  const standalone = [];

  for (const item of rawItems) {
    const parts = item.parts;
    if (parts.length === 3 && parts[0] in ['2', '3']) {
      const parentQnum = parts.slice(0, 2).join('.');
      if (!parents[parentQnum]) parents[parentQnum] = [];
      parents[parentQnum].push(item);
    } else {
      standalone.push(item);
    }
  }

  for (const item of standalone) {
    const qnum = item.question_number;
    let itemText = item.text;
    let marks = 1;

    // Extract marks from text
    const compositeMatch = itemText.match(/\((\d+)x\s*(\d+)\)\((\d+)\)\s*$/);
    if (compositeMatch) {
      marks = parseInt(compositeMatch[3]);
      itemText = itemText.substring(0, itemText.lastIndexOf('(')).trim();
      const lastParen = itemText.lastIndexOf('(');
      if (lastParen > 0) itemText = itemText.substring(0, lastParen).trim();
    } else {
      const singleMatch = itemText.match(/\((\d+)\)\s*$/);
      if (singleMatch) {
        marks = parseInt(singleMatch[1]);
        itemText = itemText.substring(0, itemText.lastIndexOf('(')).trim();
      }
    }

    if (itemText.length < 1) continue;

    const subParts = [];
    const subMatches = [...itemText.matchAll(/\(([a-e])\)\s*(.*?)(?=\([a-e]\)|$)/gs)];
    for (const sub of subMatches) {
      subParts.push({ letter: sub[1], text: sub[2].trim() });
    }

    const childItems = parents[qnum] || [];

    const finalItem = {
      question_number: qnum,
      answer_text: itemText,
      marks: marks,
      type: item.type,
      sub_parts: subParts
    };

    if (childItems.length > 0) {
      const childSubParts = [];
      for (let idx = 0; idx < childItems.length; idx++) {
        const child = childItems[idx];
        const isLast = (idx === childItems.length - 1);
        const result = extractChildMarks(child.text, isLast);

        childSubParts.push({
          number: child.question_number,
          text: result.text,
          marks: result.marks
        });
      }

      finalItem.marks = childSubParts.reduce((sum, c) => sum + c.marks, 0);
      finalItem.child_sub_parts = childSubParts;
    }

    items.push(finalItem);
  }

  return items;
}

router.post('/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
    const pdfFilePath = req.file.path;
    const extraction = await extractTextFromPDF(pdfFilePath);

    if (!extraction.success) {
      fs.unlinkSync(pdfFilePath);
      return res.status(400).json({ success: false, error: extraction.error, ocr_required: true });
    }

    const text = extraction.text;
    const items = parseDBEQuestions(text);
    const totalImages = items.reduce((sum, i) => sum + (i.images ? i.images.length : 0), 0);
    fs.unlinkSync(pdfFilePath);

    res.json({
      success: true, extraction_method: extraction.method,
      total_pages: 1, total_items: items.length,
      total_marks: items.reduce((sum, i) => sum + i.marks, 0),
      total_images_detected: totalImages, ocr_used: false,
      items: items,
      debug_text_preview: text.substring(0, 2000)
    });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/parse-memo', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No memo PDF file uploaded' });
    const pdfFilePath = req.file.path;
    const extraction = await extractTextFromPDF(pdfFilePath);

    if (!extraction.success) {
      fs.unlinkSync(pdfFilePath);
      return res.status(400).json({ success: false, error: extraction.error, ocr_required: true });
    }

    const text = extraction.text;
    const items = parseDBEMemo(text);
    fs.unlinkSync(pdfFilePath);

    res.json({
      success: true, extraction_method: extraction.method,
      total_pages: 1, total_items: items.length,
      total_marks: items.reduce((sum, i) => sum + i.marks, 0),
      ocr_used: false, items: items,
      debug_text_preview: text.substring(0, 2000)
    });
  } catch (e) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
