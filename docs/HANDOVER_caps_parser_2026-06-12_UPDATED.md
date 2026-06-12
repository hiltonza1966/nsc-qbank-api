# CAPS PDF Parser Development - Handover Note (Updated)
## Date: 2026-06-12 08:11
## Status: PAUSED — Parser v2.7a deployed but returning empty grades
## Previous Session: 2026-06-12 — Parser development stopped, awaiting diagnostic output

---

## 1. WHAT WAS ACCOMPLISHED (Verified Facts)

### 1.1 Real PDF Structure Discovered (2026-06-12)
After running diagnostics on actual CAPS PDFs, the parser structure is:

```
Section 3 (Teaching Plans) - WHERE ACTUAL DATA LIVES
├── Annual Teaching Plan Grade 10
│   ├── term 1: Formal assessment
│   │   ├── Form of assessmentAssignmentTest
│   │   └── Total marks50100
│   ├── term 2: Formal assessment
│   │   ├── Form of assessmentAssignmentTest
│   │   └── Total marks50100
│   └── ...
├── Annual Teaching Plan Grade 11
│   └── ...
└── Annual Teaching Plan Grade 12
    └── ...

Section 4 (Summary Table) - NOT WHERE DATA LIVES
├── the Programme of assessment in Grade 10
│   ├── term 1term 2term 3term 4 (headers only)
│   └── Assessment names (no per-term details)
└── mark out of: (weighting summary)
```

**Key Discovery:** The actual per-term assessment data (names, marks, weightings) is in **Section 3 (Teaching Plans)**, NOT Section 4.

### 1.2 Files Created (Verified)
- `capsPdfParser_v2.7a_FIXED.js` — Current deployed version (backup in repo root)
- `capsPdfParser_v2.7_REAL.js` — Version with Section 3 parsing logic (backup in repo root)
- `debug-pdf.js` — Diagnostic script to see raw pdf-parse output (in repo root)
- `show-sections.js` — Shows specific sections of PDF text (in repo root)

### 1.3 Current Deployment (Verified)
```
C:\dev\nsc-qbank\routes\capsPdfParser.js  ← v2.7a (const/let bug fixed)
```

### 1.4 Bug Fixed in v2.7a
- **Issue:** `const` variable reassignment error
- **Fix:** Changed `const` to `let` in variable declaration
- **Status:** ✅ Fixed and deployed

---

## 2. WHAT STILL NEEDS FIXING (Verified Problems)

### 2.1 CRITICAL: Parser Returns Empty Grades Array
**File:** `routes/capsPdfParser.js` (v2.7a)
**Symptom:** Parser executes successfully but `grades` array is empty `[]`
**Root Cause:** The parser searches for `Annual Teaching Plan Grade X` pattern in Section 3 text, but the actual PDF text may have different header patterns.
**Evidence:**
- Subject detection works (BUSINESS STUDIES detected correctly)
- Document type detection works
- Section 4 extraction works but is NOT the right source
- Section 3 parsing logic exists but returns empty grade blocks

**Possible Causes:**
1. Header text may differ from `Annual Teaching Plan Grade X` (e.g., `Summary of Annual Teaching Plan`, `Annual Teaching Plan: Grade X`, etc.)
2. Grade block boundaries may not be detected correctly
3. Term boundaries within grade blocks may not be detected correctly
4. Assessment extraction regex may not match actual text patterns

### 2.2 Required Information to Fix
To fix the parser, the following diagnostic output is needed:
1. First 100 lines of `temp/debug-raw.txt` from running `node debug-pdf.js`
2. Actual header text around grade blocks (lines containing "Grade 10", "Grade 11", "Grade 12")
3. Actual term header text (lines containing "term 1", "term 2", etc.)
4. Actual assessment text patterns (lines containing "Form of assessment", "Total marks", etc.)

---

## 3. WHEN YOU RESUME (Next Steps)

### Step 1: Run Diagnostics
```powershell
cd C:\dev\nsc-qbank
node debug-pdf.js "C:\path\to\Business Studies CAPS.pdf"
```

