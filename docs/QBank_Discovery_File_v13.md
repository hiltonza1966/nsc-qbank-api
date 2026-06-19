# QBank Discovery File v13.0 — Language Parser Complete
**Generated:** 19 June 2026 23:57 SAST
**Updated By:** AI K2.6 Session — Language Parser Fix & Seed
**Status:** LANGUAGE PARSER v9 WORKING. ALL 34 LANGUAGE SUBJECTS SEEDED.
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev
sc-qbank
**Branch:** main
**Git HEAD:** TBD (after commit)
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0in\mysql.exe

---

## 1. SCHEMA STATE (Post-Language Seed)

### Language Data Seeded — COMPLETE ✅
| Table | Count | Status |
|-------|-------|--------|
| lookup_caps_topics | 1,934 | ✅ 61 subjects (27 + 34 languages) |
| lookup_caps_subtopics | 19,751 | ✅ Linked |
| caps_atp_content | 23,863 | ✅ 85 subjects |
| caps_poa_template | 3,615 | ✅ 73 subjects |

### Language Subjects (34 subjects, 442 topics)
All 34 language subjects seeded with correct official_codes from caps_subjects_master:
- 11 Home Language (A1) subjects
- 11 First Additional Language (A2) subjects
- 10 Second Additional Language (B4) subjects
- 1 French SAL (B4)
- 1 Mandarin SAL (B4)

---

## 2. LANGUAGE PARSER v9

### Fixes from v8
| Fix | Description | Status |
|-----|-------------|--------|
| Correct codes | Changed 1135xxxx → 1330xxxx from database | ✅ |
| grade_id FK | Maps 10→1, 11→2, 12→3 | ✅ |
| Unique topic_code | Added grade suffix (ENGH02-10, ENGH02-11, ENGH02-12) | ✅ |
| Subtopic schema | Removed grade_number (column doesn't exist) | ✅ |
| Missing subjects | Added SASL, French SAL, Mandarin SAL | ✅ |
| SASL detection | Fixed 'SIGN' → 'SIGN LANGUAGE' to avoid DESIGN match | ✅ |

### Parser Output
| Data Type | Per Subject | Total (34 subjects) |
|-----------|-------------|---------------------|
| Topics | 13 | 442 |
| Subtopics | 480 | 16,320 |
| ATP | 480 | 16,320 |
| POA | 43 | 1,462 |

### Language Skills (4 per grade)
1. Listening and Speaking
2. Reading and Viewing
3. Writing and Presenting
4. Language Structures and Conventions

---

## 3. DATA FLOW (Language Subjects)

```
CAPS Language PDF
    |
    v
[CAPSLanguageParser v9] — Extracts topics/subtopics/ATP/POA
    |
    v
lookup_caps_topics (topic_id, subject_official_code, grade_id, grade_number,
                    strand, term, topic_code, topic_name, topic_weighting,
                    time_weeks, paper_no, description, is_active, display_order)
    |
    v
lookup_caps_subtopics (subtopic_id, topic_id, subtopic_code, subtopic_name,
                       description, is_active, display_order)
    |
    v
caps_atp_content (content_id, subject_official_code, subject_alpha_code,
                  subject_name, grade, term, week_range, paper_no, paper_code,
                  topic, subtopic, caps_topic_id, caps_ref, source_url)
    |
    v
caps_poa_template (poa_id, subject_official_code, subject_alpha_code,
                   subject_name, grade, term, week_range, paper_no, paper_code,
                   topic, subtopic, programme_of_assessment, weight_sba_pct,
                   cognitive_level, caps_ref, source_url)
```

---

## 4. API ENDPOINTS (Unchanged from v12)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | /api/caps/parse-topics | Upload PDF, extract topics/subtopics | ✅ Mounted |
| POST | /api/caps/seed-topics | Save extracted data to database | ✅ Mounted |
| GET | /api/caps/topics/:subject_code | Get all topics for a subject | ✅ Mounted |
| GET | /api/caps/subtopics/:topic_id | Get subtopics for a topic | ✅ Mounted |

---

## 5. FILES CHANGED (This Session)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| caps_language_parser_v9.py | NEW | Corrected language parser | ✅ Working |
| caps_language_parser_v8.py | ARCHIVED | Previous version (wrong codes) | ⚠️ Superseded |
| combined_all_languages.sql | NEW | All 34 language subjects | ✅ Executed |
| caps_language_parsed_results.json | NEW | JSON output | ✅ Generated |

---

## 6. CRITICAL RULES (Updated)

1. Verify with DESCRIBE before writing SQL
2. Surgical fixes only — change only what's needed
3. Use .Contains() in PowerShell
4. Restart backend after every route change
5. Topic codes must be unique across all subjects
6. Grade linkage: lookup_caps_topics.grade_number maps to caps_atp_content.grade
7. No assumptions — verify schema before every change
8. Export router directly: module.exports = router; (not {router, Class})
9. **Always use correct official codes from caps_subjects_master**
10. **Delete old data before re-seeding to avoid duplicates**

---

## 7. NEXT STEPS (Pending)

1. **Commit to Git** — All changes ready for commit
2. **Fix Inflated Topic Counts** — Non-language subjects (ACCN, BSTD, MATH, LIFE, HOSP)
3. **Fix Missing POA** — Physical Sciences, Mathematical Literacy
4. **Frontend Integration** — Build CAPS parser UI for language subjects
5. **Verify Integration** — Check capsLinker.js routes with new data

---

*End of Discovery File v13.0*
*Date: 2026-06-19 23:57 SAST*
