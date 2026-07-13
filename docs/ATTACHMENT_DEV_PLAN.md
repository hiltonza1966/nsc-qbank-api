# QBank Attachment Parser — Development & Git Commit Plan
**Version:** 1.0  
**Date:** 2026-07-09  
**Author:** AI Assistant  
**Status:** Ready for Implementation

---

## 1. OBJECTIVE

Build a **5th standalone parser** (`attachment_parser.py`) that:
- Extracts images from PDFs with bounding boxes
- Filters noise (headers, footers, logos, "Please turn over")
- Classifies images (diagram, table, graph, formula, noise)
- Associates images to questions via **spatial proximity**
- Links images to correct hierarchy (header vs sub-item)
- Writes metadata-rich records to `item_attachments`

**Result:** Relevant attachments per paper drop from **130** to **~15-20**.

---

## 2. CRITICAL CONSTRAINTS

| # | Constraint | Rationale |
|---|-----------|-----------|
| 1 | **ZERO changes** to `qp_content_parser.py`, `qp_marks_parser.py`, `memo_content_parser.py`, `memo_marks_parser.py`, `master_harness_v3.py` | These are working. Do not touch. |
| 2 | **ZERO changes** to `batch_parser.js` core logic | Only add a single call to the new integration module. |
| 3 | **All new files** go into their own paths | Easy to revert if needed. |
| 4 | **Schema changes are additive only** | `ALTER TABLE` adds columns; no drops, no renames. |
| 5 | **Python parser is standalone** | No imports from other parsers. Only uses `fitz` + stdlib. |

---

## 3. FILE INVENTORY

### New Files (to be created)

| File | Path | Purpose | Lines |
|------|------|---------|-------|
| `attachment_parser.py` | `backend/parsers/attachment_parser.py` | Core Python parser | ~900 |
| `attachment_integration.js` | `routes/v3/attachment_integration.js` | Node.js wrapper for batch_parser | ~350 |
| `attachment_schema.sql` | `db/migrations/attachment_schema.sql` | DB schema additions | ~120 |

### Modified Files (minimal touches)

| File | Path | Change | Lines Added |
|------|------|--------|-------------|
| `batch_parser.js` | `routes/v3/batch_parser.js` | Add 1 import + 1 function call after QP parse | ~10 |
| `server.js` | `server.js` | Ensure `attachment_integration.js` route/module is available | ~5 |

---

## 4. DATABASE SCHEMA CHANGES

### ALTER TABLE `item_attachments`

```sql
-- 14 new columns (all nullable with defaults)
attachment_type ENUM('diagram','table','graph','formula','map','stimulus','header_logo','footer','noise','unknown') DEFAULT 'unknown'
relevance_score DECIMAL(3,2) DEFAULT 0.00
page_number INT
bbox_x0, bbox_y0, bbox_x1, bbox_y1 DECIMAL(8,2)
image_width, image_height INT
is_primary BOOLEAN DEFAULT FALSE
is_noise BOOLEAN DEFAULT FALSE
linked_question_number VARCHAR(20)
link_method ENUM('proximity','explicit_reference','manual','batch') DEFAULT 'batch'
image_hash VARCHAR(64)
aspect_ratio DECIMAL(6,2)
file_size_kb INT
```

### New Tables

```sql
attachment_audit_log      -- Track all attachment changes
attachment_noise_patterns -- Learned noise templates (DBE logo hashes, etc.)
```

### Indexes

```sql
idx_attachments_type, idx_attachments_noise, idx_attachments_primary
idx_attachments_hash, idx_attachments_qnum, idx_attachments_page
```

---

## 5. GIT COMMIT STRATEGY

### Commit 1: `feat: attachment parser schema additions`
```bash
git add db/migrations/attachment_schema.sql
git commit -m "feat: attachment parser schema additions

- Add 14 metadata columns to item_attachments
- Add attachment_audit_log table
- Add attachment_noise_patterns table
- Add performance indexes
- Zero breaking changes to existing schema"
```

### Commit 2: `feat: attachment_parser.py — standalone image parser`
```bash
git add backend/parsers/attachment_parser.py
git commit -m "feat: attachment_parser.py — standalone image parser

- Extracts images with bounding boxes from PDFs
- 6-stage noise filter (global templates, size, aspect ratio, position, page context)
- Image classifier (diagram, table, graph, formula, noise)
- Proximity-based question association
- Hierarchy linking (header vs sub-item)
- Standalone: no imports from other parsers
- Includes --test mode for standalone validation"
```

### Commit 3: `feat: attachment_integration.js — Node.js wrapper`
```bash
git add routes/v3/attachment_integration.js
git commit -m "feat: attachment_integration.js — Node.js wrapper

- Extracts question anchors from parse_results
- Spawns attachment_parser.py via child_process
- Maps attachments to item_master item_ids
- Inserts metadata-rich records into item_attachments
- Provides getAttachmentSummary() for dashboard"
```

### Commit 4: `feat: integrate attachment parser into batch pipeline`
```bash
git add routes/v3/batch_parser.js server.js
git commit -m "feat: integrate attachment parser into batch pipeline

- batch_parser.js: calls AttachmentIntegration after QP parse
- server.js: ensures module is loadable
- Only adds 10 lines to batch_parser.js
- No changes to existing parse logic"
```

