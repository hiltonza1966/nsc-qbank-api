# QBank Wizard - AI Handover Note v7
**Version:** v7.0  
**Date:** 15 June 2026 22:30 SAST  
**System:** NSC QBank Corporate System  
**Repository:** C:\dev\nsc-qbank  
**Database:** nsc_qbank (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (node server.js from repo root)  
**Frontend Port:** 3000 (npm run dev from frontend/)  
**Git Branch:** main  
**Last Commit:** 2c2fdec - Parser v11 tested, harness improved  

---

## PARSER STATUS (2026-06-15 22:30)

### Current Results (Geography P2 Nov 2024)

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| QP Items | 76 | ~40 | High (may include sub-questions) |
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

## HARNESS USAGE GUIDE

### File Location
```
sandbox/
├── harness.py              # Main test harness
├── diagnostic.py           # PDF structure diagnostic
├── diagnostic_marks.py     # Marks extraction diagnostic
└── extract_dbe_paper.py    # Production parser
```

### How to Run the Harness

```powershell
# 1. Navigate to sandbox
cd C:\dev\nsc-qbank\sandbox

# 2. Run harness with both PDFs
python harness.py "<qp_pdf_path>" "<memo_pdf_path>" "<paper_code>"

# Example:
python harness.py "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\Question Papers\Geography P2 Nov 2024 Eng.pdf" "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\Question Papers\Geography P2 Nov 2024 MG Eng.pdf" "GEOG_P2_NOV_2024"
```

### Harness Output

```json
{
  "paper_code": "GEOG_P2_NOV_2024",
  "qp_items": 76,
  "qp_marks": 86,
  "mg_items": 76,
  "mg_marks": 86,
  "final_marks": 139,
  "red_flags": 2,
  "qp_hash": "270332fc",
  "mg_hash": "66ccb9e9",
  "top_issues": [...]
}
```

### How to Run Diagnostics

```powershell
# Diagnostic 1: PDF structure (shows text around question numbers)
python diagnostic.py "<pdf_path>"

# Diagnostic 2: Marks extraction (shows all marks found per question)
python diagnostic_marks.py "<pdf_path>"
```

---

## HOW TO COPY HARNESS TO REPO

### Method 1: Direct Copy (Recommended)
```powershell
# Copy harness files to repo sandbox
cd C:\dev\nsc-qbank
Copy-Item "sandbox\harness.py" "sandbox\harness.py" -Force
Copy-Item "sandbox\diagnostic.py" "sandbox\diagnostic.py" -Force
Copy-Item "sandbox\diagnostic_marks.py" "sandbox\diagnostic_marks.py" -Force
Copy-Item "scripts\extract_dbe_paper.py" "scripts\extract_dbe_paper.py" -Force

# Commit to git
git add sandbox/harness.py sandbox/diagnostic.py sandbox/diagnostic_marks.py scripts/extract_dbe_paper.py
git commit -m "feat: Parser v11 with harness diagnostics"
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

## NEXT STEPS FOR HARNESS IMPROVEMENT

### 1. Add Section Detection
- Detect section headers (e.g., "QUESTION 1", "SECTION A")
- Map questions to sections
- Skip section totals from marks extraction

### 2. Add Marks Validation
- Compare extracted marks with expected total from paper header
- Flag if sum of marks != total marks stated in paper

### 3. Add Image Extraction
- Extract images from PDF pages
- Save to uploads/ folder
- Link to item_attachments table

### 4. Add CAPS Comparison
- Compare extracted items with CAPS expected structure
- Flag missing or extra items
- Validate marks against CAPS guidelines

### 5. Add Detailed Logging
- Log each question extraction step
- Log marks found and marks missed
- Log deduplication decisions
- Save to parser.log file

---

## CRITICAL RULES

1. **Always run harness before wizard** - verify parser output first
2. **Check red flags < 5** before importing to database
3. **Verify final marks ~ 150** for standard papers
4. **Test on Geography first** - it has the most complex layout
5. **Commit after each successful test** - maintain git history

---

## END OF HANDOVER NOTE v7

*Parser v11 tested. Harness improved. Ready for continued development.*
*Date: 2026-06-15 22:30 SAST*
