# QBank Complete Schema & Seed Data Guide v6.0
**Date:** 30 June 2026 22:00
**Updated:** Batch parser rename fixes applied, parser_subject_code uniqueness discussed
**Database:** nsc_qbank (MySQL 8.0.45)
**Total Tables:** 34
**Character Set:** utf8mb4 COLLATE utf8mb4_unicode_ci
**Engine:** InnoDB

---

## CRITICAL: ACTUAL vs DOCUMENTED COLUMN NAMES

The following tables have column names that DIFFER from earlier schema documentation:

| Table | Documented (Wrong) | Actual (Correct) | Used By |
|-------|-------------------|------------------|---------|
| lookup_assessment_types | assessment_type_code | type_code | Backend API, Frontend |
| lookup_assessment_types | assessment_type_name | type_name | Backend API, Frontend |
| lookup_assessment_bodies | assessment_origin | body_code | Backend API, Frontend |
| lookup_assessment_bodies | assessment_body_name | body_name | Backend API, Frontend |
| lookup_assessment_bodies | (missing) | body_full_name | Backend API |
| lookup_exam_sessions | session_id | exam_session_id | Backend API, Frontend |
| lookup_papers | (missing) | paper_code | Backend API |
| lookup_papers | (missing) | paper_type | Backend API |
| lookup_papers | (missing) | duration_minutes | Backend API |
| lookup_papers | (missing) | display_order | Backend API |

**Rule:** Always verify column names with INFORMATION_SCHEMA.COLUMNS before writing code.

---

## 1. CORE DIMENSION LOOKUP TABLES (6 tables) — VERIFIED

### 1.1 lookup_years (Academic Years)

```sql
CREATE TABLE lookup_years (
  year_id INT AUTO_INCREMENT PRIMARY KEY,
  year_value INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_year_value (year_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** year_id, year_value, is_active, created_at
**Frontend maps:** year_id → id, year_value → name

### 1.2 lookup_grades (Grade Levels)

```sql
CREATE TABLE lookup_grades (
  grade_id INT AUTO_INCREMENT PRIMARY KEY,
  grade_number INT NOT NULL,
  grade_name VARCHAR(50) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grade_number (grade_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** grade_id, grade_number, grade_name, is_active, created_at
**Frontend maps:** grade_id → id, grade_name/grade_number → name

### 1.3 lookup_subjects (NSC Subjects) — UPDATED 2026-06-30

```sql
CREATE TABLE lookup_subjects (
  subject_id INT NOT NULL AUTO_INCREMENT,
  subject_official_code VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  subject_name VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  subject_alpha_code VARCHAR(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  parser_subject_code VARCHAR(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  description TEXT COLLATE utf8mb4_unicode_ci,
  is_active TINYINT(1) DEFAULT '1',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subject_id`),
  UNIQUE KEY `uk_subject_official_code` (`subject_official_code`)
) ENGINE=InnoDB AUTO_INCREMENT=262 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** subject_id, subject_official_code, subject_name, subject_alpha_code, parser_subject_code, description, is_active, created_at, updated_at
**Frontend maps:** subject_id → id, subject_name → name, subject_alpha_code → code
**Unique Constraints:** subject_official_code (UK), subject_id (PK)
**parser_subject_code:** NO UNIQUE constraint (discussed for future Grade 10/11)
**Current unique parser_subject_code count:** 123 (no duplicates)

**⚠️ GRADE CONSIDERATION:** parser_subject_code currently does NOT include grade.
When adding Grade 10/11, options:
1. Append `_G10`, `_G11`, `_G12` to parser_subject_code (simplest)
2. Add `grade` column with composite unique key `(parser_subject_code, grade)`

### 1.4 lookup_papers (Paper Types) — CORRECTED

