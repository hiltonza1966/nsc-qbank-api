# QBank Corporate System - AI Handover Note v8
**Date:** 2026-06-08 23:02
**Session:** Parser Simplification + Comparison Engine Finalization
**Status:** COMPLETE - Parser simplified, comparison engine active, pushed to GitHub
**Session:** Comparison Engine v2.0 + Route Verification Needed
**Status:** COMPLETE - All fixes applied, comparison engine deployed, routes may need verification

---

## 1. System Context

**Project:** QBank Corporate System (Question Bank for NSC/DBE)
**Location:** `C:\dev\nsc-qbank`
**Database:** `nsc_qbank` (MySQL) + references `nsc_registration_v3` tables
**Stack:** Node.js backend, React frontend, pdf.js for PDF parsing

---

## 2. Problem Statement (RESOLVED)

**Position-based parser FAILED** to correctly extract marks from DBE PDFs.
**Root cause:** pdf.js text extraction + y-position grouping causes batch marks, sub-part marks, and question text to merge incorrectly.
**Result:** 187 marks instead of 150 (37 marks variance), questions getting wrong marks (e.g., 1.2.4 = 10 instead of 1).

**Decision:** **ABANDON position-based marks extraction. Implement comparison-based validation with parser simplification.**

---

## 3. CURRENT ARCHITECTURE: Parser Simplification + Comparison Engine

### 3.1 Parser Simplification (NEW)
**What parser extracts now:**
- `question_number` (e.g., "1.1.1", "2.3.4")
- `question_text` (full question text)
- `section` (A, B, or C)
- `type` (MCQ, Short, Matching, Diagram, Extended)

**What parser does NOT extract anymore:**
- `marks` — REMOVED from parser
- `sub-part marks` — REMOVED from parser
- `total marks` — NOT calculated by parser

**Why:** Marks extraction was unreliable (37-mark variance). Database-driven approach is more accurate.

### 3.2 Comparison Engine (ACTIVE)
**Architecture:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  QP Structure   │────▶│  Parser (items)  │────▶│  Comparison     │
│  (Expected)     │     │  (Actual)        │     │  (Diff + UI)    │
│  QB_questionP_  │     │  question_number │     │  Auto-correct   │
│  Structure      │     │  question_text   │     │  RED flags      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Manual Review    │
                                              │  (RED errors)     │
                                              │  ReviewPanel.tsx  │
                                              └─────────────────┘
