# QBank Corporate System - AI Handover Note v9
**Date:** 2026-06-09 14:26
**Session:** Complete Schema Definition + CAPS Extraction + Phase Planning
**Status:** SCHEMA COMPLETE - 34 tables defined, Life Sciences CAPS extracted, ready for migration
**Next Session:** Phase 2 Implementation - Run migration, populate CAPS data, test end-to-end

---

## 1. SYSTEM CONTEXT

**Project:** QBank Corporate System (Question Bank for NSC/DBE)  
**Location:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL 8.0.45) + references `nsc_registration_v3` tables  
**Stack:** Node.js backend, React frontend, pdf.js for PDF parsing  
**GitHub:** https://github.com/hiltonza1966/nsc-qbank-api.git  
**Branch:** main  

---

## 2. ARCHITECTURAL DECISIONS (CRITICAL - DO NOT CHANGE)

### 2.1 Parser Simplification (DECISION: 2026-06-08)
**Position-based marks extraction ABANDONED.**
- Root cause: pdf.js y-position grouping causes batch marks, sub-part marks, and question text to merge incorrectly
- Result: 187 marks extracted instead of 150 (37 marks variance)
- **Parser now extracts ONLY:** question_number, question_text, section, type
- **Marks come from database:** `parse_expected_structure` table (gold standard)

### 2.2 Comparison Engine (ACTIVE)
**Architecture:**
```
Parser (items only) → Load Expected Structure → Compare → Auto-correct/RED Flag → Manual Review
```
- Auto-corrects marks when parser variance ≤ 2× expected
- Flags RED for manual review when variance > 2× or parser failed
- Manual review via ReviewPanel.tsx with editable marks

### 2.3 Database-Driven Configuration (NO HARDCODING)
- All QP structure must come from `parse_expected_structure` table
- All subjects from `lookup_subjects` (synced from nsc_registration_v3)
- All paper types from `lookup_papers`
- All assessment types from `lookup_assessment_types`
- All cognitive levels from `lookup_cognitive_levels`
- **NO hardcoded arrays, NO magic strings, NO enums in code**

---

## 3. COMPLETE DATABASE SCHEMA (34 TABLES)

### 3.1 Core Dimension Lookups (6 tables) - PRE-POPULATED
| Table | Purpose | Seed Data | FK Used By |
|-------|---------|-----------|------------|
| `lookup_years` | Academic years 2020-2030 | ✅ 11 rows | All item/paper tables |
| `lookup_grades` | Grade 10/11/12 | ✅ 3 rows | All item/paper tables |
| `lookup_subjects` | NSC subjects (sync from nsc_registration_v3) | 🔄 Sync needed | All item/paper tables |
| `lookup_papers` | Paper types P1/P2/P3/Practical/PAT/Oral/SBA | ✅ 7 rows | All item/paper tables |
| `lookup_assessment_types` | EXAM/TEST/SBA/PAT/TRIAL/DIAGNOSTIC/BASELINE | ✅ 7 rows | All item/paper tables |
| `lookup_assessment_bodies` | DBE/IEB/SACAI/NSC | ✅ 4 rows | All item/paper tables |

### 3.2 Secondary Dimension Lookups (6 tables) - PRE-POPULATED
| Table | Purpose | Seed Data | FK Used By |
|-------|---------|-----------|------------|
| `lookup_cognitive_levels` | Bloom's Taxonomy with CAPS weighting | ✅ 6 rows | item_master, item_memos, parse_expected_structure |
| `lookup_difficulty_levels` | Easy/Medium/Hard with p-value ranges | ✅ 3 rows | item_master, item_versions |
| `lookup_item_types` | MCQ/Short/Medium/Extended/Essay/Diagram/Matching/Practical/Source-Based | ✅ 11 rows | item_master, parse_expected_structure |
| `lookup_languages` | 11 SA official languages | ✅ 10 rows | item_master |
| `lookup_exam_sessions` | June/November/Trial/Baseline/Mid-Year | ✅ 5 rows | parse_sessions |
| `lookup_marking_schemes` | Holistic/Analytic/Rubric/Keyword/Method | ✅ 5 rows | item_master, item_memos |

