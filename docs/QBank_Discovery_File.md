# QBank Discovery File v2.0

**Generated:** 7 June 2026 08:33 SAST
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Last Commit:** b46999a docs: add QBank handover, discovery and development plan (5 June 2026)

---

## 1. Architecture Overview

- **Runtime:** Node.js 20, Express 4.19.2
- **Database:** MySQL 8.0.45 (not PostgreSQL)
- **Driver:** mysql2/promise 3.9.7
- **Port:** 4000
- **CORS:** Enabled for all origins
- **Cross-database reference:** `subject_structure` table lives in `nsc_registration_v3` only

---

## 2. Repository File Structure

```
C:\dev\nsc-qbank
├── .env                          (98 bytes) - DB credentials
├── .env.example                  (94 bytes)
├── .gitignore                    (70 bytes)
├── COMMIT_LOG.md                 (1062 bytes)
├── README.md                     (259 bytes)
├── VERSION.txt                   (182 bytes)
├── package.json                  (452 bytes)
├── package-lock.json             (61336 bytes)
├── server.js                     (1541 bytes) - Main entry point
├── server.log                    (198 bytes)
│
├── backend/
│   └── routes/
│       ├── qbank.js              (1689 bytes) - Legacy route
│       └── qbank_1.js            (3410 bytes) - Legacy route
│
├── database/migrations/
│   ├── 001_create_qbank_paper_specs.sql          (1374 bytes)
│   ├── 001_create_qbank_paper_specs_1.sql        (2885 bytes)
│   ├── 001_schema_fix.sql                        (3184 bytes) - CURRENT (adds missing columns)
│   ├── 002_create_qbank_items.sql                (2559 bytes)
│   ├── 003_create_qbank_item_options.sql         (1116 bytes)
│   ├── 003_seed_specs.sql                        (1347 bytes) - CURRENT (MATH P1/P2, PHYS P1/P2)
│   ├── 004_create_qbank_papers.sql               (1564 bytes)
│   ├── 005_create_qbank_paper_items.sql          (1199 bytes)
│   ├── 006_add_item_provenance.sql               (255 bytes)
│   ├── 007_seed_paper_specs.sql                  (410 bytes)
│   ├── 008_consolidate_qbank_tables.sql          (6577 bytes) - CURRENT (staging + tagging tables)
│   ├── 009_fix_specs.sql                         (1862 bytes) - CURRENT (dedup + fix empty sections)
│   ├── Show Create table subject_structure.sql     (36 bytes)
│   ├── Qbank Schema.sql                          (430 bytes)
│   └── Qbank all tables with columns.sql         (1233 bytes)
│
├── docs/
│   ├── AI_Handover_Note_2026-06-05.md            (1308 bytes)
│   ├── concept_documents.txt                     (29068 bytes)
│   ├── Development_Plan_v1.md                    (9516 bytes)
│   ├── nsc_registration_system_v4_details_v1.11.txt (17612 bytes)
│   ├── QBank_Development_Plan_Updated.md         (1513 bytes)
│   ├── QBank_Discovery_File.md                   (1175 bytes) - THIS FILE REPLACES
│   └── tor_urs.txt                               (106573 bytes)
│
├── migrations/ (legacy folder - some files duplicated)
│   ├── 002_item_provenance.sql                   (454 bytes)
│   ├── 003_seed_specs.sql                        (883 bytes)
│   ├── 2026-06-05_papers_schema.sql             (715 bytes)
│   ├── Migration 007- Staging + Tagging Foundation.sql (2886 bytes)
│   ├── Qbank all tables with columns.sql         (1233 bytes)
│   └── Qbank Schema.sql                          (430 bytes)
│
├── routes/
│   ├── items.js                  (3349 bytes) - CURRENT (item CRUD + bulk)
│   ├── papers.js                 (6141 bytes) - CURRENT (generation + retrieval)
│   ├── specs.js                  (225 bytes) - Simple GET all specs
│   └── staging.js                (4845 bytes) - CURRENT (bulk import + approve)
│
└── wizard/
    ├── index.html                  (11048 bytes) - Import wizard UI
    └── README.txt                  (699 bytes)
```

---

## 3. Database Schema (Complete)

### 3.1 Table Row Counts (as of 2026-06-07 08:30)

