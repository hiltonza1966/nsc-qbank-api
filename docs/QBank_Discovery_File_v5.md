# QBank Discovery File v4.0 — Corporate Edition
**Generated:** 8 June 2026 10:24 SAST
**Updated By:** AI K2.6 Session
**Status:** Comparison Engine Implemented
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev
sc-qbank
**Branch:** main
**Status:** Comparison Engine Complete — Parser Integration Pending

---

## 1. ARCHITECTURE OVERVIEW

- **Runtime:** Node.js 20, Express 4.19.2
- **Database:** MySQL 8.0.45 (not PostgreSQL)
- **Driver:** mysql2/promise 3.9.7
- **Port:** 4000
- **CORS:** Enabled for all origins
- **Cross-database reference:** `subject_structure` table lives in `nsc_registration_v3` only
- **Frontend:** Vanilla HTML/JS (migrating to React + TypeScript in Phase 5)
- **Image Storage:** Local filesystem (migrating to S3/MinIO in production)
- **PDF Parser:** Position-based extraction via pdf.js (NOT regex-based)

---

## 2. PARSER DISCOVERY — CRITICAL FINDINGS

### 2.1 Text Extraction Problem
**Issue:** `pdf-parse` and `pdf2json` produce garbled concatenated text from DBE PDFs.

**Example of extracted text:**
```
1.11.1.11.1.21.1.31.1.41.1.51.1.61.1.71.1.81.1.91.1.10C  A  D  A  C  D  B  D  B  A  (10x 2)(20)
```

**Expected text:**
```
1.1.1 The hormone that prepares the body for an emergency is ...
A aldosterone.
B progesterone.
C adrenalin.
D prolactin.
(10 x 2)(20)
```

### 2.2 Why Regex Fails
- Question numbers concatenated without spaces: `1.11.1.1` instead of `1.1 1.1.1`
- Marks embedded in text: `(10x 2)(201.21.2.1Progesterone`
- Section headers mixed with content: `SECTION A2025`
- No reliable whitespace or newline separation

### 2.3 Corporate Standard Solution
**Position-based parsing using pdf.js `getTextContent()`:**
- Each text item has: `str` (text), `transform` (position matrix), `width`, `height`, `fontName`
- Sort by Y position (top to bottom) then X position (left to right)
- Detect sections by font size changes (SECTION A/B/C are larger/bolder)
- Identify question numbers by consistent left indentation
- Extract marks by right-aligned position near question numbers

---

## 3. DATABASE SCHEMA (Current)

### 3.1 Table Row Counts (as of 2026-06-07 20:08)

| Table | Rows | Purpose |
|-------|------|---------|
| qbank_items_staging | 0 | Cleared for testing |
| qbank_items | 6 | Live approved items |
| qbank_item_memos | 0 | Cleared for testing |
| qbank_item_tags | 0 | Live item tags |
| qbank_item_curriculum | 0 | Live curriculum links |
| qbank_items_staging_tags | 0 | Draft tags |
| qbank_items_staging_curriculum | 0 | Draft curriculum |
| qbank_papers | 4 | Generated papers |
| qbank_paper_items | 3 | Paper-item associations |
| qbank_paper_specs | 4 | Paper specifications |
| qbank_users | 0 | System users |
| QB_questionP_Structure | 38 | Expected QP structure (gold standard) |
| QB_parsed_results | 76 | Parser output with auto-correction |
| QB_parse_sessions | 2 | Audit trail for parse runs |
| question_reviews | 0 | Review workflow (legacy) |
| accounting_questions | 10 | Pre-QBank legacy |
| questions | 3 | Pre-QBank legacy |

### 3.2 Migration Status
| Migration | Status | Notes |
|-----------|--------|-------|
| 001_schema_fix.sql | ✅ Applied | |
| 003_seed_specs.sql | ✅ Applied | |
| 008_consolidate_qbank_tables.sql | ✅ Applied | |
| 009_fix_specs.sql | ✅ Applied | |
| 010_create_memo_table.sql | ✅ Applied | |
| 011_corporate_schema.sql | ✅ Applied | Added attachments table, item_type column |

---

## 4. EXPECTED PARSER OUTPUT (LIFE P1 Nov 2025)

### 4.1 Question Paper Structure
| Section | Question | Type | Marks | Notes |
|---------|----------|------|-------|-------|
| A | 1.1.1-1.1.10 | MCQ | 2 each = 20 | 10 questions |
| A | 1.2.1-1.2.8 | Short | 1 each = 8 | 8 questions |
| A | 1.3.1-1.3.3 | Matching | 2 each = 6 | 3 questions |
| A | 1.4.1-1.4.3 | Diagram | 8 total | With sub-parts (a)(b)(c) |
| A | 1.5.1-1.5.4 | Diagram | 8 total | With sub-parts (a)(b)(c) |
| B | 2.1 | Extended | 8 | Sub-parts: 2.1.1(3), 2.1.2(3), 2.1.3(2) |
| B | 2.2 | Extended | 11 | Sub-parts: 2.2.1(2), 2.2.2(2), 2.2.3(5), 2.2.4(2) |
| B | 2.3 | Extended | 14 | Sub-parts: 2.3.1(3), 2.3.2(2), 2.3.3(1), 2.3.4(6) |
| B | 2.4 | Extended | 6 | Sub-parts: 2.4.1(1), 2.4.2(1), 2.4.3(4) |
| B | 2.5 | Extended | 11 | Sub-parts: 2.5.1(1), 2.5.2(3), 2.5.3(2), 2.5.4(3), 2.5.5(2) |
| C | 3.1 | Extended | 8 | Sub-parts: 3.1.1(1), 3.1.2(1), 3.1.3(1), 3.1.4(3) |
| C | 3.2 | Extended | 13 | Sub-parts: 3.2.1(1), 3.2.2(6), 3.2.3(6) |
| C | 3.3 | Extended | 5 | Single item |
| C | 3.4 | Extended | 14 | Sub-parts: 3.4.1(2), 3.4.2(2), 3.4.3(5), 3.4.4(5) |
| C | 3.5 | Extended | 10 | Sub-parts: 3.5.1(1), 3.5.2(1), 3.5.3(5), 3.5.4(2), 3.5.5(2) |
| **Total** | **38 items** | | **150 marks** | |