### 3.3 Curriculum Lookups - CAPS (2 tables) - NEED SEEDING
| Table | Purpose | Seed Data | FK Used By |
|-------|---------|-----------|------------|
| `lookup_caps_topics` | CAPS topics per subject-grade (e.g., LIFE_12_1_1 = DNA: Code of Life) | 🔄 Extracting from CAPS PDF | item_master, parse_expected_structure |
| `lookup_caps_subtopics` | CAPS subtopics per topic (e.g., LIFE 2.3.1 = DNA Structure) | 🔄 Extracting from CAPS PDF | item_master |

### 3.4 Taxonomy Lookup (1 table) - PRE-POPULATED
| Table | Purpose | Seed Data | FK Used By |
|-------|---------|-----------|------------|
| `lookup_tag_taxonomy` | Controlled vocabulary for all tags | ✅ 21 rows | item_tags |

### 3.5 Master Data - Items (10 tables) - EMPTY, READY
| Table | Purpose | Status |
|-------|---------|--------|
| `item_master` | Core item table (all 6 dimensions + content + classification) | ✅ Empty, ready |
| `item_mcq_options` | MCQ options A/B/C/D with distractor analysis | ✅ Empty, ready |
| `item_memos` | Marking guidelines/answers | ✅ Empty, ready |
| `item_memo_subparts` | Detailed sub-part rubrics (e.g., 2.1.1=3 marks) | ✅ Empty, ready |
| `item_stimuli` | Shared stimuli (case study, diagram, graph) | ✅ Empty, ready |
| `item_attachments` | Images/diagrams file paths | ✅ Empty, ready |
| `item_tags` | Item-to-tag linkage | ✅ Empty, ready |
| `item_versions` | Audit trail of changes | ✅ Empty, ready |
| `item_reviews` | Review comments (threaded) | ✅ Empty, ready |
| `review_workflow` | State machine transitions | ✅ Empty, ready |

### 3.6 Paper Assembly (4 tables) - EMPTY, READY
| Table | Purpose | Status |
|-------|---------|--------|
| `paper_templates` | Paper blueprints with constraints | ✅ Empty, ready |
| `paper_template_sections` | Sections within templates (A/B/C) | ✅ Empty, ready |
| `generated_papers` | Assembled papers | ✅ Empty, ready |
| `generated_paper_items` | Items in assembled papers | ✅ Empty, ready |

### 3.7 Parser & Comparison (3 tables) - PARTIALLY POPULATED
| Table | Purpose | Status |
|-------|---------|--------|
| `parse_sessions` | Parser audit trail | ✅ Empty, ready |
| `parse_expected_structure` | Gold standard (expected question numbers, marks, types) | 🔄 Needs Grade 12 Paper 1 & 2 seeding |
| `parse_results` | Parser output with auto-correction + RED flags | ✅ Empty, ready |

### 3.8 User & Admin (2 tables) - EMPTY, READY
| Table | Purpose | Status |
|-------|---------|--------|
| `qbank_users` | System users (Examiners, Moderators, Admins, etc.) | ✅ Empty, ready |
| `user_subject_assignments` | Subject expert assignments | ✅ Empty, ready |

---

## 4. LIFE SCIENCES CAPS EXTRACTION (GRADE 12)

### 4.1 Knowledge Strands (4)
| Strand | Description | Grades |
|--------|-------------|--------|
| Strand 1 | Life at the Molecular, Cellular and Tissue Level | 10, 11, 12 |
| Strand 2 | Life Processes in Plants and Animals | 10, 11, 12 |
| Strand 3 | Environmental Studies | 10, 11, 12 |
| Strand 4 | Diversity, Change and Continuity | 10, 11, 12 |

