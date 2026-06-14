# QBank Wizard - AI Handover Note v3
**Version:** v3.0  
**Date:** 14 June 2026 20:10 SAST  
**System:** NSC QBank Corporate System  
**Repository:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (`node server.js` from repo root)  
**Frontend Port:** 3000 (`npm run dev` from `frontend/`)  
**Git Branch:** main  
**Last Commit:** (pending — uncommitted changes in working tree)  

---

## CRITICAL UPDATE: ROUTE CONFLICT INVESTIGATION (2026-06-14 20:00)

### Problem Discovered
Multiple wizard-related route files exist in `routes/` that may **interfere** with the current pipeline. The new routes (pdfExtract.js, wizardImport.js) may be clashing with legacy routes (compare-qp.js, memo-parser.js, memo-compare.js, import.js).

### Route Files Inventory (Verified)
| File | Status | Risk | Action Required |
|------|--------|------|-----------------|
| `routes/pdfExtract.js` | ACTIVE | LOW | Contains 5 working wizard routes — **KEEP** |
| `routes/wizardImport.js` | ACTIVE | LOW | Import pipeline — **KEEP** |
| `routes/compare-qp.js` | LEGACY | **HIGH** | May register `/api/wizard/structure`, `/compare-qp`, `/save-corrections` — **VERIFY** if still mounted in server.js |
| `routes/memo-parser.js` | LEGACY | **HIGH** | May register `/api/wizard/extract-memo` — **VERIFY** if still mounted |
| `routes/memo-compare.js` | LEGACY | **HIGH** | May register `/api/wizard/compare-memo` — **VERIFY** if still mounted |
| `routes/import.js` | LEGACY | **HIGH** | May register `/api/wizard/import` — **VERIFY** if still mounted |

### server.js Route Registration (CRITICAL CHECK NEEDED)
The following lines in `server.js` must be verified. If BOTH legacy and new routes are mounted, Express will use the **first one registered** and silently ignore the second:

```javascript
// NEW routes (current pipeline — v9 discovery)
app.use('/api/wizard', require('./routes/pdfExtract'));
app.use('/api/wizard', require('./routes/wizardImport'));

// LEGACY routes (may still be mounted — v2 handover)
app.use('/api/wizard', require('./routes/compare-qp'));      // ???
app.use('/api/wizard', require('./routes/memo-parser'));     // ???
app.use('/api/wizard', require('./routes/memo-compare'));    // ???
app.use('/api/wizard', require('./routes/import'));          // ???
```

**IMMEDIATE ACTION:** Run this in PowerShell to check server.js:
```powershell
cd C:\dev\nsc-qbank
Select-String -Path server.js -Pattern "require\('./routes/(compare-qp|memo-parser|memo-compare|import|pdfExtract|wizardImport)'\)"
```

If legacy routes are still mounted, **comment them out** and restart backend.

---

## MIGRATION 017 STATUS (2026-06-14 20:00)

### Migration File
`database/migrations/017_wizard_pipeline.sql`

### Errors Encountered
| Time | Error | Cause | Status |
|------|-------|-------|--------|
| 20:04 | `ALTER COLUMN IF NOT EXISTS` syntax error | MySQL 8.0 does not support `IF NOT EXISTS` in `ALTER TABLE ... ALTER COLUMN` | FAILED |
| 20:04 | `paper_code_question does not exist` | Column name mismatch in migration script | FAILED |

### Corrected Migration (Manual Fix Applied)
The migration was edited to use `ADD COLUMN` instead of `ALTER COLUMN IF NOT EXISTS`:
```sql
ALTER TABLE parse_results ADD COLUMN paper_code VARCHAR(50) AFTER session_id;
ALTER TABLE parse_expected_structure ADD COLUMN paper_code VARCHAR(50) AFTER structure_id;
```

**Status:** Migration applied manually via MySQL CLI. Columns now exist.

---

## PARSER DEBUG STATUS (2026-06-14 20:00)

### Current Problem
**"No questions found in QP PDF"** — the PyMuPDF extraction in `scripts/extract_dbe_paper.py` is not catching DBE question structures.

### Root Cause Analysis
DBE papers use **content headers** (e.g., "SECTION A", "QUESTION 1", "1.1") rather than simple line patterns. The current regex/line-based approach misses:
1. Multi-line question text spanning paragraphs
2. Mark allocations in brackets on separate lines
3. Sub-questions (1.1.1, 1.1.2) nested under parent questions
4. Section boundaries (A/B/C)

