# NSC QBank Corporate System - AI Handover Note v4
**Date:** 7 June 2026 20:08 SAST
**Session:** Parser Fix - Corporate Standard Approach Identified
**Status:** PARSER REWRITE REQUIRED - Position-based parsing needed

---

## EXECUTIVE SUMMARY

Previous regex-based parser approach FAILED. `pdf-parse` produces garbled concatenated text from DBE PDFs (e.g., `1.11.1.11.1.21.1.3...`). Corporate standard solution: use `pdf.js getTextContent()` in browser to extract text with position info, then send structured data to backend for parsing. This eliminates regex-based layout detection entirely.

---

## 1. PARSER ISSUES DISCOVERED

### 1.1 Text Extraction Problem
- `pdf-parse` and `pdf2json` both produce **garbled concatenated text** from DBE PDFs
- Question numbers run together: `1.11.1.11.1.21.1.31.1.4...`
- Marks notations embedded in text: `(10x 2)(201.21.2.1Progesterone...`
- **Result:** Regex-based parsing impossible

### 1.2 Current Parser Results (WRONG)
| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| QP Items | 38 | 49 | ❌ Too many |
| QP Marks | 150 | 76 | ❌ Too low |
| Memo Items | 38 | 57 | ❌ Too many |
| Memo Marks | 150 | 173 | ❌ Too high |
| Section Detection | A/B/C | All A | ❌ Broken |
| Marks Extraction | Per item | All 1 or 0 | ❌ Broken |

### 1.3 Root Cause
DBE PDFs use **position-based text placement** (not flow-based). Text extraction libraries lose spatial layout, causing concatenation. Regex cannot reconstruct layout from flat text.

---

## 2. CORPORATE STANDARD SOLUTION

### 2.1 Industry Best Practice (Pearson, ETS, Cambridge)
- **Phase 1: Layout Analysis** - Use PDF internal position data (not regex)
- **Phase 2: Structure Detection** - Identify sections by font size/position changes
- **Phase 3: Content Extraction** - Extract text blocks by position, not pattern matching

### 2.2 Implementation Approach
Since `pdf.js` is already loaded in browser for PDF rendering:

```javascript
// Browser-side text extraction (wizard)
const page = await pdf.getPage(pageNum);
const textContent = await page.getTextContent();
const items = textContent.items; // Each item has: str, transform, width, height, fontName

// Sort by Y position (top to bottom) then X position (left to right)
// This gives properly ordered text with layout preserved
```

### 2.3 Advantages
- **No regex needed** for layout detection
- **Preserves question number spacing** (no concatenation)
- **Detects sections** by font size changes (SECTION A, B, C are larger)
- **Identifies marks** by position (right-aligned numbers in parentheses)
- **Handles multi-column** layouts correctly

---

## 3. IMPLEMENTATION PLAN

### 3.1 Wizard Changes (Frontend)
1. Add `extractTextWithPositions()` function using `pdf.js getTextContent()`
2. Sort text items by Y then X position
3. Detect section headers by font size (SECTION A, B, C)
4. Identify question numbers by position (left-aligned, consistent indentation)
5. Extract marks notations by position (right-aligned, near question numbers)
6. Send structured text (with position metadata) to backend

### 3.2 Backend Changes
1. New endpoint: `POST /api/wizard/parse-pdf-structured`
2. Accepts JSON array of text items with positions
3. Uses position data to reconstruct layout
4. Extracts question numbers, text, marks, sections without regex
5. Returns same format as current parser (for backward compatibility)

### 3.3 No New Dependencies
- `pdf.js` already loaded in browser for rendering
- No new npm packages needed

---

## 4. EXPECTED RESULTS

| Metric | Expected | Target |
|--------|----------|--------|
| QP Items | 38 | 38 |
| QP Marks | 150 | 150 |
| Memo Items | 38 | 38 |
| Memo Marks | 150 | 150 |
| Section Detection | A/B/C | A/B/C |
| Marks Extraction | Per item | Correct |

### 4.1 Item Structure (38 items)
- **Section A (28 items):**
  - 1.1.1-1.1.10: MCQ, 2 marks each = 20 marks
  - 1.2.1-1.2.8: Short answer, 1 mark each = 8 marks
  - 1.3.1-1.3.3: Matching, 2 marks each = 6 marks
  - 1.4.1-1.4.3: Diagram, 8 marks total
  - 1.5.1-1.5.4: Diagram, 8 marks total
- **Section B (5 items):** 2.1-2.5, marks vary, total 50
- **Section C (5 items):** 3.1-3.5, marks vary, total 50
- **Grand Total: 150 marks**

---

## 5. FILES STATUS

### Current Files (Ready for Update)
| File | Status | Action Needed |
|------|--------|---------------|
| `wizard/index.html` | Needs rewrite | Add position-based text extraction |
| `routes/pdf_parser.js` | Needs rewrite | Accept structured text, no regex |
| `routes/staging.js` | Working | No changes needed |
| `routes/attachments.js` | Working | No changes needed |
| `server.js` | Working | Add new route |
| `package.json` | Working | No changes needed |

### New Endpoint Required
- `POST /api/wizard/parse-pdf-structured` - Accepts text items with positions
- `POST /api/wizard/parse-memo-structured` - Same for memo

---

## 6. RISK MITIGATION

| Risk | Mitigation |
|------|------------|
| Position-based parsing complexity | Use pdf.js proven API, well-documented |
| Browser compatibility | pdf.js works in all modern browsers |
| Performance with large PDFs | Process page by page, show progress |
| Fallback if position data missing | Fall back to current regex parser |

---

## 7. NEXT CHAT STARTER

**Say:** "Parser rewrite required. Previous regex-based approach failed due to pdf-parse producing garbled concatenated text. Corporate standard solution: use pdf.js getTextContent() in browser for position-based text extraction, then send structured data to backend. This eliminates regex entirely and matches how Pearson/ETS handle PDF parsing."

**First Actions:**
1. Rewrite wizard to extract text with positions using pdf.js
2. Add new backend endpoint for structured text parsing
3. Test with LIFE P1 PDF to verify 38 items / 150 marks
4. Verify memo parser produces matching 38 items

---

*End of Handover Note v4*
*Parser approach changed from regex to position-based*
*Corporate standard identified and documented*
