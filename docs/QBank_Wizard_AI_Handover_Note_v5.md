# QBank Wizard - AI Handover Note v5
**Version:** v5.0  
**Date:** 15 June 2026 16:20 SAST  
**System:** NSC QBank Corporate System  
**Repository:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (`node server.js` from repo root)  
**Frontend Port:** 3000 (`npm run dev` from `frontend/`)  
**Git Branch:** main  
**Last Commit:** `8ebd78e` — Wizard pipeline end-to-end working  

---

## MAJOR ACHIEVEMENT: IMPORT TO DATABASE WORKING (2026-06-15)

### Status: FULLY FUNCTIONAL END-TO-END

```
Step 1: QP Upload        ✅ 200 — 76 items extracted
Step 2: Memo Upload      ✅ 200 — 104 items extracted, 91 linked
Step 3: Review Table     ✅ 200 — All items render with status badges
Step 4: Save Corrections ✅ 200 — Corrections saved to parse_results
Step 5: Import to DB     ✅ 200 — 91 items + 91 memos imported
```

### Database Verification
| Metric | Value |
|--------|-------|
| item_master records | 95 |
| item_memos records | 91 |
| Total marks | 177 |
| Total allocated | 177 |

---

## FIXES APPLIED TODAY (2026-06-15)

### Import Route Column Fixes (wizardImport.js)
| # | Error | Fix | Status |
|---|-------|-----|--------|
| 1 | `marks` not in parse_results | Changed SELECT to `auto_corrected_marks` | ✅ |
| 2 | `is_memo = 1` column missing | Removed `AND is_memo = 1` from WHERE | ✅ |
| 3 | `auto_corrected_marks` in item_master INSERT | Changed to `marks` | ✅ |
| 4 | `difficulty_level_id` wrong name | Changed to `difficulty_id` | ✅ |
| 5 | `marks_allocated` missing | Added column + `finalMarks` value | ✅ |
| 6 | Column count mismatch | Added `?` placeholder before `'draft'` | ✅ |
| 7 | `memo.marks` undefined | Changed to `memo.auto_corrected_marks` | ✅ |

**Commit:** `8ebd78e` — "fix: Wizard pipeline end-to-end working"

---

## PARSER ISSUES (Next Priority)

| Metric | Actual | Expected | Issue |
|--------|--------|----------|-------|
| QP Items | 76 | ~40 | Parent headers included |
| Memo Items | 104 | ~40 | Parent headers + overlapping blocks |
| Total Marks | 177 | 150 | Parser sums too many mark notations |

**Fix needed in:** `scripts/extract_dbe_paper.py`
- Skip 2-part numbers (`1.1`, `3.2`) — these are parent headers
- Only extract 3-part numbers (`1.1.1`, `3.2.4`) as actual items
- Tighten text block boundaries

---

## CRITICAL RULES

1. Verify with INFORMATION_SCHEMA before writing SQL
2. Surgical fixes only
3. Use `.Contains()` in PowerShell, not `-match` with special chars
4. Restart backend after every fix
5. Parser marks are wrong but import uses expected_marks

---

## VERIFIED API ENDPOINTS (2026-06-15)

| Method | Endpoint | Status |
|--------|----------|--------|
| POST | `/api/wizard/extract-qp` | ✅ 200 |
| POST | `/api/wizard/extract-memo` | ✅ 200 |
| GET | `/api/wizard/extraction-status/:session_id` | ✅ 200 |
| GET | `/api/wizard/comparison/:session_id` | ✅ 200 |
| POST | `/api/wizard/save-corrections` | ✅ 200 |
| POST | `/api/wizard/import` | ✅ 200 |

---

## END OF HANDOVER NOTE v5

*Import fully working. Parser refinement is next priority.*
*Date: 2026-06-15 16:20 SAST*