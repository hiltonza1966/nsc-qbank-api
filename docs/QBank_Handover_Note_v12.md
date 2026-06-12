# QBank Corporate System - AI Handover Note v12
**Date:** 2026-06-12 08:11
**Session:** CAPS Parser Development Paused at v2.7a, Document Synchronization
**Status:** PARSER PAUSED — Comparison engine SQL fixes applied but NOT verified, CAPS parser v2.7a deployed but returns empty grades, Frontend white screen issue unresolved
**Next Session:** Resume parser with real PDF diagnostic output, verify comparison engine fixes, fix frontend white screen
**Previous Session:** 2026-06-11 19:25 — Frontend white screen, Caps parser not seeding all values
**Parser Status:** v2.7a deployed in routes\capsPdfParser.js

---

## 1. SYSTEM CONTEXT (VERIFIED FACTS ONLY)

**Project:** QBank Corporate System (Question Bank for NSC/DBE)
**Location:** `C:\dev\nsc-qbank`
**Database:** `nsc_qbank` (MySQL 8.0.45) — NOT `spd` or `spd_system`
**Database Password:** Hilton@66 (verified in multiple sessions)
**Stack:** Node.js v24.14.0, Express backend (port 4000), React + Vite frontend (port 3000)
**Driver:** mysql2/promise 3.9.7
**PDF Processing:** pdf.js (for QP parser), pdf-parse (for CAPS parser)
**GitHub:** https://github.com/hiltonza1966/nsc-qbank-api.git
**Branch:** main
**Git HEAD:** 2a392c8 (as of 2026-06-09 15:59 session)
**Cross-database reference:** `nsc_registration_v3` contains `lookup_subjects` and `subject_structure`
**MySQL Executable:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
**MySQL Dump:** `C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe`

---

## 2. WHAT ACTUALLY WORKS (Verified with Evidence from Conversation History)

### ✅ Parser (pdf_parser_structured.js) — QP Parser
- **Status:** WORKING (as of 2026-06-09)
- **Evidence:** Extracts 29 items from Geography P1 Nov 2025 PDF (2190 text items → 456 lines → 29 atomic items)
- **Output:** question_number, question_text, section, type, marks (from batch totals)
- **File:** `routes/pdf_parser_structured.js`
- **Note:** This is the QUESTION PAPER parser, NOT the CAPS parser

### ✅ Subject Loading (Frontend)
- **Status:** WORKING (as of 2026-06-10)
- **Evidence:** Dropdown shows all 123 subjects from `lookup_subjects` table
- **Endpoint:** `GET /api/lookup/lookup_subjects` (dynamic route in server.js)
- **File:** `frontend/src/components/wizard/UploadWizard.tsx`
- **Fix Applied:** Changed from hardcoded subjects to API fetch

### ✅ Emojis (Frontend)
- **Status:** WORKING (as of 2026-06-10)
- **Evidence:** 📄, ✅, 📝, ⏳, 🔍, ❌ all display correctly in browser
- **File:** `frontend/src/components/wizard/UploadWizard.tsx`
- **Fix Applied:** Replaced garbled byte sequences with correct Unicode

### ✅ Database Schema (34 tables)
- **Status:** EXISTS (as of 2026-06-09)
- **Evidence:** All 34 tables created via Migration 014
- **Migration:** `database/migrations/014_complete_qbank_schema.sql`
- **Note:** 15 lookup tables seeded, 123 subjects synced

### ✅ CAPS Parser Deployment (v2.7a)
- **Status:** DEPLOYED but BROKEN (returns empty grades)
- **Evidence:** File exists at `routes\capsPdfParser.js`
- **Fix Applied:** `const` → `let` bug fixed in v2.7a
- **File:** `routes/capsPdfParser.js` (v2.7a)

---

## 3. WHAT IS BROKEN (Verified with Evidence from Conversation History)

### ❌ CRITICAL: CAPS Parser Returns Empty Grades
**File:** `routes/capsPdfParser.js` (v2.7a)
**Symptom:** Parser executes but `grades` array is empty
**Root Cause:** Parser searches for `Annual Teaching Plan Grade X` in Section 3, but actual PDF headers may differ
**Key Discovery (2026-06-12):** Actual per-term assessment data lives in **Section 3 (Teaching Plans)**, NOT Section 4 (Summary Table)
**Evidence:**
```
Section 3 (Teaching Plans) - WHERE ACTUAL DATA LIVES
├── Annual Teaching Plan Grade 10
│   ├── term 1: Formal assessment
│   │   ├── Form of assessmentAssignmentTest
│   │   └── Total marks50100
```
**Fix Needed:** Adjust `_parseGradeFromTeachingPlans()` to match actual header patterns in real PDF
**Status:** PAUSED — needs real PDF diagnostic output
**Next Step:** Run `node debug-pdf.js "C:\path\to\Business Studies CAPS.pdf"` and paste first 100 lines of `temp\debug-raw.txt`

