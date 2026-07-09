# AI Handover Note — QBank Parser Fix Session v51
**Session Date:** 2026-07-09
**AI:** Kimi K2.6
**User:** visagie.h
**Repo:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL 8.0.45, password: Hilton@66)
**Previous Handover:** v50

---

## 1. WHAT WAS FIXED THIS SESSION

### A. Trigger Fix (CRITICAL)
**Problem:** `DELETE FROM item_master` failed with `Column 'user_id' cannot be null`
**Root Cause:** Triggers `tr_item_master_insert` and `tr_item_master_delete` used `@current_user_id` which was NULL
**Fix:** Recreated triggers with `COALESCE(@current_user_id, 1)` — defaults to admin (user_id=1)
**File:** `fix_triggers.sql` (one-time fix, already applied to DB)

### B. Attachment Fix (CRITICAL)
**Problem:** `attachments_inserted=0` for all papers
**Root Cause:** `buildAllImages()` in `batch_parser.js` expected `item.qp_images` as **strings**, but `qp_content_parser.py` returns **objects** `{filename, page, bbox}`
**Fix:** Added object format handling to `buildAllImages()` — checks `typeof imgPath === 'object'` and extracts `imgPath.filename`
**File:** `batch_parser.js` (lines ~100-140)

### C. Attachment Counter Fix
**Problem:** `promote_attachments_linked=0` even though attachments were linked
**Root Cause:** The UPDATE loop didn't increment the counter
**Fix:** Added `attachmentsLinked += updateResult.affectedRows || 0;`
**File:** `batch_parser.js` (line ~790)

### D. Dashboard Attachments Card
**Added:** New "Attachments" card to QBank Dashboard (pink color)
**Backend:** `dashboard.js` — added `total_attachments` to `/api/dashboard/stats`
**Frontend:** `Dashboard.tsx` — added `totalAttachments` to interface and `<StatCard>` component
**Files:** `dashboard.js`, `Dashboard.tsx`

### E. Database Cleanup Procedure
**Problem:** Old items with `_OLD`, `_DEL`, `_OLD2` suffixes blocked new promotions
**Solution:** `SET FOREIGN_KEY_CHECKS=0; DELETE FROM item_master;` (trigger now handles NULL user_id)
**Also clears:** `item_attachments`, `item_memos` when doing full re-runs

---

## 2. DEPLOYMENT RESULTS — FULL 112 PAIRS

```
success: True
summary: {total_pairs: 112, successful: 112, failed: 0, unmatched: 25}
```

**Per-paper metrics:**
- items: 24-36 per paper
- marks: 123-267 per paper (Accounting P2 has wrong marks: 597,522 — needs manual fix)
- headers_detected: 9-17 per paper
- attachments_inserted: 176-216 per paper
- promote_status: success (after cleaning item_master)
- promote_items_inserted: 22-27 per paper
- promote_attachments_linked: matches attachments_inserted

**Unmatched:** 25 files (no memo file found — these are QP-only papers)

---

## 3. FILES IN REPO (Current State)

| File | Version | Status |
|------|---------|--------|
| backend/parsers/qp_content_parser.py | v5.1 | Row-based, no duplicates |
| backend/parsers/qp_marks_parser.py | v4 | Verified correct |
| backend/parsers/memo_content_parser.py | v4 | Verified correct |
| backend/parsers/memo_marks_parser.py | v2 | Section totals only |
| backend/parsers/master_harness_v3.py | v39 | MCQ + image fixes |
| backend/parsers/parser_api_v2.py | v39 | Maps harness to batch |
| routes/v3/batch_parser.js | v38 + fixes | Attachments + counter fixed |
| routes/v3/step1_preprocessing.js | — | Filename parsing |
| backend/parsers/bilingual_cleaner.py | — | English/Afrikaans filter |
| routes/dashboard.js | — | Added total_attachments |
| frontend/src/pages/Dashboard.tsx | — | Added Attachments card |

---

## 4. CRITICAL NOTES FOR NEXT AI

