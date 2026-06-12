# QBank Discovery File v8.0 — Corporate Edition
**Generated:** 12 June 2026 08:11 SAST
**Updated By:** AI K2.6 Session — Document Synchronization
**Status:** PARSER PAUSED at v2.7a — Comparison Engine Fix Applied but NOT Verified — Frontend White Screen Unresolved
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** 2a392c8 (as of 2026-06-09 15:59 session)
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
**MySQL Dump Path:** C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe

---

## 1. ARCHITECTURE OVERVIEW (VERIFIED FACTS)

- **Runtime:** Node.js v24.14.0, Express 4.19.2
- **Database:** MySQL 8.0.45 (NOT PostgreSQL)
- **Driver:** mysql2/promise 3.9.7
- **Port:** 4000
- **CORS:** Enabled for all origins
- **Cross-database reference:** `nsc_registration_v3` contains `subject_structure` and `lookup_subjects`
- **Frontend:** React + TypeScript + Vite (migrated from vanilla HTML)
- **Frontend Dev Server:** Port 3000
- **Frontend Build:** `npm run build` in `frontend/` directory
- **Image Storage:** Local filesystem `C:\dev\nsc-qbank\uploads\`
- **PDF Processing:** pdf.js for QP parser, pdf-parse for CAPS parser
- **GitHub:** https://github.com/hiltonza1966/nsc-qbank-api.git

---

## 2. PARSER DISCOVERY — CRITICAL FINDINGS (UPDATED 2026-06-12)

### 2.1 QP Parser (pdf_parser_structured.js) — WORKING
**Status:** WORKING (verified 2026-06-09)
- Extracts 29 items from Geography P1 Nov 2025 PDF
- 2190 text items → 456 lines → 29 atomic items
- Output: question_number, question_text, section, type, marks (from batch totals)
- File: `routes/pdf_parser_structured.js`

### 2.2 CAPS Parser (capsPdfParser.js) — BROKEN at v2.7a
**Status:** DEPLOYED but BROKEN (empty grades)
**File:** `routes/capsPdfParser.js` (v2.7a)
**Key Discovery (2026-06-12):**
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
**Root Cause:** Parser searches for `Annual Teaching Plan Grade X` but actual PDF text may have different headers. Need real PDF diagnostic to determine exact header patterns.
**Fix Needed:** Adjust `_parseGradeFromTeachingPlans()` to match actual header patterns.

### 2.3 Text Extraction Problem (RESOLVED by simplification for QP Parser)
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
**Solution:** QP parser uses pdf.js `getTextContent()` with position-based sorting. CAPS parser uses pdf-parse.

### 2.4 Why Position-Based Parsing FAILED for Marks (CRITICAL DECISION)
**Attempted:** pdf.js `getTextContent()` with position-based sorting for marks extraction
**Result:** 187 marks extracted instead of 150 (37 marks variance)
**Root cause:** Batch marks, sub-part marks, and question text merge incorrectly due to y-position grouping
**Example error:** Question 1.2.4 got 10 marks instead of 1
**Decision:** ABANDON position-based marks extraction in QP parser. Marks come from database `parse_expected_structure`.

---

## 3. DATABASE SCHEMA (Current — Updated 2026-06-12)

### 3.0 Migration Status

| Migration | Status | Notes |
|-----------|--------|-------|
| 001_schema_fix.sql | ✅ Applied | |
| 003_seed_specs.sql | ✅ Applied | |
| 008_consolidate_qbank_tables.sql | ✅ Applied | |
| 009_fix_specs.sql | ✅ Applied | |
| 010_create_memo_table.sql | ✅ Applied | |
| 011_corporate_schema.sql | ✅ Applied | Added attachments table, item_type column |
| 012_qp_structure_tables.sql | ✅ Applied | 38 items, 150 marks for LIFE_SC_P1_NOV_2025 |
| **014_complete_qbank_schema.sql** | **✅ Applied** | **34 tables created, 15 lookup tables seeded, 123 subjects synced** |
| **015_fix_paper_code.sql** | **🔄 CREATED but NOT APPLIED** | **Adds paper_code to parse_expected_structure and parse_results** |

### 3.1 Table Row Counts (as of 2026-06-09 — LAST KNOWN)

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
| **parse_expected_structure** | **38** | **Expected QP structure (gold standard)** | **✅ POPULATED** |
| **parse_results** | **0** | **Parser output with auto-correction** | **❌ EMPTY (comparison engine broken)** |
| **parse_sessions** | **2+** | **Audit trail for parse runs** | **✅ ACTIVE** |
| question_reviews | 0 | Review workflow (legacy) | ⚠️ Legacy |
| accounting_questions | 10 | Pre-QBank legacy | ⚠️ Legacy |
| questions | 3 | Pre-QBank legacy | ⚠️ Legacy |
| lookup_subjects | 123 | All NSC subjects | ✅ Synced from nsc_registration_v3 |
| lookup_years | 11 | Academic years 2020-2030 | ✅ Pre-populated |
| lookup_grades | 3 | Grade 10/11/12 | ✅ Pre-populated |
| lookup_papers | 7 | Paper types | ✅ Pre-populated |
| lookup_assessment_types | 7 | Assessment types | ✅ Pre-populated |
| lookup_assessment_bodies | 4 | Assessment bodies | ✅ Pre-populated |
| lookup_cognitive_levels | 6 | Bloom's Taxonomy | ✅ Pre-populated |
| lookup_difficulty_levels | 3 | Easy/Medium/Hard | ✅ Pre-populated |
| lookup_item_types | 8 | Item types | ✅ Pre-populated |
| lookup_languages | 11 | SA official languages | ✅ Pre-populated |
| lookup_exam_sessions | 5 | Exam sessions | ✅ Pre-populated |
| lookup_marking_schemes | 5 | Marking schemes | ✅ Pre-populated |
| lookup_caps_topics | 11 | Life Sciences G12 topics | 🔄 Partially populated |
| lookup_caps_subtopics | 0 | CAPS subtopics | ❌ NOT populated |
| lookup_tag_taxonomy | 15+ | Controlled vocabulary | ✅ Pre-populated |
| item_master | 0 | Core item table | ✅ Empty (ready) |
| item_mcq_options | 0 | MCQ options | ✅ Empty (ready) |
| item_memos | 0 | Marking guidelines | ✅ Empty (ready) |
| item_memo_subparts | 0 | Sub-part rubrics | ✅ Empty (ready) |
| item_stimuli | 0 | Shared stimuli | ✅ Empty (ready) |
| item_attachments | 0 | Images/diagrams | ✅ Empty (ready) |
| item_tags | 0 | Item tagging | ✅ Empty (ready) |
| item_versions | 0 | Audit trail | ✅ Empty (ready) |
| item_reviews | 0 | Review comments | ✅ Empty (ready) |
| review_workflow | 0 | State machine | ✅ Empty (ready) |
| paper_templates | 0 | Paper blueprints | ✅ Empty (ready) |
| paper_template_sections | 0 | Template sections | ✅ Empty (ready) |
| generated_papers | 0 | Assembled papers | ✅ Empty (ready) |
| generated_paper_items | 0 | Items in papers | ✅ Empty (ready) |
| qbank_users | 0 | System users | ✅ Empty (ready) |
| user_subject_assignments | 0 | Subject expert assignments | ✅ Empty (ready) |

**Total: 34 tables**

### 3.2 Legacy vs New Tables

**Old tables DROPPED:** qbank_items (old), qbank_papers (old), qbank_paper_items (old), qbank_items_staging (old), etc. — Replaced by new 34-table schema.

**Legacy tables PRESERVED:**
- `accounting_questions` — 10 rows (pre-QBank legacy)
- `questions` — 3 rows (pre-QBank legacy)
- `qbank_users_legacy` — preserved

### 3.3 Subject Sync
**Source:** `nsc_registration_v3.lookup_subjects`
**Method:** Stored procedure `sync_lookup_subjects()` created for manual sync by Superadmin
**Count:** 123 subjects synced
**Key columns:** `subject_id` (INT), `subject_official_code` (VARCHAR), `subject_name` (VARCHAR), `subject_alpha_code` (VARCHAR)

---

## 4. EXPECTED PARSER OUTPUT (LIFE P1 Nov 2025) — VERIFIED

### 4.1 Question Paper Structure (Gold Standard in DB)
| Section | Question | Type | Marks | Count |
|---------|----------|------|-------|-------|
| A | 1.1.1-1.1.10 | MCQ | 2 each = 20 | 10 |
| A | 1.2.1-1.2.8 | Short | 1 each = 8 | 8 |
| A | 1.3.1-1.3.3 | Matching | 2 each = 6 | 3 |
| A | 1.4.1-1.4.3 | Diagram | 8 total | 3 |
| A | 1.5.1-1.5.4 | Diagram | 8 total | 4 |
| B | 2.1 | Extended | 8 | 1 |
| B | 2.2 | Extended | 11 | 1 |
| B | 2.3 | Extended | 14 | 1 |
| B | 2.4 | Extended | 6 | 1 |
| B | 2.5 | Extended | 11 | 1 |
| C | 3.1 | Extended | 8 | 1 |
| C | 3.2 | Extended | 13 | 1 |
| C | 3.3 | Extended | 5 | 1 |
| C | 3.4 | Extended | 14 | 1 |
| C | 3.5 | Extended | 10 | 1 |
| **Total** | **38 items** | | **150 marks** | |

### 4.2 Memo Structure
- Same 38 items, with marking guidelines
- Each item linked by question_number
- Sub-parts have individual marks and answers
- Parent totals match QP totals
- Parser extracts memo text, marks come from `parse_expected_structure`

---

## 5. PARSER IMPLEMENTATION STATUS (UPDATED 2026-06-12)

### 5.1 QP Parser (pdf_parser_structured.js)
| Component | Approach | Status |
|-----------|----------|--------|
| Text Extraction | pdf.js getTextContent() | ✅ Working (items only) |
| Question Detection | Position + font analysis | ✅ Working |
| Marks Extraction | REMOVED from parser | ❌ ABANDONED |
| Section Detection | Font size changes | ✅ Working |
| Parent-Child | Question number hierarchy | ✅ Working |
| Comparison Engine | Database-driven validation | 🔄 Fix applied, NOT verified |
| Manual Review UI | React + RED highlighting | 🔄 Fix applied, NOT verified |

### 5.2 CAPS Parser (capsPdfParser.js v2.7a)
| Component | Approach | Status |
|-----------|----------|--------|
| Text Extraction | pdf-parse | ✅ Working |
| Document Type Detection | Header pattern matching | 🔄 Needs verification |
| Subject Detection | Header text search | ✅ Working (BUSINESS STUDIES detected) |
| Section 3 Parsing | Teaching Plans extraction | ❌ BROKEN (empty grades) |
| Section 4 Parsing | Summary Table extraction | ✅ Working but NOT the right source |
| Grade Block Detection | `Annual Teaching Plan Grade X` | ❌ BROKEN (headers may differ) |
| Assessment Extraction | Per-term formal assessments | ❌ BROKEN (returns empty) |

### 5.3 Parser Output (What QP parser produces)
```json
{
  "question_number": "1.1.1",
  "question_text": "The hormone that prepares the body for an emergency is ...",
  "section": "A",
  "type": "MCQ"
  // NO marks field — marks come from parse_expected_structure
}
```

### 5.4 Comparison Engine Logic (NOT VERIFIED AS WORKING)
```javascript
// 1. Parser produces items (no marks)
// 2. Load expected from parse_expected_structure where paper_code = ?
// 3. For each parser item:
//    - Find matching question_number in expected
//    - If found: assign expected_marks, status = 'validated'
//    - If parser attempted marks and variance ≤ 2× expected: auto-correct
//    - If variance > 2× or parser failed: status = 'pending', FLAG RED
// 4. For missing expected questions: create placeholder, FLAG RED
// 5. Return comparison report with RED flags for manual review
```

---

## 6. FILE STRUCTURE (Updated 2026-06-12)

```
C:\dev\nsc-qbank
├── .env                          (Database credentials)
├── .env.example                  (Template)
├── .gitignore                    (Git ignore rules)
├── COMMIT_LOG.md                 (Commit history)
├── README.md                     (Project readme)
├── VERSION.txt                   (Version info)
├── package.json                  (Node dependencies)
├── package-lock.json             (Locked dependencies)
├── server.js                     (Main Express server — port 4000)
├── server.log                    (Server logs)
│
├── backend/
│   └── routes/
│       ├── qbank.js              (Legacy routes)
│       └── qbank_1.js            (Legacy routes)
│
├── database/
│   └── migrations/
│       ├── 001_schema_fix.sql
│       ├── 003_seed_specs.sql
│       ├── 008_consolidate_qbank_tables.sql
│       ├── 009_fix_specs.sql
│       ├── 010_create_memo_table.sql
│       ├── 011_corporate_schema.sql
│       ├── 012_qp_structure_tables.sql
│       ├── 014_complete_qbank_schema.sql  (34 tables)
│       └── 015_fix_paper_code.sql       (CREATED but NOT APPLIED)
│
├── docs/
│   ├── AI_Handover_Note_v7.md
│   ├── QBank_Development_Plan_v4.md
│   ├── QBank_Discovery_File_v6.md
│   ├── QBank_Handover_Note_v11.md
│   └── ...
│
├── routes/
│   ├── items.js                  (Item CRUD)
│   ├── papers.js                 (Paper generation)
│   ├── pdf_parser_structured.js  (QP parser — WORKING)
│   ├── compare-qp.js             (Comparison engine — FIX APPLIED, NOT VERIFIED)
│   ├── capsPdfParser.js          (CAPS parser — v2.7a, BROKEN, empty grades)
│   ├── qp-structure-extractor.js (Future paper extraction)
│   ├── specs.js                  (Specs GET)
│   ├── staging.js                (Staging + memo import)
│   ├── attachments.js            (Image upload/download)
│   ├── lookup.js                 (NOT NEEDED — deleted, server.js has dynamic route)
│   └── memo-compare.js           (Memo comparison — NOT TESTED)
│
├── frontend/                     (React + Vite + TypeScript)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── App.tsx               (Main app component — WHITE SCREEN ISSUE)
│       ├── main.tsx
│       ├── index.css
│       ├── components/
│       │   └── wizard/
│       │       ├── UploadWizard.tsx    (Subjects, emojis, force_overwrite — FIX APPLIED)
│       │       └── ReviewPanel.tsx     (RED highlighting, editable marks — FIX APPLIED)
│       └── services/
│           └── api.ts            (API calls)
│
├── wizard/                       (Legacy HTML — DEPRECATED)
│   ├── index.html                (Old wizard, NOT used anymore)
│   └── README.txt
│
├── uploads/                      (Image storage)
│   └── items/
│       └── {item_id}/
│           └── {attachment_id}.png
│
├── temp/                         (Temporary files)
│   └── debug-raw.txt             (CAPS parser diagnostic output)
│
├── debug-pdf.js                  (Diagnostic script for CAPS PDF)
├── show-sections.js            (Section viewer for CAPS PDF)
├── capsPdfParser_v2.7a_FIXED.js (Backup of v2.7a)
├── capsPdfParser_v2.7_REAL.js    (Backup with Section 3 logic)
└── backups/                      (Database backups)
    └── nsc_qbank_backup_*.sql
