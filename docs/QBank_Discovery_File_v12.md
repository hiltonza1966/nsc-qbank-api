# QBank Discovery File v12.0 — CAPS Topic Parser Refocus
**Generated:** 18 June 2026 13:34 SAST
**Updated By:** AI K2.6 Session — CAPS Parser Refocus
**Status:** MIGRATIONS 021 & 022 EXECUTED. BACKEND RUNNING. PARSER MOUNTED.
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** TBD (after commit)
**Node.js:** v24.14.0
**MySQL:** 8.0.45
**Backend Port:** 4000
**Frontend Port:** 3000
**Frontend URL:** http://localhost:3000/
**Database Password:** Hilton@66
**MySQL Path:** C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

---

## 1. SCHEMA STATE (Post-Migration 021 & 022)

### Migration 021: CAPS Topics Schema Alignment — EXECUTED ✅
| Change | Table | Column/Constraint | Status |
|--------|-------|-------------------|--------|
| ADD COLUMN | lookup_caps_topics | grade_number INT NULL | ✅ Added |
| ADD FK | caps_atp_content | fk_atp_caps_topic | ✅ Added |
| ADD UNIQUE | lookup_caps_topics | uk_topic_code | ✅ Added |
| ADD INDEX | lookup_caps_topics | idx_subject_grade | ✅ Added |
| ADD INDEX | caps_atp_content | idx_caps_topic_id | ✅ Added |

### Migration 022: Clear & Reset — EXECUTED ✅
| Table | Row Count | Status |
|-------|-----------|--------|
| item_caps_mapping | 0 | ✅ Cleared |
| lookup_caps_subtopics | 0 | ✅ Cleared |
| lookup_caps_topics | 0 | ✅ Cleared |
| paper_caps_constraints | 0 | ✅ Cleared |
| parse_expected_structure.caps_topic_id | 183 NULLs | ✅ Reset |
| item_master.caps_topic_id | 0 NULLs | ✅ Already empty |

### Foreign Keys on caps_atp_content (Verified)
| Constraint | Column | References | Status |
|------------|--------|------------|--------|
| fk_atp_caps_topic | caps_topic_id | lookup_caps_topics.topic_id | ✅ NEW |
| fk_atp_grade | grade | lookup_grades.grade_number | ✅ Existing |
| fk_atp_subject | subject_official_code | caps_subjects_master.subject_official_code | ✅ Existing |

---

## 2. CAPS PARSER REFOCUS (v1.0 FOCUSED)

### Scope
- **EXTRACT ONLY:** Topics and Subtopics from CAPS PDFs
- **TARGET TABLES:** lookup_caps_topics, lookup_caps_subtopics
- **NO LONGER SEEDS:** caps_atp_content, caps_poa_template, caps_subjects_master

### Topic Code Format
- **Standard:** {SUBJECT_SHORT}{GRADE_NUMBER}-{TOPIC_ABBREV}
- **Examples:** MATH12-SEQ, LIFE12-DNA, PHYS12-MECH, GEO12-ATM
- **Subtopic:** {TOPIC_CODE}-{SUBTOPIC_NUM} (e.g., MATH12-SEQ-01)

### Subject Short Codes
| Subject | Code |
|---------|------|
| Mathematics | MATH |
| Mathematical Literacy | MATHLIT |
| Technical Mathematics | TECHMATH |
| Physical Sciences | PHYS |
| Life Sciences | LIFE |
| Life Orientation | LIFEORI |
| Geography | GEO |
| History | HIST |
| Economics | ECON |
| Business Studies | BUS |
| Accounting | ACC |
| Technical Sciences | TECHSCI |

### Parser Sections
| Section | Source | Data Extracted |
|---------|--------|---------------|
| Section 2 | Overview of Topics | Topic names, strands, weightings |
| Section 3 | Annual Teaching Plans | Term assignments, time allocations, paper numbers |
| Section 4 | Assessment | Not used for topic extraction |

### Grade Mapping
| Grade Number | grade_id |
|--------------|----------|
| 10 | 1 |
| 11 | 2 |
| 12 | 3 |

---

## 3. DATA FLOW (Post-Refocus)

```
CAPS PDF
    |
    v
[CapsTopicParser] — Extracts topics/subtopics only
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
[Consumer Tables via FKs]
    — item_caps_mapping (topic_id, subtopic_id, strand_id)
    — item_master (caps_topic_id, caps_subtopic_id)
    — parse_expected_structure (caps_topic_id, caps_subtopic_id)
    — paper_caps_constraints (caps_topic_id)
```

---

## 4. API ENDPOINTS (New — Mounted at /api/caps)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | /api/caps/parse-topics | Upload PDF, extract topics/subtopics | ✅ Mounted |
| POST | /api/caps/seed-topics | Save extracted data to database | ✅ Mounted |
| GET | /api/caps/topics/:subject_code | Get all topics for a subject | ✅ Mounted |
| GET | /api/caps/subtopics/:topic_id | Get subtopics for a topic | ✅ Mounted |

**Existing endpoints still mounted:**
| POST | /api/caps/parse | Legacy CAPS PDF parser | ✅ Still mounted |
| GET | /api/caps/curriculum | Curriculum data | ✅ Still mounted |

---

## 5. FILES CHANGED (This Session)

| File | Action | Description | Status |
|------|--------|-------------|--------|
| database/migrations/021_caps_topics_schema_alignment.sql | NEW | Schema alignment | ✅ Executed |
| database/migrations/022_clear_caps_topics_data.sql | NEW | Data reset | ✅ Executed |
| backend/routes/capsTopicParser.js | NEW | Focused parser | ✅ Copied to routes/ |
| routes/capsTopicParser.js | COPIED | Route file for server.js | ✅ Mounted |
| server.js | MODIFIED | Added capsTopicParser route | ✅ Running |
| docs/QBank_Discovery_File_v12.md | UPDATE | This document | ✅ Updated |
| docs/QBank_Handover_v24.md | UPDATE | AI Handover | ✅ Updated |

---

## 6. CRITICAL RULES

1. Verify with INFORMATION_SCHEMA before writing SQL
2. Surgical fixes only — change only what's needed
3. Use .Contains() in PowerShell
4. Restart backend after every route change
5. Topic codes must be unique across all subjects
6. Grade linkage: lookup_caps_topics.grade_number maps to caps_atp_content.grade
7. No assumptions — verify schema before every change
8. Export router directly: module.exports = router; (not {router, Class})

---

## 7. NEXT STEPS (Pending)

1. **Commit to Git** — All changes ready for commit
2. **Test Parser** — Upload CAPS PDF, verify extraction
3. **Sandbox Testing** — Build harness in Python using available tools (PyPDF2, pdfminer)
4. **Seed First Subject** — Start with Mathematics
5. **Verify Integration** — Check consumer table linkages

---

*End of Discovery File v12.0*
*Date: 2026-06-18 13:34 SAST*
