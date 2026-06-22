# QBank Parser - AI Handover Note v31
**Date:** 22 June 2026 15:18 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main
**Git HEAD:** f1bce29

---

## CURRENT STATUS

### ✅ COMPLETED TODAY (2026-06-22)

| Feature | Status | Details |
|---------|--------|---------|
| **Parser v30** | ✅ COMPLETE | 23 Green, 0 Yellow, 0 Red, 144/150 marks |
| **API Versioning** | ✅ COMPLETE | v2/v1/legacy isolated routes |
| **Feature Flags** | ✅ COMPLETE | config/features.js — toggle without code changes |
| **Batch Parser** | ✅ READY | /api/v2/parser/batch — process folder of papers |
| **Cleanup** | ✅ COMPLETE | 30+ old files removed, canonical paths |
| **Database** | ✅ POPULATED | parse_sessions, parse_results, parse_memos |
| **Git** | ✅ PUSHED | 4 commits on main |

---

## CORPORATE API VERSIONING (NEW)

### Isolated Route Structure
```
routes/
  v2/
    parser.js          ← Wizard v30 (isolated from CAPS)
    batch_parser.js    ← Batch processing (isolated)
  v1/
    caps.js            ← CAPS v9 (isolated from Wizard)
  legacy.js            ← Backward compatibility
config/
  features.js          ← Feature flags
```

### API Endpoints
| Feature | Endpoint | Status |
|---------|----------|--------|
| Wizard Status | /api/v2/parser/status | ✅ Active |
| Wizard Parse | /api/v2/parser/parse | ✅ Active |
| Wizard Parse-QP | /api/v2/parser/parse-qp | ✅ Active |
| Wizard Parse-Memo | /api/v2/parser/parse-memo | ✅ Active |
| Wizard Approve | /api/v2/parser/approve | ✅ Active |
| Wizard Batch | /api/v2/parser/batch | ✅ Active |
| CAPS Subjects | /api/v1/caps/subjects | ✅ Active |
| CAPS Content | /api/v1/caps/content/:code | ✅ Active |
| CAPS PoA | /api/v1/caps/poa/:code | ✅ Active |
| Legacy Health | /api/health | ✅ Active |

### Feature Flags (config/features.js)
```javascript
wizard_parser_v30: { enabled: true }  // Toggle Wizard without affecting CAPS
caps_parser_v9: { enabled: true }      // Toggle CAPS without affecting Wizard
batch_processing: { enabled: true }    // Toggle batch without affecting single
legacy_routes: { enabled: true }      // Backward compatibility
```

---

## PARSER v30 — FOUR PARSER ARCHITECTURE

### Components
| Parser | File | Purpose |
|--------|------|---------|
| P1 | qp_content_parser.py | Extract question text + images + pages |
| P2 | memo_content_parser.py | Extract answer text + images + pages |
| P3 | qp_marks_parser.py | Extract marks from QP (PRIMARY) |
| P4 | memo_marks_parser.py | Extract section totals from Memo (VALIDATION) |
| P5 | master_harness_v2.py | Combine all 4 by question_number |
| API | parser_api_v2.py | PythonShell-safe API wrapper |

### Results (Accounting P1 Nov 2025)
- **Matched:** 23 items
- **Green:** 23 | Yellow: 0 | Red: 0
- **Total Marks:** 144/150 (96% accuracy)
- **Variance:** 6 marks (from multi-line marks not captured)

### Known Limitations
1. Table extraction disabled (PyMuPDF C-level bug)
2. Multi-line marks not fully captured (2.1, 2.3, 3.3.1)
3. 3x1 pattern not matching (3.1.1, 3.1.2, 3.1.3)
4. 6-mark variance from target 150

---

## DATABASE STATE

### Parser Tables
| Table | Records | Status |
|-------|---------|--------|
| parse_sessions | 1+ | ✅ Audit trail per paper |
| parse_results | 23+ | ✅ Question items |
| parse_memos | 23+ | ✅ Memo items |

### CAPS Tables
| Table | Records | Status |
|-------|---------|--------|
| lookup_caps_topics | 1,779 | ✅ 61 subjects |
| lookup_caps_subtopics | 19,751 | ✅ Linked |
| caps_atp_content | 23,838 | ✅ 85 subjects |
| caps_poa_template | 3,615 | ✅ 73 subjects |

---

## FILES IN REPO (Canonical)

### Backend Parsers (v30)
```
backend/parsers/
  bilingual_cleaner.py      (3067 bytes)
  qp_content_parser.py      (5185 bytes)
  memo_content_parser.py    (6960 bytes)
  qp_marks_parser.py        (3675 bytes)
  memo_marks_parser.py      (3122 bytes)
  master_harness_v2.py      (9829 bytes)
  parser_api_v2.py          (4785 bytes)
```

### Routes (Versioned)
```
routes/
  parser.js                 (11351 bytes) — Legacy
  v2/
    parser.js               (6906 bytes) — Wizard v30
    batch_parser.js         (12255 bytes) — Batch processing
  v1/
    caps.js                 (1948 bytes) — CAPS v9
  legacy.js                 (490 bytes) — Backward compatibility
```

### Config
```
config/
  features.js               (1125 bytes) — Feature flags
```

---

## DEPLOYMENT COMMANDS

### Restart Server
```powershell
Get-Process node | Stop-Process -Force
Start-Sleep -Seconds 2
cd C:\dev\nsc-qbank
node server.js
```

### Test Endpoints
```powershell
# v2 Wizard
Invoke-RestMethod -Uri "http://localhost:4000/api/v2/parser/status" -Method GET

# v1 CAPS
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/caps/subjects" -Method GET

# Legacy
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method GET
```

### Batch Processing
```powershell
$body = @{
    folder_path = "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\Question Papers"
    year_id = 1
    grade_id = 3
    assessment_type_id = 1
    assessment_body_id = 1
    create_production_items = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/api/v2/parser/batch" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 300
```

---

## GIT HISTORY

| Commit | Description |
|--------|-------------|
| f1bce29 | Implement Corporate API Versioning + Feature Flags |
| 98f5233 | Remove stale backend/routes/ duplicate directory |
| 4350a40 | Cleanup: Remove old parser scripts, backups, and duplicates |
| 8d8b4c1 | QBank Parser v30 - Four Parser Architecture |

---

## NEXT STEPS

### Immediate
1. **Test Batch Parser** — Process all 20+ papers in CAPS Documents folder
2. **Fix 6-mark variance** — Multi-line marks, 3x1 pattern
3. **Enable table extraction** — When PyMuPDF bug fixed

### Phase 3
4. **Review Workflow** — 3 levels: Peer → Expert → Moderator
5. **Items Page** — Verify imported items display correctly
6. **Other Subjects** — Maths, Physics, Geography, Life Sciences

---

## CRITICAL RULES (Updated)

1. **Verify with DESCRIBE before writing SQL**
2. **Surgical fixes only** — change only what's needed
3. **Use API versioning** — never share routes between features
4. **Use feature flags** — toggle without code changes
5. **Restart backend after every route change**
6. **No assumptions** — verify schema before every change
7. **Export router directly:** module.exports = router;
8. **Always use correct official codes from caps_subjects_master**
9. **Delete old data before re-seeding to avoid duplicates**
10. **Commit after every working change**

---

*End of Handover Note v31*
*Date: 2026-06-22 15:18 SAST*
*Next Session: Test Batch Parser + Fix 6-mark variance*
