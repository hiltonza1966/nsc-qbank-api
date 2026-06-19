# Updated AI Handover Note v26
**Date:** 19 June 2026 10:47 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main
**Last Commit:** TBD (after this session)

---

## MAJOR ACHIEVEMENTS THIS SESSION

### 1. Subject Foundation Rebuilt ✅
- **Rebuilt caps_subjects_master** with 123 subjects using CORRECT official codes from authoritative CSV
- **Rebuilt lookup_subjects** with 123 subjects
- **Added columns:** subject_name_afr, subject_group to both tables
- **Fixed corrupted data** from previous session (wrong official codes)

### 2. CAPS Topics Extracted ✅
- **27 subjects** processed from CAPS PDFs
- **1,492 topics** in lookup_caps_topics
- **Correct subject_official_code** linkage to caps_subjects_master
- **Topic codes:** Sequential format per subject (e.g., PHSC01, PHSC02...)

### 3. CAPS Subtopics Extracted ✅
- **3,431 subtopics** in lookup_caps_subtopics
- **Linked to topics** via topic_id foreign key
- **Proper grade_number** alignment

### 4. ATP Data Extracted ✅
- **7,543 ATP records** in caps_atp_content
- **Extracted from Section 3** of CAPS documents
- **Term, week_range, topic, subtopic** data captured
- **51 subjects** have ATP data

### 5. POA Data Extracted ✅
- **2,153 POA records** in caps_poa_template
- **Extracted from Section 4** of CAPS documents
- **Term, week_range, assessment_type, weight, cognitive_level** captured
- **Linked to topics/subtopics** via topic_name and subtopic_name

### 6. Parsers Built ✅
- **batch_caps_parser_v6.py** — Topic/subtopic extractor with correct codes
- **atp_poa_extractor.py** — ATP/POA extractor
- **poa_extractor_v3.py** — POA with proper topic linkage
- All parsers saved in sandbox/

---

## CURRENT DATABASE STATUS

### Table Counts
| Table | Count | Status |
|-------|-------|--------|
| caps_subjects_master | 123 | ✅ Complete |
| lookup_subjects | 123 | ✅ Complete |
| lookup_caps_topics | 1,492 | ✅ 27 subjects |
| lookup_caps_subtopics | 3,431 | ✅ Linked |
| caps_atp_content | 7,543 | ✅ 51 subjects |
| caps_poa_template | 2,153 | ✅ 39 subjects |

### Subjects with Complete Data (Topics + Subtopics + ATP + POA)
| Subject | Topics | Subtopics | ATP | POA |
|---------|--------|-----------|-----|-----|
| Accounting (ACCN) | 263 | 107 | 261 | 56 |
| Business Studies (BSTD) | 283 | 175 | 517 | 66 |
| Economics (ECON) | 195 | 105 | 135 | 97 |
| Geography (GEOG) | 163 | 135 | 163 | 135 |
| Hospitality (HOSP) | 245 | 228 | 643 | 46 |
| Life Orientation (LIFE) | 290 | 277 | 290 | 277 |
| Mathematics (MATH) | 356 | 215 | 356 | 215 |
| Physical Sciences (PHSC) | 19 | 0 | 556 | 0 |
| Tourism (TRSM) | 245 | 220 | 501 | 51 |
| + 17 more subjects | ... | ... | ... | ... |

---

## CRITICAL FILES CREATED/UPDATED

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| batch_caps_parser_v6.py | sandbox/ | Topic/subtopic extractor | ✅ Working |
| atp_poa_extractor.py | sandbox/ | ATP/POA extractor | ✅ Working |
| poa_extractor_v3.py | sandbox/ | POA with topic linkage | ✅ Working |
| rebuild_subjects_from_csv.sql | repo/ | Rebuild subjects with correct codes | ✅ Executed |
| complete_rebuild_v2.sql | repo/ | Add columns + rebuild | ✅ Executed |
| fix_actual_schema.sql | repo/ | Fix schema with correct columns | ✅ Executed |
| import_all_v6_fixed.sql | repo/ | Import v6 topics+subtopics | ✅ Executed |
| import_atp_poa.sql | repo/ | Import ATP/POA | ✅ Executed |
| import_poa_v3.sql | repo/ | Import v3 POA | ✅ Executed |
| Subject Structure - NSC CAPS 2025_Updated.csv | uploads/ | Authoritative subject codes | ✅ Used |

---

## KNOWN ISSUES TO FIX

### 1. Inflated Topic Counts ⚠️
Some subjects have too many topics (parser treating every line as topic):
- ACCN: 263 topics (should be ~15)
- BSTD: 283 topics (should be ~15)
- MATH: 356 topics (should be ~20)
- LIFE: 290 topics (should be ~10)
- HOSP: 245 topics (should be ~15)

**Fix needed:** Better topic filtering in parser

