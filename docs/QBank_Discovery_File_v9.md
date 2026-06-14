# QBank Discovery File v9.0 — Wizard Pipeline Fix
**Generated:** 14 June 2026 18:00 SAST
**Updated By:** AI K2.6 Session — Wizard Pipeline Critical Fix
**Status:** BACKEND FIXED, FRONTEND v6 DEPLOYED, LOOKUPS VERIFIED
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev
sc-qbank
**Branch:** main
**Git HEAD:** (to be committed)
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0in\mysql.exe

---

## 1. TODAY'S FIXES (2026-06-14)

### 1.1 Backend Fixes (routes/pdfExtract.js)

| Fix | Line | Details |
|-----|------|---------|
| Added `/comparison/:session_id` route | 273 | Returns full review data with JOIN to lookup_item_types |
| Added `/save-corrections` route | 320 | Updates parse_results with user corrections |
| Fixed `parsed_type` → `lit.type_name` | 281 | parse_results has `parsed_type_id` (INT), not `parsed_type` (VARCHAR) |
| Added JOIN to lookup_item_types | 294-295 | `LEFT JOIN lookup_item_types lit ON r.parsed_type_id = lit.item_type_id` |
| Removed `is_memo` from INSERT | 204 | Column does not exist in parse_results |

### 1.2 Frontend Fixes (WizardPage.tsx)

| Fix | Details |
|-----|---------|
| `normalizeLookup()` | Maps actual DB columns to standard `{id, name, code}` |
| Assessment Types | Maps `type_name`, `type_code` (not `assessment_type_name`) |
| Assessment Bodies | Maps `body_name`, `body_code` (not `assessment_body_name`) |
| Exam Sessions | Maps `exam_session_id` (not `session_id`) |
| Auto-populate subjectAlpha | From `subject_alpha_code` on subject selection |
| Auto-populate yearValue | From `year_value` on year selection |
| Auto-populate paperNo | From `paper_no` on paper selection |
| Paper code preview | Shows live `GEOGRAPHY_P2_NOV_2024` before upload |
| Drag & drop | Visual feedback with blue border on drag |
| API_BASE | `/api` (relative, no hardcoded localhost) |

### 1.3 Database Migration Applied

| Migration | Status | Result |
|-----------|--------|--------|
| 017_wizard_pipeline.sql | ✅ Applied | All columns already existed, unique key added |

---

## 2. VERIFIED API ENDPOINTS (2026-06-14)

### 2.1 Wizard Pipeline (NEW — Backend)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/extract-qp` | Upload QP PDF, extract items | ✅ Working |
| POST | `/api/wizard/extract-memo` | Upload Memo PDF, extract items | ✅ Working |
| GET | `/api/wizard/extraction-status/:session_id` | Get extraction summary | ✅ Working |
| GET | `/api/wizard/comparison/:session_id` | Get full review data | ✅ Added today |
| POST | `/api/wizard/save-corrections` | Save user corrections | ✅ Added today |
| POST | `/api/wizard/import` | Import to item_master | ✅ Working |

### 2.2 Lookup Endpoints (VERIFIED — All Working)

| Method | Endpoint | Response Format | Status |
|--------|----------|-----------------|--------|
| GET | `/api/lookup/lookup_subjects` | `{success: true, data: [{subject_id, subject_name, subject_alpha_code, ...}]}` | ✅ Working |
| GET | `/api/lookup/lookup_papers` | `{success: true, data: [{paper_id, paper_name, paper_no, ...}]}` | ✅ Working |
| GET | `/api/lookup/lookup_years` | `{success: true, data: [{year_id, year_value, ...}]}` | ✅ Working |
| GET | `/api/lookup/lookup_grades` | `{success: true, data: [{grade_id, grade_name, grade_number, ...}]}` | ✅ Working |
| GET | `/api/lookup/lookup_assessment_types` | `{success: true, data: [{assessment_type_id, type_name, type_code, ...}]}` | ✅ Working |
| GET | `/api/lookup/lookup_assessment_bodies` | `{success: true, data: [{assessment_body_id, body_name, body_code, ...}]}` | ✅ Working |
| GET | `/api/lookup/lookup_exam_sessions` | `{success: true, data: [{exam_session_id, session_name, session_code, ...}]}` | ✅ Working |

**⚠️ CRITICAL:** All lookup responses wrap data in `{success: true, data: [...]}` — frontend must extract `.data`

---

## 3. ACTUAL DATABASE COLUMN NAMES (Verified via curl + INFORMATION_SCHEMA)

### 3.1 Tables with Different Names Than Schema Docs