| Table | Rows |
|-------|------|
| accounting_questions | 10 |
| qbank_item_curriculum | 0 |
| qbank_item_tags | 0 |
| qbank_items | 6 |
| qbank_items_staging | 0 |
| qbank_items_staging_curriculum | 0 |
| qbank_items_staging_tags | 0 |
| qbank_paper_items | 3 |
| qbank_paper_specs | 4 |
| qbank_papers | 4 |
| qbank_users | 0 |
| question_reviews | 0 |
| questions | 3 |

### 3.2 Core Tables

#### `qbank_items` — Live Question Bank Items (6 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| item_id | char(36) | NO | NULL | | Primary key (UUID) |
| subject_official_code | varchar(10) | YES | NULL | | e.g. "MATH", "PHYS" |
| paper_no | tinyint | YES | NULL | | e.g. 1, 2 |
| question_text | text | YES | NULL | | Full question text |
| marks | smallint | YES | NULL | | Marks per item |
| topic | varchar(100) | YES | NULL | | Topic classification |
| cognitive_level | varchar(50) | YES | NULL | | e.g. "Remember", "Apply" |
| difficulty | enum('Easy','Medium','Hard') | YES | NULL | | Difficulty rating |
| source_year | smallint | YES | NULL | | Year of source paper |
| source_exam_board | varchar(20) | YES | NULL | | e.g. "DBE" |
| source_paper_code | varchar(20) | YES | NULL | | Source paper identifier |
| status | varchar(20) | YES | 'Draft' | | 'Draft' or 'Approved' |
| created_by | int | YES | NULL | | User ID |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | Auto timestamp |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | Auto update |
| item_code | varchar(50) | YES | NULL | | Added by Migration 008 |
| caps_topic | varchar(100) | YES | NULL | | Added by Migration 008 |
| item_type | enum('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') | YES | NULL | | Added by Migration 008 |
| difficulty_level | enum('Easy','Medium','Hard') | YES | NULL | | Added by Migration 008 |
| caps_subtopic | varchar(100) | YES | NULL | | Added by Migration 008 |
| source_reference | varchar(200) | YES | NULL | | Added by Migration 008 |

**Primary Key:** `item_id` (BTREE)

**Current Data:**
- 3 MATH P1 items (marks: 5, 7, 8) — all status = 'Approved' (updated 2026-06-07)
- 3 other items (various statuses)

---

#### `qbank_papers` — Generated Exam Papers (4 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| paper_id | char(36) | NO | NULL | | Primary key (UUID) |
| spec_id | char(36) | YES | NULL | | FK to qbank_paper_specs |
| title | varchar(200) | YES | NULL | | Paper title |
| total_marks | smallint | YES | NULL | | Total marks from spec |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | Auto timestamp |
| subject_official_code | varchar(10) | NO | '' | | Added by Migration 001 |
| paper_no | tinyint | NO | 1 | | Added by Migration 001 |
| duration_minutes | int | NO | 180 | | Added by Migration 001 |
| status | varchar(20) | NO | 'Draft' | | Added by Migration 001 |
| created_by | int | NO | 1 | | Added by Migration 001 |

**Primary Key:** `paper_id` (BTREE)

---

#### `qbank_paper_items` — Paper-Item Linkage (3 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| paper_id | char(36) | NO | NULL | | Part of composite PK |
| item_id | char(36) | NO | NULL | | Part of composite PK |
| section_name | varchar(100) | NO | '' | | Added by Migration 001 |
| position | int | NO | 0 | | Added by Migration 001 |
| marks_allocated | smallint | NO | 0 | | Added by Migration 001 |

**Primary Key:** `(paper_id, item_id)` composite (BTREE)

---

#### `qbank_paper_specs` — Paper Specifications (4 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| spec_id | char(36) | NO | NULL | | Primary key (UUID) |
| subject_official_code | varchar(10) | YES | NULL | | e.g. "MATH", "PHYS" |
| paper_no | tinyint | YES | NULL | | e.g. 1, 2 |
| total_marks | smallint | YES | NULL | | Total paper marks |
| duration_minutes | smallint | YES | NULL | | Exam duration |
| sections_config | json | YES | NULL | | JSON array of sections |

**Primary Key:** `spec_id` (BTREE)
**Unique Key:** `uq_spec` on `(subject_official_code, paper_no)` (BTREE) — Added by Migration 009

**Current Data (as of 2026-06-07):**

