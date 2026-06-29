# QBank Parser Import Dashboard - AI Handover Note
**Date:** 2026-06-29 13:19 SAST
**Session:** Parser Import Dashboard Development
**Status:** IN PROGRESS - Dashboard created but needs fixes
**Git:** 3 commits ahead of origin/main

---

## 1. WHAT WAS DONE THIS SESSION

### 1.1 Cleanup
- Deleted old backup files (BACKUP_OLD_WIZARD, .bak, .backup files)
- Deleted old diagnostic scripts (check_*, clear_*, diagnose_*, test_*, update_*)
- Committed: `4338269` - chore: clean up old backup files

### 1.2 WizardPage Fix
- Fixed `handleImport` function to use `/api/v3/parser/approve` endpoint
- Added `session_id` and `language` to request body
- Removed `approved_items` from request body
- Committed: `a56234b` - fix: update WizardPage handleImport to use v3 parser API

### 1.3 Parser Import Dashboard Created
- **Backend route:** `routes/dashboard_parser_status.js`
- **Frontend page:** `frontend/src/pages/ParserImportDashboard.tsx`
- **Route added:** `/parser-import-dashboard` in App.tsx
- **Navigation:** Added to Wizard dropdown
- **API endpoints:**
  - `GET /api/dashboard/parser/parser-import-status`
  - `GET /api/dashboard/parser/filters`
- Committed: `3fd9468` + `eefce9f` - feat: add parser import dashboard + fixes

---

## 2. CRITICAL ISSUES IDENTIFIED

### 2.1 Dashboard Shows Wrong Data
- **Year shows 2024** instead of 2025 (from lookup_years table)
- **Language shows "English" for all** (hardcoded, not using lookup_languages)
- **Only 24 papers showing** out of 75+ parse sessions
- **No attachments showing** (item_attachments table is empty)

### 2.2 Wrong Column Used
- **Using `subject_alpha_code`** (e.g., ACCN) instead of `subject_official_code` (e.g., 12351024)
- **Must use `subject_official_code`** as per user requirements

### 2.3 Missing language_id in parse_sessions
- **parse_sessions table does NOT have `language_id` column**
- **Current columns:** session_id, year_id, grade_id, subject_id, paper_id, assessment_type_id, assessment_body_id, file_name, file_hash, parser_version, total_items_found, total_marks_parser, total_marks_expected, total_marks_corrected, auto_corrected_count, manual_review_count, missing_count, status, error_message, completed_at, created_at, paper_code, is_memo
- **Need to add:** `language_id` column

### 2.4 Parser Not Extracting Dimensions from Filename
- **Parser currently gets dimensions from frontend** (WizardPage dropdowns)
- **Should extract from PDF filename** (e.g., "Accounting P1 Nov 2025 Eng.pdf")
- **Need to extract:** year, grade, paper, language from filename
- **Need to look up IDs** from lookup tables

---

## 3. WHAT NEEDS TO BE DONE NEXT

### 3.1 Add language_id to parse_sessions
```sql
ALTER TABLE parse_sessions ADD COLUMN language_id INT NULL AFTER assessment_body_id;
ALTER TABLE parse_sessions ADD FOREIGN KEY (language_id) REFERENCES lookup_languages(language_id);
```

### 3.2 Modify Parser to Extract Dimensions from Filename
- **File:** `routes/v3/parser.js` (and v2 if still used)
- **Extract from filename pattern:** `{Subject} P{PaperNo} {Session} {Year} {Language}.pdf`
- **Examples:**
  - `Accounting P1 Nov 2025 Eng.pdf` -> subject=ACCOUNTING, paper=P1, year=2025, language=ENG
  - `Mathematics P2 Nov 2025 Afr.pdf` -> subject=MATHEMATICS, paper=P2, year=2025, language=AFR
- **Look up IDs:**
  - `lookup_subjects` -> find `subject_id` by `parser_subject_code` (full name without spaces)
  - `lookup_papers` -> find `paper_id` by `paper_no`
  - `lookup_years` -> find `year_id` by `year_value`
  - `lookup_languages` -> find `language_id` by `language_code` (ENG->EN, AFR->AF)
  - `lookup_grades` -> assume Grade 12 (grade_id=3) or extract from context

### 3.3 Fix Dashboard to Use Correct Columns
- **Remove `subject_alpha_code`** from dashboard
- **Use `subject_official_code`** from lookup_subjects
- **Join `lookup_languages`** to get `language_name` from `language_id`
- **Join `lookup_years`** to get `year_value` from `year_id`
- **Remove hardcoded values** (no "English", no "2024")

### 3.4 Fix Dashboard Query
- **Show ALL parse_sessions** (not just those with parse_results)
- **Use proper LEFT JOINs** to show papers with 0 parsed items
- **Fix GROUP BY** to include all non-aggregated columns

