# QBank Parser - AI Handover Note v30
**Date:** 21 June 2026 08:10 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main

---

## CURRENT STATUS

### ✅ What's Working
- **Parser API chain is functional** — QP + Memo parsers extract data, harness combines, frontend displays
- **Frontend builds successfully** — ParserReviewPanel.tsx compiles
- **Text extraction works** — Question text and answer text both show in review panel
- **Tables extract** — Financial data tables render correctly
- **Page references show** — QP pages and Memo pages displayed
- **Image extraction infrastructure** in place (directories created, API route added)

### ⚠️ Known Issues
1. **Memo marks are wrong** — Parser picks up cumulative/section totals instead of per-question marks
2. **Too many RED items** — Because memo marks are wrong, confidence calculation fails
3. **QP text bleeding** — Some questions include "INFORMATION" sections from subsequent pages
4. **Memo marks = 0 for many items** — Mark extraction regex doesn't match memo format (`[1]`, `✓`, "one mark")
5. **All 22 items show as RED** — Only 4 Green, 2 Yellow, 17 Red (should be mostly Green/Yellow)

---

## ROOT CAUSE ANALYSIS

### QP Mark Format (CORRECT)
- Inline: `1.1 ... (6)`
- Mark allocation table: `1.1 (6 marks)`
- Clean, consistent

### Memo Mark Format (BROKEN)
- Inline: `[1]`, `✓`, `☑` (symbols, not numbers)
- Text descriptions: "one mark", "two marks", "one m mark"
- Bracketed: `(1)` for part-marks within workings
- **No clean per-question total** — marks are distributed across answer text
- Current parser looks for `\((\d+)\)` which misses most memo marks

---

## FOUR-PARSER ARCHITECTURE (Next Phase)

### Parser 1: `qp_content_parser.py`
**Purpose:** Extract question numbers + question text + attachments
**Input:** QP PDF
**Output:** `{question_number, question_text, qp_images, qp_tables, qp_pages}`
**No marks extraction**

### Parser 2: `memo_content_parser.py`
**Purpose:** Extract question numbers + answer text + attachments
**Input:** Memo PDF
**Output:** `{question_number, answer_text, memo_images, memo_tables, memo_pages}`
**No marks extraction**

### Parser 3: `qp_marks_parser.py`
**Purpose:** Extract QP marks from mark allocation table
**Input:** QP PDF (first 2-3 pages)
**Output:** `{question_number, marks}`
**Sources:**
- Inline marks: `1.1 ... (6)`
- Mark allocation table at start of QP

### Parser 4: `memo_marks_parser.py`
**Purpose:** Extract Memo marks from marking guidelines
**Input:** Memo PDF
**Output:** `{question_number, marks}`
**Sources:**
- Section totals: `6` at end of 1.1 answer
- Running totals in tables
- Count `[1]`, `✓`, `☑` symbols per question
- Parse "one mark", "two marks" text

### Parser 5: `master_harness_v2.py`
**Purpose:** Combine all 4 parsers by question_number
**Logic:**
1. Run Parser 1 + Parser 3 → QP data (content + marks)
2. Run Parser 2 + Parser 4 → Memo data (content + marks)
3. Match by question_number
4. Calculate confidence based on correct marks

---

## FILES CURRENTLY IN REPO

### Backend Parsers (FIXED in v29)
```
backend/parsers/qp_parser_option_b.py          → Working, extracts text+tables+images
backend/parsers/memo_parser_option_b.py        → Working, extracts text+tables+images
backend/parsers/master_harness.py              → Working, combines QP+Memo
backend/parsers/parser_api.py                  → Working, API wrapper
backend/parsers/bilingual_cleaner.py           → No changes needed
```

### Frontend (FIXED in v29)
```
frontend/src/components/ParserReviewPanel.tsx  → Working, displays review panel
```

### Routes (FIXED in v29)
```
routes/parser.js                               → Working, has image serving + approve endpoint
```

---

## DEPLOYMENT COMMANDS (for Four Parser phase)

```powershell
# 1. Backup current parsers
cd C:\dev\nsc-qbank\backend\parsers
Copy-Item qp_parser_option_b.py qp_parser_option_b_v30.py
Copy-Item memo_parser_option_b.py memo_parser_option_b_v30.py
Copy-Item master_harness.py master_harness_v30.py

# 2. Deploy new four-parser files
# (files will be provided in next session)

# 3. Rebuild frontend
cd C:\dev\nsc-qbank\frontend
npm run build

# 4. Restart backend
Get-Process node | Stop-Process -Force
cd C:\dev\nsc-qbank
node server.js
```

---

## KEY INSIGHTS FROM PDF ANALYSIS

### QP Structure (Accounting P1 Nov 2025)
- Page 1: Header (150 marks, 2 hours)
- Page 2: Instructions + Mark allocation table
- Page 3-4: Question 1 (50 marks)
- Page 5-6: Question 2 (45 marks)
- Page 7-8: Question 3 (40 marks)
- Page 9-10: Question 4 (15 marks)
- Page 11-15: Formula sheet

### Memo Structure
- Page 1: Header + Marking principles
- Page 2: Question 1.1, 1.2 (marks at end: `6`, `8`)
- Page 3: Question 1.3 (marks at end: `36`)
- Page 4: Question 2.1, 2.2 (marks: `3`, `4`, `23`)
- Page 5: Question 2.3, 2.4 (marks: `3`, `5`, `5`, `2`)
- Page 6: Question 3.1.1-3.1.3 (marks: `3`)
- Page 7: Question 3.2.1-3.2.3 (marks: `4`, `4`, `4`, `4`, `2`)
- Page 8: Question 3.3.1-3.3.2 (marks: `4`, `4`, `4`)
- Page 9: Question 3.4, 3.5 (marks: `3`, `2`, `2`)
- Page 10: Question 4.1, 4.2 (marks: `2`, `2`, `2`)
- Page 11-13: Question 4.3, 4.4, 4.5 (marks: `2`, `4`, `4`)

### Memo Mark Patterns
- Section totals appear at end of each answer block
- Format: standalone number on last line (e.g., `6`, `8`, `36`)
- Sub-questions have marks inline with `[1]`, `✓`, `☑`
- Tables have marks in rightmost column

---

## NEXT STEPS (Priority Order)

### P1: Build Four Parser Architecture
1. Create `qp_content_parser.py` — extract text only, no marks
2. Create `memo_content_parser.py` — extract text only, no marks
3. Create `qp_marks_parser.py` — extract marks from allocation table
4. Create `memo_marks_parser.py` — extract marks from section totals
5. Create `master_harness_v2.py` — combine all 4 by question_number

### P2: Test with Accounting P1 Nov 2025
- Verify all 22 items have correct QP marks
- Verify all 22 items have correct Memo marks
- Target: 18+ Green items, 2-3 Yellow, 1-2 Red

### P3: Deploy and Test End-to-End
- Frontend review panel shows correct confidence
- Approve & Import works
- Database records created correctly

---

## ROLLBACK PLAN

If issues occur:
```powershell
cd C:\dev\nsc-qbank\backend\parsers
Copy-Item qp_parser_option_b_v30.py qp_parser_option_b.py
Copy-Item memo_parser_option_b_v30.py memo_parser_option_b.py
Copy-Item master_harness_v30.py master_harness.py
Get-Process node | Stop-Process -Force
cd C:\dev\nsc-qbank
node server.js
```

---

*End of Handover Note v30*
*Date: 2026-06-21 08:10 SAST*
*Next Session: Build Four Parser Architecture*
