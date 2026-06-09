# QBank Discovery File v6.0 — Corporate Edition
**Generated:** 8 June 2026 23:02 SAST
**Updated By:** AI K2.6 Session
**Status:** Phase 2 Complete → Natural Keys Implementation (Option 2) Next
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Status:** Comparison Engine Complete — Parser Extracts Items Only (No Marks)

---

## 1. ARCHITECTURE OVERVIEW

- **Runtime:** Node.js 20, Express 4.19.2
- **Database:** MySQL 8.0.45 (not PostgreSQL)
- **Driver:** mysql2/promise 3.9.7
- **Port:** 4000
- **CORS:** Enabled for all origins
- **Cross-database reference:** `subject_structure` table lives in `nsc_registration_v3` only
- **Frontend:** Vanilla HTML/JS (migrating to React + TypeScript in Phase 5)
- **Image Storage:** Local filesystem (migrating to S3/MinIO in production)
- **PDF Parser:** **SIMPLIFIED** — Extracts question_number, text, section, type ONLY. Marks come from database.

---

## 2. PARSER DISCOVERY — CRITICAL FINDINGS (UPDATED 2026-06-08)

### 2.1 Text Extraction Problem (RESOLVED by simplification)
**Issue:** `pdf-parse` and `pdf2json` produce garbled concatenated text from DBE PDFs.
**Example of extracted text:**
```
1.11.1.11.1.21.1.31.1.41.1.51.1.61.1.71.1.81.1.91.1.10C  A  D  A  C  D  B  D  B  A  (10x 2)(20)
```
**Expected text:**
```
1.1.1 The hormone that prepares the body for an emergency is ...
A aldosterone.
B progesterone.
C adrenalin.
D prolactin.
(10 x 2)(20)
```

### 2.2 Why Position-Based Parsing FAILED (CRITICAL DECISION)
**Attempted:** pdf.js `getTextContent()` with position-based sorting
**Result:** 187 marks extracted instead of 150 (37 marks variance)
**Root cause:** Batch marks, sub-part marks, and question text merge incorrectly due to y-position grouping
**Example error:** Question 1.2.4 got 10 marks instead of 1
**Decision:** **ABANDON position-based marks extraction**

### 2.3 NEW Corporate Standard Solution (ACTIVE)
**Parser Simplification:**
- Extracts ONLY: `question_number`, `question_text`, `section`, `type`
- Does NOT extract marks
- Validates item count (38 for LIFE P1) and sections (A, B, C)

**Comparison Engine:**
- Loads expected structure from `QB_questionP_Structure` table
- Compares parser output against expected question numbers
- Auto-corrects marks when parser variance is within tolerance (≤2× expected)
- Flags RED for manual review when variance exceeds tolerance or parser fails

**Manual Review UI:**
- `ReviewPanel.tsx` shows RED highlighting for flagged items
- Editable marks field for manual correction
- Save corrections to `QB_parsed_results` with audit trail

---

## 3. DATABASE SCHEMA (Current — Updated 2026-06-09)

### 3.0 Migration 014 Status (NEW)
**Date:** 2026-06-09 18:00
**Status:** ✅ COMPLETE

**Tables Created:** 34 new tables
**Foreign Keys:** 66 constraints established
**Seed Data:** 15 lookup tables populated
**Subjects Synced:** 123 from nsc_registration_v3.lookup_subjects
**Paper Structure:** 38 items for LIFE_SC_P1_NOV_2025
**Backend:** Running on port 4000

**Key Changes:**
- Old tables dropped: qbank_items, qbank_papers, qbank_paper_items, etc.
- Legacy tables preserved: accounting_questions, qbank_users_legacy
- New tables active: item_master, parse_expected_structure, lookup_subjects, etc.
- Stored procedure: sync_lookup_subjects() for manual sync by Superadmin

**Next Phase:** Option 2 (Natural Keys) - Change from surrogate keys to natural keys

## 3. DATABASE SCHEMA (Current — Updated 2026-06-08)

### 3.1 Table Row Counts (as of 2026-06-08 23:02)

