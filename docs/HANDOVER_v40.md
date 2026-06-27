# QBank Batch Parser Auto-Promote Fix — AI Handover Note v40
**Date:** 2026-06-27
**Status:** COMPLETE — Auto-promote to item_master is working

---

## 1. WHAT WAS FIXED

### 1.1 Duplicate Files Cleaned Up
- Removed `backend/parsers/batch_parser.js` (duplicate, not used by routes)
- Removed old `qp_memo_register` backup files
- Only `routes/v2/batch_parser.js` is now the single source of truth

### 1.2 autoPromoteSession Function Fixed
- **Column count mismatch:** Fixed 61 columns = 61 placeholders = 61 values
- **Foreign key constraints resolved:**
  - `parser_subject_code` lookup added to `lookup_subjects` query
  - `year_id` lookup added from `lookup_years` (maps year_value to year_id)
  - `grade_id` set to 3 (Grade 12) for all parser papers
- **All NOT NULL fields populated** with valid lookup IDs

### 1.3 Results
- 78 QP+Memo pairs parsed successfully
- 2,436 items auto-promoted to `item_master`
- 48 distinct papers
- 1,164 sub-parts (is_sub_part=1)
- 990 green confidence, 1,446 yellow confidence

---

## 2. FILES CHANGED
- `routes/v2/batch_parser.js` — Added `autoPromoteSession` with correct FK lookups

---

## 3. NEXT STEPS
- Test Database Data source in frontend QP/Memo Register
- Verify headers are correctly marked with `is_sub_part=1`
- Test item_master CRUD operations