### ❌ CRITICAL: Frontend White Screen
**File:** `frontend/src/App.tsx`
**Symptom:** White screen, nothing showing at `http://localhost:3000/`
**Evidence:** `curl.exe http://localhost:3000/` returns 404
**Root Cause:** Unknown — App.tsx may have routing issues or missing component imports
**Session:** 2026-06-11 19:25 — User reported white screen, build succeeded but page blank
**Status:** UNRESOLVED
**Fix Attempted:** Checked `App.tsx` content, build succeeded, but white screen persisted

### ❌ CRITICAL: Comparison Engine SQL Error — FIX APPLIED BUT NOT VERIFIED
**File:** `routes/compare-qp.js`
**Error:** `Column count doesn't match value count at row 1`
**Root Cause:** INSERT statement had 11 columns but 13 values. Extra values: `paper_id`, `paper_code` inserted as values but they were NOT columns in `parse_results`. Also `parsed_type` (string "MCQ") passed to `parsed_type_id` (INT column).
**Fix Applied (2026-06-10):**
- Corrected INSERT to 12 columns, 12 values
- Added type mapping (MCQ→1, Short→2, etc.)
- Added `paper_code` column to both `parse_expected_structure` and `parse_results`
**Status:** NEEDS DEPLOYMENT + TESTING — NOT VERIFIED

### ❌ CRITICAL: Missing paper_code Column in Database — FIX CREATED BUT NOT VERIFIED
**Tables Affected:** `parse_expected_structure`, `parse_results`
**Fix Applied:** `database/migrations/015_fix_paper_code.sql` adds `paper_code VARCHAR(50)` to both tables
**Status:** NEEDS DEPLOYMENT + TESTING — NOT VERIFIED

### ❌ CRITICAL: ReviewPanel Shows 0 Items — NOT VERIFIED AS FIXED
**File:** `frontend/src/components/wizard/ReviewPanel.tsx`
**Symptom:** "All Items (0)", "Red Flags (0)", "Auto-Corrected (0)"
**Root Cause:** (1) Comparison engine crashes with SQL error so no results saved, (2) 409 "Paper already parsed" error blocks re-parsing
**Fix Applied (2026-06-10):** `UploadWizard.tsx` updated with `force_overwrite: true` to bypass 409 error
**Status:** NEEDS TESTING — NOT VERIFIED

### ❌ CRITICAL: Extract-Structure Endpoint Fails — NOT VERIFIED AS FIXED
**Endpoint:** `POST /api/wizard/extract-structure`
**Error:** `Unknown column 'paper_code' in 'on clause'`
**Fix Applied:** Migration 015 to add `paper_code` column
**Status:** NEEDS DEPLOYMENT + TESTING — NOT VERIFIED

### ❌ CAPS Wizard Not Working Correctly
**File:** `frontend/src/components/wizard/CapsWizard.tsx` (or similar)
**Symptom:** Not showing all subjects, comparison failed, emojis not working
**Session:** 2026-06-10 18:12 — User reported wizard issues
**Status:** PARTIALLY FIXED — subjects and emojis fixed, but CAPS parser data incomplete

### ❌ Memo Comparison — NOT TESTED
**File:** `routes/memo-compare.js`
**Status:** NOT TESTED in any session
**Note:** Schema exists but no verification that endpoint works

---

## 4. FILES CHANGED (With Session Dates)

