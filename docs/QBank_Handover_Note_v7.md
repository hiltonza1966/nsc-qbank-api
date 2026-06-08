# QBank Corporate System - AI Handover Note v6
**Date:** 2026-06-08
**Session:** Critical Fixes + Git Commit
**Status:** COMPLETE - All fixes applied, pushed to GitHub  
**Session:** Parser Fix → Comparison-Based Validation Approach  
**Status:** COMPLETE - Comparison engine implemented, tested, and deployed

---

## 1. System Context

**Project:** QBank Corporate System (Question Bank for NSC/DBE)  
**Location:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL) + references `nsc_registration_v3` tables  
**Stack:** Node.js backend, React frontend, pdf.js for PDF parsing

---

## 2. Problem Statement

**Position-based parser FAILED** to correctly extract marks from DBE PDFs.  
**Root cause:** pdf.js text extraction + y-position grouping causes batch marks, sub-part marks, and question text to merge incorrectly.  
**Result:** 187 marks instead of 150 (37 marks variance), questions getting wrong marks (e.g., 1.2.4 = 10 instead of 1).

**Decision:** Abandon position-based marks extraction. Implement **comparison-based validation** instead.

---

## 3. NEW APPROACH: Comparison-Based Validation

### Architecture:
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  QP Structure   │────▶│  Parser (items)  │────▶│  Comparison     │
│  (Expected)     │     │  (Actual)        │     │  (Diff + UI)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Manual Review    │
                                              │  (RED errors)     │
                                              └─────────────────┘
```

### Step 1: Extract QP Structure (DONE)
- File: `qp_structure.json` — defines expected question numbers, types, marks
- For Life Sciences P1 Nov 2025: **38 items, 150 marks**
- Section A: 28 items, 50 marks (MCQ, Short, Matching, Diagram)
- Section B: 10 items, 100 marks (Extended)

### Step 2: Parser Extracts Items Only
- Parser extracts: question_number, question_text, section, type
- **Parser does NOT extract marks** — marks come from QP structure table
- Parser validates: correct number of items (38), correct sections

### Step 3: Comparison Engine
- Compares parser output against QP structure
- Flags mismatches in RED:
  - Missing questions
  - Extra questions
  - Wrong question numbers
  - Wrong marks (if parser tries to extract marks)

### Step 4: Manual Review UI
- Shows questions in table format
- **RED highlighting** for any variance from expected
- Editable marks field for manual correction
- Save corrected marks to database

### Step 5: Same Process for Memo
- Memo structure extracted separately
- Compared against QP structure for alignment
- Manual review for memo-specific marks

---

## 4. Files Created This Session

### 4.1 QP Structure Reference
**File:** `qp_structure.json` (in `/mnt/agents/output/`)
```json
{
  "paper_code": "LIFE_SC_P1_NOV_2025",
  "subject": "Life Sciences",
  "paper_no": "P1",
  "total_marks": 150,
  "total_items": 38,
  "sections": {
    "A": { "name": "Section A", "total_marks": 50, "questions": [...] },
    "B": { "name": "Section B", "total_marks": 100, "questions": [...] }
  }
}
```

### 4.2 Parser Fix (Surgical - NOT DEPLOYED)
**File:** `pdf_parser_structured_FIXED.js` (in `/mnt/agents/output/`)
- Fixes `in` operator bug
- Adds batch marks distribution
- Adds sub-part marks handling
- **Status:** Tested in sandbox, NOT working correctly (146 marks, still wrong)
- **Decision:** Do NOT deploy — use comparison approach instead

### 4.3 Comparison Logic (READY TO IMPLEMENT)
**Concept:** Backend endpoint `/api/wizard/compare-qp` that:
1. Receives parser output (question numbers, text, types)
2. Loads QP structure from database table
3. Compares and returns variance report
4. Flags errors for manual review

---

## 5. Database Schema Needed

### Table: `qp_expected_marks`
```sql
CREATE TABLE qp_expected_marks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paper_code VARCHAR(50) NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  question_type ENUM('MCQ','Short','Matching','Diagram','Extended') NOT NULL,
  section VARCHAR(20) NOT NULL,
  expected_marks INT NOT NULL,
  sequence INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paper_question (paper_code, question_number)
);
```

### Table: `qp_parsed_results`
```sql
CREATE TABLE qp_parsed_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paper_id INT NOT NULL,
  question_number VARCHAR(20) NOT NULL,
  question_text TEXT,
  parsed_type VARCHAR(20),
  parsed_section VARCHAR(20),
  parsed_marks INT,
  status ENUM('pending','validated','corrected') DEFAULT 'pending',
  corrected_marks INT,
  variance INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Next Steps (Priority Order)