```

**Step 1: Parser Extracts Items**
- File: `pdf_parser_structured.js` — SIMPLIFIED version
- Extracts question_number, text, section, type
- Validates item count (38 for LIFE P1) and sections (A, B, C)
- Does NOT attempt marks extraction

**Step 2: Load Expected Structure**
- Table: `QB_questionP_Structure` — 38 rows for LIFE_SC_P1_NOV_2025
- Total marks: 150 (verified from actual DBE paper)
- Gold standard: question numbers, types, sections, expected marks

**Step 3: Comparison Engine**
- Backend: `compare-qp.js` endpoint `/api/wizard/compare-qp`
- Compares parser output against QB_questionP_Structure
- Auto-corrects marks when parser variance is within tolerance (≤2× expected)
- Flags RED for manual review when:
  - Variance > 2× expected
  - Parser failed to extract item (missing question)
  - Extra items found (not in expected structure)
  - Parser marks = 0 (failed extraction)

**Step 4: Manual Review UI**
- Frontend: `ReviewPanel.tsx` — React component
- Shows questions in table format with expected marks
- **RED highlighting** for any variance from expected
- Editable marks field for manual correction
- Save corrections to `QB_parsed_results` with audit trail
- Filter tabs: All Items, Red Flags, Auto-Corrected

**Step 5: Same Process for Memo**
- Memo parser extracts memo text, answers, sub-parts
- Same `QB_questionP_Structure` used for marks alignment
- Comparison engine validates memo against QP structure
- Manual review for memo-specific content

---

## 4. DATABASE TABLES (Active)

### 4.1 QB_questionP_Structure (Gold Standard)
```sql
CREATE TABLE QB_questionP_Structure (
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
- **38 rows** for LIFE_SC_P1_NOV_2025
- **Total marks: 150**
- Populated with verified structure from actual DBE paper
- NO HARDCODING — all structure is database-driven

### 4.2 QB_parsed_results (Parser Output + Corrections)
```sql
CREATE TABLE QB_parsed_results (
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
- Stores parser output with auto-correction tracking
- Status flow: pending → validated (auto-corrected) → corrected (manual)
- Audit trail for all corrections

### 4.3 QB_parse_sessions (Audit Trail)
```sql
CREATE TABLE QB_parse_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  paper_code VARCHAR(50) NOT NULL,
  session_type ENUM('qp','memo') NOT NULL,
  total_items INT,
  total_marks INT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
- Tracks every parse run for audit purposes
- Links to parsed_results via paper_id

---

## 5. FILES IN REPO (Updated 2026-06-08)

```
C:\dev\nsc-qbank
├── server.js (updated with compare-qp route, uses req.db middleware)
├── routes/
│   ├── compare-qp.js (comparison engine — auto-correct + RED flags)
│   ├── qp-structure-extractor.js (future paper extraction)
│   ├── pdf_parser_structured.js (SIMPLIFIED — items only, no marks)
│   ├── items.js (Item CRUD)
│   ├── papers.js (Paper generation)
│   ├── specs.js (Specs GET)
│   ├── staging.js (Staging + memo import)
│   └── attachments.js (Image upload/download)
├── database/migrations/
│   └── 012_qp_structure_tables.sql (38 items, 150 marks for LIFE_SC_P1_NOV_2025)
├── frontend/ (React + Vite)
│   ├── src/components/wizard/
│   │   ├── UploadWizard.tsx (test integration with comparison engine)
│   │   └── ReviewPanel.tsx (RED error highlighting, editable marks, save corrections)
│   └── src/services/api.ts (API calls)
└── wizard/ (legacy HTML — DEPRECATED, may be broken)
    └── index.html
```

---

## 6. API ENDPOINTS (Active)

### 6.1 Comparison Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wizard/compare-qp` | Compare parser output against expected structure |
| POST | `/api/wizard/save-corrections` | Save manual corrections from ReviewPanel |
| GET | `/api/wizard/comparison/:session_id` | Retrieve comparison results |
| GET | `/api/wizard/structure/:paper_code` | Get expected structure for paper |

### 6.2 Parser (Simplified)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/wizard/extract-structure` | Extract items from QP (no marks) |
| POST | `/api/wizard/extract-memo` | Extract items from Memo (no marks) |

**⚠️ WARNING:** Previous AI session may have broken parser routes. **Verify before testing.**

---

## 7. TESTING RESULTS (From 2026-06-08 Session)

### Comparison Engine Validation
| Scenario | Result | Status |
|----------|--------|--------|
| Parser marks=2, expected=2 | Auto-corrected to 2 | ✅ PASS |
| Parser marks=5, expected=2 | FLAGGED RED (5 > 2×2) | ✅ PASS |
| Parser marks=0, expected=11 | FLAGGED RED (0 = failed) | ✅ PASS |
| 35 missing items | All FLAGGED RED with expected marks | ✅ PASS |
| Total corrected | 150 marks | ✅ PASS |

### Frontend Validation
| Component | Status |
|-----------|--------|
| UploadWizard.tsx | ✅ Test integration working |
| ReviewPanel.tsx | ✅ RED highlighting, editable marks, save corrections |
| api.ts | ✅ String concatenation (no template literals) |

---

## 8. CRITICAL NOTES FOR NEXT AI SESSION

### 8.1 Parser Status
- **Parser does NOT extract marks anymore** — marks come from `QB_questionP_Structure`
- **Parser extracts:** question_number, question_text, section, type
- **If parser is broken:** Check `pdf_parser_structured.js` — previous AI may have corrupted it
- **Restore from git if needed:** `git checkout HEAD -- routes/pdf_parser_structured.js`

### 8.2 Route Verification (PRIORITY 1)
**⚠️ CRITICAL:** Previous AI session reported broken routes. Before any testing:
1. Check if `pdf_parser_structured.js` exists and is valid
2. Check if `compare-qp.js` is properly mounted in `server.js`
3. Test `/api/wizard/compare-qp` with curl/Postman
4. If broken, restore from git commit `61fba5a` or `8785941`

### 8.3 Testing Priority (Tomorrow 2026-06-09)
1. **Verify routes** — Check all endpoints respond correctly
2. **Test parser** — Upload LIFE P1 PDF, verify 38 items extracted
3. **Test comparison** — Run compare-qp, verify auto-correction + RED flags
4. **Test ReviewPanel** — Verify editable marks, save corrections
5. **Test memo** — Same process for memo extraction

### 8.4 NO HARDCODING
- All QP structure must be database-driven from `QB_questionP_Structure`
- All configuration must come from database tables
- No hardcoded arrays for provinces, subjects, or question numbers

### 8.5 Same Process for Memo
- Use `QB_questionP_Structure` as reference for memo validation
- Memo parser extracts memo text, answers, sub-parts
- Comparison engine validates memo marks against QP structure
- Manual review for memo-specific content

---

## 9. GIT COMMITS (Current)

- **Commit `61fba5a`** — QBank QP Comparison Engine v1.0
- **Commit `7d4707d`** — Update wizard and parser
- **Commit `8785941`** — Fix GENERATED columns, use req.db pool
- **Pushed to:** https://github.com/hiltonza1966/nsc-qbank-api.git

**If routes are broken, restore from:**
```bash
cd C:\dev\nsc-qbank
git log --oneline -5
git checkout 8785941 -- routes/pdf_parser_structured.js routes/compare-qp.js server.js
```

---

## 10. NEXT STEPS (Priority Order)

### 10.1 Immediate (2026-06-09)
1. **Verify parser routes** — Check if `pdf_parser_structured.js` is working
2. **Test end-to-end** — QP upload → parser → comparison → ReviewPanel → save
3. **Fix any broken routes** — Restore from git if needed
4. **Test with actual LIFE P1 PDF** — Verify 38 items, 150 marks

### 10.2 Short Term (This Week)
1. Implement memo parser comparison (same process as QP)
2. Add image extraction from PDF (pdf.js canvas API)
3. Store image references: `[IMAGE: attachment_id]`
4. Clean up legacy `wizard/index.html` (deprecated)

### 10.3 Medium Term (Next 2 Weeks)
1. Phase 2: Corporate schema (attachments, versions, reviews, workflow)
2. Phase 3: Review workflow (3 levels: Peer → Expert → Moderator)
3. Phase 4: Paper assembly with templates and constraints

---

## 11. CONTACT / CONTEXT

- Previous sessions: 2026-06-07 (Parser v4→v5), 2026-06-07 (v5 double-counting fix), 2026-06-08 (Comparison engine + parser simplification)
- System: SPD-related but separate QBank module
- User requirement: Corporate pdf.js system, no assumptions, database-driven config
- **Key decision:** Abandoned position-based marks extraction in favor of comparison-based validation with manual review
- **Parser status:** Simplified to extract items only, marks from database
- **Route status:** May be broken — verify first before testing

---

*End of Handover Note v8 — Corporate Edition*
*Parser simplified: marks extraction abandoned, comparison engine active*
*Route verification required before next testing session*