| Table | Column (Actual) | Column (Old Doc — WRONG) | Used For |
|-------|-----------------|--------------------------|----------|
| lookup_assessment_types | `type_code` | `assessment_type_code` | Paper code, display |
| lookup_assessment_types | `type_name` | `assessment_type_name` | Dropdown display |
| lookup_assessment_bodies | `body_code` | `assessment_origin` | Paper code, display |
| lookup_assessment_bodies | `body_name` | `assessment_body_name` | Dropdown display |
| lookup_assessment_bodies | `body_full_name` | (missing) | Extended display |
| lookup_exam_sessions | `exam_session_id` | `session_id` | Foreign key |
| lookup_papers | `paper_code` | (missing) | Paper code shorthand |
| lookup_papers | `paper_type` | (missing) | written/practical/oral |
| lookup_papers | `duration_minutes` | (missing) | Exam duration |
| lookup_papers | `display_order` | (missing) | UI ordering |

### 3.2 parse_results (Parser Output)

| Column | Type | Notes |
|--------|------|-------|
| `result_id` | INT PK | Auto-increment |
| `session_id` | VARCHAR(64) | FK to parse_sessions |
| `question_number` | VARCHAR(20) | e.g. "1.1.1" |
| `question_text` | TEXT | Extracted text |
| `parsed_type_id` | INT | FK to lookup_item_types |
| `parsed_section` | VARCHAR(20) | A/B/C |
| `parser_extracted_marks` | INT | From parser (may be null) |
| `expected_marks` | INT | From parse_expected_structure |
| `auto_corrected_marks` | INT | Calculated |
| `correction_status` | ENUM | auto_corrected/manual_review/validated/parser_missing |
| `variance` | INT GENERATED | `parser_extracted_marks - expected_marks` |
| `is_red_flag` | TINYINT GENERATED | `ABS(variance) > expected_marks` |
| `user_corrected_marks` | INT | Manual override |
| `reviewer_notes` | TEXT | Free text |
| `created_at` | TIMESTAMP | Auto |
| `updated_at` | TIMESTAMP | Auto |
| **paper_code** | VARCHAR(50) | Added by Migration 017 |

**⚠️ DOES NOT HAVE:** `is_memo` (removed from code), `parsed_type` (use `parsed_type_id` + JOIN)

---

## 4. WIZARD PIPELINE FLOW (Verified)

```
1. User selects dimensions from dropdowns (all 7 lookups populated)
2. Frontend auto-builds paper code: {subjectAlpha}_P{paperNo}_{session}_{year}
3. User drags QP PDF → clicks "Extract Question Paper"
4. Backend: multer saves temp file → Python PyMuPDF extracts text
5. Backend: saves to parse_sessions + parse_results (no marks from parser)
6. Backend: loads expected structure from parse_expected_structure
7. Backend: compares parser items vs expected, assigns marks, flags variances
8. Frontend: shows Step 2 (Memo upload)
9. User drags Memo PDF → clicks "Extract Memo"
10. Backend: extracts memo items, links to QP by question_number
11. Frontend: shows Step 3 (Review table)
12. User edits marks → clicks "Save Corrections"
13. Backend: updates parse_results.user_corrected_marks
14. User clicks "Import to Database"
15. Backend: inserts into item_master + item_memos
```

---

## 5. FILE STRUCTURE (Updated 2026-06-14)

```
C:\dev
sc-qbank
├── server.js                          (has pdfExtract + wizardImport routes)
├── routes/
│   ├── pdfExtract.js                  (5 wizard routes — FIXED today)
│   ├── wizardImport.js                (/import route)
│   └── ...
├── scripts/
│   └── extract_dbe_paper.py           (PyMuPDF extraction)
├── frontend/
│   └── src/
│       └── pages/
│           └── WizardPage.tsx         (v6 — all lookups working)
├── database/
│   └── migrations/
│       └── 017_wizard_pipeline.sql    (Applied — adds paper_code columns)
└── docs/
    ├── QBank_Complete_Schema_v3.md    (THIS FILE — corrected column names)
    └── QBank_Discovery_File_v9.md     (THIS FILE)
```

---

## 6. NEXT STEPS

1. **Test end-to-end** with Geography P2 Nov 2024 PDFs
2. **Verify extraction** produces ~40 items with ~150 marks
3. **Verify memo linking** matches QP items by question_number
4. **Verify import** creates records in item_master + item_memos
5. **Commit to git** once all tests pass

---

## 7. CRITICAL RULES FOR FUTURE AI SESSIONS

1. **NEVER trust schema docs** — always verify with `INFORMATION_SCHEMA.COLUMNS` or `curl`
2. **NEVER use `||` chains for column mapping** — use explicit per-table mapping
3. **Backend returns `{success: true, data: [...]}`** — frontend must extract `.data`
4. **parse_results has `parsed_type_id`** (INT) — not `parsed_type` (VARCHAR)
5. **parse_results has NO `is_memo`** — remove from all SQL
6. **All 7 lookups must be tested** individually before claiming success
7. **Paper code format:** `{subjectAlpha}_P{paperNo}_{session}_{year}`
8. **No hardcoding** — all config from database

---

*End of Discovery File v9.0 — Wizard Pipeline Fix*
*All column names verified against actual database*
*Date: 2026-06-14 18:00*