### Step 2: Examine Raw Output
```powershell
Get-Content "temp\debug-raw.txt" | Select-Object -First 100
```

### Step 3: Paste Output to AI
Paste the first 100 lines of `temp\debug-raw.txt` here. The AI will:
1. Identify the exact header patterns in your PDF
2. Adjust `_parseGradeFromTeachingPlans()` to match actual headers
3. Adjust term detection regex
4. Adjust assessment extraction regex
5. Test and iterate

### Step 4: Verify Fix
After parser fix:
```powershell
node -e "const parser = require('./routes/capsPdfParser'); parser.parseCapsPdf('C:\path\to\Business Studies CAPS.pdf').then(r => console.log(JSON.stringify(r.grades, null, 2)))"
```
Expected: Non-empty `grades` array with objects containing:
- `gradeNumber`
- `assessments` array with objects containing:
  - `term`
  - `formOfAssessment`
  - `totalMarks`

---

## 4. PARSER VERSION HISTORY

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| v1.0 | 2026-06-11 | ❌ Broken | Initial version |
| v2.0 | 2026-06-11 | ❌ Broken | Section 4 focus (wrong source) |
| v2.5 | 2026-06-11 | ❌ Broken | Added Section 3 logic |
| v2.7 | 2026-06-11 | ❌ Broken | Real PDF structure discovery |
| v2.7a | 2026-06-12 | 🔄 Deployed but broken | const→let fix, empty grades |
| v2.8 | TBD | ❌ Not created | Needs real PDF diagnostic |

---

## 5. CAPS PARSER REQUIREMENTS (User Approved)

The CAPS parser must extract and seed the following tables:
1. `lookup_caps_topics` — CAPS topics per subject-grade
2. `lookup_caps_subtopics` — CAPS subtopics per topic
3. **NEW REQUIREMENTS (2026-06-12):**
   - Annual Teaching Plan data per grade
   - Assessment data per term (form of assessment, total marks)
   - Programme of Assessment summary
   - Recording & reporting requirements

**Tables to be populated from CAPS PDF:**
- `lookup_caps_topics` (already partially populated for Life Sciences)
- `lookup_caps_subtopics` (NOT populated)
- `paper_template_sections` (NOT populated — needs CAPS data)
- `parse_expected_structure` (partially populated for Life Sciences P1)

---

## 6. FILES IN SANDBOX / BACKUPS

```
C:\dev\nsc-qbank
├── capsPdfParser_v2.7a_FIXED.js    (Backup of deployed version)
├── capsPdfParser_v2.7_REAL.js      (Backup with Section 3 logic)
├── debug-pdf.js                    (Diagnostic script)
├── show-sections.js                (Section viewer)
└── temp/
    └── debug-raw.txt               (Diagnostic output — GENERATED ON RUN)
```

---

## 7. QUICK RESUME COMMANDS

```powershell
cd C:\dev\nsc-qbank

# Check parser version
Get-Content "routes\capsPdfParser.js" | Select-String "parser_version"

# Run diagnostics
node debug-pdf.js "C:\path\to\Business Studies CAPS.pdf"

# Check temp files
Get-Content "temp\debug-raw.txt" | Select-Object -First 50

# Show specific sections
node show-sections.js "C:\path\to\Business Studies CAPS.pdf" "Section 3"

# Test parser directly
node -e "const p = require('./routes/capsPdfParser'); p.parseCapsPdf('C:\path\to\Business Studies CAPS.pdf').then(r => console.log(r))"
```

---

## 8. CRITICAL NOTES

- **DO NOT assume header patterns** — Always verify with actual PDF text
- **Section 3 is the correct source** — NOT Section 4
- **Parser uses pdf-parse** — NOT pdf.js (which is used for QP parser)
- **Empty grades = wrong header patterns** — Fix regex/patterns, not the parser logic
- **Always backup before changes** — Use mysqldump before seeding CAPS data
- **Test with multiple subjects** — Business Studies, Life Sciences, Accounting, etc.

---

*End of CAPS Parser Handover Note (Updated)*
*Status: PAUSED — awaiting real PDF diagnostic output*
*Date: 2026-06-12 08:11*
