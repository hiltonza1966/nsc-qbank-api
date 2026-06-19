# Updated AI Handover Note v27
**Date:** 19 June 2026 23:57 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev
sc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main
**Last Commit:** TBD (after this session)

---

## MAJOR ACHIEVEMENTS THIS SESSION

### 1. Language Parser Fixed ✅
- **Fixed caps_language_parser_v9.py** with correct subject_official_code from database
- **Corrected codes:** Changed from 1135xxxx to 1330xxxx (verified from caps_subjects_master)
- **Fixed grade_id FK:** Maps 10→1, 11→2, 12→3 (verified from lookup_grades)
- **Fixed topic_code uniqueness:** Now includes grade (ENGH02-10, ENGH02-11, ENGH02-12)
- **Fixed subtopic INSERT:** Removed grade_number (column does not exist in schema)
- **Added missing subjects:** SASL (13305954), French SAL (13352054), Mandarin SAL (13356044)
- **Fixed SASL detection:** Changed from 'SIGN' to 'SIGN LANGUAGE' to avoid matching DESIGN

### 2. Language Data Seeded ✅
- **34 language subjects** processed and seeded
- **442 topics** in lookup_caps_topics (34 subjects × 13 topics)
- **16,320 subtopics** in lookup_caps_subtopics (34 × 480)
- **16,320 ATP records** in caps_atp_content (34 × 480)
- **1,462 POA records** in caps_poa_template (34 × 43)
- All subjects use correct official_codes from database

### 3. Database Cleaned ✅
- **Deleted all old language data** with wrong codes (1135xxxx)
- **Verified clean state** before seeding
- **All 4 tables** populated correctly with no duplicates

---

## CURRENT DATABASE STATUS

### Table Counts
| Table | Count | Status |
|-------|-------|--------|
| caps_subjects_master | 123 | ✅ Complete |
| lookup_subjects | 123 | ✅ Complete |
| lookup_caps_topics | 1,934 | ✅ 61 subjects (27 + 34 languages) |
| lookup_caps_subtopics | 19,751 | ✅ Linked |
| caps_atp_content | 23,863 | ✅ 85 subjects |
| caps_poa_template | 3,615 | ✅ 73 subjects |

### Language Subjects Seeded (34 subjects)
| Subject | Official Code | Level | Topics | Subtopics | ATP | POA |
|---------|--------------|-------|--------|-----------|-----|-----|
| Afrikaans HL | 13301024 | A1 | 13 | 480 | 480 | 43 |
| Afrikaans FAL | 13311054 | A2 | 13 | 480 | 480 | 43 |
| Afrikaans SAL | 13351694 | B4 | 13 | 480 | 480 | 43 |
| English HL | 13301084 | A1 | 13 | 480 | 480 | 43 |
| English FAL | 13311114 | A2 | 13 | 480 | 480 | 43 |
| English SAL | 13351724 | B4 | 13 | 480 | 480 | 43 |
| IsiNdebele HL | 13301144 | A1 | 13 | 480 | 480 | 43 |
| IsiNdebele FAL | 13311174 | A2 | 13 | 480 | 480 | 43 |
| IsiNdebele SAL | 13351754 | B4 | 13 | 480 | 480 | 43 |
| IsiXhosa HL | 13301204 | A1 | 13 | 480 | 480 | 43 |
| IsiXhosa FAL | 13311234 | A2 | 13 | 480 | 480 | 43 |
| IsiXhosa SAL | 13351784 | B4 | 13 | 480 | 480 | 43 |
| IsiZulu HL | 13301264 | A1 | 13 | 480 | 480 | 43 |
| IsiZulu FAL | 13311294 | A2 | 13 | 480 | 480 | 43 |
| IsiZulu SAL | 13351814 | B4 | 13 | 480 | 480 | 43 |
| Sepedi HL | 13301324 | A1 | 13 | 480 | 480 | 43 |
| Sepedi FAL | 13311354 | A2 | 13 | 480 | 480 | 43 |
| Sepedi SAL | 13351844 | B4 | 13 | 480 | 480 | 43 |
| Sesotho HL | 13301384 | A1 | 13 | 480 | 480 | 43 |
| Sesotho FAL | 13311414 | A2 | 13 | 480 | 480 | 43 |
| Sesotho SAL | 13351874 | B4 | 13 | 480 | 480 | 43 |
| Setswana HL | 13301444 | A1 | 13 | 480 | 480 | 43 |
| Setswana FAL | 13311474 | A2 | 13 | 480 | 480 | 43 |
| Setswana SAL | 13351904 | B4 | 13 | 480 | 480 | 43 |
| SiSwati HL | 13301504 | A1 | 13 | 480 | 480 | 43 |
| SiSwati FAL | 13311534 | A2 | 13 | 480 | 480 | 43 |
| SiSwati SAL | 13351934 | B4 | 13 | 480 | 480 | 43 |
| Tshivenda HL | 13301574 | A1 | 13 | 480 | 480 | 43 |
| Tshivenda FAL | 13311604 | A2 | 13 | 480 | 480 | 43 |
| Tshivenda SAL | 13351964 | B4 | 13 | 480 | 480 | 43 |
| Xitsonga HL | 13301634 | A1 | 13 | 480 | 480 | 43 |
| Xitsonga FAL | 13311664 | A2 | 13 | 480 | 480 | 43 |
| Xitsonga SAL | 13351994 | B4 | 13 | 480 | 480 | 43 |
| French SAL | 13352054 | B4 | 13 | 480 | 480 | 43 |
| Mandarin SAL | 13356044 | B4 | 13 | 480 | 480 | 43 |