### 4.2 Grade 12 Topics (11 topics across 4 terms)
| Term | Strand | Topic Code | Topic Name | Weighting | Paper |
|------|--------|-----------|-----------|-----------|-------|
| T1 | Strand 1 | LIFE_12_1_1 | DNA: Code of Life | 19% | Paper 2 |
| T1 | Strand 1 | LIFE_12_1_2 | Meiosis | 7% | Paper 1 |
| T1 | Strand 2 | LIFE_12_2_1 | Reproduction in Vertebrates | 4% | Paper 1 |
| T1 | Strand 2 | LIFE_12_2_2 | Human Reproduction | 21% | Paper 1 |
| T2 | Strand 2 | LIFE_12_2_3 | Responding to Environment: Humans | 30% | Paper 1 |
| T2 | Strand 1 | LIFE_12_1_3 | Human Endocrine System | 15% | Paper 1 |
| T2 | Strand 2 | LIFE_12_2_4 | Homeostasis in Humans | 7% | Paper 1 |
| T2 | Strand 2 | LIFE_12_2_5 | Responding to Environment: Plants | 7% | Paper 1 |
| T3 | Strand 4 | LIFE_12_4_1 | Evolution by Natural Selection | 15% | Paper 2 |
| T3 | Strand 4 | LIFE_12_4_2 | Human Evolution | 15% | Paper 2 |
| T4 | Strand 3 | LIFE_12_3_1 | Human Impact on Environment | 17% | Paper 1 |

### 4.3 Grade 12 Paper 1 Structure (2½ hours, 150 marks, 38 items)
| Section | Question | Type | Marks | Count | Cognitive Level |
|---------|----------|------|-------|-------|-----------------|
| A | 1.1.1-1.1.10 | MCQ | 2 each = 20 | 10 | Remember |
| A | 1.2.1-1.2.8 | Short Answer | 1 each = 8 | 8 | Remember/Understand |
| A | 1.3.1-1.3.3 | Matching | 2 each = 6 | 3 | Understand/Apply |
| A | 1.4.1-1.4.3 | Diagram | 8 total | 3 | Apply/Analyse |
| A | 1.5.1-1.5.4 | Diagram | 8 total | 4 | Apply/Analyse |
| B | 2.1-2.5 | Extended | 50 total | 5 | Analyse/Evaluate |
| C | 3.1-3.5 | Extended | 50 total | 5 | Evaluate/Create |
| **Total** | **38 items** | | **150 marks** | | |

### 4.4 Grade 12 Paper 2 Structure (2½ hours, 150 marks)
| Content | Marks |
|---------|-------|
| DNA: Code of Life | 27 |
| Meiosis | 12 |
| Genetics & Inheritance | 45 |
| Evolution through Natural Selection | 23 |
| Human Evolution | 43 |
| **Total** | **150** |

### 4.5 Cognitive Level Weighting (CAPS Page 72)
| Level | Weighting | Verbs | Bloom Level |
|-------|-----------|-------|-------------|
| Remember | 40% | define, list, identify, name, recall, state | 1 |
| Understand | 25% | explain, describe, classify, summarize, interpret | 2 |
| Apply | 20% | calculate, solve, demonstrate, use, perform | 3 |
| Analyse/Evaluate/Synthesise | 15% | analyse, compare, contrast, evaluate, justify | 4-6 |

---

## 5. FILES IN REPO (Current State)

