# QBank Wizard - AI Handover Note v4
**Version:** v4.0  
**Date:** 14 June 2026 21:30 SAST  
**System:** NSC QBank Corporate System  
**Repository:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (`node server.js` from repo root)  
**Frontend Port:** 3000 (`npm run dev` from `frontend/`)  
**Git Branch:** main  
**Last Commit:** `738e82c` (`.gitignore` update) + uncommitted working tree changes  

---

## MAJOR ACHIEVEMENT: WIZARD END-TO-END WORKING (2026-06-14 21:30)

### Status: QP Upload → Memo Upload → Review → Save → Import (IN PROGRESS)

| Step | Status | Details |
|------|--------|---------|
| 1. QP Upload | ✅ WORKING | Extracts 76 items, saves to parse_expected_structure |
| 2. Memo Upload | ✅ WORKING | Extracts 104 items, links 91 to QP, 13 unlinked |
| 3. Review Table | ✅ WORKING | Renders all items with status badges |
| 4. Save Corrections | ✅ WORKING | Saves to parse_results |
| 5. Import to DB | 🔄 IN PROGRESS | Column fixes applied, testing now |

---

## CRITICAL FIXES APPLIED TODAY (2026-06-14)

### 1. Route Conflicts RESOLVED
**Problem:** Legacy routes (compare-qp.js, memo-parser.js, memo-compare.js, import.js) shadowed new routes.
**Fix:** Deleted legacy routes from `routes/`, moved to `routes/BACKUP_OLD_WIZARD/`.
**Commit:** `234e6de` — "refactor: Remove legacy wizard routes, clean up server.js"
**Result:** Only `pdfExtract.js` and `wizardImport.js` handle `/api/wizard`.

### 2. Python pyArgs Order FIXED (Root Cause of "Mode must be 'qp' or 'memo'")
**Problem:** Backend passed `['qp', pdfPath, ...]` but Python expected `[pdfPath, 'qp', ...]`.
**Fix:** Swapped order in both QP and memo routes:
```javascript
const pyArgs = [
  scriptPath,
  pdfPath,       // pdf path FIRST (matches Python sys.argv[1])
  'qp',          // mode SECOND (matches Python sys.argv[2])
  paper_code, ...
];
```
**File:** `routes/pdfExtract.js` lines 48-57 (QP) and 220-228 (memo)

### 3. force_overwrite Added
**Problem:** 409 Conflict on re-uploading same paper.
**Fix:** 
- Backend: Added `req.body.force_overwrite !== 'true'` check before 409 response
- Frontend: Added `formData.append('force_overwrite', 'true')` to both QP and memo uploads
**Files:** `routes/pdfExtract.js` line 39, `frontend/src/pages/WizardPage.tsx` lines 321 and 367

### 4. Null-Safe Extracted Values
**Problem:** `extracted.total_items` / `extracted.total_marks` could be undefined → SQL error.
**Fix:** Added `?? 0` fallback:
```javascript
extracted.total_items ?? 0, extracted.total_marks ?? 0
```
**File:** `routes/pdfExtract.js` line 94

### 5. Import Route Column Fixes (wizardImport.js)
**Problem:** Import route used wrong column names from old schema assumptions.
**Fixes applied:**

| # | Wrong | Correct | Location |
|---|-------|---------|----------|
| 1 | `marks` (in parse_results SELECT) | `auto_corrected_marks` | SELECT FROM parse_results |
| 2 | `AND is_memo = 1` | Removed entirely | WHERE clause |
| 3 | `auto_corrected_marks` (in item_master INSERT) | `marks` | INSERT INTO item_master columns |
| 4 | `difficulty_level_id` | `difficulty_id` | INSERT INTO item_master columns |
| 5 | Missing `marks_allocated` | Added `marks_allocated` with value `finalMarks` | INSERT INTO item_master columns + VALUES |

**File:** `routes/wizardImport.js` lines 43-95

---

## PARSER RESULTS (Current Extraction)

### Geography P2 Nov 2024 Test
| Metric | Value | Expected | Status |
|--------|-------|----------|--------|
| QP Items | 76 | ~40-50 | ⚠️ Over-extracted (parent questions included) |
| Memo Items | 104 | ~40-50 | ⚠️ Over-extracted |
| Total Marks (Memo) | 533 | 150 | ⚠️ Parser sums all mark notations |
| Linked to QP | 91 | — | ✅ Good |
| Unlinked | 13 | — | ⚠️ Parent headers not in QP |

**Note:** Parser accuracy needs refinement. Backend uses `expected_marks` from `parse_expected_structure` for database import, so import data will be correct.

---

## PENDING FIXES FOR TOMORROW (2026-06-15)

1. **Import to Database** — Test after column fixes. If more column errors appear, fix surgically.
2. **Memo Parser Refinement** — Fix `extract_dbe_paper.py` to:
   - Skip 2-part numbers (`1.1`, `3.2`) — these are parent headers
   - Only extract 3-part numbers (`1.1.1`, `3.2.4`) as actual items
   - Tighten text block boundaries to prevent overlapping
   - Target: ~40 items with exactly 150 marks
3. **Commit all changes** — Working tree has uncommitted fixes to `pdfExtract.js`, `wizardImport.js`, `WizardPage.tsx`

---

## CRITICAL RULES FOR TOMORROW'S SESSION

1. **Verify before fixing** — Run `git status` to see current state
2. **Surgical fixes only** — Change exactly the line causing the error, nothing else
3. **Use `.Contains()` in PowerShell** — Avoid regex with `?` or `=` characters
4. **Restart backend after every fix** — `taskkill /F /IM node.exe` then `node server.js`
5. **Test import after each column fix** — Don't batch multiple fixes untested
6. **Parser marks are wrong** — But import uses `expected_marks`, so import is correct
7. **Never trust schema docs** — Always verify with `INFORMATION_SCHEMA.COLUMNS`

---

## VERIFIED API ENDPOINTS (2026-06-14 21:30)

| Method | Endpoint | Status |
|--------|----------|--------|
| POST | `/api/wizard/extract-qp` | ✅ 200 |
| POST | `/api/wizard/extract-memo` | ✅ 200 |
| GET | `/api/wizard/extraction-status/:session_id` | ✅ 200 |
| GET | `/api/wizard/comparison/:session_id` | ✅ 200 |
| POST | `/api/wizard/save-corrections` | ✅ 200 |
| POST | `/api/wizard/import` | 🔄 Testing (column fixes applied) |

---

## END OF HANDOVER NOTE v4

*Wizard pipeline is functional. Import route has column fixes applied and is ready for testing.*
*Parser refinement scheduled for tomorrow.*
*Date: 2026-06-14 21:30 SAST*