| File | Change | Session | Status |
|------|--------|---------|--------|
| `frontend/src/components/wizard/UploadWizard.tsx` | Fetch subjects from API, fix emojis, add force_overwrite | 2026-06-10 | ✅ Ready but NOT verified |
| `frontend/src/components/wizard/ReviewPanel.tsx` | Fix all garbled emojis | 2026-06-10 | ✅ Ready but NOT verified |
| `routes/compare-qp.js` | Fix INSERT column/value count, add type mapping, add paper_code | 2026-06-10 | ✅ Ready but NOT verified |
| `database/migrations/015_fix_paper_code.sql` | Add paper_code to parse_expected_structure and parse_results | 2026-06-10 | ✅ Ready but NOT verified |
| `routes/capsPdfParser.js` | v2.7a deployed, const→let fix | 2026-06-11/12 | ✅ Deployed but BROKEN (empty grades) |
| `debug-pdf.js` | Diagnostic script created | 2026-06-12 | ✅ Created |
| `show-sections.js` | Section viewer created | 2026-06-12 | ✅ Created |
| `frontend/src/App.tsx` | Checked for white screen cause | 2026-06-11 | ❌ White screen unresolved |

---

## 5. DEPLOYMENT CHECKLIST (NOT COMPLETED — DO THIS FIRST)

### Step 1: Run SQL Migration (015_fix_paper_code.sql)
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 nsc_qbank < database/migrations/015_fix_paper_code.sql
```
**Status:** NOT EXECUTED — User was instructed to run this but no confirmation received

### Step 2: Copy Fixed Files
```powershell
Copy-Item "C:\Users\visagie.h\Downloads\UploadWizard.tsx" "C:\dev\nsc-qbank\frontend\src\components\wizard\UploadWizard.tsx" -Force
Copy-Item "C:\Users\visagie.h\Downloads\ReviewPanel.tsx" "C:\dev\nsc-qbank\frontend\src\components\wizard\ReviewPanel.tsx" -Force
Copy-Item "C:\Users\visagie.h\Downloads\compare-qp.js" "C:\dev\nsc-qbank\routes\compare-qp.js" -Force
```
**Status:** NOT CONFIRMED — User may have copied files but no verification

### Step 3: Rebuild Frontend
```powershell
cd C:\dev\nsc-qbank\frontend
npm run build
```
**Status:** NOT CONFIRMED

### Step 4: Restart Backend
```powershell
cd C:\dev\nsc-qbank
node server.js
```
**Status:** NOT CONFIRMED

### Step 5: Test End-to-End
1. Open `http://localhost:3000/`
2. Select any subject (should show 123 subjects)
3. Upload Geography P1 Nov 2025 PDF
4. Click "Parse & Validate"
5. **Expected:** ReviewPanel shows 29 items, not 0
**Status:** NOT TESTED

---

## 6. CRITICAL NOTES FOR NEXT AI SESSION

### DO NOT BELIEVE PREVIOUS HANDOVER NOTES
Previous notes (v9, v10, v11) claimed "Phase 2 complete, all endpoints active." This is FALSE. The comparison engine was broken the entire time. Fixes were applied but NEVER VERIFIED. Always verify by testing the actual upload flow.

### Schema vs Code Drift
The database schema (014) and the backend routes are NOT in sync. The schema document says `paper_code` was added, but the actual SQL may not have been executed. Always verify schema with:
```sql
DESCRIBE parse_expected_structure;
DESCRIBE parse_results;
```

### Parser Works, Comparison Doesn't (Still True)
- QP Parser: ✅ Extracts items correctly (verified 2026-06-09)
- Comparison: ❌ SQL errors prevent saving results (fix applied 2026-06-10, NOT VERIFIED)
- ReviewPanel: ❌ Shows 0 items because comparison fails (fix applied 2026-06-10, NOT VERIFIED)

### CAPS Parser Completely Broken
- v2.7a deployed but returns empty grades
- Real data is in Section 3 (Teaching Plans), not Section 4
- Need actual PDF diagnostic output to fix header patterns

### Frontend White Screen
- Build succeeds but page is blank
- May be React Router issue, missing route, or component error
- Check browser console for React errors
- Check `App.tsx` for correct component imports

### Test with Real PDFs
Do not claim "working" until you upload a PDF and see items in the ReviewPanel. The only valid test is:
1. Upload PDF → 2. Click Parse → 3. ReviewPanel shows >0 items

### NO HARDCODING (Still Enforced)
- All subjects from `lookup_subjects` via API
- All QP structure from `parse_expected_structure`
- All paper types from `lookup_papers`
- All assessment types from `lookup_assessment_types`
- Time windows, province codes, exam sessions — ALL from database tables