| subject_official_code | paper_no | total_marks | duration_minutes | sections_config |
|-----------------------|----------|-------------|------------------|-----------------|
| MATH | 1 | 150 | 180 | `[{"name":"Algebra","marks":50},{"name":"Calculus","marks":50},{"name":"Geometry","marks":50}]` |
| MATH | 2 | 150 | 180 | `[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]` |
| PHYS | 1 | 150 | 180 | `[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]` |
| PHYS | 2 | 150 | 180 | `[{"name":"Section A","marks":75},{"name":"Section B","marks":75}]` |

---

#### `qbank_users` — QBank Users (0 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| id | bigint | NO | NULL | auto_increment | Primary key |
| email | varchar(255) | NO | NULL | | Unique |
| full_name | varchar(255) | NO | NULL | | |
| role | enum('Examiner','Chief Examiner','Moderator','Admin') | YES | 'Examiner' | | |
| password_hash | varchar(255) | NO | NULL | | |
| is_active | tinyint(1) | YES | 1 | | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | |

**Primary Key:** `id` (BTREE)
**Unique Key:** `email` (BTREE)

---

### 3.3 Staging Tables (All in nsc_qbank)

#### `qbank_items_staging` — Draft Import Items (0 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| item_id | char(36) | NO | NULL | | Primary key |
| subject_official_code | varchar(10) | YES | NULL | | |
| paper_no | tinyint | YES | NULL | | |
| question_text | text | YES | NULL | | |
| marks | smallint | YES | NULL | | |
| topic | varchar(100) | YES | NULL | | |
| cognitive_level | varchar(50) | YES | NULL | | |
| difficulty | enum('Easy','Medium','Hard') | YES | NULL | | |
| source_year | smallint | YES | NULL | | |
| source_exam_board | varchar(20) | YES | NULL | | |
| source_paper_code | varchar(20) | YES | NULL | | |
| status | varchar(20) | YES | 'Draft' | | |
| created_by | int | YES | NULL | | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | |
| item_code | varchar(50) | YES | NULL | | Added by Migration 008 |
| caps_topic | varchar(100) | YES | NULL | | Added by Migration 008 |
| item_type | enum('MCQ','Short','Medium','Extended','Source-based','Practical','Essay') | YES | NULL | | Added by Migration 008 |
| difficulty_level | enum('Easy','Medium','Hard') | YES | NULL | | Added by Migration 008 |
| caps_subtopic | varchar(100) | YES | NULL | | Added by Migration 008 |
| source_reference | varchar(200) | YES | NULL | | Added by Migration 008 |
| staging_batch | varchar(50) | YES | NULL | | Added by Migration 008 |
| imported_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | Added by Migration 008 |
| content_hash | char(40) | YES | NULL | STORED GENERATED | SHA1 of trimmed question_text |

**Primary Key:** `item_id` (BTREE)
**Unique Key:** `uq_staging_item` on `(subject_official_code, paper_no, source_year, source_exam_board, source_paper_code, content_hash)` (BTREE)

---

#### `qbank_items_staging_tags` — Draft Tags (0 rows)

| Column | Type | Nullable | Default | Extra |
|--------|------|----------|---------|-------|
| item_id | bigint | NO | NULL | |
| tag_type | enum('topic','subtopic','skill','outcome','language','source') | NO | NULL | |
| tag_value | varchar(150) | NO | NULL | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

**Primary Key:** `(item_id, tag_type, tag_value)` composite (BTREE)

---

#### `qbank_items_staging_curriculum` — Draft Curriculum (0 rows)

| Column | Type | Nullable | Default | Extra |
|--------|------|----------|---------|-------|
| item_id | bigint | NO | NULL | |
| caps_code | varchar(30) | NO | NULL | |
| weight | decimal(3,2) | YES | 1.00 | |

**Primary Key:** `(item_id, caps_code)` composite (BTREE)

---

### 3.4 Tagging Tables (Live)

#### `qbank_item_tags` — Live Item Tags (0 rows)

| Column | Type | Nullable | Default | Extra |
|--------|------|----------|---------|-------|
| item_id | char(36) | NO | NULL | FK to qbank_items |
| tag_type | enum('topic','subtopic','skill','outcome','language','source') | NO | NULL | |
| tag_value | varchar(150) | NO | NULL | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

**Primary Key:** `(item_id, tag_type, tag_value)` composite (BTREE)
**Foreign Key:** `fk_tags_item` → `qbank_items(item_id)` ON DELETE CASCADE

---

#### `qbank_item_curriculum` — Live Curriculum (0 rows)