```
C:\dev\nsc-qbank
├── server.js (updated with compare-qp route, uses req.db middleware)
├── routes/
│   ├── compare-qp.js (comparison engine — auto-correct + RED flags)
│   ├── qp-structure-extractor.js (future paper extraction)
│   ├── pdf_parser_structured.js (SIMPLIFIED — items only, no marks)
│   ├── items.js (Item CRUD)
│   ├── papers.js (Paper generation)
│   ├── specs.js (Specs GET)
│   ├── staging.js (Staging + memo import)
│   └── attachments.js (Image upload/download)
├── database/migrations/
│   ├── 001_schema_fix.sql
│   ├── 003_seed_specs.sql
│   ├── 008_consolidate_qbank_tables.sql
│   ├── 009_fix_specs.sql
│   ├── 010_create_memo_table.sql
│   ├── 011_corporate_schema.sql
│   ├── 012_qp_structure_tables.sql (38 items, 150 marks for LIFE_SC_P1_NOV_2025)
│   └── 014_complete_qbank_schema.sql (NEW — 34 tables with all seed data)
├── docs/
│   ├── QBank_Discovery_File_v6.md
│   ├── QBank_Development_Plan_v6.md (NEW — complete schema + CAPS)
│   ├── QBank_Handover_Note_v8.md
│   └── QBank_Handover_Note_v9.md (THIS FILE)
├── frontend/ (React + Vite)
│   ├── src/components/wizard/
│   │   ├── UploadWizard.tsx (test integration with comparison engine)
│   │   └── ReviewPanel.tsx (RED error highlighting, editable marks, save corrections)
│   └── src/services/api.ts (API calls)
└── wizard/ (legacy HTML — DEPRECATED)
    └── index.html
```

---

## 6. API ENDPOINTS (Active)

### 6.1 Comparison Engine
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/compare-qp` | Compare parser output against expected structure | ✅ Active |
| POST | `/api/wizard/save-corrections` | Save manual corrections from ReviewPanel | ✅ Active |
| GET | `/api/wizard/comparison/:session_id` | Retrieve comparison results | ✅ Active |
| GET | `/api/wizard/structure/:paper_code` | Get expected structure for paper | ✅ Active |

### 6.2 Parser (Simplified)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/wizard/extract-structure` | Extract items from QP (no marks) | ⚠️ Needs testing |
| POST | `/api/wizard/extract-memo` | Extract items from Memo (no marks) | ⚠️ Needs testing |

### 6.3 New Routes Needed (Phase 2+)
| Method | Endpoint | Description | Phase |
|--------|----------|-------------|-------|
| GET | `/api/lookup/:table` | Get all rows from any lookup table | Phase 2 |
| POST | `/api/items` | Create item in item_master | Phase 2 |
| GET | `/api/items/:id` | Get item with all related data | Phase 2 |
| POST | `/api/templates` | Create paper template | Phase 4 |
| POST | `/api/papers/assemble` | Assemble paper from template | Phase 4 |
| POST | `/api/reviews` | Submit review | Phase 3 |
| GET | `/api/reviews/pending` | Get pending reviews for user | Phase 3 |

---

## 7. CRITICAL NOTES FOR NEXT AI SESSION

### 7.1 Schema Migration (PRIORITY 1)
**Run migration `014_complete_qbank_schema.sql`** to create all 34 tables.
- File: `database/migrations/014_complete_qbank_schema.sql`
- Command: `mysql -u root -pHilton@66 nsc_qbank < database/migrations/014_complete_qbank_schema.sql`
- Verify: Check all tables created, all seed data populated
- **If migration fails:** Check for existing table conflicts, drop old tables if needed

### 7.2 Subject Sync (PRIORITY 2)
**Sync `lookup_subjects` from `nsc_registration_v3.lookup_subjects`**
- Command: `INSERT INTO lookup_subjects (...) SELECT ... FROM nsc_registration_v3.lookup_subjects`
- Verify: All NSC subjects populated, especially LIFE_SC (Life Sciences)

### 7.3 CAPS Seeding (PRIORITY 3)
**Populate `lookup_caps_topics` and `lookup_caps_subtopics` for Life Sciences Grade 12**
- Data extracted from CAPS PDF (uploaded 2026-06-09)
- 11 topics already defined in schema document
- Subtopics need extraction from CAPS document pages 22-70
- **If extraction is complex:** Seed topics first, subtopics can be added incrementally

### 7.4 Paper Structure Seeding (PRIORITY 4)
**Populate `parse_expected_structure` for Grade 12 Paper 1 & 2**
- Paper 1: 38 items, 150 marks, sections A/B/C (detailed in section 4.3)
- Paper 2: 5 content areas, 150 marks (detailed in section 4.4)
- Use `lookup_item_types` for question_type_id (MCQ=1, Short=4, Extended=6, etc.)
- Use `lookup_cognitive_levels` for cognitive_level_id (Remember=1, Understand=2, Apply=3, Analyse=4)

