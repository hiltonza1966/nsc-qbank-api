# QBank Discovery File v14.0 — Corporate API Versioning Complete
**Generated:** 22 June 2026 15:18 SAST
**Updated By:** AI K2.6 Session — API Versioning + Feature Flags + Batch Parser
**Status:** CORPORATE ARCHITECTURE IMPLEMENTED. ALL FEATURES ISOLATED.
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** f1bce29
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

---

## 1. SCHEMA STATE (Post-Corporate Architecture)

### Parser Tables — POPULATED ✅
| Table | Count | Status |
|-------|-------|--------|
| parse_sessions | 1+ | ✅ Audit trail per paper |
| parse_results | 23+ | ✅ Question items per paper |
| parse_memos | 23+ | ✅ Memo items per paper |

### CAPS Tables — COMPLETE ✅
| Table | Count | Status |
|-------|-------|--------|
| lookup_caps_topics | 1,779 | ✅ 61 subjects (27 + 34 languages) |
| lookup_caps_subtopics | 19,751 | ✅ Linked |
| caps_atp_content | 23,838 | ✅ 85 subjects |
| caps_poa_template | 3,615 | ✅ 73 subjects |

---

## 2. CORPORATE API VERSIONING (NEW)

### Problem Solved
**Before:** Fixing CAPS parser corrupted Wizard parser (shared routes, shared files)
**After:** Each feature is completely isolated — cannot corrupt each other

### Architecture
```
API Layer:
  /api/v2/parser/*     ← Wizard v30 (isolated)
  /api/v1/caps/*       ← CAPS v9 (isolated)
  /api/*               ← Legacy (backward compatibility)

Route Layer:
  routes/v2/parser.js      ← Wizard only
  routes/v2/batch_parser.js ← Batch only
  routes/v1/caps.js        ← CAPS only
  routes/legacy.js          ← Health check

Config Layer:
  config/features.js      ← Toggle features without code changes
```

### Feature Flags
```javascript
wizard_parser_v30: { enabled: true }   // Toggle Wizard
caps_parser_v9: { enabled: true }       // Toggle CAPS
batch_processing: { enabled: true }    // Toggle batch
legacy_routes: { enabled: true }      // Toggle legacy
```

---

## 3. PARSER v30 — FOUR PARSER ARCHITECTURE

### Components
| Parser | File | Purpose | Status |
|--------|------|---------|--------|
| P1 | qp_content_parser.py | Extract question text + images + pages | ✅ |
| P2 | memo_content_parser.py | Extract answer text + images + pages | ✅ |
| P3 | qp_marks_parser.py | Extract marks from QP (PRIMARY) | ✅ |
| P4 | memo_marks_parser.py | Extract section totals (VALIDATION) | ✅ |
| P5 | master_harness_v2.py | Combine all 4 by question_number | ✅ |
| API | parser_api_v2.py | PythonShell-safe wrapper | ✅ |

### Results (Accounting P1 Nov 2025)
- **Matched:** 23 items
- **Green:** 23 | Yellow: 0 | Red: 0
- **Total Marks:** 144/150 (96% accuracy)
- **Variance:** 6 marks

---

## 4. BATCH PARSER (NEW)

### Purpose
Process multiple QP + Memo PDF pairs in one operation

### Input
- Folder containing PDF files
- Naming convention: `{Subject} P{PaperNo} Nov {Year} Eng.pdf` (QP)
- `{Subject} P{PaperNo} Nov {Year} MG Eng.pdf` (Memo)

### Output
- Auto-pairs QP + Memo by filename matching
- Extracts dimensions from filenames
- Processes each pair through v30 parser
- Saves to parse_sessions, parse_results, parse_memos
- Generates batch report

### Endpoint
```
POST /api/v2/parser/batch
Body: {
  folder_path: "C:\\path\\to\\papers",
  year_id: 1,
  grade_id: 3,
  assessment_type_id: 1,
  assessment_body_id: 1,
  create_production_items: false
}
```

---

## 5. DATA FLOW (Parser Workflow)

```
PDF Files (QP + Memo)
    |
    v
[Batch Parser] — Pairs files, extracts dimensions
    |
    v
[Parser API v2] — Calls Python parser_api_v2.py
    |
    v
[Four Parser Architecture]
  ├── qp_content_parser.py
  ├── memo_content_parser.py
  ├── qp_marks_parser.py
  ├── memo_marks_parser.py
  └── master_harness_v2.py
    |
    v
parse_sessions (1 record per paper)
    |
    v
parse_results (N records per paper — question items)
    |
    v
parse_memos (N records per paper — memo items)
    |
    v
[Optional] item_master + item_memos + item_attachments
```

---

## 6. API ENDPOINTS (Versioned)

### v2 API — Wizard Parser
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v2/parser/status | Check parser status |
| POST | /api/v2/parser/parse | Full parse (QP + Memo) |
| POST | /api/v2/parser/parse-qp | QP only |
| POST | /api/v2/parser/parse-memo | Memo only |
| POST | /api/v2/parser/approve | Approve and import |
| POST | /api/v2/parser/batch | Batch processing |
| GET | /api/v2/parser/batch/status | Batch status |

### v1 API — CAPS Parser
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/caps/parse | Parse CAPS JSON |
| POST | /api/v1/caps/execute | Execute SQL |
| GET | /api/v1/caps/subjects | List subjects |
| GET | /api/v1/caps/grades | List grades |
| GET | /api/v1/caps/migrations | List migrations |
| GET | /api/v1/caps/content/:code | ATP content |
| GET | /api/v1/caps/poa/:code | PoA template |

### Legacy API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |

---

## 7. FILES CHANGED (This Session)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| config/features.js | NEW | Feature flags configuration | ✅ |
| routes/v2/parser.js | NEW | Wizard v30 isolated route | ✅ |
| routes/v2/batch_parser.js | NEW | Batch processing isolated | ✅ |
| routes/v1/caps.js | NEW | CAPS v9 isolated route | ✅ |
| routes/legacy.js | NEW | Backward compatibility | ✅ |
| server.js | MODIFIED | Added versioned route mounts | ✅ |
| backend/parsers/* | VERIFIED | All v30 parsers intact | ✅ |

---

## 8. CRITICAL RULES (Updated)

1. **Verify with DESCRIBE before writing SQL**
2. **Surgical fixes only** — change only what's needed
3. **Use API versioning** — never share routes between features
4. **Use feature flags** — toggle without code changes
5. **Restart backend after every route change**
6. **Topic codes must be unique across all subjects**
7. **No assumptions** — verify schema before every change
8. **Export router directly:** module.exports = router;
9. **Always use correct official codes from caps_subjects_master**
10. **Delete old data before re-seeding to avoid duplicates**
11. **Commit after every working change**

---

## 9. NEXT STEPS (Pending)

1. **Test Batch Parser** — Process all 20+ papers in CAPS Documents folder
2. **Fix 6-mark Variance** — Multi-line marks, 3x1 pattern
3. **Enable Table Extraction** — When PyMuPDF bug fixed
4. **Test Other Subjects** — Maths, Physics, Geography, Life Sciences
5. **Review Workflow** — Phase 3: Peer → Expert → Moderator
6. **Items Page** — Verify imported items display correctly

---

*End of Discovery File v14.0*
*Date: 2026-06-22 15:18 SAST*
*Next Session: Test Batch Parser + Fix 6-mark variance*