| Column | Type | Nullable | Default | Extra |
|--------|------|----------|---------|-------|
| item_id | char(36) | NO | NULL | FK to qbank_items |
| caps_code | varchar(30) | NO | NULL | |
| weight | decimal(3,2) | YES | 1.00 | |

**Primary Key:** `(item_id, caps_code)` composite (BTREE)
**Foreign Key:** `fk_curr_item` → `qbank_items(item_id)` ON DELETE CASCADE

---

### 3.5 Legacy Tables (Pre-QBank)

#### `accounting_questions` — Pre-QBank Accounting (10 rows)

| Column | Type | Nullable | Default | Extra |
|--------|------|----------|---------|-------|
| id | int | NO | NULL | auto_increment |
| q_num | varchar(20) | NO | NULL | |
| question | text | NO | NULL | |
| marks | int | YES | NULL | |
| answer | varchar(50) | YES | NULL | |
| workings | text | YES | NULL | |
| subject | varchar(50) | YES | 'Accounting' | |
| grade | varchar(20) | YES | 'Grade 12' | |
| year | int | NO | NULL | |
| paper | varchar(10) | NO | NULL | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED |

**Indexes:** `PRIMARY(id)`, `idx_qnum(q_num)`, `idx_year_paper(year, paper)`

---

#### `questions` — Pre-QBank Generic (3 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| question_id | bigint | NO | NULL | auto_increment | Primary key |
| subject_official_code | varchar(20) | NO | NULL | | |
| paper_no | int | NO | NULL | | |
| paper_type_numeric | tinyint | NO | NULL | | 1=Written 2=Oral 3=SBA 4=Practical 5=PAT |
| question_text | text | NO | NULL | | |
| option_a | varchar(500) | YES | NULL | | MCQ options |
| option_b | varchar(500) | YES | NULL | | |
| option_c | varchar(500) | YES | NULL | | |
| option_d | varchar(500) | YES | NULL | | |
| correct_option | enum('A','B','C','D') | YES | NULL | | |
| marks | int | YES | 1 | | |
| caps_topic | varchar(255) | YES | NULL | | |
| cognitive_level | enum('L1','L2','L3','L4') | YES | NULL | | |
| year_added | year | YES | NULL | | |
| last_used_year | year | YES | NULL | | |
| status | enum('Draft','Panel Review','Chief Approved','Moderated','Locked','archived') | YES | 'Draft' | | |
| difficulty | tinyint | YES | NULL | | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | |
| created_by | bigint | YES | NULL | | |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP | |

**Indexes:** `PRIMARY(question_id)`, `fk_q_subject(subject_official_code, paper_no)` → `nsc_registration_v3.subject_structure`

---

#### `question_reviews` — Review Workflow (0 rows)

| Column | Type | Nullable | Default | Extra | Notes |
|--------|------|----------|---------|-------|-------|
| review_id | bigint | NO | NULL | auto_increment | Primary key |
| question_id | bigint | NO | NULL | | |
| reviewer_id | bigint | NO | NULL | | References nsc_registration_v3.users.id |
| action | enum('Submit','Approve','Reject','Comment','Flag') | NO | NULL | | |
| comment | text | YES | NULL | | |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED | |

**Indexes:** `PRIMARY(review_id)`, `fk_review_user(reviewer_id)` → `qbank_users(id)`, `question_id(question_id)`

---

### 3.6 Views

#### `v_item_usage` — Item Usage Tracking

| Column | Type | Nullable | Source |
|--------|------|----------|--------|
| item_id | char(36) | NO | qbank_paper_items |
| last_used_at | timestamp | YES | MAX(created_at) |
| usage_count | bigint | YES | COUNT(*) |

**Definition:**
```sql
CREATE VIEW v_item_usage AS
SELECT item_id, MAX(created_at) as last_used_at, COUNT(*) as usage_count
FROM qbank_paper_items GROUP BY item_id;
```

---

#### `v_questions_full` — Full Question Details (cross-db)

| Column | Type | Nullable | Source |
|--------|------|----------|--------|
| question_id | bigint | NO | questions |
| subject_official_code | varchar(20) | NO | questions |
| paper_no | int | NO | questions |
| subject_name_eng | varchar(100) | NO | nsc_registration_v3.subject_structure |
| paper_name_eng | varchar(50) | YES | nsc_registration_v3.subject_structure |
| paper_type | varchar(20) | YES | nsc_registration_v3.subject_structure |
| paper_type_numeric | tinyint | NO | questions |
| question_text | text | NO | questions |
| difficulty | tinyint | YES | questions |

