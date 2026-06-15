# QBank Discovery File v11.0 — Import Working
**Generated:** 15 June 2026 16:20 SAST
**Updated By:** AI K2.6 Session — Import to Database Verified
**Status:** WIZARD FULLY FUNCTIONAL (QP → Memo → Review → Save → Import)
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** 8ebd78e
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

---

## 1. MAJOR ACHIEVEMENT (2026-06-15)

### Wizard Pipeline: FULLY FUNCTIONAL

```
Step 1: QP Upload        ✅ 200 — 76 items extracted
Step 2: Memo Upload      ✅ 200 — 104 items extracted, 91 linked
Step 3: Review Table     ✅ 200 — All items render with status badges
Step 4: Save Corrections ✅ 200 — Corrections saved to parse_results
Step 5: Import to DB     ✅ 200 — 91 items + 91 memos imported
```

### Database Verification
| Table | Count | Notes |
|-------|-------|-------|
| item_master | 95 | 91 imported + 4 existing |
| item_memos | 91 | All linked to imported items |
| Total marks | 177 | Expected 150 (parser over-extracts) |
| Total allocated | 177 | Matches marks |

---

## 2. FIXES APPLIED (2026-06-15)

### Import Route Column Fixes (wizardImport.js)
| # | Error | Fix |
|---|-------|-----|
| 1 | `marks` not in parse_results | SELECT uses `auto_corrected_marks` |
| 2 | `is_memo = 1` missing | Removed from WHERE |
| 3 | `auto_corrected_marks` in item_master | Changed to `marks` |
| 4 | `difficulty_level_id` wrong | Changed to `difficulty_id` |
| 5 | `marks_allocated` missing | Added column + value |
| 6 | Column count mismatch | Added `?` before `'draft'` |
| 7 | `memo.marks` undefined | Changed to `memo.auto_corrected_marks` |

**Commit:** 8ebd78e

---

## 3. PARSER ISSUES (Next Priority)

| Metric | Actual | Expected | Issue |
|--------|--------|----------|-------|
| QP Items | 76 | ~40 | Parent headers included |
| Memo Items | 104 | ~40 | Parent headers + overlapping blocks |
| Total Marks | 177 | 150 | Parser sums too many mark notations |

**Fix needed:** `scripts/extract_dbe_paper.py`
- Skip 2-part numbers (`1.1`, `3.2`) — parent headers
- Only extract 3-part numbers (`1.1.1`, `3.2.4`) as actual items
- Tighten text block boundaries

---

## 4. CRITICAL RULES

1. Verify with INFORMATION_SCHEMA before writing SQL
2. Surgical fixes only
3. Use .Contains() in PowerShell
4. Restart backend after every fix
5. Parser marks are wrong but import uses expected_marks

---

*End of Discovery File v11.0*
*Date: 2026-06-15 16:20*