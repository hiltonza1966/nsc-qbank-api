# Updated AI Handover Note v24
**Date:** 18 June 2026 13:34 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main
**Last Commit:** TBD (after this session)

---

## CURRENT STATUS

### Working ✅
- Parser API: POST /api/parser/parse → 200
- WizardPage.tsx integrated with parser API
- ParserReviewPanel.tsx (no MUI)
- Loaded Dashboard v22 mounted at /api/dashboard/loaded
- CAPS Linker CRUD page at /caps-linker
- caps_subjects_master: 29 rows (fully seeded)
- caps_atp_content: 5,536 rows (fully seeded)
- caps_poa_template: 2,784 rows (fully seeded)
- **Migration 021: EXECUTED** — Schema alignment complete
- **Migration 022: EXECUTED** — Data reset complete
- **capsTopicParser: MOUNTED** at /api/caps

### In Progress 🔄
- CAPS Topic/Subtopic Parser Refocus (v1.0 FOCUSED)
- Sandbox testing with PyPDF2/pdfminer
- Git commit pending

### Cleared & Ready for Seeding ✅
- lookup_caps_topics: 0 rows (CLEARED)
- lookup_caps_subtopics: 0 rows (CLEARED)
- item_caps_mapping: 0 rows (CLEARED)
- paper_caps_constraints: 0 rows (CLEARED)
- parse_expected_structure.caps_topic_id: 183 NULLs (RESET)
- item_master.caps_topic_id: 0 NULLs (ALREADY EMPTY)

---

## CRITICAL DECISIONS MADE (2026-06-18)

### 1. Topic Code Format
**Standard:** {SUBJECT_SHORT}{GRADE_NUMBER}-{TOPIC_ABBREV}
- Mathematics: MATH12-SEQ, MATH12-FUNC, MATH12-CALC1
- Life Sciences: LIFE12-DNA, LIFE12-MEIO, LIFE12-EVOL
- Geography: GEO12-ATM, GEO12-GEO, GEO12-POP

### 2. Grade Linkage
- **lookup_caps_topics.grade_id** → lookup_grades.grade_id (1,2,3)
- **lookup_caps_topics.grade_number** → NEW COLUMN (10,11,12) for alignment with caps_atp_content.grade
- **caps_atp_content.grade** → lookup_grades.grade_number (existing FK)
- **NEW FK:** caps_atp_content.caps_topic_id → lookup_caps_topics.topic_id

### 3. Parser Scope
- **EXTRACT ONLY:** Topics and subtopics from CAPS PDFs
- **NO LONGER SEEDS:** ATP, POA, subject_master (already populated)
- **TARGET:** lookup_caps_topics + lookup_caps_subtopics only

### 4. Data Reset
- Clear ALL existing topic/subtopic data
- Clear consumer table references (item_caps_mapping, parse_expected_structure, item_master, paper_caps_constraints)
- Repopulate from CAPS PDFs for all subjects

### 5. Router Export Pattern
- **CORRECT:** module.exports = router;
- **INCORRECT:** module.exports = { router, ClassName };
- safeRequire() checks: typeof route === 'function' || (route && route.use)

---

## NEXT SESSION PRIORITIES

1. **Commit to Git** — All changes ready for commit
2. **Test Parser** — Upload CAPS PDF, verify topic extraction
3. **Sandbox Testing** — Build Python harness with PyPDF2/pdfminer
4. **Seed First Subject** — Start with Mathematics (has existing data pattern)
5. **Verify Integration** — Check item_caps_mapping, item_master linkage

---

## FILES FOR NEXT SESSION

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| 021_caps_topics_schema_alignment.sql | database/migrations/ | Schema changes | ✅ Executed |
| 022_clear_caps_topics_data.sql | database/migrations/ | Data reset | ✅ Executed |
| capsTopicParser.js | routes/ | Focused parser | ✅ Mounted |
| QBank_Discovery_File_v12.md | docs/ | Updated discovery | ✅ Updated |
| QBank_Handover_v24.md | docs/ | This handover | ✅ Updated |

---

## CRITICAL RULES

1. Always verify schema with INFORMATION_SCHEMA before writing SQL
2. Surgical fixes only — change only what's needed
3. Test backend first — verify API with curl before frontend
4. Commit after each migration — maintain git history
5. No assumptions — verify all field names against actual schema
6. Use grade_number for alignment between lookup_caps_topics and caps_atp_content
7. Export router directly: module.exports = router;

---

## AVAILABLE PARSER TOOLS (System)

| Tool | Status | Use Case |
|------|--------|----------|
| PyPDF2 | ✅ Installed | Basic text extraction |
| pdfminer | ✅ Installed | Structured text extraction |
| tabula | ✅ Installed | Table extraction |
| pdftotext | ✅ Available | Command-line text extraction |
| tesseract | ✅ Available | OCR for scanned PDFs |
| pandas | ✅ Installed | Data processing |
| numpy | ✅ Installed | Numerical processing |
| docx | ✅ Installed | Word document processing |

---

*End of Handover Note v24*
*Date: 2026-06-18 13:34 SAST*