---

#### `v_questions_with_reviewers` — Questions + Reviewer Names (cross-db)

| Column | Type | Nullable | Source |
|--------|------|----------|--------|
| question_id | bigint | NO | questions |
| subject_official_code | varchar(20) | NO | questions |
| paper_no | int | NO | questions |
| question_text | text | NO | questions |
| status | enum | YES | questions |
| caps_topic | varchar(255) | YES | questions |
| cognitive_level | enum | YES | questions |
| marks | int | YES | questions |
| created_by_name | varchar(255) | YES | nsc_registration_v3.users |
| subject_name_eng | varchar(100) | NO | nsc_registration_v3.subject_structure |
| paper_name_eng | varchar(50) | YES | nsc_registration_v3.subject_structure |
| paper_type | varchar(20) | YES | nsc_registration_v3.subject_structure |

---

#### `v_subject_structure` — Subject Structure (cross-db mirror)

| Column | Type | Nullable | Source |
|--------|------|----------|--------|
| subject_official_code | varchar(20) | NO | nsc_registration_v3.subject_structure |
| paper_no | int | NO | nsc_registration_v3.subject_structure |
| reg_type | varchar(20) | NO | FT & PT |
| subject_short_code | int | YES | nsc_registration_v3.subject_structure |
| subject_alpha_code | varchar(10) | NO | nsc_registration_v3.subject_structure |
| subject_name_eng | varchar(100) | NO | nsc_registration_v3.subject_structure |
| subject_name_afr | varchar(100) | YES | nsc_registration_v3.subject_structure |
| subject_group | varchar(5) | NO | nsc_registration_v3.subject_structure |
| unique_group_name | varchar(100) | YES | nsc_registration_v3.subject_structure |
| origin | varchar(10) | YES | nsc_registration_v3.subject_structure |
| grade | varchar(10) | YES | nsc_registration_v3.subject_structure |
| paper_name_eng | varchar(50) | YES | nsc_registration_v3.subject_structure |
| paper_name_afr | varchar(50) | YES | nsc_registration_v3.subject_structure |
| duration | decimal(3,1) | YES | nsc_registration_v3.subject_structure |
| assessment_origin | varchar(20) | YES | nsc_registration_v3.subject_structure |
| adjustment_type | varchar(20) | YES | nsc_registration_v3.subject_structure |
| paper_type_code | varchar(5) | YES | nsc_registration_v3.subject_structure |
| paper_type | varchar(20) | YES | nsc_registration_v3.subject_structure |
| max_mark | int | YES | nsc_registration_v3.subject_structure |
| true_mark | int | YES | nsc_registration_v3.subject_structure |
| paper_mark | int | YES | nsc_registration_v3.subject_structure |
| subject_owner | varchar(10) | YES | nsc_registration_v3.subject_structure |
| weighting | int | YES | nsc_registration_v3.subject_structure |
| notes | text | YES | nsc_registration_v3.subject_structure |
| created_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | YES | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |

---

## 4. API Routes (Current Implementation)

### 4.1 `GET /health`
Returns: `{"status":"ok","timestamp":"2026-06-07T06:07:06.091Z"}`

### 4.2 `POST /api/qbank/papers/generate`
**Body:** `{"subject_official_code":"MATH","paper_no":1,"title":"Test Paper 1"}`
**Logic:**
1. Lookup spec by `(subject_official_code, paper_no)`
2. Parse `sections_config` JSON
3. Create paper with `spec_id` linkage
4. For each section: select approved items via `RAND()` + `LIMIT` (uses `query()`, not `execute()`)
5. Track used items to prevent duplicate `item_id` in composite PK
6. Warn on items used within 2 years
7. Validate total allocated marks vs spec

**Returns:**
```json
{
  "success": true,
  "paper_id": "uuid",
  "spec_id": "uuid",
  "total_items": 3,
  "total_allocated_marks": 20,
  "spec_total_marks": 150,
  "warnings": [...]
}
```

### 4.3 `GET /api/qbank/papers/:id`
Returns paper with joined items ordered by position.

### 4.4 `GET /api/qbank/items?subject=MATH&paper=1`
Returns up to 100 items, filtered by subject/paper, ordered by `created_at DESC`.

### 4.5 `POST /api/qbank/items` (single) and `POST /api/qbank/items/bulk`
Creates items with status 'Draft'.