### Sandbox Harness
ZIP file extracted to repo: `scripts/extract_dbe_paper.py` (updated version from Downloads).

**Test Command:**
```powershell
cd C:\dev\nsc-qbank
python scripts/extract_dbe_paper.py "C:\path\to\Geography_P2_Nov_2024.pdf"
```

### Next Parser Tasks
1. Run sandbox harness against actual DBE PDF
2. Verify extraction produces ~40 items with ~150 marks
3. Check that question numbers match pattern: `^\d+(?:\.\d+)*$`
4. Verify section detection (A/B/C)

---

## FILE CHANGES SINCE LAST COMMIT (2026-06-14)

### Files Modified (Not Yet Committed)
| File | Change | Status |
|------|--------|--------|
| `server.js` | Route registration may have changed | CHECK |
| `database/migrations/017_wizard_pipeline.sql` | Applied manually, may need git sync | CHECK |
| `scripts/extract_dbe_paper.py` | Updated from ZIP extraction | Ready |
| `frontend/src/pages/WizardPage.tsx` | v6 deployed | Working |
| `routes/pdfExtract.js` | 5 routes fixed 18:00 | Working |
| `routes/wizardImport.js` | Import pipeline | Working |

### Files from Downloads (Copied to Repo)
```powershell
# Commands executed in last session:
Copy-Item "C:\Users\visagie.h\Downloads\017_wizard_pipeline.sql" "C:\dev\nsc-qbank\database\migrations\" -Force
Copy-Item "C:\Users\visagie.h\Downloads\extract_dbe_paper.py" "C:\dev\nsc-qbank\scripts\" -Force
# (plus other ZIP contents)
```

---

## VERIFIED API ENDPOINTS (Updated 2026-06-14 20:00)

### Working Endpoints (pdfExtract.js + wizardImport.js)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/extract-qp` | Upload QP PDF, extract items | Working (if no legacy clash) |
| POST | `/api/wizard/extract-memo` | Upload Memo PDF, extract items | Working (if no legacy clash) |
| GET | `/api/wizard/extraction-status/:session_id` | Get extraction summary | Working |
| GET | `/api/wizard/comparison/:session_id` | Get full review data | Added 18:00 |
| POST | `/api/wizard/save-corrections` | Save user corrections | Added 18:00 |
| POST | `/api/wizard/import` | Import to item_master | Working |

### LEGACY ENDPOINTS (MAY BE SHADOWED)
If `compare-qp.js`, `memo-parser.js`, `memo-compare.js`, or `import.js` are still mounted in `server.js`, the following endpoints may be **silently overriding** the new routes:
- `POST /api/wizard/structure` (compare-qp.js)
- `POST /api/wizard/compare-qp` (compare-qp.js)
- `POST /api/wizard/extract-memo` (memo-parser.js)
- `POST /api/wizard/compare-memo` (memo-compare.js)
- `POST /api/wizard/import` (import.js)

**CRITICAL:** If a legacy route handles `/api/wizard/import` BEFORE `wizardImport.js`, the new import logic (with schema-agnostic lookup resolution) will **never execute**.

---

## DATABASE SCHEMA (Verified 2026-06-14 20:00)

### parse_results (Current State)
```sql
result_id INT PK AUTO_INCREMENT
session_id VARCHAR(64)
paper_code VARCHAR(50)          -- ADDED by Migration 017
question_number VARCHAR(20)
question_text TEXT
parsed_type_id INT              -- FK to lookup_item_types (NOT parsed_type VARCHAR)
parsed_section VARCHAR(20)
parser_extracted_marks INT
expected_marks INT
auto_corrected_marks INT
correction_status ENUM('auto_corrected','manual_review','validated','parser_missing')
variance INT GENERATED
is_red_flag TINYINT GENERATED
user_corrected_marks INT
reviewer_notes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```
**DOES NOT HAVE:** `is_memo`, `parsed_type` — remove from ALL code

### parse_sessions (Current State)
```sql
session_id VARCHAR(50) PK
paper_code VARCHAR(50)
year_id INT
grade_id INT
subject_id INT
paper_id INT
assessment_type_id INT
assessment_body_id INT
file_name VARCHAR(255)
file_hash VARCHAR(64)
parser_version VARCHAR(20)
total_items_found INT
total_marks_parser INT
total_marks_expected INT
total_marks_corrected INT
auto_corrected_count INT
manual_review_count INT
missing_count INT
status ENUM('comparing','auto_corrected','completed','imported')
error_message TEXT
completed_at TIMESTAMP NULL
created_at TIMESTAMP
```