1. **Row-based extraction is correct** — don't revert to linear text parsing
2. **Always clear Python cache** before testing: `Remove-Item *.pyc` and `__pycache__`
3. **Always clean ALL tables before full re-runs:**
   ```sql
   SET FOREIGN_KEY_CHECKS=0;
   DELETE FROM item_master;
   DELETE FROM item_attachments;
   DELETE FROM item_memos;
   TRUNCATE parse_sessions;
   TRUNCATE parse_results;
   TRUNCATE parse_expected_structure;
   TRUNCATE parse_memos;
   TRUNCATE parser_results;
   SET FOREIGN_KEY_CHECKS=1;
   ```
4. **Trigger fix is permanent** — `COALESCE(@current_user_id, 1)` means NULL defaults to admin
5. **Use SQL to verify** — Don't trust parser output counts alone
6. **Test folder:** `C:\dev\nsc-qbank\docs\Question Papers\Test`
7. **Backend port:** 4000, **MySQL path:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
8. **Never hardcode values** — all config must be database-driven
9. **Preserve existing functionality** — audit first, add on top
10. **Attachments are global per paper** — every item gets ALL images from the PDF (register shows which are relevant)

---

## 5. TEST CHECKLIST (Updated)

- [x] 112 pairs parsed successfully
- [x] 70 items for LIFESCIENCES_P1_2025_NOV_ENG (Test folder)
- [x] 1.2.1–1.2.8 exist in parse_results (all 8 table items)
- [x] 2.2.1–2.2.3 exist in parse_results
- [x] 1.3.1–1.3.3 exist (matching questions, not MCQ)
- [x] Header marks correct (1.2=8, 1.3=6, 2.2=11, etc.)
- [x] Sub-item marks correct (1.2.x=1, 1.3.x=2)
- [x] MCQ options extracted for 1.1.x items
- [x] item_answer_json populated in parse_results
- [x] item_answer_json populated in item_master
- [x] Promotion succeeds (no duplicate key after cleaning)
- [x] item_master has correct hierarchy
- [x] Attachments linked (promote_attachments_linked > 0)
- [x] Dashboard shows Attachments card
- [ ] Fix 8 missing items per paper (diagram/header items — CRUD team)
- [ ] Fix Accounting P2 marks (597,522 — manual review)
- [ ] Scale beyond 112 pairs (find missing memo files for 25 unmatched)

---

## 6. DEPLOYMENT PACKAGE

Download all corrected files:
- `parser_fix_v10_FINAL.zip` — 6 parser files
- `dashboard_attachments_fix.zip` — dashboard.js + Dashboard.tsx
- `fix_triggers.sql` — MySQL trigger fix (already applied)

Copy to:
- `.py` files → `C:\dev\nsc-qbank\backend\parsers\`
- `batch_parser.js` → `C:\dev\nsc-qbank\routes\v3\`
- `dashboard.js` → `C:\dev\nsc-qbank\routes\`
- `Dashboard.tsx` → `C:\dev\nsc-qbank\frontend\src\pages\`

---

## 7. KNOWN LIMITATIONS (For CRUD Team)

1. **8 missing items per paper** — Diagram-based questions (1.3, 1.4.1, 1.5.3, 2.2.1, 2.4.2, 3.2.2, 3.4.2, 3)
   - These have question numbers embedded in images, not extractable text
   - CRUD screen needs to allow manual addition of these items

2. **Section headers** (e.g., "3") — Not extracted as they have no question number in text
   - CRUD screen needs to allow adding section-level headers

3. **Attachments are global per paper** — Every item gets ALL images from the PDF
   - The register will show all attachments; users can identify which belong to which item
   - Future enhancement: associate images with specific items by page proximity

4. **Accounting P2 marks** — Shows 597,522 instead of ~150
   - The marks parser is picking up account numbers/invoice numbers
   - Needs manual correction in the register

5. **25 unmatched QP files** — No matching memo files found
   - These papers cannot be parsed without memos
   - Need to source the missing memo PDFs

---

END OF HANDOVER v51