### 3.5 Fix Summary Cards
- **Show correct totals** (parsed vs imported)
- **Show missing imports** (papers parsed but not imported)
- **Show papers not yet parsed** (in folder but not in database)

---

## 4. DATABASE SCHEMA (Relevant Tables)

### 4.1 parse_sessions
| Column | Type | Notes |
|--------|------|-------|
| session_id | VARCHAR(36) | PK |
| year_id | INT | FK to lookup_years |
| grade_id | INT | FK to lookup_grades |
| subject_id | INT | FK to lookup_subjects |
| paper_id | INT | FK to lookup_papers |
| assessment_type_id | INT | FK to lookup_assessment_types |
| assessment_body_id | INT | FK to lookup_assessment_bodies |
| file_name | VARCHAR(255) | PDF filename |
| file_hash | VARCHAR(64) | |
| parser_version | VARCHAR(20) | |
| total_items_found | INT | |
| total_marks_parser | INT | |
| total_marks_expected | INT | |
| total_marks_corrected | INT | |
| auto_corrected_count | INT | |
| manual_review_count | INT | |
| missing_count | INT | |
| status | VARCHAR(50) | |
| error_message | TEXT | |
| completed_at | TIMESTAMP | |
| created_at | TIMESTAMP | |
| paper_code | VARCHAR(50) | e.g., ACCOUNTING_P1_2025_NOV_ENG |
| is_memo | TINYINT | |

### 4.2 lookup_subjects
| Column | Type | Notes |
|--------|------|-------|
| subject_id | INT | PK |
| subject_official_code | VARCHAR(20) | **USE THIS** (e.g., 12351024) |
| subject_alpha_code | VARCHAR(10) | **DO NOT USE** (e.g., ACCN) |
| subject_name | VARCHAR(255) | e.g., Accounting |
| parser_subject_code | VARCHAR(100) | e.g., ACCOUNTING (full name no spaces) |

### 4.3 lookup_languages
| language_id | language_code | language_name |
|-------------|---------------|---------------|
| 1 | EN | English |
| 2 | AF | Afrikaans |
| 3 | ZU | isiZulu |
| 4 | XH | isiXhosa |
| 5 | ST | Sesotho |
| 6 | TN | Setswana |
| 7 | NS | siSwati |
| 8 | ND | isiNdebele |
| 9 | TS | Xitsonga |
| 10 | VE | Tshivenda |

### 4.4 lookup_years
| year_id | year_value |
|---------|------------|
| 1 | 2020 |
| 2 | 2021 |
| 3 | 2022 |
| 4 | 2023 |
| 5 | 2024 |
| 6 | 2025 |

### 4.5 lookup_grades
| grade_id | grade_number |
|----------|--------------|
| 1 | 10 |
| 2 | 11 |
| 3 | 12 |

### 4.6 lookup_papers
| paper_id | paper_no | paper_name |
|----------|----------|------------|
| 1 | 1 | Paper 1 |
| 2 | 2 | Paper 2 |
| 3 | 3 | Paper 3 |

---

## 5. CRITICAL RULES FOR NEXT AI

1. **NEVER use `subject_alpha_code`** - Always use `subject_official_code`
2. **NEVER hardcode values** - Always use lookup tables
3. **NEVER extract from strings** - Use proper foreign keys and joins
4. **ALWAYS verify schema** before writing queries
5. **ALWAYS use `parser_subject_code`** for parser-to-database linking
6. **ALWAYS check if columns exist** before using them

---

## 6. FILES TO MODIFY

| File | Action | Priority |
|------|--------|----------|
| `routes/v3/parser.js` | Add language_id extraction | HIGH |
| `routes/v2/parser.js` | Add language_id extraction (if still used) | MEDIUM |
| `routes/dashboard_parser_status.js` | Fix to use subject_official_code, lookup tables | HIGH |
| `frontend/src/pages/ParserImportDashboard.tsx` | Fix to use subject_official_code, remove hardcodes | HIGH |
| `parse_sessions` table | Add language_id column | HIGH |

---

## 7. TESTING CHECKLIST

- [ ] Dashboard shows correct year (2025)
- [ ] Dashboard shows correct language (English/Afrikaans)
- [ ] Dashboard shows ALL papers (not just 24)
- [ ] Dashboard uses subject_official_code
- [ ] No hardcoded values in dashboard
- [ ] Parser extracts language from filename
- [ ] Parser stores language_id in parse_sessions
- [ ] Filters work correctly (year, grade, subject, paper, language)

---

## 8. CONTACT

**User:** Building Corporate Qbank for NSC (South Africa)
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev
sc-qbank
**Backend Port:** 4000
**Frontend Port:** 3000
**Database Password:** Hilton@66

---

**END OF HANDOVER NOTE**
**Next Session:** Fix dashboard to use proper lookup tables and subject_official_code
