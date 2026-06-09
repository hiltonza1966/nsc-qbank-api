# QBank Discovery File v8.0 — Corporate Edition
**Generated:** 9 June 2026 20:08 SAST
**Updated By:** AI K2.6 Session
**Status:** Phase 2 Complete → Natural Keys Implementation (Option 2) Next
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Status:** Memo Compare Endpoint Fixed, Root Files Cleaned

---

## 1. ARCHITECTURE OVERVIEW

- **Runtime:** Node.js 20, Express 4.19.2
- **Database:** MySQL 8.0.45 (not PostgreSQL)
- **Driver:** mysql2/promise 3.9.7
- **Port:** 4000
- **CORS:** Enabled for all origins
- **Cross-database reference:** `subject_structure` table lives in `nsc_registration_v3` only
- **Frontend:** React + Vite (port 3000)
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
- Loads expected structure from `parse_expected_structure` table
- Compares parser output against expected question numbers
- Auto-corrects marks when parser variance is within tolerance (≤2× expected)
- Flags RED for manual review when variance exceeds tolerance or parser fails

**Manual Review UI:**
- `ReviewPanel.tsx` shows RED highlighting for flagged items
- Editable marks field for manual correction
- Save corrections to `parse_results` with audit trail

---

## 3. DATABASE SCHEMA (Current — Updated 2026-06-09)

### 3.0 Migration 014 Status
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

### 3.1 Core Tables (Migration 014 — 34 Tables)

#### 3.1.1 Lookup/Dimension Tables (6 tables)
| Table | PK | Purpose | Rows |
|-------|-----|---------|------|
| `lookup_years` | year_id (INT) | Academic years | 5 |
| `lookup_grades` | grade_id (INT) | Grade levels | 3 |
| `lookup_subjects` | subject_id (INT) | Subjects (synced from nsc_registration_v3) | 123 |
| `lookup_papers` | paper_id (INT) | Paper numbers | 2 |
| `lookup_assessment_types` | assessment_type_id (INT) | Exam types (NSC, IEB, etc.) | 3 |
| `lookup_assessment_bodies` | assessment_body_id (INT) | Assessment bodies (DBE, IEB, etc.) | 2 |

#### 3.1.2 Item Management Tables (6 tables)
| Table | PK | Purpose |
|-------|-----|---------|
| `item_master` | item_id (INT) | Approved question items |
| `item_staging` | item_id (INT) | Draft/staging items |
| `item_attachments` | attachment_id (INT) | Images, diagrams, files |
| `item_tags` | tag_id (INT) | Curriculum tags |
| `item_versions` | version_id (INT) | Item version history |
| `item_reviews` | review_id (INT) | Review workflow tracking |

#### 3.1.3 Memo Tables (2 tables)
| Table | PK | Purpose |
|-------|-----|---------|
| `item_memos` | memo_id (INT) | Memo (answer key) master |
| `item_memo_subparts` | subpart_id (INT) | Memo sub-part answers and marks |

#### 3.1.4 Parser/Comparison Tables (3 tables)
| Table | PK | Purpose | Rows |
|-------|-----|---------|------|
| `parse_expected_structure` | structure_id (INT) | Gold standard QP structure | 38 (LIFE P1) |
| `parse_results` | result_id (INT) | Parser output + corrections | 0 |
| `parse_sessions` | session_id (VARCHAR) | Audit trail for parse runs | 1+ |

**parse_sessions columns:**
```sql
session_id VARCHAR(64) PK
year_id INT NULL
grade_id INT NULL
subject_id INT NULL
paper_id INT NULL
assessment_type_id INT NULL
assessment_body_id INT NULL
file_name VARCHAR(255) NOT NULL
file_hash VARCHAR(64) NOT NULL
parser_version VARCHAR(20) DEFAULT '1.0'
total_items_found INT NULL
total_marks_parser INT NULL
total_marks_expected INT NULL
total_marks_corrected INT NULL
auto_corrected_count INT DEFAULT 0
manual_review_count INT DEFAULT 0
missing_count INT DEFAULT 0
status ENUM('parsing','comparing','auto_corrected','reviewing','completed','failed') DEFAULT 'parsing'
error_message TEXT NULL
completed_at TIMESTAMP NULL
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
paper_code VARCHAR(50) NOT NULL DEFAULT ''
```