```sql
CREATE TABLE lookup_papers (
  paper_id INT AUTO_INCREMENT PRIMARY KEY,
  paper_no INT NOT NULL,
  paper_code VARCHAR(10) NOT NULL,
  paper_name VARCHAR(100) NOT NULL,
  paper_name_afr VARCHAR(100) DEFAULT NULL,
  paper_type VARCHAR(20) NOT NULL,
  duration_minutes INT DEFAULT 180,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_paper_no (paper_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** paper_id, paper_no, paper_code, paper_name, paper_type, duration_minutes, is_active, display_order, created_at
**Frontend maps:** paper_id → id, paper_name → name, paper_no → code

### 1.5 lookup_assessment_types (Assessment Types) — CORRECTED

```sql
CREATE TABLE lookup_assessment_types (
  assessment_type_id INT AUTO_INCREMENT PRIMARY KEY,
  type_code VARCHAR(20) NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_type_code (type_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** assessment_type_id, type_code, type_name, description, is_active, created_at
**Frontend maps:** assessment_type_id → id, type_name → name, type_code → code
**⚠️ WAS:** assessment_type_code, assessment_type_name — WRONG

### 1.6 lookup_assessment_bodies (Assessment Bodies) — CORRECTED

```sql
CREATE TABLE lookup_assessment_bodies (
  assessment_body_id INT AUTO_INCREMENT PRIMARY KEY,
  body_code VARCHAR(50) NOT NULL,
  body_name VARCHAR(100) NOT NULL,
  body_full_name VARCHAR(255) DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_body_code (body_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** assessment_body_id, body_code, body_name, body_full_name, is_active, created_at
**Frontend maps:** assessment_body_id → id, body_name → name, body_code → code
**⚠️ WAS:** assessment_origin, assessment_body_name — WRONG

---

## 2. SECONDARY DIMENSION LOOKUP TABLES (6 tables) — VERIFIED

### 2.5 lookup_exam_sessions (Examination Sessions) — CORRECTED

```sql
CREATE TABLE lookup_exam_sessions (
  exam_session_id INT AUTO_INCREMENT PRIMARY KEY,
  session_code VARCHAR(20) NOT NULL,
  session_name VARCHAR(100) NOT NULL,
  session_month INT DEFAULT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_session_code (session_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Actual Columns:** exam_session_id, session_code, session_name, session_month, description, is_active, created_at
**Frontend maps:** exam_session_id → id, session_name → name, session_code → code
**⚠️ WAS:** session_id — WRONG

---

## 7. PARSER & COMPARISON TABLES (3 tables) — VERIFIED

### 7.1 parse_sessions (Parser Audit Trail)

**Actual Columns:** session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, file_name, file_hash, parser_version, total_items_found, total_marks_parser, total_marks_expected, total_marks_corrected, auto_corrected_count, manual_review_count, missing_count, status, error_message, completed_at, created_at

### 7.2 parse_expected_structure (Gold Standard)

**Actual Columns:** structure_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, question_number, question_type_id, section, expected_marks, sequence, parent_question, is_sub_part, cognitive_level_id, caps_subtopic_id, created_at, updated_at
**Migration 017 adds:** paper_code VARCHAR(50)

### 7.3 parse_results (Parser Output) — CORRECTED

**Actual Columns:** result_id, session_id, question_number, question_text, parsed_type_id, parsed_section, parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, variance (GENERATED), is_red_flag (GENERATED), user_corrected_marks, reviewer_notes, created_at, updated_at
**Migration 017 adds:** paper_code VARCHAR(50)
**⚠️ DOES NOT HAVE:** is_memo, parsed_type — these are WRONG in old code
**✅ HAS:** parsed_type_id (INT FK to lookup_item_types)

---

## 8. ITEM MASTER TABLE — CORRECTED (Import Verified 2026-06-15)

### 8.1 item_master (Production)

```sql
CREATE TABLE item_master (
  item_id CHAR(36) PRIMARY KEY,
  item_hash VARCHAR(64),
  subject_official_code VARCHAR(20),
  subject_alpha_code VARCHAR(10),
  paper_no INT,
  year_id INT,
  grade_id INT,
  subject_id INT,
  paper_id INT,
  assessment_type_id INT,
  assessment_body_id INT,
  item_code VARCHAR(50) UNIQUE,
  question_number VARCHAR(20),
  parent_question VARCHAR(20),
  is_sub_part TINYINT,
  question_text TEXT,
  marks INT,
  marks_allocated INT,              -- NOT NULL, no default
  item_type_id INT,
  cognitive_level_id INT,
  difficulty_id INT,              -- WAS: difficulty_level_id (WRONG)
  language_id INT,
  status ENUM('draft','peer_approved','published','archived'),
  review_status ENUM('draft','peer_review','approved','rejected'),
  source_year VARCHAR(10),
  source_paper_code VARCHAR(50),
  source_question_number VARCHAR(20),
  created_by INT NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**CRITICAL CORRECTIONS (Verified 2026-06-15):**
| Column | Wrong (Old) | Correct (Actual) | Status |
|--------|-------------|-------------------|--------|
| difficulty_id | difficulty_level_id | difficulty_id | ✅ Fixed |
| marks | auto_corrected_marks | marks | ✅ Fixed |
| marks_allocated | Missing | marks_allocated (NOT NULL) | ✅ Added |

**Import Route INSERT (Verified Working 2026-06-15):**
```sql
INSERT INTO item_master
(item_code, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id,
 language_id, question_number, question_text, marks, marks_allocated, item_type_id,
 cognitive_level_id, difficulty_id, status,
 source_paper_code, source_question_number, created_by)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
```

**Import Results (Verified 2026-06-15):**
- 91 items imported to item_master
- 91 memos imported to item_memos
- Total marks: 177 (expected 150 — parser refinement needed)

---

## 9. ITEM MEMOS TABLE

### 9.1 item_memos (Production)

```sql
CREATE TABLE item_memos (
  memo_id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  question_number VARCHAR(20),
  answer_text TEXT,
  marks INT,
  marking_guideline TEXT,
  is_current TINYINT DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 10. BATCH PARSER RENAME SYSTEM (NEW 2026-06-30)

### 10.1 Machine Filename Format
```
{PARSER_SUBJECT_CODE}_{PAPER}_{YEAR}_{SESSION}_{LANGUAGE}_{TYPE}.pdf
```

### 10.2 isMachineFormat Function
```javascript
function isMachineFormat(filename) {
  const name = filename.replace('.pdf', '');
  return name.includes('_P') && 
         /_\d{4}_/.test(name) && 
         /^[A-Z0-9_&-]+$/i.test(name) && 
         !name.includes(' ');
}
```

**Regex components:**
- `name.includes('_P')` — Has paper indicator
- `/_\d{4}_/.test(name)` — Has 4-digit year
- `/^[A-Z0-9_&-]+$/i` — Only uppercase, digits, underscore, ampersand, hyphen (case-insensitive)
- `!name.includes(' ')` — No spaces

### 10.3 Assessment Type Suffixes in parser_subject_code
| Assessment Type | Suffix | Example |
|-----------------|--------|---------|
| Home Language | HOMELANGUAGE | AFRIKAANSHOMELANGUAGE |
| First Additional | FIRSTADDITIONALLANGUAGE | ENGLISHFIRSTADDITIONALLANGUAGE |
| Second Additional | SECONDADDITIONALLANGUAGE | AFRIKAANSSECONDADDITIONALLANGUAGE |

---

## FRONTEND NORMALIZATION MAP (Verified 2026-06-15)

```typescript
const normalizeLookup = (item: any): LookupItem => {
  const id = item.assessment_type_id ?? item.assessment_body_id ?? item.exam_session_id ?? item.subject_id ?? item.paper_id ?? item.year_id ?? item.grade_id ?? item.id ?? 0;
  const name = item.type_name || item.body_name || item.session_name || item.subject_name || item.paper_name || item.year_value || item.grade_name || item.grade_number || item.name || '';
  const code = item.type_code || item.body_code || item.session_code || item.subject_alpha_code || item.paper_no || item.code || '';
  return { id, name: String(name), code: String(code), ... };
};
```

---

## IMPORT ROUTE COLUMN MAP (Verified 2026-06-15)

### parse_results → item_master Mapping

| parse_results Column | item_master Column | Transform |
|---------------------|-------------------|-----------|
| question_number | question_number | Direct |
| question_text | question_text | Direct |
| auto_corrected_marks | marks | Direct |
| auto_corrected_marks | marks_allocated | Direct (same value) |
| question_type_id | item_type_id | Direct |
| year_id | year_id | From parse_sessions |
| grade_id | grade_id | From parse_sessions |
| subject_id | subject_id | From parse_sessions |
| paper_id | paper_id | From parse_sessions |
| assessment_type_id | assessment_type_id | From parse_sessions |
| assessment_body_id | assessment_body_id | From parse_sessions |
| paper_code | source_paper_code | Direct |
| question_number | source_question_number | Direct |

**⚠️ parse_results DOES NOT HAVE:** is_memo, marks, parsed_type
**✅ parse_results HAS:** auto_corrected_marks, parsed_type_id, expected_marks

---

*End of Corrected Schema v6.0*
*All column names verified against INFORMATION_SCHEMA, curl API responses, and import route debugging*
*Date: 2026-06-30 22:00*