### Commit 5: `test: validate attachment parser on Life Sciences P1`
```bash
git add tests/attachment_parser_test.log
git commit -m "test: validate attachment parser on Life Sciences P1

- 16 pages processed
- 130 raw images → ~18 relevant attachments
- Noise filter correctly identifies DBE logos, headers, footers
- Proximity association links diagrams to correct questions
- All 5 diagram sections (1.4, 1.5, 2.2, 2.4, 3.1, 3.4, 3.5) detected"
```

---

## 6. TEST PROCEDURE

### Step 1: Apply Schema
```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u root -pHilton@66 nsc_qbank < db\migrations\attachment_schema.sql
```

### Step 2: Test Parser Standalone
```powershell
cd C:\dev\nsc-qbank\backend\parsers
python attachment_parser.py --test "C:\dev\nsc-qbank\docs\Question Papers\LIFESCIENCES_P1_2025_NOV_ENG_QP.pdf" --output ./test_output
```

**Expected Output:**
```
Total images extracted:     130
Noise filtered:             112
Relevant attachments:       18
Primary attachments:        18
Average relevance score:    0.85

By type:
  diagram       : 14
  table         : 2
  graph         : 1
  noise         : 112
  header_logo   : 8
  footer        : 4

By question (top 10):
  1.4           : 3
  1.5           : 1
  2.2           : 1
  2.4           : 1
  3.1           : 1
  3.4           : 1
  3.5           : 1
```

### Step 3: Test Integration
```powershell
# Run batch parser on test folder with create_production_items=true
$body = @{
    folder_path = "C:\dev\nsc-qbank\docs\Question Papers\Test"
    create_production_items = $true
} | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "http://localhost:4000/api/v3/parser/batch" -Method POST -Body $body -ContentType "application/json"
```

### Step 4: Verify DB
```sql
SELECT 
    source_paper_code,
    COUNT(*) as total_items,
    SUM(CASE WHEN a.attachment_type = 'diagram' THEN 1 ELSE 0 END) as diagrams,
    SUM(CASE WHEN a.is_noise = TRUE THEN 1 ELSE 0 END) as noise
FROM item_master im
LEFT JOIN item_attachments a ON im.item_id = a.item_id
WHERE im.source_paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG'
GROUP BY source_paper_code;
```

---

## 7. ROLLBACK PLAN

If anything breaks:

```sql
-- Remove new columns (MySQL 8.0+)
ALTER TABLE item_attachments DROP COLUMN attachment_type;
ALTER TABLE item_attachments DROP COLUMN relevance_score;
ALTER TABLE item_attachments DROP COLUMN page_number;
ALTER TABLE item_attachments DROP COLUMN bbox_x0;
ALTER TABLE item_attachments DROP COLUMN bbox_y0;
ALTER TABLE item_attachments DROP COLUMN bbox_x1;
ALTER TABLE item_attachments DROP COLUMN bbox_y1;
ALTER TABLE item_attachments DROP COLUMN image_width;
ALTER TABLE item_attachments DROP COLUMN image_height;
ALTER TABLE item_attachments DROP COLUMN is_primary;
ALTER TABLE item_attachments DROP COLUMN is_noise;
ALTER TABLE item_attachments DROP COLUMN linked_question_number;
ALTER TABLE item_attachments DROP COLUMN link_method;
ALTER TABLE item_attachments DROP COLUMN image_hash;
ALTER TABLE item_attachments DROP COLUMN aspect_ratio;
ALTER TABLE item_attachments DROP COLUMN file_size_kb;

DROP TABLE IF EXISTS attachment_audit_log;
DROP TABLE IF EXISTS attachment_noise_patterns;
```

```bash
# Revert code
git reset --soft HEAD~5
git checkout -- routes/v3/batch_parser.js server.js
```

---

## 8. RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Parser misses diagrams | Medium | High | Manual review UI in CRUD; tune thresholds |
| Parser marks real diagrams as noise | Low | High | Conservative thresholds; audit log |
| Performance on 112 papers | Medium | Medium | Batch async processing; cache noise hashes |
| DB schema migration fails | Low | High | Test on backup first; rollback script ready |
| Integration breaks batch_parser | Low | Critical | Wrap in try/catch; fallback to old behavior |

---

## 9. POST-DEPLOYMENT TASKS

- [ ] CRUD Register: Show only `is_primary=TRUE` and `is_noise=FALSE` attachments
- [ ] CRUD Register: Add "Mark as Noise" / "Mark as Primary" buttons
- [ ] CRUD Register: Add manual re-association dropdown
- [ ] Dashboard: Add "Attachments per Paper" stat card
- [ ] Dashboard: Add "Noise Filtered" stat card
- [ ] Learn noise patterns from first 10 papers and populate `attachment_noise_patterns`
- [ ] Document attachment types for subject specialists

---

## 10. CHECKLIST BEFORE COMMIT

- [ ] `attachment_parser.py` syntax check passes (`python -m py_compile`)
- [ ] `attachment_integration.js` lint passes
- [ ] `attachment_schema.sql` runs without error on test DB
- [ ] Standalone test on Life Sciences P1 produces expected output
- [ ] Integration test on 1 paper succeeds
- [ ] Existing batch_parser tests still pass (no regression)
- [ ] All 4 other parsers untouched (git diff confirms)
- [ ] Rollback script tested

---

END OF DEV PLAN
