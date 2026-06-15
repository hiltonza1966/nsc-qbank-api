# QBank Wizard - AI Handover Note v8
**Version:** v8.0  
**Date:** 15 June 2026 22:50 SAST  
**System:** NSC QBank Corporate System  
**Repository:** C:\dev\nsc-qbank  
**Database:** nsc_qbank (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (node server.js from repo root)  
**Frontend Port:** 3000 (npm run dev from frontend/)  
**Git Branch:** main  
**Last Commit:** b0d771c - Parser v11 with harness diagnostics  

---

## PARSER STATUS (2026-06-15 22:50)

### Current Results (Geography P2 Nov 2024)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| QP Items | 76 | ~40 | High (includes sub-questions) |
| Memo Items | 76 | ~40 | High |
| QP Marks | 86 | ~150 | Low (matching/MCQ marks only in memo) |
| Memo Marks | 86 | ~150 | Low |
| **Final Marks** | **139** | **150** | Close |
| Red Flags | 2 | <5 | Good |
| Missing Marks | 11 | 0 | Need investigation |

### Red Flags (2 items)

| Question | QP Marks | Memo Marks | Issue |
|----------|----------|------------|-------|
| 1.4.4 | 4 | 2 | QP has more marks than memo |
| 3.2.2 | 2 | 1 | QP has more marks than memo |

**Root Cause:** Section total marks bleeding into sub-questions. The parser finds (38) for section 2.4 and applies it to 2.4.4 instead of finding (4).

### Missing Marks (11 marks)

Questions with NO marks in either QP or memo:
- 1.3.3, 1.3.4, 1.3.5
- 1.4.2, 1.4.5
- 1.5.3, 1.5.4
- 2.3.5, 2.3.6
- 2.4.3, 2.4.5
- 2.5.4, 2.5.5
- 3.1.2, 3.1.3, 3.1.5
- 3.2.1
- 3.3.2, 3.3.3

**Investigation needed:** These may be:
1. Questions with marks in a different format (not (X))
2. Questions with marks on a separate page
3. Questions that are part of a multi-part question where marks are on the parent
4. Table-based marks that the parser isn't detecting

---

## CRITICAL FINDINGS FROM PAGE_STRUCTURE DIAGNOSTIC

### Marks Location Pattern

From the page_structure.py diagnostic, the marks are located as follows:

**Page 3 (1.1.x matching questions):**
- 1.1.1 to 1.1.7: NO marks nearby → marks are on a DIFFERENT page or in memo only
- 1.1.8: marks at offset 8 → (8 x 1) (8) = SECTION TOTAL, not individual mark

**Page 4 (1.2.x MCQ questions):**
- 1.2.1 to 1.2.7: NO marks nearby → marks are in memo only

**Page 5 (1.3.x questions):**
- 1.3.1: marks at line 23-24, question at line 22 → offset 1-2 lines ✓
- 1.3.2: marks at line 33-36, question at line 31 → offset 2-5 lines ✓
- 1.3.3: marks at line 45-48, question at line 43 → offset 2-5 lines ✓
- 1.3.4: marks at line 57-59, question at line 55 → offset 2-4 lines ✓
- 1.3.5: marks at line 68-70, question at line 66 → offset 2-4 lines ✓

**Page 6 (1.4.x questions):**
- 1.4.1: marks at line 21, question at line 20 → offset 1 line ✓
- 1.4.2: marks at line 29-31, question at line 27 → offset 2-4 lines ✓
- 1.4.3: marks at line 42, question at line 37 → offset 5 lines ✓
- 1.4.4: marks at line 52-54, question at line 50 → offset 2-4 lines ✓
- 1.4.5: marks at line 62-64, question at line 60 → offset 2-4 lines ✓

**Page 8-9 (2.1.x matching questions):**
- 2.1.1 to 2.1.8: NO marks nearby → marks are in memo only

**Page 16 (3.1.x questions):**
- 3.1.2: NO marks nearby → marks missing or on next page
- 3.1.3: NO marks nearby → marks missing or on next page
- 3.1.5: NO marks nearby → marks missing or on next page

### Key Patterns Identified

1. **Matching questions (1.1.x, 2.1.x)**: Marks are ONLY in memo, NOT in QP
2. **MCQ questions (1.2.x, 2.2.x)**: Marks are ONLY in memo, NOT in QP
3. **Other questions**: Marks are in QP, offset by 1-5 lines from question
4. **Section totals**: (X x Y) format at end of section = total for all questions in section
5. **Cross-page marks**: Some marks may be on the NEXT page after the question

---

## PARSER V13 IMPROVEMENTS

### Changes from v11 to v13

1. **Cross-page search**: Searches across all pages (not just within one page)
2. **Wider context**: Searches up to 15 lines ahead (was 8)
3. **Section total detection**: Skips marks > 15 (section totals are 20-40)
4. **Better text extraction**: Captures multi-line questions properly
5. **Improved comparison**: Better red flag logic

### File Structure

```
sandbox/
├── harness.py              # Main test harness (v13)
├── diagnostic.py           # PDF structure diagnostic
├── diagnostic_marks.py     # Marks extraction diagnostic
├── page_structure.py       # Page layout diagnostic
├── marks_location.py       # Marks position diagnostic
├── deep_diagnostic.py      # Deep analysis diagnostic
└── extract_dbe_paper.py    # Production parser (v13)
```

---

## HOW TO USE THE HARNESS

### Prerequisites

```powershell
# Ensure PyMuPDF is installed
pip install PyMuPDF

# Ensure sandbox folder exists
New-Item -ItemType Directory -Force -Path "C:\dev\nsc-qbank\sandbox"
```

### Run the Harness

```powershell
# 1. Navigate to sandbox
cd C:\dev\nsc-qbank\sandbox

# 2. Run harness with both PDFs
python harness.py "<qp_pdf_path>" "<memo_pdf_path>" "<paper_code>"

# Example:
python harness.py "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\Question Papers\Geography P2 Nov 2024 Eng.pdf" "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\Question Papers\Geography P2 Nov 2024 MG Eng.pdf" "GEOG_P2_NOV_2024"
```

### Expected Output

```json
{
  "paper_code": "GEOG_P2_NOV_2024",
  "qp_items": 76,
  "qp_marks": 86,
  "mg_items": 76,
  "mg_marks": 86,
  "final_marks": 139,
  "missing_marks_count": 11,
  "red_flags": 2,
  "qp_hash": "270332fc",
  "mg_hash": "66ccb9e9",
  "top_issues": [
    {
      "question_number": "1.4.4",
      "qp_marks": 4,
      "mg_marks": 2,
      "final_marks": 2,
      "variance": 2,
      "qp_text": "Why are both the transition zone...",
      "mg_text": "Why are both the transition zone..."
    },
    {
      "question_number": "3.2.2",
      "qp_marks": 2,
      "mg_marks": 1,
      "final_marks": 1,
      "variance": 1,
      "qp_text": "(a) What evidence suggests...",
      "mg_text": "Evidence suggests suburb..."
    }
  ]
}
```

### Run Diagnostics

```powershell
# Diagnostic 1: PDF structure (shows text around question numbers)
python diagnostic.py "<pdf_path>"

# Diagnostic 2: Marks extraction (shows all marks found per question)
python diagnostic_marks.py "<pdf_path>"

# Diagnostic 3: Page structure (shows marks alignment per page)
python page_structure.py "<pdf_path>"

# Diagnostic 4: Marks location (shows exact position of marks)
python marks_location.py "<pdf_path>"

# Diagnostic 5: Deep analysis (shows section structure)
python deep_diagnostic.py "<pdf_path>"
```

---

## HOW TO COPY FILES TO REPO

### Method 1: Direct Copy (Recommended)

```powershell
# Copy all files to repo
cd C:\dev\nsc-qbank

# Copy parser
Copy-Item "C:\Users\visagie.h\Downloads\extract_dbe_paper_v13.py" "scripts\extract_dbe_paper.py" -Force

# Copy harness
Copy-Item "C:\Users\visagie.h\Downloads\harness_v13.py" "sandbox\harness.py" -Force

# Copy diagnostics
Copy-Item "C:\Users\visagie.h\Downloads\page_structure.py" "sandbox\page_structure.py" -Force
Copy-Item "C:\Users\visagie.h\Downloads\marks_location.py" "sandbox\marks_location.py" -Force
Copy-Item "C:\Users\visagie.h\Downloads\deep_diagnostic.py" "sandbox\deep_diagnostic.py" -Force

# Copy handover note
Copy-Item "C:\Users\visagie.h\Downloads\QBank_Wizard_AI_Handover_Note_v8.md" "docs\QBank_Wizard_AI_Handover_Note_v8.md" -Force

# Commit to git
git add scripts/extract_dbe_paper.py sandbox/harness.py sandbox/page_structure.py sandbox/marks_location.py sandbox/deep_diagnostic.py docs/QBank_Wizard_AI_Handover_Note_v8.md
git commit -m "feat: Parser v13 with cross-page search and improved diagnostics"
git push origin main
```

### Method 2: Using PowerShell Array (No Redirect)

```powershell
cd C:\dev\nsc-qbank\sandbox

# Create harness.py
$lines = @(
    '#!/usr/bin/env python3',
    'import sys',
    '...'
)
$lines | Set-Content -Path "harness.py" -Encoding UTF8
```

---

## NEXT STEPS FOR IMPROVEMENT

### 1. Fix Missing 11 Marks

**Priority: HIGH**

Questions with no marks:
- 3.1.2, 3.1.3, 3.1.5 (Page 16)
- 3.2.1 (Page 17)
- 3.3.2, 3.3.3 (Page 18)

**Investigation needed:**
- Check if marks are on the NEXT page (cross-page boundary)
- Check if marks are in a table format
- Check if marks are in a different notation (not (X))

**Action:** Run marks_location.py on these specific pages to find marks.

### 2. Fix Red Flags (1.4.4 and 3.2.2)

**Priority: HIGH**

**1.4.4:** QP=4, Memo=2 → QP has MORE marks than memo
**3.2.2:** QP=2, Memo=1 → QP has MORE marks than memo

**Root cause:** Section totals bleeding into sub-questions.
- 1.4 section total might be (14) or similar
- 3.2 section total might be (6) or similar

**Fix:** Improve section total detection in parser.

### 3. Add Section Detection

**Priority: MEDIUM**

- Detect section headers (e.g., "QUESTION 1", "SECTION A")
- Map questions to sections
- Skip section totals from marks extraction
- Validate marks per section

### 4. Add Image Extraction

**Priority: MEDIUM**

- Extract images from PDF pages
- Save to uploads/ folder
- Link to item_attachments table
- Include image references in parser output

### 5. Add CAPS Comparison

**Priority: LOW**

- Compare extracted items with CAPS expected structure
- Flag missing or extra items
- Validate marks against CAPS guidelines
- Link to CAPS topics and subtopics

---

## CRITICAL RULES

1. **Always run harness before wizard** - verify parser output first
2. **Check red flags < 5** before importing to database
3. **Verify final marks ~ 150** for standard papers
4. **Test on Geography first** - it has the most complex layout
5. **Commit after each successful test** - maintain git history
6. **Use memo marks as source of truth** - QP marks are secondary
7. **Skip section totals** - marks > 15 are usually section totals
8. **Search cross-page** - marks may be on next page after question

---

## TROUBLESHOOTING

### Issue: "No marks found nearby"

**Cause:** Marks are on a different page or in a different format.
**Fix:** Run page_structure.py to find exact marks location.

### Issue: "QP marks > Memo marks"

**Cause:** Section total marks bleeding into sub-questions.
**Fix:** Improve section total detection (skip marks > 15).

### Issue: "Missing marks"

**Cause:** Marks are in table format or on next page.
**Fix:** Increase search window to 15 lines, search across pages.

### Issue: "Duplicate questions"

**Cause:** Parent headers (2-part numbers) being treated as questions.
**Fix:** Skip 2-part numbers (1.1, 2.4) - these are section headers.

---

## END OF HANDOVER NOTE v8

*Parser v13 ready. Cross-page search implemented. Diagnostics improved.*
*Date: 2026-06-15 22:50 SAST*

**Next Action:** Test parser v13 with harness and verify results.