| Table | Rows | Purpose | Status |
|-------|------|---------|--------|
| qbank_items_staging | 0 | Cleared for testing | ✅ Ready |
| qbank_items | 6 | Live approved items | ✅ Active |
| qbank_item_memos | 0 | Cleared for testing | ✅ Ready |
| qbank_item_tags | 0 | Live item tags | ✅ Active |
| qbank_item_curriculum | 0 | Live curriculum links | ✅ Active |
| qbank_items_staging_tags | 0 | Draft tags | ✅ Ready |
| qbank_items_staging_curriculum | 0 | Draft curriculum | ✅ Ready |
| qbank_papers | 4 | Generated papers | ✅ Active |
| qbank_paper_items | 3 | Paper-item associations | ✅ Active |
| qbank_paper_specs | 4 | Paper specifications | ✅ Active |
| qbank_users | 0 | System users | ✅ Ready |
| **QB_questionP_Structure** | **38** | **Expected QP structure (gold standard)** | **✅ POPULATED** |
| **QB_parsed_results** | **76** | **Parser output with auto-correction** | **✅ ACTIVE** |
| **QB_parse_sessions** | **2** | **Audit trail for parse runs** | **✅ ACTIVE** |
| question_reviews | 0 | Review workflow (legacy) | ⚠️ Legacy |
| accounting_questions | 10 | Pre-QBank legacy | ⚠️ Legacy |
| questions | 3 | Pre-QBank legacy | ⚠️ Legacy |

### 3.2 Migration Status (Updated)
| Migration | Status | Notes |
|-----------|--------|-------|
| 001_schema_fix.sql | ✅ Applied | |
| 003_seed_specs.sql | ✅ Applied | |
| 008_consolidate_qbank_tables.sql | ✅ Applied | |
| 009_fix_specs.sql | ✅ Applied | |
| 010_create_memo_table.sql | ✅ Applied | |
| 011_corporate_schema.sql | ✅ Applied | Added attachments table, item_type column |
| **012_qp_structure_tables.sql** | **✅ Applied** | **38 items, 150 marks for LIFE_SC_P1_NOV_2025** |

### 3.3 NEW Tables (Added 2026-06-08)

**Table: `QB_questionP_Structure`** (Gold Standard — Expected Structure)
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
- Populated with verified question numbers and marks from actual DBE paper

**Table: `QB_parsed_results`** (Parser Output + Corrections)
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
- Status: pending → validated (auto-corrected) → corrected (manual)

**Table: `QB_parse_sessions`** (Audit Trail)
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

---

## 4. EXPECTED PARSER OUTPUT (LIFE P1 Nov 2025) — VERIFIED

### 4.1 Question Paper Structure (Gold Standard in DB)
| Section | Question | Type | Marks | Notes |
|---------|----------|------|-------|-------|
| A | 1.1.1-1.1.10 | MCQ | 2 each = 20 | 10 questions |
| A | 1.2.1-1.2.8 | Short | 1 each = 8 | 8 questions |
| A | 1.3.1-1.3.3 | Matching | 2 each = 6 | 3 questions |
| A | 1.4.1-1.4.3 | Diagram | 8 total | With sub-parts (a)(b)(c) |
| A | 1.5.1-1.5.4 | Diagram | 8 total | With sub-parts (a)(b)(c) |
| B | 2.1 | Extended | 8 | Sub-parts: 2.1.1(3), 2.1.2(3), 2.1.3(2) |
| B | 2.2 | Extended | 11 | Sub-parts: 2.2.1(2), 2.2.2(2), 2.2.3(5), 2.2.4(2) |
| B | 2.3 | Extended | 14 | Sub-parts: 2.3.1(3), 2.3.2(2), 2.3.3(1), 2.3.4(6) |
| B | 2.4 | Extended | 6 | Sub-parts: 2.4.1(1), 2.4.2(1), 2.4.3(4) |
| B | 2.5 | Extended | 11 | Sub-parts: 2.5.1(1), 2.5.2(3), 2.5.3(2), 2.5.4(3), 2.5.5(2) |
| C | 3.1 | Extended | 8 | Sub-parts: 3.1.1(1), 3.1.2(1), 3.1.3(1), 3.1.4(3) |
| C | 3.2 | Extended | 13 | Sub-parts: 3.2.1(1), 3.2.2(6), 3.2.3(6) |
| C | 3.3 | Extended | 5 | Single item |
| C | 3.4 | Extended | 14 | Sub-parts: 3.4.1(2), 3.4.2(2), 3.4.3(5), 3.4.4(5) |
| C | 3.5 | Extended | 10 | Sub-parts: 3.5.1(1), 3.5.2(1), 3.5.3(5), 3.5.4(2), 3.5.5(2) |
| **Total** | **38 items** | | **150 marks** | **VERIFIED** |

