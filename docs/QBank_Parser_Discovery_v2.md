# QBank Parser System — Discovery File v2.0
**Project:** nsc-qbank (Corporate QBank for South African NSC)
**Repo:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL 8.0.45)
**DB Password:** Hilton@66
**Backend Port:** 4000
**Session:** 2026-07-09

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Parser Pipeline (Python)
```
PDF QP + PDF Memo
    ↓
qp_content_parser.py (row-based bounding box extraction)
qp_marks_parser.py (row-based marks extraction)
memo_content_parser.py (row-based answer extraction)
memo_marks_parser.py (section totals only)
    ↓
master_harness_v3.py (combines all 4 outputs)
    ↓
parser_api_v2.py (maps harness output to batch_parser expected fields)
    ↓
Node.js batch_parser.js (DB insert + promotion)
```

### 1.2 Key Insight: Row-Based Extraction
PyMuPDF's `page.get_text()` reads DBE PDFs **column-by-column**, not row-by-row.
This causes missing items, wrong MCQ options, and incorrect marks.

**Fix:** Use `page.get_text("words")` to get word-level bounding boxes,
group by y-position into visual rows, then read left-to-right.
This makes column order irrelevant.

### 1.3 File Locations
| Component | Path |
|-----------|------|
| QP Content Parser | `backend/parsers/qp_content_parser.py` |
| QP Marks Parser | `backend/parsers/qp_marks_parser.py` |
| Memo Content Parser | `backend/parsers/memo_content_parser.py` |
| Memo Marks Parser | `backend/parsers/memo_marks_parser.py` |
| Master Harness | `backend/parsers/master_harness_v3.py` |
| Parser API | `backend/parsers/parser_api_v2.py` |
| Batch Parser | `routes/v3/batch_parser.js` |
| Step 1 Preprocessing | `routes/v3/step1_preprocessing.js` |
| Bilingual Cleaner | `backend/parsers/bilingual_cleaner.py` |
| Dashboard API | `routes/dashboard.js` |
| Dashboard UI | `frontend/src/pages/Dashboard.tsx` |

---

## 2. DATABASE SCHEMA

### 2.1 Parser Tables
```sql
parse_sessions      — session metadata
parse_results       — QP extracted items (question_text, marks, item_answer_json, images)
parse_memos         — Memo extracted items (answer_text, marks)
parser_results      — legacy parser output
parse_expected_structure — expected item structure
```

### 2.2 item_master (Production Table)
```sql
item_id, item_code, source_paper_code, source_question_number,
question_number, question_text, marks, marks_allocated,
qp_marks, memo_marks, item_answer_json, item_type_id,
parent_question, is_sub_part, is_header, header_level,
parent_item_id, status, review_status, created_by, user_id
```

**Important:**
- `source_paper_code` (NOT `paper_code`) — used for filtering
- `item_answer_json` — stores MCQ options as JSON string
- `item_code` has UNIQUE constraint: `uk_item_code`
- Triggers on item_master: `tr_item_master_insert`, `tr_item_master_delete`
  - Use `COALESCE(@current_user_id, 1)` to avoid NULL user_id errors

### 2.3 item_attachments
```sql
attachment_id, item_id, result_id, session_id, file_name, file_path,
file_size, mime_type, attachment_type, question_number, is_extracted
```

**Note:** Every item in a paper gets ALL images from that paper's PDF.
This is by design — the register shows all attachments and users identify relevance.

### 2.4 item_memos
```sql
memo_id, item_id, question_number, answer_text, marks, is_current
```

---

## 3. API ENDPOINTS

### 3.1 Batch Parser
```
POST /api/v3/parser/batch
Body: {
    folder_path: "C:\dev\nsc-qbank\docs\Question Papers\Test",
    create_production_items: true
}
```

### 3.2 Parser Status
```
GET /api/v3/parser/batch/status
```

### 3.3 Dashboard Stats
```
GET /api/dashboard/stats
Returns: { total_papers, total_sessions, total_parsed_items,
           auto_corrected, manual_review, total_attachments }
```

### 3.4 Other Key Endpoints
```
/api/v3/parser        — batch parser routes
/api/v2               — QP & Memo Register (v3 code mounted at v2)
/api/dashboard/parser — parser status dashboard
/api/debug/logs       — debug logs
```

---

## 4. KNOWN ISSUES & FIXES