### 4.2 Memo Structure (Same 63 items, with marking guidelines)
- Each item linked by question_number
- Sub-parts have individual marks and answers
- Parent totals match QP totals

---

## 5. PARSER IMPLEMENTATION STATUS

### 5.1 Current Implementation (Comparison Engine Added)
| Component | Approach | Status |
|-----------|----------|--------|
| Text Extraction | pdf-parse + pdf2json | ❌ Produces garbled text |
| Question Detection | Regex on flat text | ❌ Fails on concatenated numbers |
| Marks Extraction | Regex on flat text | ❌ All default to 1 or 0 |
| Section Detection | Regex on flat text | ❌ All show Section A |
| Parent-Child | Regex grouping | ❌ Produces 49 items instead of 38 |
| **Comparison Engine** | **Database-driven validation** | **✅ Auto-corrects + RED flags** |
| **Manual Review UI** | **React + RED highlighting** | **✅ Editable marks + save** |

### 5.2 Parser Integration (Next Phase)
| Component | Approach | Status |
|-----------|----------|--------|
| Text Extraction | pdf.js getTextContent() | 🔄 Next Phase |
| Layout Analysis | Position-based sorting | 🔄 Pending |
| Question Detection | Position + font analysis | 🔄 Pending |
| Marks Extraction | Position-based (right-aligned) | 🔄 Pending |
| Section Detection | Font size changes | 🔄 Pending |
| Parent-Child | Question number hierarchy | 🔄 Pending |

---

## 6. FILE STRUCTURE (Updated)

```
C:\dev
sc-qbank
├── .env                          (98 bytes)
├── .env.example                  (94 bytes)
├── .gitignore                    (70 bytes)
├── COMMIT_LOG.md                 (1062 bytes)
├── README.md                     (259 bytes)
├── VERSION.txt                   (182 bytes)
├── package.json                  (Updated with pdf-parse)
├── package-lock.json             (Updated)
├── server.js                     (Updated with attachments route)
├── server.log                    (198 bytes)
│
├── backend/
│   └── routes/
│       ├── qbank.js              (Legacy)
│       └── qbank_1.js            (Legacy)
│
├── database/migrations/
│   ├── 001_schema_fix.sql
│   ├── 003_seed_specs.sql
│   ├── 008_consolidate_qbank_tables.sql
│   ├── 009_fix_specs.sql
│   ├── 010_create_memo_table.sql
│   └── 011_corporate_schema.sql  (NEW)
│
├── docs/
│   ├── AI_Handover_Note_v4.md    (THIS UPDATE)
│   ├── QBank_Development_Plan_Corporate_v3.md
│   ├── QBank_Discovery_File_v4.md (THIS FILE)
│   └── ...
│
├── routes/
│   ├── items.js                  (Item CRUD)
│   ├── papers.js                 (Paper generation)
│   ├── pdf_parser_structured.js  (Position-based parser - CURRENT)
│   ├── compare-qp.js             (NEW - Comparison engine)
│   ├── qp-structure-extractor.js (NEW - Future paper extraction)
│   ├── specs.js                  (Specs GET)
│   ├── staging.js                (Staging + memo import)
│   └── attachments.js            (Image upload/download)
│
├── frontend/                     (NEW - React + Vite)
│   ├── src/components/wizard/
│   │   ├── UploadWizard.tsx      (Test integration)
│   │   └── ReviewPanel.tsx       (RED error highlighting)
│   └── src/services/api.ts       (API calls)
│
├── wizard/
│   ├── index.html                (NEEDS REWRITE - position-based extraction)
│   └── README.txt
│
└── uploads/                      (Image storage)
```

---

## 7. NEXT STEPS

### 7.1 Immediate Actions
1. Rewrite `wizard/index.html` to use `pdf.js getTextContent()` for text extraction
2. Add position-based text sorting and layout analysis
3. Rewrite `routes/pdf_parser.js` to accept structured text with positions
4. Test with LIFE P1 PDF to verify 38 items / 150 marks

### 7.2 Testing Criteria
| Test | Expected | Pass Criteria |
|------|----------|---------------|
| QP Item Count | 63 | Exactly 63 items |
| QP Marks Total | 150 | Exactly 150 marks |
| Memo Item Count | 63 | Exactly 63 items |
| Memo Marks Total | 150 | Exactly 150 marks |
| Section Detection | A/B/C | Correct sections assigned |
| Marks Per Item | Varies | Correct marks for each item |
| Question Linking | By number | QP and Memo items match |

---

*End of Discovery File v4.0 — Corporate Edition*
*Parser approach changed from regex to position-based*
*Corporate standard identified and documented*