### 4.6 `POST /api/staging/bulk`
Validates and inserts items into `qbank_items_staging`.

### 4.7 `POST /api/staging/approve/:id`
Migrates staging item to live `qbank_items` with tags/curriculum.

---

## 5. Migrations Applied (Chronological)

| Migration | Date | Purpose | Status |
|-----------|------|---------|--------|
| 001_create_qbank_paper_specs.sql | Original | Create specs table | Historical |
| 002_create_qbank_items.sql | Original | Create items table | Historical |
| 003_create_qbank_item_options.sql | Original | Create options table | Historical |
| 004_create_qbank_papers.sql | Original | Create papers table | Historical |
| 005_create_qbank_paper_items.sql | Original | Create paper_items table | Historical |
| 006_add_item_provenance.sql | Original | Add provenance columns | Historical |
| 007_seed_paper_specs.sql | Original | Seed initial specs | Historical |
| 2026-06-05_papers_schema.sql | 5 June | Manual ALTER for schema fix | Applied |
| 001_schema_fix.sql | 7 June | Formal migration: adds `spec_id`, `subject_official_code`, `paper_no`, `duration_minutes`, `status`, `created_by`, `total_marks` to `qbank_papers`; adds `section_name`, `position`, `marks_allocated` to `qbank_paper_items`; adds `created_at`, `updated_at` to `qbank_items` | ✅ Applied |
| 003_seed_specs.sql | 7 June | Seeds MATH P1/P2, PHYS P1/P2 with valid `sections_config` | ✅ Applied |
| 008_consolidate_qbank_tables.sql | 7 June | Creates `qbank_items_staging`, `qbank_item_tags`, `qbank_item_curriculum`, `qbank_items_staging_tags`, `qbank_items_staging_curriculum` in `nsc_qbank`; adds `item_code`, `caps_topic`, `item_type`, `difficulty_level`, `caps_subtopic`, `source_reference` to both `qbank_items` and `qbank_items_staging` | ✅ Applied |
| 009_fix_specs.sql | 7 June | Removes empty `sections_config` specs, deduplicates, adds `uq_spec` unique key, inserts MATH P1 with valid sections | ✅ Applied |

---

## 6. Environment

- **Node.js:** v24.14.0 (from server log)
- **MySQL:** 8.0.45 Community Server
- **OS:** Windows (Win64)
- **Database:** nsc_qbank (main), nsc_registration_v3 (cross-ref for subject_structure only)
- **Port:** 4000
- **CORS:** Enabled for all origins

---

## 7. Known Issues & Risks

| Issue | Status | Impact |
|-------|--------|--------|
| Only 3 approved MATH P1 items exist | Active | Cannot fill 150-mark paper |
| `questions` table has FK to `nsc_registration_v3.subject_structure` | Active | Cross-db dependency |
| `question_reviews.reviewer_id` references `nsc_registration_v3.users.id` | Active | Cross-db dependency |
| `v_questions_full`, `v_questions_with_reviewers`, `v_subject_structure` are cross-db views | Active | Depend on nsc_registration_v3 |
| No topic weighting in item selection | Active | Random selection only |
| No validation of marks allocation per topic | Active | May not match CAPS weighting |
| `LIMIT 20` replaced with dynamic fetch but still over-fetches | Resolved | Uses `Math.max(sectionMarks, 50)` |
| `RAND()` in prepared statements | Resolved | Uses `query()` instead of `execute()` |
| `IF NOT EXISTS` not supported for ADD COLUMN in MySQL 8.0.45 | Resolved | Uses `PREPARE/EXECUTE` dynamic SQL |
| `IF NOT EXISTS` not supported for ADD UNIQUE KEY | Resolved | Uses `information_schema.statistics` check |

---

## 8. Git Status (as of 2026-06-07 08:30)

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   README.md
  modified:   package-lock.json
  modified:   package.json
  modified:   routes/items.js
  modified:   routes/papers.js
  modified:   server.js

Untracked files:
  COMMIT_LOG.md
  VERSION.txt
  backend/
  database/
  docs/
  migrations/
  routes/staging.js
  wizard/

Last 3 commits:
  b46999a docs: add QBank handover, discovery and development plan (5 June 2026)
  fe87b41 chore(db): document papers schema changes
  a2ba9da Initial commit: working API with qbank_papers schema fixes
```

---

*End of Discovery File v2.0*
*All schema data verified from information_schema queries run 2026-06-07 08:30*
*No assumptions made — all facts from actual database and file system*