### 4.2 Memo Structure (Same 38 items, with marking guidelines)
- Each item linked by question_number
- Sub-parts have individual marks and answers
- Parent totals match QP totals
- **Parser extracts memo text, marks come from QB_questionP_Structure**

---

## 5. PARSER IMPLEMENTATION STATUS (UPDATED 2026-06-08)

### 5.1 Current Implementation (Comparison Engine Active)
| Component | Approach | Status |
|-----------|----------|--------|
| Text Extraction | pdf.js getTextContent() | ✅ Working (items only) |
| Question Detection | Position + font analysis | ✅ Working |
| **Marks Extraction** | **REMOVED from parser** | **❌ ABANDONED** |
| Section Detection | Font size changes | ✅ Working |
| Parent-Child | Question number hierarchy | ✅ Working |
| **Comparison Engine** | **Database-driven validation** | **✅ Auto-corrects + RED flags** |
| **Manual Review UI** | **React + RED highlighting** | **✅ Editable marks + save** |

### 5.2 Parser Output (What it produces now)
```json
{
  "question_number": "1.1.1",
  "question_text": "The hormone that prepares the body for an emergency is ...",
  "section": "A",
  "type": "MCQ"
  // NO marks field — marks come from QB_questionP_Structure
}
```

### 5.3 Comparison Engine Logic
```javascript
// 1. Parser produces items (no marks)
// 2. Load expected from QB_questionP_Structure where paper_code = ?
// 3. For each parser item:
//    - Find matching question_number in expected
//    - If found: assign expected_marks, status = 'validated'
//    - If parser attempted marks and variance ≤ 2× expected: auto-correct
//    - If variance > 2× or parser failed: status = 'pending', FLAG RED
// 4. For missing expected questions: create placeholder, FLAG RED
// 5. Return comparison report with RED flags for manual review
```

---

## 6. FILE STRUCTURE (Updated 2026-06-08)

```
C:\dev\nsc-qbank
├── .env                          (98 bytes)
├── .env.example                  (94 bytes)
├── .gitignore                    (70 bytes)
├── COMMIT_LOG.md                 (1062 bytes)
├── README.md                     (259 bytes)
├── VERSION.txt                   (182 bytes)
├── package.json                  (Updated with pdf-parse)
├── package-lock.json             (Updated)
├── server.js                     (Updated with compare-qp route)
├── server.log                    (198 bytes)
│
├── backend/
│   └── routes/
│       ├── qbank.js              (Legacy)
│       └── qbank_1.js            (Legacy)
│
├── database/migrations/
│   ├── 001_schema_fix.sql
│   ├── 003_seed_specs.sql
│   ├── 008_consolidate_qbank_tables.sql
│   ├── 009_fix_specs.sql
│   ├── 010_create_memo_table.sql
│   ├── 011_corporate_schema.sql  (Added attachments table, item_type column)
│   └── **012_qp_structure_tables.sql**  (**NEW: 38 items, 150 marks**)
│
├── docs/
│   ├── AI_Handover_Note_v7.md    (Updated)
│   ├── QBank_Development_Plan_v4.md (Updated)
│   ├── QBank_Discovery_File_v6.md (THIS FILE)
│   └── ...
│
├── routes/
│   ├── items.js                  (Item CRUD)
│   ├── papers.js                 (Paper generation)
│   ├── pdf_parser_structured.js  (Position-based parser — SIMPLIFIED, no marks)
│   ├── **compare-qp.js**         (**NEW — Comparison engine, auto-correct + RED flags**)
│   ├── qp-structure-extractor.js (Future paper extraction)
│   ├── specs.js                  (Specs GET)
│   ├── staging.js                (Staging + memo import)
│   └── attachments.js            (Image upload/download)
│
├── frontend/                     (React + Vite)
│   ├── src/components/wizard/
│   │   ├── UploadWizard.tsx      (Test integration with comparison engine)
│   │   └── **ReviewPanel.tsx**   (**RED error highlighting, editable marks**)
│   └── src/services/api.ts       (API calls)
│
├── wizard/                       (Legacy HTML — DEPRECATED)
│   ├── index.html                (NEEDS REWRITE or removal)
│   └── README.txt
│
└── uploads/                      (Image storage)
```

