# QBank Corporate System - AI Handover Note v11
**Date:** 2026-06-10 16:10
**Session:** Fix comparison engine, schema alignment, frontend subjects/emojis
**Status:** PARTIALLY WORKING - Parser works, comparison engine has SQL errors, ReviewPanel shows 0 items
**Next Session:** Fix comparison engine to return results, fix ReviewPanel data loading, test end-to-end

---

## 1. SYSTEM CONTEXT

**Project:** QBank Corporate System (Question Bank for NSC/DBE)  
**Location:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL 8.0.45)  
**Stack:** Node.js backend (port 4000), React frontend (port 3000), pdf.js for PDF parsing  
**GitHub:** https://github.com/hiltonza1966/nsc-qbank-api.git  
**Branch:** main  
**Git HEAD:** 5f91139 (Remove temporary fix scripts)  

---

## 2. WHAT ACTUALLY WORKS (Verified with Evidence)

### ✅ Parser (pdf_parser_structured.js)
- **Status:** WORKING
- **Evidence:** Extracts 29 items from Geography P1 Nov 2025 PDF (2190 text items → 456 lines → 29 atomic items)
- **Output:** question_number, question_text, section, type, marks (from batch totals)
- **File:** `routes/pdf_parser_structured.js`

### ✅ Subject Loading (Frontend)
- **Status:** WORKING
- **Evidence:** Dropdown shows all 123 subjects from `lookup_subjects` table
- **Endpoint:** `GET /api/lookup/lookup_subjects` (dynamic route in server.js line 73)
- **File:** `frontend/src/components/wizard/UploadWizard.tsx`

### ✅ Emojis (Frontend)
- **Status:** WORKING
- **Evidence:** 📄, ✅, 📝, ⏳, 🔍, ❌ all display correctly in browser
- **File:** `frontend/src/components/wizard/UploadWizard.tsx`

### ✅ Database Schema (34 tables)
- **Status:** EXISTS
- **Evidence:** All 34 tables created, 15 lookup tables seeded, 123 subjects synced
- **Migration:** `database/migrations/014_complete_qbank_schema.sql`

---

## 3. WHAT IS BROKEN (Verified with Evidence)

### ❌ CRITICAL: Comparison Engine SQL Error
**File:** `routes/compare-qp.js`  
**Error:** `Column count doesn't match value count at row 1`  
**Root Cause:** INSERT statement has 11 columns but 13 values. Extra values: `paper_id`, `paper_code` inserted as values but they are NOT columns in `parse_results`. Also `parsed_type` (string "MCQ") passed to `parsed_type_id` (INT column).  
**Evidence:**
```sql
INSERT INTO parse_results 
  (session_id, question_number, question_text, parsed_type_id, parsed_section, 
   parser_extracted_marks, expected_marks, auto_corrected_marks, correction_status, 
   user_corrected_marks, reviewer_notes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)  -- 11 columns, 13 values!
```
**Impact:** Comparison engine crashes, no results saved to database, ReviewPanel shows 0 items  
**Fix Applied:** `compare-qp.js` updated with correct INSERT (12 columns, 12 values), type mapping (MCQ→1, Short→2, etc.), paper_code added as proper column  
**Status:** NEEDS TESTING

### ❌ CRITICAL: Missing paper_code Column in Database
**Tables Affected:** `parse_expected_structure`, `parse_results`  
**Error:** `Unknown column 'paper_code' in 'on clause'` (extract-structure endpoint)  
**Root Cause:** Migration 014 does NOT include `paper_code` column in `parse_expected_structure` or `parse_results`. Routes reference it but it doesn't exist.  
**Evidence:** `parse_expected_structure` schema has no `paper_code` column. `parse_results` schema has no `paper_code` column.  
**Fix Applied:** `database/migrations/015_fix_paper_code.sql` adds `paper_code VARCHAR(50)` to both tables  
**Status:** NEEDS DEPLOYMENT + TESTING

### ❌ CRITICAL: ReviewPanel Shows 0 Items
**File:** `frontend/src/components/wizard/ReviewPanel.tsx`  
**Symptom:** "All Items (0)", "Red Flags (0)", "Auto-Corrected (0)"  
**Root Cause:** Two issues: (1) Comparison engine crashes with SQL error so no results saved, (2) 409 "Paper already parsed" error blocks re-parsing  
**Fix Applied:** `UploadWizard.tsx` updated with `force_overwrite: true` to bypass 409 error  
**Status:** NEEDS TESTING

### ❌ ReviewPanel Emojis Garbled
**File:** `frontend/src/components/wizard/ReviewPanel.tsx`  
**Symptom:** `ðŸ"‹`, `ðŸ"´`, `âœ"` instead of 📋, 🔴, ✓  
**Root Cause:** File saved with wrong encoding at some point  
**Fix Applied:** All garbled byte sequences replaced with correct Unicode  
**Status:** NEEDS DEPLOYMENT + TESTING