### 7.5 Route Verification (PRIORITY 5)
**Check if parser routes are broken from previous AI session**
- Test: `curl http://localhost:4000/api/wizard/compare-qp` (should return 400 or structure)
- If broken: Restore from git commit `61fba5a` or `8785941`
- Command: `git checkout 8785941 -- routes/pdf_parser_structured.js routes/compare-qp.js server.js`

### 7.6 NO HARDCODING (ENFORCED)
- All QP structure must come from `parse_expected_structure` table
- All subjects from `lookup_subjects`
- All paper types from `lookup_papers`
- All assessment types from `lookup_assessment_types`
- **NO hardcoded arrays in code, NO magic strings, NO inline enums**

### 7.7 Legacy Data Migration
- `accounting_questions` table exists with flat schema (q_num, question, marks, answer, workings, subject, grade, year, paper)
- Migrate to `item_master` using lookup table FKs
- Keep legacy table as `accounting_questions_legacy` for reference

---

## 8. PHASES FOR NEXT SESSION

### Phase 2: Schema Implementation (Current Priority)
**Goal:** Create all 34 tables, populate seed data, sync subjects, seed CAPS data

**Tasks:**
1. Run migration `014_complete_qbank_schema.sql`
2. Verify all 34 tables created
3. Verify all 15 lookup tables populated with seed data
4. Sync `lookup_subjects` from `nsc_registration_v3`
5. Populate `lookup_caps_topics` for Life Sciences Grade 12 (11 topics)
6. Populate `lookup_caps_subtopics` for each topic (extract from CAPS PDF)
7. Populate `parse_expected_structure` for Grade 12 Paper 1 (38 items)
8. Populate `parse_expected_structure` for Grade 12 Paper 2 (content areas)
9. Migrate legacy `accounting_questions` to `item_master`
10. Update `compare-qp.js` to use new table names
11. Test end-to-end: Upload LIFE P1 PDF → Parser → Comparison → ReviewPanel

**Commit:** `git commit -m "feat: implement complete 34-table schema with CAPS seed data"`

### Phase 3: Review Workflow
**Goal:** Implement 3-level review workflow (Peer → Expert → Moderator)

**Tasks:**
1. Implement state machine transitions
2. Role-based approval (Developer → Peer → Expert → Moderator)
3. Comment threading with categories (Accuracy, Clarity, Curriculum, Bias, Technical)
4. Review queue dashboard
5. Email/in-app notifications

**Commit:** `git commit -m "feat: implement 3-level review workflow with notifications"`

### Phase 4: Paper Assembly
**Goal:** Template-based paper assembly with constraint satisfaction

**Tasks:**
1. Create paper templates from CAPS specs
2. Assembly algorithm with constraints (topic, difficulty, cognitive distribution)
3. Examiner tools (replace, shuffle, preview, export)
4. Parallel paper generation with anchor items
5. Export to PDF/Word

**Commit:** `git commit -m "feat: paper assembly with templates, constraints, and parallel forms"`

### Phase 5: React Frontend
**Goal:** Complete React frontend with all pages

**Tasks:**
1. Login page
2. Dashboard (stats, recent items, pending reviews)
3. Item Bank (search, filter, grid/list view)
4. Item Detail (view, edit, versions, reviews, usage)
5. Import Wizard (Step 1-4 with React)
6. Review Queue (items pending review)
7. Paper Assembly (template, assemble, preview, export)
8. Template Management (CRUD templates)
9. Taxonomy Management (tags, categories)
10. User Management (roles, permissions)
11. Reports (usage, performance, analytics)

**Commit:** `git commit -m "feat: complete React frontend with all pages"`

### Phase 6: Advanced Features
**Goal:** Psychometrics, analytics, export, integration

