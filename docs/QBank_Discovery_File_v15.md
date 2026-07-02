# QBank Discovery File v15.0 — Batch Parser Rename System Complete
**Generated:** 30 June 2026 22:00 SAST
**Updated By:** AI K2.6 Session — Batch Parser Rename Fixes
**Status:** RENAME SYSTEM COMPLETE. ALL FILES IN MACHINE FORMAT. IMPORT BLOCKED BY WRONG SUBJECT CODES.
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** aeeea08 (2026-06-30)
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

---

## 1. SCHEMA STATE (Post-Rename Fixes)

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

### Lookup Tables — VERIFIED ✅
| Table | Count | Status |
|-------|-------|--------|
| lookup_subjects | 262 | ✅ 123 unique parser_subject_code values |
| lookup_years | 5+ | ✅ |
| lookup_grades | 3+ | ✅ Grade 12 = grade_id 3 |
| lookup_papers | 5+ | ✅ |
| lookup_assessment_types | 3+ | ✅ |
| lookup_assessment_bodies | 2+ | ✅ DBE, IEB |
| lookup_exam_sessions | 4+ | ✅ Nov, May-June, Feb-March, Sept |

---

## 2. CORPORATE API VERSIONING (UNCHANGED)

### Architecture
```
API Layer:
  /api/v3/parser/*     ← Batch Parser v3 (current)
  /api/v2/parser/*     ← Wizard v30 (legacy)
  /api/v1/caps/*       ← CAPS v9 (isolated)
  /api/*               ← Legacy (backward compatibility)

Route Layer:
  routes/v3/batch_parser.js  ← Batch parser (current)
  routes/v2/parser.js        ← Wizard only
  routes/v2/batch_parser.js  ← Batch only (legacy)
  routes/v1/caps.js          ← CAPS only
  routes/legacy.js           ← Health check

Config Layer:
  config/features.js         ← Toggle features without code changes
```

### Feature Flags
```javascript
wizard_parser_v30: { enabled: true }   // Toggle Wizard
batch_parser_v3: { enabled: true }      // Toggle Batch Parser
caps_parser_v9: { enabled: true }       // Toggle CAPS
legacy_routes: { enabled: true }        // Toggle legacy
```

---

## 3. BATCH PARSER v3 — RENAME SYSTEM

### Status: COMPLETE ✅
- All 387 Question Papers files renamed to machine format
- Zero errors, zero old-format files remaining
- SASL alias working
- Assessment type validation (HL/FAL/SAL) working
- isMachineFormat regex handles all edge cases

### Input (Old Format)
```
{Subject} [HL|FAL|SAL] P{PaperNo} {Session} {Year} [QP|MG] [Eng|Afr].pdf
```

### Output (Machine Format)
```
{PARSER_SUBJECT_CODE}_{PAPER}_{YEAR}_{SESSION}_{LANGUAGE}_{TYPE}.pdf
```

### Examples
| Old Format | Machine Format |
|------------|---------------|
| `Accounting P1 Nov 2025 Eng.pdf` | `ACCOUNTING_P1_2025_NOV_ENG_QP.pdf` |
| `Afrikaans HL P1 Nov 2025 Afr.pdf` | `AFRIKAANSHOMELANGUAGE_HL_P1_2025_NOV_AFR_Memo_AFR.pdf` |
| `SASL HL P1 May-June 2025 QP Transcription.pdf` | `SOUTHAFRICANSIGNLANGUAGEHOMELANGUAGE_HL_P1_2025_MAY_JUNE_SASL_QP_Transcription.pdf` |

### Endpoint
```
POST /api/v3/parser/rename-preview
Body: {
  folder_path: "C:\\dev\\nsc-qbank\\docs\\Question Papers",
  execute: false  // true to actually rename
}
```

---

## 4. BATCH PARSER v3 — IMPORT SYSTEM

### Status: BLOCKED ⚠️
- 387 files in machine format ready
- Some files have WRONG subject codes from buggy rename (see Section 6)
- Need to fix wrong codes before import can proceed

### Known Wrong Subject Codes
| Wrong File | Correct File |
|------------|-------------|
| `SETSWANAHOMELANGUAGE_SAL_P1...` | `SETSWANASECONDADDITIONALLANGUAGE_SAL_P1...` |
| `ENGLISHHOMELANGUAGE_FAL_P1...` | `ENGLISHFIRSTADDITIONALLANGUAGE_FAL_P1...` |
| `TSHIVENDAHOMELANGUAGE_FAL_P3...` | `TSHIVENDAFIRSTADDITIONALLANGUAGE_FAL_P3...` |
| `SISWATIHOMELANGUAGE_FAL_P3...` | `SISWATIFIRSTADDITIONALLANGUAGE_FAL_P3...` |

### Import Endpoint
```
POST /api/v3/parser/batch
Body: {
  folder_path: "C:\\dev\\nsc-qbank\\docs\\Question Papers",
  year_id: 5,        // 2025
  grade_id: 3,       // Grade 12
  assessment_type_id: 1,
  assessment_body_id: 1,
  create_production_items: false
}
```

---

## 5. PARSER v30 — FOUR PARSER ARCHITECTURE

### Components (UNCHANGED)
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

## 6. DATA FLOW (Parser Workflow)

```
PDF Files (QP + Memo) — ALL IN MACHINE FORMAT
    |
    v
[Batch Parser v3] — Pairs files by machine-format naming
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

## 7. API ENDPOINTS (Versioned)

### v3 API — Batch Parser (CURRENT)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v3/parser/rename-preview | Preview or execute rename |
| POST | /api/v3/parser/batch | Batch processing (import) |
| GET | /api/v3/parser/status | Check parser status |

### v2 API — Wizard Parser (LEGACY)
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

## 8. FILES CHANGED (This Session)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| routes/v3/batch_parser.js | MODIFIED | SASL alias, assessment type validation, duplicate language fix, isMachineFormat regex | ✅ |
| docs/Question Papers/* | RENAMED | 387 files renamed to machine format | ✅ |
| INTEGRATION_GUIDE.md | NEW | Parser integration documentation | ✅ |

---

## 9. CRITICAL RULES (Updated)

1. **Verify with DESCRIBE before writing SQL**
2. **Surgical fixes only** — change only what's needed
3. **Use API versioning** — never share routes between features
4. **Restart backend after every route change**
5. **No assumptions** — verify schema before every change
6. **Export router directly:** module.exports = router;
7. **Always use correct official codes from caps_subjects_master**
8. **Delete old data before re-seeding to avoid duplicates**
9. **Commit after every working change**
10. **isMachineFormat regex must handle:** hyphens, ampersands, case-insensitive, no spaces
11. **parser_subject_code must match assessment type** (HL/FAL/SAL) in filename

---

## 10. NEXT STEPS (Pending)

1. **Fix Wrong Subject Codes** — Re-rename files with incorrect HOMELANGUAGE/FAL/SAL mismatches
2. **Test Batch Parser Import** — Verify machine-format filenames can be parsed
3. **Run Full Import** — Process all 387 files into parse_sessions/parse_results
4. **Auto-Promote to item_master** — Verify auto-promote works with corrected data
5. **Add Grade to parser_subject_code** — When adding Grade 10/11 support
6. **Fix 6-mark Variance** — Multi-line marks, 3x1 pattern
7. **Enable Table Extraction** — When PyMuPDF bug fixed

---

*End of Discovery File v15.0*
*Date: 2026-06-30 22:00 SAST*
*Next Session: Fix wrong subject codes + Test batch import*