#### 3.1.5 Paper Generation Tables (5 tables)
| Table | PK | Purpose |
|-------|-----|---------|
| `paper_templates` | template_id (INT) | Paper template definitions |
| `paper_template_sections` | section_id (INT) | Template section rules |
| `generated_papers` | paper_id (INT) | Generated exam papers |
| `generated_paper_items` | gp_item_id (INT) | Items in generated papers |
| `paper_template_item_pools` | pool_id (INT) | Item pool assignments |

#### 3.1.6 Review Workflow Tables (2 tables)
| Table | PK | Purpose |
|-------|-----|---------|
| `review_workflow` | workflow_id (INT) | Review workflow instances |
| `review_workflow_history` | history_id (INT) | Workflow state changes |

#### 3.1.7 Audit/Logging Tables (3 tables)
| Table | PK | Purpose |
|-------|-----|---------|
| `audit_logs` | log_id (INT) | General audit trail |
| `user_sessions` | session_id (INT) | User session tracking |
| `communication_logs` | log_id (INT) | Communication audit |

#### 3.1.8 System Tables (7 tables)
| Table | PK | Purpose |
|-------|-----|---------|
| `spd_users` | user_id (INT) | System users (SPD integration) |
| `user_roles` | role_id (INT) | Role definitions |
| `user_permissions` | permission_id (INT) | Permission definitions |
| `user_role_assignments` | assignment_id (INT) | User-role links |
| `notification_settings` | setting_id (INT) | User notification prefs |
| `system_config` | config_id (INT) | System configuration |
| `lookup_provinces` | province_id (INT) | Province codes |

### 3.2 Legacy Tables (Preserved but not active)
| Table | Rows | Status |
|-------|------|--------|
| `accounting_questions` | 10 | ⚠️ Legacy |
| `qbank_users_legacy` | 0 | ⚠️ Legacy |
| `questions` | 3 | ⚠️ Legacy |

### 3.3 Migration Status
| Migration | Status | Notes |
|-----------|--------|-------|
| 001_schema_fix.sql | ✅ Applied | |
| 003_seed_specs.sql | ✅ Applied | |
| 008_consolidate_qbank_tables.sql | ✅ Applied | |
| 009_fix_specs.sql | ✅ Applied | |
| 010_create_memo_table.sql | ✅ Applied | |
| 011_corporate_schema.sql | ✅ Applied | |
| 012_qp_structure_tables.sql | ✅ Applied | 38 items, 150 marks |
| **014_complete_qbank_schema.sql** | **✅ Applied** | **34 tables, 66 FKs, 15 lookups** |

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
- **Parser extracts memo text, marks come from parse_expected_structure**

---

## 5. PARSER IMPLEMENTATION STATUS (UPDATED 2026-06-09)

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
| **Memo Compare** | **QP structure validation** | **✅ Fixed 2026-06-09** |

### 5.2 Parser Output (What it produces now)
```json
{
  "question_number": "1.1.1",
  "question_text": "The hormone that prepares the body for an emergency is ...",
  "section": "A",
  "type": "MCQ"
  // NO marks field — marks come from parse_expected_structure
}
```

### 5.3 Comparison Engine Logic
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

## 6. FILE STRUCTURE (Updated 2026-06-09)

