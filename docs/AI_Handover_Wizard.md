# QBank Question Paper & Marking Guideline Wizard - AI Handover Note
**Version:** v1.0  
**Date:** 2026-06-13  
**System:** NSC QBank Corporate System  
**Repository:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (`node server.js` from repo root)  
**Frontend Port:** 3000 (`npm run dev` from `frontend/`)  

---

## CRITICAL RULES FOR FUTURE AI

1. **NEVER make assumptions about table names or columns.** Always run `DESCRIBE table_name;` or `SHOW TABLES;` before writing SQL.
2. **NEVER hardcode lookup values.** All lookups come from database tables (`lookup_subjects`, `lookup_papers`, `lookup_years`, `lookup_grades`, `lookup_assessment_types`, `lookup_assessment_bodies`, `lookup_item_types`, etc.).
3. **The old `wizard/index.html` is DEPRECATED.** Do NOT fix it. The production wizard is the React component at `/wizard` route.
4. **Always check Git history** before modifying files: `git log --oneline -10` and `git diff HEAD~1 --name-only`.
5. **The system was working before an AI broke it.** If something is broken, check what changed in Git first.
6. **Backend must be running before testing frontend.** MySQL must be running first. Check `server.log` for errors.

---

## SYSTEM ARCHITECTURE

```
Frontend (React + Vite)          Backend (Node.js + Express)          MySQL (nsc_qbank)
    |                                    |                                    |
    |-- Upload QP PDF                    |-- pdfjs-dist text extraction       |
    |-- Upload Memo PDF                  |-- parse-qp.js                      |-- parse_results
    |-- Review & Correct               |-- memo-parser.js                   |-- parse_sessions
    |-- Import to Database               |-- compare-qp.js                    |-- parse_expected_structure
    |                                    |-- memo-compare.js                  |-- item_master
    |                                    |-- extract-structure.js             |-- item_memos
    |                                    |                                    |-- item_attachments
```

---

## WIZARD WORKFLOW (4 Steps)

### Step 1: Upload & Parse Question Paper (QP)
- User selects: Subject, Paper No, Year, Grade, Assessment Type, Assessment Body
- User uploads QP PDF
- Frontend extracts text using `pdfjs-dist` (client-side)
- Frontend parses text into structured items (`question_number`, `question_text`, `section`, `type`, `marks`)
- Frontend calls `POST /api/wizard/structure` → saves expected structure to `parse_expected_structure`
- Frontend calls `POST /api/wizard/compare-qp` → creates review session in `parse_sessions` + `parse_results`
- Returns `session_id` for review

### Step 2: Upload & Parse Memo (Marking Guidelines)
- User uploads Memo PDF
- Frontend extracts text using `pdfjs-dist`
- Frontend parses text into memo items (`question_number`, `answer_text`, `marks`)
- Frontend calls `POST /api/wizard/extract-memo` → saves memo items to `parse_results` with `is_memo=1`
- Frontend calls `POST /api/wizard/compare-memo` → checks alignment (QP vs Memo marks match)
- Returns alignment summary (aligned/mismatched/missing)

### Step 3: Review & Correct
- Frontend renders `ReviewPanel` component with `session_id`
- Calls `GET /api/wizard/comparison/:session_id` → loads all items from `parse_results`
- Shows: question text, section, type, parser marks, expected marks, corrected marks, status
- User can: edit marks, add notes, filter by status (All/Red Flags/Auto-Corrected)
- User clicks "Save Corrections" → calls `POST /api/wizard/save-corrections`
- Updates `parse_results` with `user_corrected_marks` and `correction_status='validated'`
- Updates `parse_sessions` status to `completed`

### Step 4: Import to Database (Production)
- **NOT YET IMPLEMENTED** — this is the next critical task
- Should read `parse_results` where `is_memo=0` and `correction_status='validated'`
- Insert into `item_master` with proper lookup IDs
- Insert matching memos from `parse_results` where `is_memo=1` into `item_memos`
- Update `parse_sessions` status to `imported`

---

## DATABASE SCHEMA (Verified 2026-06-13)

### Production Tables
```sql
-- item_master: Stores actual question items
CREATE TABLE item_master (
  item_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_code VARCHAR(50) NOT NULL UNIQUE,
  subject_official_code VARCHAR(20),
  paper_no INT,
  year_id INT,
  grade_id INT,
  assessment_type_id INT,
  assessment_body_id INT,
  language_id INT,
  question_number VARCHAR(20),
  question_text TEXT,
  marks INT,
  item_type_id INT,
  cognitive_level_id INT,
  difficulty_level_id INT,
  status ENUM('draft','peer_approved','published','archived') DEFAULT 'draft',
  source_year VARCHAR(10),
  source_paper_code VARCHAR(50),
  source_question_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- item_memos: Stores memo answers linked to items
CREATE TABLE item_memos (
  memo_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_id CHAR(36) NOT NULL,
  question_number VARCHAR(20),
  answer_text TEXT,
  marks INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES item_master(item_id)
);

-- item_memo_subparts: Sub-part answers
CREATE TABLE item_memo_subparts (
  subpart_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  memo_id CHAR(36) NOT NULL,
  subpart_number VARCHAR(10),
  answer_text TEXT,
  marks INT,
  FOREIGN KEY (memo_id) REFERENCES item_memos(memo_id)
);

-- item_attachments: Images/diagrams
CREATE TABLE item_attachments (
  attachment_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_id CHAR(36) NOT NULL,
  file_name VARCHAR(255),
  file_path VARCHAR(500),
  mime_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES item_master(item_id)
);
```