### 4.1 Fixed This Session
| Issue | Fix | File |
|-------|-----|------|
| Missing table items (1.2.1-1.2.8) | Row-based extraction | qp_content_parser.py |
| Wrong MCQ options | Row-based + stricter regex | qp_content_parser.py |
| Wrong header marks | Row-based marks extraction | qp_marks_parser.py |
| Memo answers scrambled | Row-based answer extraction | memo_content_parser.py |
| MCQ false positives | Removed memo is_mcq override | master_harness_v3.py |
| item_answer_json not in DB | Added to SELECT, INSERT, VALUES | batch_parser.js |
| Images not linked | Fixed 'images' key + object format | batch_parser.js |
| total_marks = {} | Added to integer default list | parser_api_v2.py |
| user_id NULL on DELETE | COALESCE in triggers | fix_triggers.sql |
| header_level undefined | Removed duplicate declarations | qp_content_parser.py |
| Attachment counter 0 | Added affectedRows increment | batch_parser.js |
| Dashboard no attachments | Added Attachments card | dashboard.js + Dashboard.tsx |

### 4.2 Still Missing (8 items per paper)
- 1.3 (header), 1.4.1, 1.5.3, 2.2.1, 2.4.2, 3.2.2, 3.4.2, 3 (diagram/header items)
- These are in diagrams or positioned beyond NUM_COL_X=200
- CRUD team needs to add these manually

### 4.3 Remaining Work
- [ ] Fix 8 missing items per paper (CRUD team)
- [ ] Fix Accounting P2 marks (597,522 — manual review)
- [ ] Find missing memo files for 25 unmatched QP papers
- [ ] Scale beyond 112 pairs (currently 25 unmatched)

---

## 5. TEST PROCEDURE

```powershell
# 1. Clear ALL data (including item_master)
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u root -pHilton@66 -e "
SET FOREIGN_KEY_CHECKS=0;
DELETE FROM nsc_qbank.item_master;
DELETE FROM nsc_qbank.item_attachments;
DELETE FROM nsc_qbank.item_memos;
TRUNCATE TABLE nsc_qbank.parse_sessions;
TRUNCATE TABLE nsc_qbank.parse_results;
TRUNCATE TABLE nsc_qbank.parse_expected_structure;
TRUNCATE TABLE nsc_qbank.parse_memos;
TRUNCATE TABLE nsc_qbank.parser_results;
SET FOREIGN_KEY_CHECKS=1;
"

# 2. Clear Python cache
Remove-Item "C:\dev\nsc-qbank\backend\parsers\__pycache__" -Recurse -Force
Remove-Item "C:\dev\nsc-qbank\backend\parsers\*.pyc" -Force

# 3. Run batch parser
$body = @{
    folder_path = "C:\dev\nsc-qbank\docs\Question Papers"
    create_production_items = $true
} | ConvertTo-Json -Depth 3
Invoke-RestMethod -Uri "http://localhost:4000/api/v3/parser/batch" -Method POST -Body $body -ContentType "application/json"

# 4. Verify
& $mysql -u root -pHilton@66 -e "
SELECT COUNT(*) as total_items FROM nsc_qbank.item_master;
SELECT COUNT(*) as total_attachments FROM nsc_qbank.item_attachments;
SELECT COUNT(*) as items_with_mcq FROM nsc_qbank.item_master WHERE item_answer_json IS NOT NULL;
SELECT source_paper_code, COUNT(*) as items FROM nsc_qbank.item_master GROUP BY source_paper_code ORDER BY items DESC LIMIT 10;
"
```

---

## 6. CRITICAL RULES

1. **Never hardcode values** — All filters, dropdowns, subjects must be database-driven
2. **Preserve existing functionality** — Audit first, add on top, never remove
3. **Clear Python cache** before testing: `Remove-Item __pycache__, *.pyc`
4. **Clean ALL tables** before full re-runs (including item_master, item_attachments, item_memos)
5. **Use SQL to verify** — Don't trust parser output counts alone
6. **Row-based extraction is correct** — Don't revert to linear text parsing
7. **Triggers use COALESCE** — NULL user_id defaults to admin (1)

---

## 7. FILE VERSIONS (Current)

| File | Version | Status |
|------|---------|--------|
| qp_content_parser.py | v5.1 | Row-based, fixes applied |
| qp_marks_parser.py | v4 | Verified correct |
| memo_content_parser.py | v4 | Verified correct |
| memo_marks_parser.py | v2 | Section totals only |
| master_harness_v3.py | v39 | MCQ + image fixes |
| parser_api_v2.py | v39 | Maps harness to batch |
| batch_parser.js | v38 + fixes | Attachments + counter fixed |
| bilingual_cleaner.py | — | English/Afrikaans filter |
| dashboard.js | — | Added total_attachments |
| Dashboard.tsx | — | Added Attachments card |

---

END OF DISCOVERY FILE v2.0