### PowerShell File Writing Rule
When writing TypeScript files via PowerShell, use:
```powershell
$lines = @('line1', 'line2')
$lines | Set-Content -Path "file.ts" -Encoding UTF8
```
- Single quotes prevent PowerShell from interpreting special characters
- All TypeScript strings inside must use double quotes
- NEVER use heredoc (@"..."@) or backticks for TypeScript files in PowerShell

### Git Status
- Last confirmed commit: 2a392c8 (2026-06-09 15:59)
- Commit 765d0d0 pushed to origin/main (2026-06-10 21:31)
- Commit 7d4707d — Update wizard and parser
- Commit 8785941 — Fix GENERATED columns, use req.db pool
- Commit 61fba5a — QBank QP Comparison Engine v1.0

---

## 7. WHAT STILL NEEDS FIXING (Priority Order)

| Priority | Issue | File | Notes |
|----------|-------|------|-------|
| 1 | Fix CAPS parser empty grades | `routes/capsPdfParser.js` | Needs real PDF diagnostic output |
| 2 | Fix frontend white screen | `frontend/src/App.tsx` | Build succeeds but blank page |
| 3 | Verify comparison engine SQL fix | `routes/compare-qp.js` | Fix applied but NOT tested |
| 4 | Verify paper_code migration | `015_fix_paper_code.sql` | Migration created but NOT executed |
| 5 | Verify ReviewPanel displays items | `ReviewPanel.tsx` | Depends on comparison working |
| 6 | Test save-corrections endpoint | `compare-qp.js` | Not tested in any session |
| 7 | Test with LIFE_SC P1 Nov 2025 | `UploadWizard.tsx` | Only Geography tested so far |
| 8 | Fix memo comparison | `memo-compare.js` | Not tested in any session |
| 9 | Remove old session records | `parse_sessions` | 409 error from old sessions |
| 10 | Complete CAPS data seeding | `lookup_caps_topics`, `lookup_caps_subtopics` | Only Life Sciences partially done |

---

## 8. QUICK REFERENCE: CRITICAL COMMANDS

### Check Schema
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 nsc_qbank -e "DESCRIBE parse_expected_structure; DESCRIBE parse_results;"
```

### Check Backend Errors
```powershell
cd C:\dev\nsc-qbank
node server.js
# Watch console while clicking "Parse & Validate"
```

### Check Browser Console
```
F12 → Console → Look for "PDF text extracted: N items"
F12 → Network → Click compare-qp → Response tab
```

### Clear Old Sessions (if 409 error persists)
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 nsc_qbank -e "DELETE FROM parse_sessions WHERE paper_code LIKE 'GEOGRAPHY%'; DELETE FROM parse_results WHERE session_id IN (SELECT session_id FROM parse_sessions WHERE paper_code LIKE 'GEOGRAPHY%');"
```

### Run CAPS Parser Diagnostic
```powershell
cd C:\dev\nsc-qbank
node debug-pdf.js "C:\path\to\Business Studies CAPS.pdf"
Get-Content "temp\debug-raw.txt" | Select-Object -First 100
```

### Backup Database (ALWAYS DO FIRST)
```powershell
& "C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe" -u root -pHilton@66 nsc_qbank > "C:\dev\nsc-qbank\backups\nsc_qbank_backup_$(Get-Date -Format 'yyyy-MM-dd_HHmm').sql"
```

---

## 9. CONTACT / CONTEXT

- **Previous sessions:** Multiple sessions claiming "Phase 2 complete" but comparison engine was broken
- **2026-06-08 session:** System was working before parser file was overwritten by broken version. Need to restore from git. File not tracked at commit 7d4707d.
- **2026-06-09 session:** Discovered SQL column mismatch, missing paper_code, 409 errors, garbled emojis
- **2026-06-10 session:** Applied fixes for comparison engine, subjects, emojis, force_overwrite
- **2026-06-11 session:** NSC code migration, CAPS parser development, frontend white screen
- **2026-06-12 session:** Parser paused at v2.7a, discovered Section 3 vs Section 4 issue
- **User requirement:** Corporate pdf.js system, no assumptions, database-driven config, no hardcoding
- **Key lesson:** ALWAYS test end-to-end before claiming success. Parser working ≠ system working.
- **Next priority:** Fix CAPS parser with real PDF diagnostics, fix frontend white screen, verify comparison engine

---

*End of AI Handover Note v12 — Factual Edition*
*Status: Parser v2.7a deployed but broken (empty grades), Comparison engine fix applied but NOT verified, Frontend white screen unresolved*
*Date: 2026-06-12 08:11*