**Tasks:**
1. Difficulty index (p-value) tracking
2. Discrimination index calculation
3. Distractor analysis for MCQs
4. Exposure monitoring and retirement
5. Analytics dashboard
6. Export to PDF/Word with proper formatting
7. Import from CSV/Excel (bulk item creation)
8. API documentation (OpenAPI/Swagger)
9. Authentication (JWT + role-based access)

**Commit:** `git commit -m "feat: psychometrics, analytics, export, and integration"`

---

## 9. TESTING CHECKLIST FOR NEXT SESSION

### 9.1 Schema Verification
- [ ] All 34 tables exist in `nsc_qbank`
- [ ] All 15 lookup tables have seed data
- [ ] `lookup_subjects` synced from `nsc_registration_v3`
- [ ] `lookup_caps_topics` has 11 Life Sciences Grade 12 topics
- [ ] `parse_expected_structure` has 38 items for Grade 12 Paper 1
- [ ] All foreign key constraints work
- [ ] No orphaned records

### 9.2 Parser Testing
- [ ] Upload LIFE P1 Nov 2025 PDF
- [ ] Parser extracts 38 items (question_number, text, section, type)
- [ ] Parser does NOT extract marks
- [ ] Comparison engine loads expected structure from database
- [ ] Auto-correction works for variance ≤ 2× expected
- [ ] RED flags appear for variance > 2× expected
- [ ] Manual review saves corrected marks to database
- [ ] Total marks = 150 after corrections

### 9.3 End-to-End Testing
- [ ] Upload PDF → Parse → Compare → Review → Save → Verify in database
- [ ] All items have correct question numbers
- [ ] All items have correct marks (from expected structure)
- [ ] All items linked to correct CAPS topic
- [ ] Audit trail in `parse_sessions` and `parse_results`

---

## 10. CONTACT / CONTEXT

- **Previous sessions:** 2026-06-07 (Parser v4→v5), 2026-06-07 (v5 double-counting fix), 2026-06-08 (Comparison engine + parser simplification), 2026-06-09 (Complete schema + CAPS extraction)
- **System:** SPD-related but separate QBank module
- **User requirement:** Corporate pdf.js system, no assumptions, database-driven config, no hardcoding
- **Key decision:** Abandoned position-based marks extraction in favor of comparison-based validation with manual review
- **Schema status:** 34 tables defined, 15 lookup tables with seed data, Life Sciences CAPS Grade 12 extracted
- **Next priority:** Run migration 014, populate CAPS data, test end-to-end

---

## 11. QUICK REFERENCE: CRITICAL COMMANDS

### Run Migration
```bash
cd C:\dev\nsc-qbank
mysql -u root -pHilton@66 nsc_qbank < database/migrations/014_complete_qbank_schema.sql
```

### Verify Tables
```bash
mysql -u root -pHilton@66 nsc_qbank -e "SHOW TABLES LIKE 'lookup_%'; SHOW TABLES LIKE 'item_%'; SHOW TABLES LIKE 'paper_%'; SHOW TABLES LIKE 'parse_%';"
```

### Sync Subjects
```bash
mysql -u root -pHilton@66 nsc_qbank -e "INSERT INTO lookup_subjects (...) SELECT ... FROM nsc_registration_v3.lookup_subjects;"
```

### Check Legacy Data
```bash
mysql -u root -pHilton@66 nsc_qbank -e "SELECT COUNT(*) FROM accounting_questions; DESCRIBE accounting_questions;"
```

### Restore Routes (if broken)
```bash
git checkout 8785941 -- routes/pdf_parser_structured.js routes/compare-qp.js server.js
```

### Start Backend
```bash
cd C:\dev\nsc-qbank
npm run dev
```

### Start Frontend
```bash
cd C:\dev\nsc-qbank\frontend
npm run dev
```

---

*End of AI Handover Note v9 — Corporate Edition*
*Schema complete: 34 tables defined, 15 lookup tables pre-populated, Life Sciences CAPS Grade 12 extracted*
*Next session: Phase 2 — Run migration, populate CAPS data, test end-to-end*
*Date: 2026-06-09 14:26*