### Staging Tables
```sql
-- parse_results: Staging for parsed QP and Memo items
CREATE TABLE parse_results (
  result_id INT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(50),
  paper_code VARCHAR(50),
  question_number VARCHAR(20),
  question_text TEXT,
  parsed_type_id INT,
  parsed_section VARCHAR(50),
  parser_extracted_marks INT,
  expected_marks INT,
  auto_corrected_marks INT,
  correction_status ENUM('auto_corrected','manual_review','validated','parser_missing') DEFAULT 'auto_corrected',
  user_corrected_marks INT,
  reviewer_notes TEXT,
  is_memo TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- parse_sessions: Parse session tracking
CREATE TABLE parse_sessions (
  session_id VARCHAR(50) PRIMARY KEY,
  paper_code VARCHAR(50),
  file_name VARCHAR(255),
  file_hash VARCHAR(64),
  parser_version VARCHAR(20),
  total_marks_expected INT,
  total_items_found INT,
  total_marks_parser INT,
  total_marks_corrected INT,
  auto_corrected_count INT,
  manual_review_count INT,
  missing_count INT,
  status ENUM('comparing','auto_corrected','completed','imported') DEFAULT 'comparing',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

-- parse_expected_structure: Gold standard structure extracted from QP
CREATE TABLE parse_expected_structure (
  structure_id INT PRIMARY KEY AUTO_INCREMENT,
  paper_code VARCHAR(50),
  question_number VARCHAR(20),
  question_type_id INT,
  section VARCHAR(50),
  expected_marks INT,
  sequence INT,
  parent_question VARCHAR(20),
  is_sub_part TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Lookup Tables (Verified)
```sql
-- lookup_item_types
+---------+-------------+
| type_id | type_name     |
+---------+-------------+
| 1       | MCQ           |
| 2       | Short Answer  |
| 3       | Matching      |
| 4       | Diagram       |
| 5       | Extended      |
+---------+-------------+

-- lookup_cognitive_levels
+-------+---------------+
| id    | level_name    |
+-------+---------------+
| 1     | Remembering   |
| 2     | Understanding |
| 3     | Applying      |
| 4     | Analysing     |
| 5     | Evaluating    |
| 6     | Creating      |
+-------+---------------+

-- lookup_difficulty_levels
+-------+---------------+
| id    | level_name    |
+-------+---------------+
| 1     | Easy          |
| 2     | Medium        |
| 3     | Hard          |
+-------+---------------+

-- lookup_languages
+-------+-------------+
| id    | language    |
+-------+-------------+
| 1     | English     |
| 2     | Afrikaans   |
+-------+-------------+
```

---

## BACKEND ROUTES (Verified Files in `routes/`)

| File | Route | Purpose |
|------|-------|---------|
| `pdf_parser_structured.js` | `POST /api/wizard/parse` | Server-side QP parsing (fallback) |
| `compare-qp.js` | `POST /api/wizard/compare-qp` | Compares parsed QP against expected structure, creates review session |
| `compare-qp.js` | `POST /api/wizard/save-corrections` | Saves user corrections to `parse_results` |
| `compare-qp.js` | `GET /api/wizard/comparison/:session_id` | Returns all items for review |
| `compare-qp.js` | `POST /api/wizard/structure` | Saves expected structure to `parse_expected_structure` |
| `compare-qp.js` | `GET /api/wizard/structure/:paper_code` | Returns expected structure |
| `memo-parser.js` | `POST /api/wizard/extract-memo` | Parses memo PDF, saves to `parse_results` with `is_memo=1` |
| `memo-compare.js` | `POST /api/wizard/compare-memo` | Compares memo against QP structure, returns alignment summary |

**Note:** `compare-qp.js` was missing from `routes/` at one point (AI deleted it). It was restored from user uploads. Always verify it exists before building.

---

## FRONTEND COMPONENTS

| File | Path | Purpose |
|------|------|---------|
| `WizardPage.tsx` | `frontend/src/pages/WizardPage.tsx` | Main 3-step wizard page (QP → Memo → Review) |
| `UploadWizard.tsx` | `frontend/src/components/wizard/UploadWizard.tsx` | Single-page wizard (alternative to WizardPage) |
| `ReviewPanel.tsx` | `frontend/src/components/wizard/ReviewPanel.tsx` | Full CRUD review table with filters, edit marks, save corrections |

**Routing:** WizardPage is rendered at `/wizard` route in `App.tsx`.

---

## ITEM CODE FORMAT (Verified from Database)

Existing items use format: `{subject_official_code}_{paper_no}_{8-char-hex}`

Examples from `item_master`:
- `12351024_1_928B4E28` (Accounting P1)
- `19331054_1_1ADB97D8` (Geography P1)
- `19331054_1_486F7287` (Geography P1)
- `19331054_1_693D9AC3` (Geography P1)

**Generate new item codes using:**
```javascript
const itemCode = `${subject_official_code}_${paper_no}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
```