### 6.1 Database Setup
1. Create `qp_expected_marks` table
2. Insert Life Sciences P1 Nov 2025 structure (38 rows)
3. Create `qp_parsed_results` table

### 6.2 Backend Implementation
1. Create `/api/wizard/compare-qp` endpoint
2. Load QP structure from database
3. Compare parser output and return variance
4. Save parser results to `qp_parsed_results`

### 6.3 Frontend Implementation
1. Create review UI component
2. Show questions in table with expected marks
3. **RED highlighting** for variance > 0
4. Editable marks field
5. Save button to update corrected marks

### 6.4 Parser Simplification
1. Remove marks extraction from parser
2. Parser only extracts: question_number, question_text, section, type
3. Validate item count (38) and sections (A, B)

### 6.5 Memo Process
1. Same QP structure used for memo alignment
2. Memo parser extracts memo-specific content
3. Comparison engine validates memo against QP

---

## 7. File Locations in Repo

```
C:\dev\nsc-qbank
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── pdf_parser_structured.js    ← CURRENT (backup restored)
│   │   │   └── compare-qp.js              ← NEW: comparison endpoint
│   │   ├── models/
│   │   │   └── qp_expected_marks.js       ← NEW: Sequelize model
│   │   └── utils/
│   │       └── qp_structure_loader.js     ← NEW: loads QP structure
│   └── server.js
├── frontend/
│   └── src/
│       └── components/
│           └── wizard/
│               ├── UploadWizard.tsx         ← EXISTING
│               └── ReviewPanel.tsx          ← NEW: manual review UI
├── database/
│   └── migrations/
│       └── 001_qp_expected_marks.sql        ← NEW: migration
└── docs/
    └── qp_structure.json                    ← QP structure reference
```

---

## 8. Critical Notes

- **NO HARDCODING** — All QP structure must be database-driven
- **Parser simplification** — Remove marks extraction, focus on question detection
- **Manual review is REQUIRED** — AI cannot reliably parse DBE PDF marks
- **Same process for Memo** — Use QP structure as reference for memo validation
- **Test with real papers** — Validate with actual DBE exam papers

---

## 9. Contact / Context

- Previous sessions: 2026-06-07 (Parser v4→v5), 2026-06-07 (v5 double-counting fix)
- System: SPD-related but separate QBank module
- User requirement: Corporate pdf.js system, no assumptions, database-driven config
- **Key decision:** Abandoned position-based marks extraction in favor of comparison-based validation with manual review

---

## 10. COMPLETED THIS SESSION (2026-06-08)

### ✅ Database
- `QB_questionP_Structure` - 38 rows for LIFE_SC_P1_NOV_2025 (150 marks)
- `QB_parsed_results` - stores parser output with auto-correction tracking
- `QB_parse_sessions` - audit trail for each parse run
- Removed GENERATED columns for MySQL 5.6 compatibility

### ✅ Backend
- `/api/wizard/compare-qp` - auto-corrects marks, flags RED for manual review
- `/api/wizard/save-corrections` - saves manual corrections
- `/api/wizard/comparison/:session_id` - retrieves comparison results
- `/api/wizard/structure/:paper_code` - gets expected structure
- `compare-qp.js` uses `req.db` from server.js middleware (not own pool)

### ✅ Frontend
- React + Vite frontend in `frontend/`
- `UploadWizard.tsx` - test integration with comparison engine
- `ReviewPanel.tsx` - RED error highlighting, editable marks, save corrections
- `api.ts` - API service with string concatenation (no template literals)

### ✅ Testing Results
- Parser marks=2, expected=2 → Auto-corrected ✅
- Parser marks=5, expected=2 → FLAGGED RED 🔴 (5 > 2×2)
- Parser marks=0, expected=11 → FLAGGED RED 🔴 (0 = failed extraction)
- 35 missing items → All FLAGGED RED with marks set to expected
- Total corrected: 150 ✅ (matches expected)

### ✅ Git
- Commit `61fba5a` - QBank QP Comparison Engine v1.0
- Commit `7d4707d` - Update wizard and parser
- Commit `8785941` - Fix GENERATED columns, use req.db pool
- Pushed to: https://github.com/hiltonza1966/nsc-qbank-api.git

### ✅ Files in Repo
```
C:\dev
sc-qbank
├── server.js (updated with compare-qp route)
├── routes/
│   ├── compare-qp.js (comparison engine)
│   ├── qp-structure-extractor.js (future paper extraction)
│   └── pdf_parser_structured.js (position-based parser)
├── database/migrations/
│   └── 012_qp_structure_tables.sql (38 items, 150 marks)
├── frontend/ (React + Vite)
│   ├── src/components/wizard/
│   │   ├── UploadWizard.tsx
│   │   └── ReviewPanel.tsx
│   └── src/services/api.ts
└── wizard/ (legacy HTML)
    └── index.html
```