---

## CRITICAL FILES CREATED/UPDATED

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| caps_language_parser_v9.py | sandbox/ | Language parser with correct codes | ✅ Working |
| caps_language_parser_v8.py | sandbox/ | Previous version (wrong codes) | ⚠️ Superseded |
| combined_all_languages.sql | output_all_languages/ | All 34 language subjects | ✅ Executed |
| caps_language_parsed_results.json | output_all_languages/ | JSON output | ✅ Generated |

---

## KNOWN ISSUES (Updated)

### 1. Inflated Topic Counts ⚠️ (Still from v26)
Some non-language subjects have too many topics:
- ACCN: 263 topics (should be ~15)
- BSTD: 283 topics (should be ~15)
- MATH: 356 topics (should be ~20)
- LIFE: 290 topics (should be ~10)
- HOSP: 245 topics (should be ~15)

**Fix needed:** Better topic filtering in batch_caps_parser_v6

### 2. Physical Sciences POA Missing ⚠️ (Still from v26)
PHSC has 0 POA records

### 3. Mathematical Literacy POA Missing ⚠️ (Still from v26)
MLIT has 0 POA records

---

## NEXT SESSION PRIORITIES

1. **Fix Inflated Topic Counts** — Improve parser topic detection for non-language subjects
2. **Fix Missing POA** — Physical Sciences, Mathematical Literacy
3. **Commit to Git** — Save all parser scripts and SQL files
4. **Frontend Integration** — Build CAPS parser UI for language subjects
5. **Verify Integration** — Check capsLinker.js routes with new data

---

## CRITICAL RULES (Updated)

1. **Always use correct official codes** from caps_subjects_master (not assumptions)
2. **Verify schema** with DESCRIBE before writing SQL
3. **Surgical fixes only** — change only what's needed
4. **Test backend first** — verify API with curl before frontend
5. **Commit after each major change** — maintain git history
6. **No assumptions** — verify all field names against actual schema
7. **Use grade_number** for alignment between tables
8. **Link POA to topics** via topic_name, not just subject_code
9. **Check file existence** before requiring/copying
10. **Use relative paths** in route files, not absolute paths

---

## LANGUAGE SUBJECT OFFICIAL CODES (Verified)

| Alpha | Official Code | Name | Level |
|-------|--------------|------|-------|
| AFRHL | 13301024 | Afrikaans Home Language | A1 |
| AFRFA | 13311054 | Afrikaans First Additional Language | A2 |
| AFRSA | 13351694 | Afrikaans Second Additional Language | B4 |
| ENGHL | 13301084 | English Home Language | A1 |
| ENGFA | 13311114 | English First Additional Language | A2 |
| ENGSA | 13351724 | English Second Additional Language | B4 |
| NDBHL | 13301144 | IsiNdebele Home Language | A1 |
| NDBFA | 13311174 | IsiNdebele First Additional Language | A2 |
| NDBSA | 13351754 | IsiNdebele Second Additional Language | B4 |
| XHOHL | 13301204 | IsiXhosa Home Language | A1 |
| XHOFA | 13311234 | IsiXhosa First Additional Language | A2 |
| XHOSA | 13351784 | IsiXhosa Second Additional Language | B4 |
| ZULHL | 13301264 | IsiZulu Home Language | A1 |
| ZULFA | 13311294 | IsiZulu First Additional Language | A2 |
| ZULSA | 13351814 | IsiZulu Second Additional Language | B4 |
| SEPHL | 13301324 | Sepedi Home Language | A1 |
| SEPFA | 13311354 | Sepedi First Additional Language | A2 |
| SEPSA | 13351844 | Sepedi Second Additional Language | B4 |
| SESHL | 13301384 | Sesotho Home Language | A1 |
| SESFA | 13311414 | Sesotho First Additional Language | A2 |
| SESSA | 13351874 | Sesotho Second Additional Language | B4 |
| SETHL | 13301444 | Setswana Home Language | A1 |
| SETFA | 13311474 | Setswana First Additional Language | A2 |
| SETSA | 13351904 | Setswana Second Additional Language | B4 |
| SWAHL | 13301504 | SiSwati Home Language | A1 |
| SWAFA | 13311534 | SiSwati First Additional Language | A2 |
| SWASA | 13351934 | SiSwati Second Additional Language | B4 |
| TSVHL | 13301574 | Tshivenda Home Language | A1 |
| TSVFA | 13311604 | Tshivenda First Additional Language | A2 |
| TSVSA | 13351964 | Tshivenda Second Additional Language | B4 |
| XITHL | 13301634 | Xitsonga Home Language | A1 |
| XITFA | 13311664 | Xitsonga First Additional Language | A2 |
| XITSA | 13351994 | Xitsonga Second Additional Language | B4 |
| FRHSA | 13352054 | French Second Additional Language | B4 |
| MANSA | 13356044 | Mandarin Second Additional Language | B4 |

---

*End of Handover Note v27*
*Date: 2026-06-19 23:57 SAST*
*Prepared for: Next session continuation*