---

## KNOWN ISSUES & FIXES APPLIED

| Issue | Fix | Date |
|-------|-----|------|
| `compare-qp.js` missing from `routes/` | Restored from user upload | 2026-06-13 |
| `GlobalWorkerOptions.workerSrc` not set | Moved to module level in `WizardPage.tsx` | 2026-06-13 |
| `WizardPage.tsx` sending FormData instead of JSON | Added client-side `pdfjs-dist` extraction, sends `textItems` JSON | 2026-06-13 |
| Dropdown rendering objects as React children | Added `safeStr()` helper to extract string values from lookup objects | 2026-06-13 |
| ReviewPanel importing non-existent API functions | Replaced with inline `fetch` calls | 2026-06-13 |
| UTF-16LE encoding corruption in saved files | All files rewritten as UTF-8 | 2026-06-13 |
| Old `wizard/index.html` broken (`pdfParse is not a function`) | **Deprecated** — do not fix. Use React wizard only | 2026-06-13 |

---

## PENDING TASKS (Next AI Session)

1. **Step 4: Import to Database**
   - Create `POST /api/wizard/import` endpoint
   - Read `parse_results` where `is_memo=0` and `correction_status='validated'`
   - Map `parse_expected_structure` lookup IDs to `item_master` fields
   - Generate `item_code` using verified format
   - Insert into `item_master`
   - Find matching memos (`is_memo=1`, same `question_number`) → insert into `item_memos`
   - Update `parse_sessions` status to `imported`

2. **Image Extraction**
   - `pdfjs-dist` can extract images from PDFs
   - Store extracted images in `item_attachments` table
   - Show image placeholders in review UI

3. **Memo Sub-parts**
   - Some questions have sub-parts (a, b, c) with separate marks
   - Need to parse and store in `item_memo_subparts`

4. **CAPS Linking**
   - After import, link items to CAPS curriculum topics/subtopics
   - Use `lookup_caps_topics` and `lookup_caps_subtopics` tables

---

## POWER SHELL COMMANDS (For Reference)

```powershell
# Check backend routes exist
Get-ChildItem C:\dev
sc-qbankoutes | Where-Object { $_.Name -match "wizard|parse|memo|compare" }

# Check frontend components
Get-ChildItem C:\dev
sc-qbankrontend\src\components\wizard -Recurse
Get-ChildItem C:\dev
sc-qbankrontend\src\pages | Where-Object { $_.Name -match "Wizard" }

# Build frontend
cd C:\dev
sc-qbankrontend
npm run build

# Start backend (port 4000)
cd C:\dev
sc-qbank
node server.js

# Check database tables
& "C:\Program Files\MySQL\MySQL Server 8.0in\mysql.exe" -u root -pHilton@66 -e "USE nsc_qbank; SHOW TABLES;"

# Describe specific table
& "C:\Program Files\MySQL\MySQL Server 8.0in\mysql.exe" -u root -pHilton@66 -e "USE nsc_qbank; DESCRIBE item_master;"

# Check recent items
& "C:\Program Files\MySQL\MySQL Server 8.0in\mysql.exe" -u root -pHilton@66 -e "USE nsc_qbank; SELECT item_id, item_code, question_number, marks, status FROM item_master ORDER BY created_at DESC LIMIT 5;"

# Git status
cd C:\dev
sc-qbank
git status
git log --oneline -5
```

---

## FILE SAVINGS RULE (CRITICAL)

When writing TypeScript files via PowerShell, **always use this exact pattern** to avoid encoding corruption:

```powershell
$lines = @(
  'import React from "react";',
  'const Component = () => {',
  '  return <div>Hello</div>;',
  '};',
  'export default Component;'
);
$lines | Set-Content -Path "frontend/src/components/Component.tsx" -Encoding UTF8
```

**Never use:**
- Heredoc (`@'...'@`) for TypeScript files
- Double quotes for strings containing `$` or special chars
- `Out-File` without `-Encoding UTF8`
- Copy-paste from clipboard into PowerShell (causes stray `n characters)

---

## CONTACT / CONTEXT

- **User:** Works on NSC QBank system for South African National Senior Certificate (NSC) exam papers
- **Subjects:** Geography, Life Sciences, Physical Sciences, Mathematics, Accounting, Business Studies, Economics, etc.
- **Paper format:** DBE (Department of Basic Education) and IEB (Independent Examinations Board)
- **Grade:** Primarily Grade 12 (Matric)
- **System status:** Backend running on port 4000, frontend on port 3000, MySQL database `nsc_qbank`
- **Last working state:** Before an AI overwrote `compare-qp.js` and corrupted `WizardPage.tsx` encoding

---

**END OF HANDOVER NOTE**
