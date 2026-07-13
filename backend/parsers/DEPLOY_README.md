# Parser Fix v5 — Complete Package (4 files)

## What's in this package

| File | Description |
|------|-------------|
| **qp_content_parser.py** | COMPLETE REWRITE — row-based extraction. Fixes missing table items, MCQ options, header detection. |
| **qp_marks_parser.py** | v4 — already verified. All 15 header totals match official memo exactly. |
| **memo_content_parser.py** | v4 — already verified. All 30 items in Q1 extract correctly. |
| **master_harness_v3.py** | v39 — patched with 2 critical fixes (MCQ fields + image key). |

## Deploy to your repo

Copy these 4 files into:

```
C:\dev\nsc-qbank\backend\parsers\
```

Overwrite the existing files:
- qp_content_parser.py
- qp_marks_parser.py
- memo_content_parser.py
- master_harness_v3.py

## What changed in each file

### qp_content_parser.py (v5)
- **Complete rewrite** using `page.get_text("words")` bounding-box approach
- Groups words into visual rows by y-position, then reads left-to-right
- **Fixes:** missing table-format items (1.2.1–1.2.8), wrong MCQ options, header detection
- **New:** marks-zone filtering (x > 470) prevents marks contamination in question text
- **New:** `qp_images` key (correct name for harness consumption)
- **New:** `item_answer_json` field for MCQ option storage

### qp_marks_parser.py (v4)
- Already verified — no changes needed
- Row-based marks extraction
- All 15 header totals correct (1.1=20, 1.2=8, ..., 3.5=10)

### memo_content_parser.py (v4)
- Already verified — no changes needed
- Row-based answer extraction
- All 30 Q1 items correct

### master_harness_v3.py (v39)
- **Fix 1:** MCQ fields now use `qp_item['is_mcq']` and `qp_item['mcq_options']` directly
  instead of re-deriving with broken duplicate functions
- **Fix 2:** Image key changed from `'images'` (non-existent) to `'qp_images'` (parser output)
- **Kept:** FINAL SAFETY PASS ensuring header_level is never NULL
- **Kept:** Content marks fallback when marks parser misses items

## Test procedure

1. Clear parser tables:
```sql
SET FOREIGN_KEY_CHECKS=0;
TRUNCATE parse_sessions;
TRUNCATE parse_results;
TRUNCATE parse_attachments;
SET FOREIGN_KEY_CHECKS=1;
```

2. Run batch parser on Test folder:
```powershell
cd C:\dev\nsc-qbank
$body = @{
    folder_path = "C:\dev\nsc-qbank\docs\Question Papers\Test"
    create_production_items = $true
} | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "http://localhost:4000/api/v3/batch-parse" `
    -Method POST -Body $body -ContentType "application/json"
```

3. Verify extraction:
```sql
SELECT question_number, LEFT(question_text, 60), is_header, header_level, is_mcq, parser_extracted_marks
FROM parse_results
WHERE paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG'
ORDER BY question_number;
```

## Expected results

- All 45+ items extracted (including 1.2.1–1.2.8, 2.2.1–2.2.3)
- Header marks correct (1.2=8, 1.3=6, 2.2=11, etc.)
- MCQ options present for 1.1.x items
- Images linked correctly (attachments_inserted > 0 AND promote_attachments_linked > 0)
- Promotion succeeds (no duplicate key errors — clean item_master first if needed)