```

---

## 7. API ENDPOINTS (Updated 2026-06-12)

### 7.1 Comparison Engine Endpoints (NOT VERIFIED AS WORKING)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/compare-qp` | Compare parser output against expected structure | 🔄 Fix applied, NOT verified |
| POST | `/api/wizard/save-corrections` | Save manual corrections from ReviewPanel | 🔄 NOT tested |
| GET | `/api/wizard/comparison/:session_id` | Retrieve comparison results | 🔄 NOT tested |
| GET | `/api/wizard/structure/:paper_code` | Get expected structure for paper | 🔄 NOT tested |

### 7.2 Parser Endpoints
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/extract-structure` | Extract items from QP (no marks) | 🔄 Needs paper_code column fix |
| POST | `/api/wizard/extract-memo` | Extract items from Memo (no marks) | ⚠️ Needs testing |

### 7.3 CAPS Parser Endpoints
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/caps/parse` | Parse CAPS PDF and seed database | ❌ BROKEN (empty grades) |
| GET | `/api/caps/status` | Check CAPS parser status | ⚠️ Unknown |

### 7.4 Lookup Endpoints (VERIFIED WORKING)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/lookup/lookup_subjects` | Get all subjects | ✅ Working |
| GET | `/api/lookup/:table` | Dynamic lookup route (server.js line 73) | ✅ Working |