---

## FRONTEND STATUS (WizardPage.tsx v6)

### Verified Working
- All 7 lookups populate correctly (subjects, papers, years, grades, assessment_types, assessment_bodies, exam_sessions)
- Paper code preview live: `{subjectAlpha}_P{paperNo}_{session}_{year}`
- Drag & drop with visual feedback
- API_BASE uses `/api` (relative)
- `normalizeLookup()` maps actual DB columns correctly

### Known Issues
- Wizard may show "No questions found" if backend parser returns empty — this is a **backend parser issue**, not frontend
- Review panel may not render if `comparison/:session_id` returns empty due to legacy route shadowing

---

## CRITICAL CHECKLIST FOR NEXT SESSION

### Before Any Parser Testing
1. **Check server.js for route conflicts**
   ```powershell
   Select-String -Path server.js -Pattern "wizard|compare-qp|memo-parser|memo-compare|import"
   ```
2. **If legacy routes are mounted, comment them out**
3. **Restart backend** (`node server.js`)
4. **Verify only pdfExtract.js and wizardImport.js handle `/api/wizard`**

### Before Any Database Work
1. **Verify columns with INFORMATION_SCHEMA** — never trust schema docs
   ```sql
   SELECT COLUMN_NAME, DATA_TYPE 
   FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = 'nsc_qbank' AND TABLE_NAME = 'parse_results';
   ```

### Before Any Git Commit
1. **Check git status** — ensure only intended files are staged
2. **Test end-to-end** with Geography P2 Nov 2024 PDFs
3. **Verify extraction** produces ~40 items with ~150 marks

---

## POWER SHELL COMMANDS FOR NEXT SESSION

### 1. Check Route Conflicts (FIRST PRIORITY)
```powershell
cd C:\dev\nsc-qbank
Write-Host "=== Route Files in routes/ ==="
Get-ChildItem routes/ -Name | Select-String "wizard|compare|memo|import|pdf"
Write-Host "=== server.js Route Registrations ==="
Select-String -Path server.js -Pattern "app\.use\(.*wizard|app\.use\(.*compare|app\.use\(.*memo|app\.use\(.*import|app\.use\(.*pdf"
```

### 2. Fix Route Conflicts (If Found)
```powershell
cd C:\dev\nsc-qbank
$server = Get-Content server.js -Raw
# Comment out legacy routes if they exist
$server = $server -replace "(app\.use\('/api/wizard',\s*require\('./routes/compare-qp'\)\);)", "// LEGACY DISABLED: `$1"
$server = $server -replace "(app\.use\('/api/wizard',\s*require\('./routes/memo-parser'\)\);)", "// LEGACY DISABLED: `$1"
$server = $server -replace "(app\.use\('/api/wizard',\s*require\('./routes/memo-compare'\)\);)", "// LEGACY DISABLED: `$1"
$server = $server -replace "(app\.use\('/api/wizard',\s*require\('./routes/import'\)\);)", "// LEGACY DISABLED: `$1"
$server | Set-Content server.js -Encoding UTF8
Write-Host "Legacy routes commented out. Restart backend."
```

### 3. Restart Backend
```powershell
cd C:\dev\nsc-qbank
# Stop any running node process
taskkill /F /IM node.exe 2>$null
Start-Sleep 2
node server.js
```

### 4. Test Parser Harness
```powershell
cd C:\dev\nsc-qbank
python scripts/extract_dbe_paper.py "C:\path\to\test.pdf"
```

### 5. Verify Database Columns
```powershell
cd C:\dev\nsc-qbank
$q = "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'nsc_qbank' AND TABLE_NAME = 'parse_results' ORDER BY ORDINAL_POSITION;"
$q | & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 -N
```

---

## KNOWN ISSUES & BLOCKERS

| # | Issue | Severity | Next Action |
|---|-------|----------|-------------|
| 1 | **Route conflicts** — legacy routes may shadow new routes | CRITICAL | Verify server.js, comment legacy |
| 2 | **Parser extraction empty** — no questions found in QP PDF | CRITICAL | Run sandbox harness, fix regex |
| 3 | **Migration 017** — applied manually, not via git | MEDIUM | Sync migration file with git |
| 4 | **Memo sub-parts** not parsed separately | LOW | Post-import enhancement |
| 5 | **CAPS linking** not automatic after import | LOW | Post-import enhancement |

---

## END OF HANDOVER NOTE v3

*All route conflicts must be resolved before parser testing.*
*Date: 2026-06-14 20:10 SAST*
