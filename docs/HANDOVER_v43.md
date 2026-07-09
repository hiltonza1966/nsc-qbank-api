# QBank QP & Memo Register — AI Handover Note v43
**Date:** 2026-07-03 16:42 SAST
**Status:** IN PROGRESS — Hierarchy display fixed, backend recalculation working, need to fix promotion & move editing to item_master
**Next AI:** K2.6 (same model, restart chat with "Restart Qbank QP & Memo Register chat")
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** db64a61 (2026-07-03)
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66

---

## 1. WHAT WAS ACCOMPLISHED TODAY (2026-07-03)

### 1.1 Hierarchy Display Fixed
**Problem:** Headers not showing, sub-items not indented, wrong order (3.4/3.5 before 3.1)
**Root Cause:** Database stored Level 1 headers with header_level=null, but frontend checked header_level===1
**Fix:** Updated sortItemsWithHeaders and render logic to treat null as Level 1

**Current Hierarchy Display:**
- **1** (HEADER, yellow badge, orange border) → 1.1, 1.2, 1.3 (indented)
- **2** (HEADER) → 2.1, 2.2, 2.3, 2.4 (indented)
- **3** (HEADER) → 3.1 (SUB-H, green) → 3.1.1, 3.1.2, 3.1.3 (sub-items) → 3.2, 3.3, 3.4, 3.5 (direct)
- **4** (HEADER) → 4.1, 4.2, 4.3, 4.4, 4.5 (indented)

### 1.2 Visual Design
- Tree connectors: ├─, └─, │  └─
- Color coding: Yellow (Header), Green (Sub-header), Blue (Sub-item), Light blue (Direct)
- Left border indicators: 6px orange (L1), 4px green (L2), 4px blue (sub-items)
- Resizable panels: Item List (maxWidth removed) and CRUD (minWidth added)

### 1.3 Backend Recalculation
**Problem:** After saving marks, is_red_flag stayed red even when marks matched
**Root Cause:** Backend didn't recalculate variance, is_red_flag, has_errors after update
**Fix:** Added recalculateItemStatus() helper to qp_memo_register.js

**Also Fixed:**
- Dropped generated columns variance and is_red_flag from parse_results/parse_memos
- Re-added as regular columns with DEFAULT 0
- Added has_errors column to both tables
- PUT /qp/:resultId and PUT /memo/:memoId now call recalculateItemStatus()
- Paper-level fetchData() called after save to refresh register summary

### 1.4 Frontend Status Cache
- Added correctedStatus state to persist fixed statuses across re-fetches
- openItemList() merges cached corrected statuses when re-fetching items

---

## 2. WHAT NEEDS TO BE DONE NEXT

### 2.1 Fix Batch Parser Promotion (CRITICAL)
**Problem:** Parsed Data shows 29 items / 305 marks (correct), but Database Data shows 28 items / 310 marks (wrong)
**Root Cause:** promoteSessionToItemMaster() is losing items or marks during promotion
**Files to Check:**
- C:\dev\nsc-qbank\utils\promoteSession.js (or similar)
- C:\dev\nsc-qbank\routes\v3\batch_parser.js (autoPromoteSession function)

**Expected Behavior:**
- All 29 items from parse_results should be copied to item_master
- All marks should match exactly
- Headers should be preserved with correct is_header/header_level

### 2.2 Move Editing to item_master (CRITICAL)
**Current:** Register edits parse_results/parse_memos (temporary tables)
**Target:** Register should edit item_master/item_memos (production tables)
**Reason:** Parsed data is temporary; production data is the single source of truth

**Changes Needed:**
1. Frontend: Change API calls from /api/v2/qp -> /api/qbank/items (item_master endpoints)
2. Backend: Add/update item_master edit endpoints in routes/items.js
3. Data Flow:
   - Parser creates items in parse_results (staging)
   - Promotion copies to item_master (production)
   - Register edits item_master directly
   - After promotion, parse_results can be deleted