### 7.5 Other Endpoints
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/api/items` | Item CRUD | ✅ Active |
| GET | `/api/papers` | Paper generation | ✅ Active |
| GET | `/api/specs` | Specifications | ✅ Active |
| POST | `/api/staging` | Staging import | ✅ Active |
| POST | `/api/attachments` | Image upload | ✅ Active |

---

## 8. NEXT STEPS (Priority Order — Updated 2026-06-12)

### 8.1 Immediate (Today 2026-06-12)
1. **Fix CAPS parser** — Run diagnostic on real PDF, adjust header patterns
2. **Fix frontend white screen** — Debug App.tsx, check React Router, verify component imports
3. **Verify comparison engine fixes** — Run migration 015, copy fixed files, test upload flow
4. **Test ReviewPanel** — Verify items display after comparison fix

### 8.2 Short Term (This Week)
1. Complete CAPS data seeding for all subjects (not just Life Sciences)
2. Populate `lookup_caps_subtopics` table
3. Test memo parser comparison
4. Add image extraction from PDF (pdf.js canvas API)
5. Store image references: `[IMAGE: attachment_id]`

### 8.3 Testing Criteria (MUST PASS BEFORE CLAIMING SUCCESS)
| Test | Expected | Pass Criteria |
|------|----------|---------------|
| QP Item Count | 38 | Exactly 38 items |
| QP Marks Total | 150 | Exactly 150 marks (from DB) |
| Memo Item Count | 38 | Exactly 38 items |
| Memo Marks Total | 150 | Exactly 150 marks (from DB) |
| Section Detection | A/B/C | Correct sections assigned |
| Comparison Engine | Auto-correct | ≤2× variance auto-corrected |
| RED Flags | Manual review | >2× variance or missing items flagged |
| Save Corrections | Audit trail | Corrected marks saved to parse_results |
| CAPS Parser | Grades array | Returns non-empty grades with assessments |
| Frontend | No white screen | All pages render correctly |

---

## 9. CRITICAL NOTES FOR NEXT AI SESSION

- **Parser does NOT extract marks anymore** — marks come from `parse_expected_structure`
- **NO HARDCODING** — All QP structure must be database-driven
- **Manual review is REQUIRED** — AI cannot reliably parse DBE PDF marks
- **Same process for Memo** — Use QP structure as reference for memo validation
- **Test with real papers** — Validate with actual DBE exam papers
- **Routes may be broken** — Previous AI sessions may have broken routes, verify first
- **Always backup before changes** — Use mysqldump before any SQL execution
- **PowerShell rule:** Use Set-Content with array of single-quoted strings for TS files
- **Database name is nsc_qbank** — NOT spd or spd_system
- **Natural keys NOT yet implemented** — Still using surrogate keys (INT auto-increment)

---

*End of Discovery File v8.0 — Corporate Edition*
*Parser v2.7a deployed but broken, Comparison engine fix applied but not verified*
*Date: 2026-06-12 08:11*