```
C:\dev\nsc-qbank
├── .env                          (98 bytes)
├── .env.example                  (94 bytes)
├── .gitignore                    (Updated: *.sql, *.zip excluded)
├── COMMIT_LOG.md                 (1062 bytes)
├── README.md                     (259 bytes)
├── VERSION.txt                   (182 bytes)
├── package.json                  (Updated)
├── package-lock.json             (Updated)
├── server.js                     (Canonical — imports all routes)
│
├── backend/                      (Legacy — DEPRECATED)
│   └── routes/
│       ├── qbank.js              (Legacy)
│       └── qbank_1.js            (Legacy)
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
│       └── **014_complete_qbank_schema.sql**  (**Canonical: 34 tables, 66 FKs**)
│
├── docs/
│   ├── AI_Handover_Note_v10.md   (Updated)
│   ├── QBank_Development_Plan_v7.md (Updated)
│   ├── **QBank_Discovery_File_v8.md**  (**THIS FILE — Updated schema**)
│   └── ...
│
├── routes/                       (**CANONICAL location for all route files**)
│   ├── items.js                  (Item CRUD)
│   ├── papers.js                 (Paper generation)
│   ├── pdf_parser_structured.js  (Position-based parser — SIMPLIFIED, no marks)
│   ├── **compare-qp.js**         (**Comparison engine, auto-correct + RED flags**)
│   ├── **memo-compare.js**       (**Memo comparison vs QP structure**)
│   ├── **memo-parser.js**        (**Memo text extraction stub**)
│   ├── **reviews.js**            (**Review workflow**)
│   ├── **templates.js**          (**Paper templates**)
│   ├── qp-structure-extractor.js (Future paper extraction)
│   ├── specs.js                  (Specs GET)
│   ├── staging.js                (Staging + memo import)
│   ├── attachments.js            (Image upload/download)
│   ├── taxonomy.js               (Curriculum taxonomy)
│   ├── usage.js                  (Item usage tracking)
│   ├── versions.js               (Item versioning)
│   └── workflow.js               (Workflow management)
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

**NOTE:** Root-level `.js` files have been REMOVED. All route files are canonical in `routes/`.

---

## 7. API ENDPOINTS (Updated 2026-06-09)

### 7.1 Comparison Engine Endpoints
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/compare-qp` | Compare parser output against expected structure | ✅ Active |
| POST | `/api/wizard/save-corrections` | Save manual corrections from ReviewPanel | ✅ Active |
| GET | `/api/wizard/comparison/:session_id` | Retrieve comparison results | ✅ Active |
| GET | `/api/wizard/structure/:paper_code` | Get expected structure for paper | ✅ Active |

### 7.2 Memo Comparison Endpoints
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/compare-memo` | Compare memo against QP structure | ✅ Fixed 2026-06-09 |
| POST | `/api/wizard/extract-memo` | Extract memo text (stub) | ⚠️ Stub |

### 7.3 Parser Endpoints (Simplified)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/extract-structure` | Extract items from QP (no marks) | ⚠️ Needs testing |

---

## 8. NEXT STEPS (Priority Order)

### 8.1 Immediate (Next Session)
1. **Test full 38-item memo payload** — Verify all aligned/missing/mismatch logic
2. **Verify frontend wizard integration** — Ensure calls /api/wizard/compare-memo
3. **Test end-to-end upload** — QP → Parser → Comparison → ReviewPanel → Save
4. **Test with actual LIFE P1 PDF** — Verify 38 items extracted, 150 marks validated

### 8.2 Short Term (This Week)
1. Implement memo parser extraction (replace stub)
2. Add image extraction from PDF (pdf.js canvas API)
3. Store image references: `[IMAGE: attachment_id]`
4. Clean up legacy `wizard/index.html` (deprecated)

### 8.3 Natural Keys (Option 2)
1. Change lookup_subjects PK to subject_official_code (VARCHAR)
2. Change lookup_papers PK to paper_no (INT)
3. Change lookup_assessment_bodies PK to assessment_origin (VARCHAR)
4. Update ALL FK references across 34 tables

### 8.4 Testing Criteria
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

---

## 9. CRITICAL NOTES FOR NEXT AI SESSION

- **Parser does NOT extract marks anymore** — marks come from `parse_expected_structure`
- **NO HARDCODING** — All QP structure must be database-driven
- **Manual review is REQUIRED** — AI cannot reliably parse DBE PDF marks
- **Same process for Memo** — Use QP structure as reference for memo validation
- **Test with real papers** — Validate with actual DBE exam papers
- **Canonical file location: routes/** — No root-level route files
- **Database migration: 014_complete_qbank_schema.sql** — Single source of truth

---

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
- item_master, item_staging, item_attachments, item_tags, item_versions, item_reviews
- parse_sessions, parse_expected_structure, parse_results
- paper_templates, paper_template_sections, generated_papers, generated_paper_items
- review_workflow, review_workflow_history
- All other tables referencing the 6 core dimensions

### 10.4 Benefits
- Self-documenting codes throughout all tables
- No mapping layer between QBank and registration system
- Direct alignment with nsc_registration_v3.subject_structure
- Simpler queries without joins for basic identification

---

*End of Discovery File v8.0 — Corporate Edition*
*Schema updated: 34 tables, 66 FKs, canonical file structure*
*Memo compare fixed: paper_code column added, FK columns made nullable*
*Root files cleaned: all routes canonical in routes/ directory*