### 2. Language PDFs Not Processed ⚠️
12 language subjects have 0 topics:
- Afrikaans HL/FAL, isiXhosa HL/FAL, isiZulu HL/FAL, Sepedi HL/FAL, Sesotho HL/FAL, Setswana HL/FAL, SiSwati HL/FAL, Tshivenda HL/FAL, Xitsonga HL/FAL, isiNdebele HL/FAL

**Fix needed:** Language-independent parser (structural/table-based)

### 3. Physical Sciences POA Missing ⚠️
PHSC has 0 POA records (Section 4 not found in scan range)

**Fix needed:** Extend scan range or use different detection strategy

### 4. Mathematical Literacy POA Missing ⚠️
MLIT has 0 POA records

**Fix needed:** Check PDF structure

### 5. Grade Linkage ⚠️
lookup_caps_topics.grade_id still NULL (column may not exist)
grade_number is populated but grade_id FK needs verification

---

## NEXT SESSION PRIORITIES

1. **Fix Inflated Topic Counts** — Improve parser topic detection
2. **Process Language PDFs** — Build language-independent parser
3. **Fix Missing POA** — Physical Sciences, Mathematical Literacy
4. **Frontend Integration** — Build CAPS parser UI
5. **Commit to Git** — Save all parser scripts and SQL files
6. **Verify Integration** — Check capsLinker.js routes with new data

---

## PARSER FILES LOCATION

**All parsers:** `C:\dev\nsc-qbank\sandbox\`
- batch_caps_parser_v6.py
- atp_poa_extractor.py
- poa_extractor_v3.py
- generate_subtopics.py
- fix_subtopics.py
- fix_poa_null.py

**Generated SQL:** `C:\dev\nsc-qbank\`
- caps_v6_*_topics.sql (27 files)
- caps_v6_*_subtopics.sql (26 files, no PHSC)
- atp_*.sql (51 files)
- poa_v3_*.sql (39 files)

**CAPS Documents:** `C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents`

---

## CRITICAL RULES (Updated)

1. **Always use correct official codes** from Subject Structure CSV
2. **Verify schema** with INFORMATION_SCHEMA before writing SQL
3. **Surgical fixes only** — change only what's needed
4. **Test backend first** — verify API with curl before frontend
5. **Commit after each major change** — maintain git history
6. **No assumptions** — verify all field names against actual schema
7. **Use grade_number** for alignment between tables
8. **Link POA to topics** via topic_name, not just subject_code
9. **Check file existence** before requiring/copying
10. **Use relative paths** in route files, not absolute paths

---

## AVAILABLE PARSER TOOLS

| Tool | Status | Use Case |
|------|--------|----------|
| PyPDF2 | ✅ Installed | Basic text extraction |
| pdfminer | ✅ Installed | Structured text extraction |
| tabula | ✅ Available | Table extraction |
| pdftotext | ✅ Available | Command-line text extraction |
| tesseract | ✅ Available | OCR for scanned PDFs |
| pandas | ✅ Installed | Data processing |
| numpy | ✅ Installed | Numerical processing |
| docx | ✅ Installed | Word document processing |
| easyocr | ✅ Installed | Python OCR (no admin needed) |
| pymupdf | ✅ Installed | PDF rendering for OCR |
| Pillow | ✅ Installed | Image processing |

---

## SUBJECT OFFICIAL CODES (Key Subjects)

| Alpha | Official Code | Name |
|-------|--------------|------|
| ACCN | 12351024 | Accounting |
| BSTD | 12351054 | Business Studies |
| ECON | 12351084 | Economics |
| GEOG | 16351054 | Geography |
| HIST | 16351084 | History |
| LIFE | 16341024 | Life Orientation |
| RLGS | 16351114 | Religion Studies |
| MATH | 19331054 | Mathematics |
| MLIT | 19321024 | Mathematical Literacy |
| TMAT | 19371504 | Technical Mathematics |
| PHSC | 19351114 | Physical Sciences |
| LFSC | 19351084 | Life Sciences |
| TSCE | 19351534 | Technical Sciences |
| CATN | 19351024 | Computer Applications Technology |
| INFT | 19351054 | Information Technology |
| CNST | 20351024 | Consumer Studies |
| HOSP | 20351054 | Hospitality Studies |
| TRSM | 20351084 | Tourism |
| AGRS | 10351054 | Agricultural Sciences |
| AGRM | 10351024 | Agricultural Management Practices |
| AGRT | 10351084 | Agricultural Technology |
| DNCE | 11351024 | Dance Studies |
| DSGN | 11351054 | Design |
| DRMA | 11351084 | Dramatic Arts |
| MUSC | 11351114 | Music |
| VSLA | 11351144 | Visual Arts |
| GRDS | 15351114 | Engineering Graphics and Design |
| CVTC | 15351264 | Civil Technology (Construction) |
| ELTP | 15351354 | Electrical Technology (Power Systems) |
| MCTA | 15351444 | Mechanical Technology (Automotive) |

---

*End of Handover Note v26*
*Date: 2026-06-19 10:47 SAST*
*Prepared for: Next session continuation*