### ❌ Extract-Structure Endpoint Fails
**Endpoint:** `POST /api/wizard/extract-structure`  
**Error:** `Unknown column 'paper_code' in 'on clause'`  
**Root Cause:** Route tries to `DELETE FROM parse_expected_structure WHERE paper_code = ?` but column doesn't exist  
**Fix Applied:** Run `015_fix_paper_code.sql` to add column  
**Status:** NEEDS DEPLOYMENT + TESTING

---

## 4. FILES CHANGED IN THIS SESSION

| File | Change | Status |
|------|--------|--------|
| `frontend/src/components/wizard/UploadWizard.tsx` | Fetch subjects from API, fix emojis, add force_overwrite, add 0-items diagnostic | ✅ Ready |
| `frontend/src/components/wizard/ReviewPanel.tsx` | Fix all garbled emojis | ✅ Ready |
| `routes/compare-qp.js` | Fix INSERT column/value count, add type mapping, add paper_code | ✅ Ready |
| `database/migrations/015_fix_paper_code.sql` | Add paper_code to parse_expected_structure and parse_results | ✅ Ready |
| `routes/lookup.js` | NOT NEEDED - server.js already has dynamic lookup route | ❌ Deleted |

---

## 5. DEPLOYMENT CHECKLIST (Do This First)

### Step 1: Run SQL Migration
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 nsc_qbank < database/migrations/015_fix_paper_code.sql
```

### Step 2: Copy Fixed Files
```powershell
Copy-Item "C:\Users\visagie.h\Downloads\UploadWizard.tsx" "C:\dev\nsc-qbank\frontend\src\components\wizard\UploadWizard.tsx" -Force
Copy-Item "C:\Users\visagie.h\Downloads\ReviewPanel.tsx" "C:\dev\nsc-qbank\frontend\src\components\wizard\ReviewPanel.tsx" -Force
Copy-Item "C:\Users\visagie.h\Downloads\compare-qp.js" "C:\dev\nsc-qbank\routes\compare-qp.js" -Force
```

### Step 3: Rebuild Frontend
```powershell
cd C:\dev\nsc-qbank\frontend
npm run build
```

### Step 4: Restart Backend
```powershell
cd C:\dev\nsc-qbank
node server.js
```

### Step 5: Test End-to-End
1. Open `http://localhost:3000/`
2. Select any subject (should show 123 subjects)
3. Upload Geography P1 Nov 2025 PDF
4. Click "Parse & Validate"
5. **Expected:** ReviewPanel shows 29 items, not 0
6. **If still 0:** Check backend console for SQL errors

---

## 6. CRITICAL NOTES FOR NEXT AI SESSION

### DO NOT BELIEVE PREVIOUS HANDOVER NOTES
Previous notes (v9, v10) claimed "Phase 2 complete, all endpoints active." This is FALSE. The comparison engine was broken the entire time. Always verify by testing the actual upload flow.

### Schema vs Code Drift
The database schema (014) and the backend routes are NOT in sync. The schema document says `paper_code` was added, but the actual SQL does not create it. Always verify schema with:
```sql
DESCRIBE parse_expected_structure;
DESCRIBE parse_results;
```

### Parser Works, Comparison Doesn't
- Parser: ✅ Extracts items correctly
- Comparison: ❌ SQL errors prevent saving results
- ReviewPanel: ❌ Shows 0 items because comparison fails

### Test with Real PDFs
Do not claim "working" until you upload a PDF and see items in the ReviewPanel. The only valid test is:
1. Upload PDF → 2. Click Parse → 3. ReviewPanel shows >0 items

### NO HARDCODING (Still Enforced)
- All subjects from `lookup_subjects` via API
- All QP structure from `parse_expected_structure`
- All paper types from `lookup_papers`
- All assessment types from `lookup_assessment_types`

---

## 7. WHAT STILL NEEDS FIXING

| Priority | Issue | File | Notes |
|----------|-------|------|-------|
| 1 | Test comparison engine after SQL fix | compare-qp.js | May still have edge cases |
| 2 | Test ReviewPanel displays items | ReviewPanel.tsx | Depends on comparison working |
| 3 | Test save-corrections endpoint | compare-qp.js | Not tested in this session |
| 4 | Add paper_code to parse_sessions | parse_sessions | Schema has it but not used consistently |
| 5 | Test with LIFE_SC P1 Nov 2025 | UploadWizard.tsx | Only Geography tested so far |
| 6 | Fix memo comparison | memo-compare.js | Not tested in this session |
| 7 | Remove old session records | parse_sessions | 409 error from old sessions |

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

---

## 9. CONTACT / CONTEXT

- **Previous sessions:** Multiple sessions claiming "Phase 2 complete" but comparison engine was broken
- **This session:** Discovered SQL column mismatch, missing paper_code, 409 errors, garbled emojis
- **User requirement:** Corporate pdf.js system, no assumptions, database-driven config, no hardcoding
- **Key lesson:** ALWAYS test end-to-end before claiming success. Parser working ≠ system working.
- **Next priority:** Deploy fixes, test comparison engine, verify ReviewPanel shows items

---

*End of AI Handover Note v11 — Brutally Honest Edition*
*Status: Parser works, comparison engine has SQL errors, ReviewPanel shows 0 items*
*Date: 2026-06-10 16:10*
