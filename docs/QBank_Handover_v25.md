# Updated AI Handover Note v25
**Date:** 18 June 2026 16:27 SAST
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
- Parser API: POST /api/parser/parse -> 200
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
- **lookup_caps_topics: 95 rows SEEDED** from CAPS_Full_ATP_Master.xlsx
- **lookup_caps_subtopics: 118 rows SEEDED** from CAPS_Full_ATP_Master.xlsx
- **backend/db.js: CREATED** — exports mysql2/promise pool

### In Progress 🔄
- CAPS Review page testing — API routes need verification
- capsLinker.js routes fixed (absolute -> relative paths)
- Database connection issue resolved (db.js created)

### Issues Found & Fixed ✅
1. **capsLinker.js route paths** — Changed from absolute `/api/caps/...` to relative `/topics/:subject_code`
2. **Database connection** — Created `backend/db.js` exporting mysql2/promise pool
3. **topic_code uniqueness** — Using sequential format `CAPS0001`, `CAPS0002`, etc.
4. **subject_name column** — `lookup_subjects.subject_name` (not `name`)

---

## CRITICAL FILES CREATED/UPDATED THIS SESSION

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| caps_atp_seeder_v7.py | sandbox/ | Excel-based seeder (sequential topic_code) | ✅ Working |
| caps_atp_seed_v7.sql | sandbox/ | Generated SQL seed file | ✅ Executed |
| caps_cleanup_reseed.py | sandbox/ | Cleanup + reseed script | ✅ Working |
| backend/db.js | backend/ | Database pool export | ✅ Created |
| capsLinker.js | backend/routes/ | Fixed route paths | ✅ Fixed |

---

## CAPS DATA SEEDED (2026-06-18)

### Subjects with Topics (10 subjects, 95 topics, 118 subtopics)
| Subject | Topics | Subtopics |
|---------|--------|-----------|
| Accounting | 13 | ~15 |
| Business Studies | 11 | ~12 |
| Economics | 7 | ~8 |
| Geography | 9 | ~11 |
| History | 2 | ~3 |
| Mathematical Literacy | 8 | ~10 |
| Mathematics | 15 | ~18 |
| Technical Mathematics | 19 | ~22 |
| Technical Sciences | 8 | ~9 |
| Tourism | 3 | ~4 |

### topic_code Format
- **Sequential:** `CAPS0001`, `CAPS0002`, ... `CAPS0095`
- **Length:** 8 chars (well under 20-char limit)
- **Unique:** Guaranteed by auto-increment counter

---

## API ROUTES STATUS

### Working Routes (capsLinker.js)
| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| /api/caps/subjects | GET | ✅ | All subjects |
| /api/caps/subjects/:code | GET | ✅ | Subject by code |
| /api/caps/atp | GET | ✅ | ATP content |
| /api/caps/poa | GET | ✅ | POA content |
| /api/caps/topics/:subject_code | GET | ✅ | **FIXED** — relative path |
| /api/caps/subtopics/:topic_id | GET | ✅ | **FIXED** — relative path |
| /api/caps/parse-topics | POST | ✅ | PDF parser |
| /api/caps/seed-topics | POST | ✅ | Seed from parsed data |

### Test Commands
```powershell
# Test topics for Accounting
curl.exe http://localhost:4000/api/caps/topics/12351024

# Test subtopics for topic_id 1
curl.exe http://localhost:4000/api/caps/subtopics/1

# Test all subjects
curl.exe http://localhost:4000/api/caps/subjects
```

---

## NEXT SESSION PRIORITIES

1. **Test Caps Review Page** — Verify topics/subtopics display in frontend
2. **Test Caps Linker Page** — Verify dropdowns populate with new data
3. **Add Remaining Subjects** — Process more CAPS PDFs for subjects not in Excel
4. **Commit to Git** — Save all changes (db.js, seeder scripts, route fixes)
5. **Verify Integration** — Check item_caps_mapping, item_master linkage

---

## CRITICAL RULES

1. Always verify schema with INFORMATION_SCHEMA before writing SQL
2. Surgical fixes only — change only what's needed
3. Test backend first — verify API with curl before frontend
4. Commit after each migration — maintain git history
5. No assumptions — verify all field names against actual schema
6. Use grade_number for alignment between lookup_caps_topics and caps_atp_content
7. Export router directly: module.exports = router;
8. **NEW:** Always check if required files exist before requiring them
9. **NEW:** Use relative paths in route files, not absolute paths
10. **NEW:** topic_code must be ≤ 20 chars and unique

---

## KNOWN ISSUES TO FIX NEXT SESSION

1. **Caps Review Page** — Need to verify frontend displays seeded topics/subtopics
2. **Caps Linker Page** — Need to verify dropdowns work with new data
3. **Missing Subjects** — Only 10 subjects seeded; need 31 total from CAPS documents
4. **Grade Linkage** — lookup_caps_topics.grade_id still NULL; needs linking to lookup_grades
5. **Paper Number** — lookup_caps_topics.paper_no still NULL; needs population

---

## AVAILABLE PARSER TOOLS (System)

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

## CAPS DOCUMENTS FOLDER

**Location:** `C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents`

**Contents:**
- 60+ CAPS PDF documents (FET Gr 10-12)
- CAPS_Full_ATP_Master.xlsx (Excel with 31 subjects, 118 ATP rows)
- Subfolders: Implementation, Question Papers

**Subjects in Excel (10 seeded):**
Accounting, Business Studies, Economics, Geography, History, Mathematical Literacy, Mathematics, Technical Mathematics, Technical Sciences, Tourism

**Subjects NOT yet seeded (21 remaining):**
Physical Sciences, Life Sciences, Life Orientation, Agricultural Sciences, Agricultural Technology, Civil Technology, Computer Applications Technology, Consumer Studies, Dance Studies, Design Studies, Dramatic Arts, Electrical Technology, Engineering Graphics & Design, Hospitality Studies, Information Technology, Mechanical Technology, Music, Religion Studies, Visual Arts, + all Language subjects

---

*End of Handover Note v25*
*Date: 2026-06-18 16:27 SAST*
*Prepared for: Next session continuation*