### 2.3 Add Paper-Level Summary Table (RECOMMENDED)
**Problem:** Paper-level errors are calculated on the fly in getParsedData()/getDatabaseData()
**Solution:** Create papers_summary table to store pre-calculated paper stats
**Benefits:** Faster register loading, consistent error counts, easier debugging

```sql
CREATE TABLE IF NOT EXISTS papers_summary (
  paper_code VARCHAR(100) PRIMARY KEY,
  qp_item_count INT DEFAULT 0,
  memo_item_count INT DEFAULT 0,
  items_match TINYINT(1) DEFAULT 0,
  item_variance INT DEFAULT 0,
  qp_expected_marks INT DEFAULT 0,
  memo_expected_marks INT DEFAULT 0,
  marks_match TINYINT(1) DEFAULT 0,
  marks_variance INT DEFAULT 0,
  has_errors TINYINT(1) DEFAULT 0,
  error_count INT DEFAULT 0,
  data_quality_issues JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.4 Fix Database Data Discrepancy
**Current State:**
| Paper | Parsed Data | Database Data |
|-------|-------------|---------------|
| ACCOUNTING_P1_2025_NOV_ENG | 29 items, 305 marks, Clean | 28 items, 310 marks, 3 issues |
| ACCOUNTING_P1_2025_NOV_AFR | 25 items, 129 marks, Clean | 22 items, 121 marks, 1 issue |

**Fix:** Either re-promote with fixed batch parser, or directly fix item_master data

---

## 3. CRITICAL FILES

| File | Purpose | Status |
|------|---------|--------|
| frontend/src/pages/QPMemoRegister.tsx | Register UI | DONE - Hierarchy fixed, resizable panels, status cache |
| routes/v3/qp_memo_register.js | QP/Memo API | DONE - Recalculation added, live marks calculation |
| routes/items.js | Item master CRUD | NEEDS item_master edit endpoints for Register |
| routes/v3/batch_parser.js | Batch parser | NEEDS promotion fix |
| utils/promoteSession.js | Promotion logic | LIKELY BROKEN - needs inspection |

---

## 4. DATABASE SCHEMA CHANGES (2026-07-03)

### parse_results - DROPPED GENERATED COLUMNS, RE-ADDED AS REGULAR
```sql
ALTER TABLE parse_results DROP COLUMN variance;
ALTER TABLE parse_results DROP COLUMN is_red_flag;
ALTER TABLE parse_results ADD COLUMN variance INT DEFAULT 0;
ALTER TABLE parse_results ADD COLUMN is_red_flag TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE parse_results ADD COLUMN has_errors TINYINT(1) NOT NULL DEFAULT 0;
```

### parse_memos - SAME CHANGES
```sql
ALTER TABLE parse_memos DROP COLUMN variance;
ALTER TABLE parse_memos DROP COLUMN is_red_flag;
ALTER TABLE parse_memos ADD COLUMN variance INT DEFAULT 0;
ALTER TABLE parse_memos ADD COLUMN is_red_flag TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE parse_memos ADD COLUMN has_errors TINYINT(1) NOT NULL DEFAULT 0;
```

---

## 5. HOW TO CALL BACK THE AI

**Say exactly:**
```
Restart Qbank QP & Memo Register chat using the same AI for context and continuity.
```

**Or upload this handover note and say:**
```
Continue from HANDOVER_v43. Fix batch parser promotion and move Register editing to item_master.
```

---

## 6. TESTING CHECKLIST

- [ ] Fix batch parser promotion (all items copied correctly)
- [ ] Re-promote ACCOUNTING_P1_2025_NOV_ENG and verify counts match
- [ ] Add item_master edit endpoints to items.js
- [ ] Update Register frontend to use item_master endpoints
- [ ] Test editing item_master directly
- [ ] Verify paper-level errors update correctly
- [ ] Add papers_summary table (optional but recommended)
- [ ] Commit all changes

---

*End of Handover Note v43*
*Date: 2026-07-03 16:42 SAST*
*Next Session: Fix promotion + Move editing to item_master*