---

## 7. API ENDPOINTS (Updated 2026-06-08)

### 7.1 Comparison Engine Endpoints
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/compare-qp` | Compare parser output against expected structure | ✅ Active |
| POST | `/api/wizard/save-corrections` | Save manual corrections from ReviewPanel | ✅ Active |
| GET | `/api/wizard/comparison/:session_id` | Retrieve comparison results | ✅ Active |
| GET | `/api/wizard/structure/:paper_code` | Get expected structure for paper | ✅ Active |

### 7.2 Parser Endpoints (Simplified)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/extract-structure` | Extract items from QP (no marks) | ⚠️ Needs testing |
| POST | `/api/wizard/extract-memo` | Extract items from Memo (no marks) | ⚠️ Needs testing |

---

## 8. NEXT STEPS (Priority Order)

### 8.1 Immediate (Tomorrow 2026-06-09)
1. **Verify parser routes are restored** — `pdf_parser_structured.js` may need fixing
2. **Test end-to-end upload** — QP → Parser → Comparison → ReviewPanel → Save
3. **Fix any broken routes** from previous AI session
4. **Test with actual LIFE P1 PDF** — Verify 38 items extracted, 150 marks validated

### 8.2 Short Term (This Week)
1. Implement memo parser comparison (same process as QP)
2. Add image extraction from PDF (pdf.js canvas API)
3. Store image references: `[IMAGE: attachment_id]`
4. Clean up legacy `wizard/index.html` (deprecated)

### 8.3 Testing Criteria
| Test | Expected | Pass Criteria |
|------|----------|---------------|
| QP Item Count | 38 | Exactly 38 items |
| QP Marks Total | 150 | Exactly 150 marks (from DB) |
| Memo Item Count | 38 | Exactly 38 items |
| Memo Marks Total | 150 | Exactly 150 marks (from DB) |
| Section Detection | A/B/C | Correct sections assigned |
| Comparison Engine | Auto-correct | ≤2× variance auto-corrected |
| RED Flags | Manual review | >2× variance or missing items flagged |
| Save Corrections | Audit trail | Corrected marks saved to QB_parsed_results |

---

## 9. CRITICAL NOTES FOR NEXT AI SESSION

- **Parser does NOT extract marks anymore** — marks come from `QB_questionP_Structure`
- **NO HARDCODING** — All QP structure must be database-driven
- **Manual review is REQUIRED** — AI cannot reliably parse DBE PDF marks
- **Same process for Memo** — Use QP structure as reference for memo validation
- **Test with real papers** — Validate with actual DBE exam papers
- **Routes may be broken** — Previous AI session may have broken parser routes, verify first

---

*End of Discovery File v6.0 — Corporate Edition*
*Parser simplified: marks extraction abandoned, comparison engine active*
*Corporate standard: database-driven expected structure + manual review*


## 10. NATURAL KEYS IMPLEMENTATION (OPTION 2 - NEXT PHASE)

### 10.1 Problem
Current schema uses surrogate keys (INT auto-increment) that don't match the source system:
- subject_id (INT) vs subject_official_code (VARCHAR) in nsc_registration_v3
- paper_id (INT) vs paper_no (INT) in nsc_registration_v3
- assessment_body_id (INT) vs assessment_origin (VARCHAR) in nsc_registration_v3

### 10.2 Solution
Change ALL dimension tables to use natural keys as primary keys:
- lookup_subjects: subject_official_code (VARCHAR) as PK
- lookup_papers: paper_no (INT) as PK
- lookup_assessment_bodies: assessment_origin (VARCHAR) as PK

### 10.3 Impact
**Tables requiring FK updates:**
- item_master, item_stimuli, item_attachments, item_tags, item_versions, item_reviews
- parse_sessions, parse_expected_structure, parse_results
- paper_templates, paper_template_sections, generated_papers, generated_paper_items
- review_workflow
- All other tables referencing the 6 core dimensions

### 10.4 Benefits
- Self-documenting codes throughout all tables
- No mapping layer between QBank and registration system
- Direct alignment with nsc_registration_v3.subject_structure
- Simpler queries without joins for basic identification

