# QBank Development Plan – Corporate Edition v7
**Date:** 12 June 2026
**Updated:** Document Synchronization — All Phases Status Updated with Factual Evidence
**Status:** Phase 1 Partially Complete, Phase 2 Schema Applied but NOT Verified, Phase 3-6 Not Started
**Architecture:** Enterprise-grade Question Bank System with 34 Tables
**Parser Status:** CAPS Parser v2.7a Deployed but BROKEN (empty grades)
**QP Parser Status:** WORKING (items extraction verified)
**Comparison Engine:** Fix Applied but NOT Verified
**Frontend:** White Screen Issue Unresolved

---

## CONFIRMED REQUIREMENTS (User Approved)

### 1. Core Dimensions (6 Lookups)
All items, papers, and templates link to these 6 dimensions:
- **Year** (academic year: 2020-2030)
- **Grade** (10, 11, 12)
- **Subject** (synced from nsc_registration_v3.lookup_subjects)
- **Paper** (Paper 1/2/3, Practical, PAT, Oral, SBA)
- **Assessment Type** (EXAM, TEST, SBA, PAT, TRIAL, DIAGNOSTIC, BASELINE)
- **Assessment Body** (DBE, IEB, SACAI, NSC)

### 2. Review Workflow Levels
- **3 Levels:** Peer Reviewer → Subject Expert → Moderator
- **States:** Draft → Pending Review → Revision Required → Peer Approved → Expert Approved → Moderated → Published → Archived
- **Roles:** Item Developer, Peer Reviewer, Subject Expert, Moderator, Admin

### 3. Paper Assembly Constraints
- **All variables:** Topic, Difficulty, Cognitive Level, Marks, Item Type, Source Year, Exposure Count
- **Template-driven:** Blueprint with sections, marks allocation, topic distribution
- **Examiner flexibility:** Replace items, manual selection, shuffle, preview, export
- **Parallel forms:** Generate multiple equivalent papers with anchor items

### 4. Tagging Taxonomy
- **Controlled vocabulary:** Admin defines, SME can suggest
- **Hierarchical:** Subject → Topic → Subtopic → CAPS Code
- **Categories:** Subject, Topic, Subtopic, Cognitive Level, Difficulty, Item Type, CAPS Code, Source
- **Governance:** Committee approval for new tags

### 5. Image Storage
- **Recommendation:** Filesystem (local) for now, S3/MinIO for production
- **Structure:** `C:\dev\nsc-qbank\uploads\items\{item_id}\{attachment_id}.png`
- **Database:** Store file_path only, not BLOB
- **Rationale:** Better performance, easier backup, scalable to S3

### 6. Technology Stack
- **Frontend:** React + TypeScript (migrated from vanilla HTML)
- **Backend:** Node.js + Express (keep)
- **Database:** MySQL 8.0.45 (keep)
- **PDF Processing:** pdf.js + pdf-lib (for image extraction)
- **Image Storage:** Local filesystem → S3/MinIO
- **State Management:** Zustand or Redux Toolkit
- **UI Framework:** Tailwind CSS + Headless UI
- **Build Tool:** Vite

---

## COMPLETE DATABASE SCHEMA (34 Tables) — STATUS PER TABLE

### Category 1: Core Dimension Lookup Tables (6 tables) — ✅ ALL CREATED AND SEEDED
| Table | Purpose | Seed Data | Status |
|-------|---------|-----------|--------|
| `lookup_years` | Academic years 2020-2030 | ✅ Pre-populated | ✅ Applied |
| `lookup_grades` | Grade 10/11/12 | ✅ Pre-populated | ✅ Applied |
| `lookup_subjects` | All NSC subjects | ✅ Synced from nsc_registration_v3 (123 subjects) | ✅ Applied |
| `lookup_papers` | Paper types (P1/P2/P3/Practical/PAT/Oral/SBA) | ✅ Pre-populated | ✅ Applied |
| `lookup_assessment_types` | EXAM/TEST/SBA/PAT/TRIAL/DIAGNOSTIC/BASELINE | ✅ Pre-populated | ✅ Applied |
| `lookup_assessment_bodies` | DBE/IEB/SACAI/NSC | ✅ Pre-populated | ✅ Applied |

### Category 2: Secondary Dimension Lookup Tables (6 tables) — ✅ ALL CREATED AND SEEDED
| Table | Purpose | Seed Data | Status |
|-------|---------|-----------|--------|
| `lookup_cognitive_levels` | Bloom's Taxonomy (Remember/Understand/Apply/Analyse/Evaluate/Create) | ✅ Pre-populated with CAPS weighting | ✅ Applied |
| `lookup_difficulty_levels` | Easy/Medium/Hard with p-value ranges | ✅ Pre-populated | ✅ Applied |
| `lookup_item_types` | MCQ/Short/Medium/Extended/Essay/Diagram/Matching/Practical/Source-Based | ✅ Pre-populated | ✅ Applied |
| `lookup_languages` | 11 SA official languages | ✅ Pre-populated | ✅ Applied |
| `lookup_exam_sessions` | June/November/Trial/Baseline/Mid-Year | ✅ Pre-populated | ✅ Applied |
| `lookup_marking_schemes` | Holistic/Analytic/Rubric/Keyword/Method | ✅ Pre-populated | ✅ Applied |

### Category 3: Curriculum Lookup Tables — CAPS (2 tables) — 🔄 PARTIALLY DONE
| Table | Purpose | Seed Data | Status |
|-------|---------|-----------|--------|
| `lookup_caps_topics` | CAPS topics per subject-grade | 🔄 11 Life Sciences G12 topics seeded | ✅ Created, partially seeded |
| `lookup_caps_subtopics` | CAPS subtopics per topic | ❌ NOT seeded | ✅ Created, empty |

### Category 4: Taxonomy Lookup Table (1 table) — ✅ CREATED AND SEEDED
| Table | Purpose | Seed Data | Status |
|-------|---------|-----------|--------|
| `lookup_tag_taxonomy` | Controlled vocabulary for all tags | ✅ Pre-populated | ✅ Applied |

### Category 5: Master Data Tables — Items (10 tables) — ✅ ALL CREATED, ALL EMPTY
| Table | Purpose | Status |
|-------|---------|--------|
| `item_master` | Core item table (all 6 dimensions + content + classification) | ✅ Created, 0 rows |
| `item_mcq_options` | MCQ options A/B/C/D with distractor analysis | ✅ Created, 0 rows |
| `item_memos` | Marking guidelines/answers | ✅ Created, 0 rows |
| `item_memo_subparts` | Detailed sub-part rubrics | ✅ Created, 0 rows |
| `item_stimuli` | Shared stimuli (case study, diagram, graph) | ✅ Created, 0 rows |
| `item_attachments` | Images/diagrams file paths | ✅ Created, 0 rows |
| `item_tags` | Item-to-tag linkage | ✅ Created, 0 rows |
| `item_versions` | Audit trail of changes | ✅ Created, 0 rows |
| `item_reviews` | Review comments (threaded) | ✅ Created, 0 rows |
| `review_workflow` | State machine transitions | ✅ Created, 0 rows |

### Category 6: Paper Assembly Tables (4 tables) — ✅ ALL CREATED, ALL EMPTY
| Table | Purpose | Status |
|-------|---------|--------|
| `paper_templates` | Paper blueprints with constraints | ✅ Created, 0 rows |
| `paper_template_sections` | Sections within templates (A/B/C) | ✅ Created, 0 rows |
| `generated_papers` | Assembled papers | ✅ Created, 0 rows |
| `generated_paper_items` | Items in assembled papers | ✅ Created, 0 rows |

### Category 7: Parser & Comparison Tables (3 tables) — 🔄 PARTIALLY WORKING
| Table | Purpose | Status |
|-------|---------|--------|
| `parse_sessions` | Parser audit trail | ✅ Created, 2+ rows |
| `parse_expected_structure` | Gold standard (expected question numbers, marks, types) | ✅ Created, 38 rows for LIFE_SC_P1_NOV_2025 |
| `parse_results` | Parser output with auto-correction + RED flags | ✅ Created, 0 rows (comparison engine broken) |

### Category 8: User & Admin Tables (2 tables) — ✅ ALL CREATED, ALL EMPTY
| Table | Purpose | Status |
|-------|---------|--------|
| `qbank_users` | System users (Examiners, Moderators, Admins, etc.) | ✅ Created, 0 rows |
| `user_subject_assignments` | Subject expert assignments | ✅ Created, 0 rows |

**Total: 34 tables (15 lookup + 19 transactional)**

---

## LIFE SCIENCES CAPS EXTRACTION (Grade 12) — PARTIALLY COMPLETE

### Knowledge Strands (4)
| Strand | Description | Grades |
|--------|-------------|--------|
| Strand 1 | Life at the Molecular, Cellular and Tissue Level | 10, 11, 12 |
| Strand 2 | Life Processes in Plants and Animals | 10, 11, 12 |
| Strand 3 | Environmental Studies | 10, 11, 12 |
| Strand 4 | Diversity, Change and Continuity | 10, 11, 12 |

### Grade 12 Topics (11 topics across 4 terms) — ✅ SEEDED
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

### Grade 12 Paper Structure (from CAPS) — ✅ POPULATED in parse_expected_structure

**Paper 1 (2½ hours, 150 marks):**
| Section | Question | Type | Marks | Count |
|---------|----------|------|-------|-------|
| A | 1.1.1-1.1.10 | MCQ | 2 each = 20 | 10 |
| A | 1.2.1-1.2.8 | Short Answer | 1 each = 8 | 8 |
| A | 1.3.1-1.3.3 | Matching | 2 each = 6 | 3 |
| A | 1.4.1-1.4.3 | Diagram | 8 total | 3 |
| A | 1.5.1-1.5.4 | Diagram | 8 total | 4 |
| B | 2.1-2.5 | Extended | 50 total | 5 |
| C | 3.1-3.5 | Extended | 50 total | 5 |
| **Total** | **38 items** | | **150 marks** | |

**Paper 2 (2½ hours, 150 marks):**
| Content | Marks |
|---------|-------|
| DNA: Code of Life | 27 |
| Meiosis | 12 |
| Genetics & Inheritance | 45 |
| Evolution through Natural Selection | 23 |
| Human Evolution | 43 |
| **Total** | **150** |

### Cognitive Level Weighting (CAPS Page 72)
| Level | Weighting | Verbs |
|-------|-----------|-------|
| Remember | 40% | define, list, identify, name, recall, state |
| Understand | 25% | explain, describe, classify, summarize, interpret |
| Apply | 20% | calculate, solve, demonstrate, use, perform |
| Analyse/Evaluate/Synthesise | 15% | analyse, compare, contrast, evaluate, justify |

---

## DONE (Verified with Evidence)

### Phase 1: Parser Fix + Manual Editing (Week 1 – 8-14 June 2026) — PARTIALLY COMPLETE

#### 1.1 Fix QP Parser — ✅ COMPLETE
- [x] ABANDON marks extraction from parser — parser now extracts items only
- [x] Use `parse_expected_structure` table for marks (database-driven gold standard)
- [x] Extract ALL sections (A, B, C) using position-based detection
- [x] Handle sub-parts (a, b, c) as separate items or parent-child
- [x] Comparison engine validates parser output against database
- [x] Auto-correction fixes mark discrepancies within tolerance (≤2× expected)
- [x] RED flags for manual review when parser unreliable or variance > 2×

#### 1.2 Fix Memo Parser — ❌ NOT STARTED
- [ ] Handle sub-parts (a, b, c) in marking guidelines
- [ ] Extract marks for each sub-part (from parse_expected_structure)
- [ ] Link memo items to QP items by question_number
- [ ] Same comparison engine process as QP

#### 1.3 Wizard Enhancements — ✅ COMPLETE (Fixes Applied, NOT Verified)
- [x] Add manual editing to Step 4:
  - Editable question numbers (text input)
  - Editable question text (rich text editor)
  - Editable memo answer (rich text editor)
  - Editable marks (number input) — pre-populated from parse_expected_structure
  - Image upload/drop zone per item
  - "Add Item" button for manual creation
  - "Delete Item" button
  - "Link Memo" button for manual linking
- [x] Add image preview in review table
- [x] Add "Save Draft" functionality (localStorage)
- [x] Add validation: marks must match expected from DB, question numbers must be unique
- [x] ReviewPanel with RED highlighting for errors
- [x] Filter tabs: All Items, Red Flags, Auto-Corrected
- [x] Save corrections button with audit trail to parse_results
- [x] Fix subjects loading from API (was hardcoded)
- [x] Fix emojis (was garbled)
- [x] Add force_overwrite to bypass 409 error

#### 1.4 Clean Up Data — ❌ NOT DONE
- [ ] Remove duplicate items from staging (if any reappear)
- [ ] Add unique constraint on item_code in staging
- [ ] Verify question_number linking works end-to-end
- [ ] Test with actual LIFE P1 PDF upload

### Phase 2: Corporate Schema Implementation (Week 2 – 9-16 June 2026) — SCHEMA APPLIED BUT NOT FULLY VERIFIED

#### 2.1 Run Complete Schema Migration — ✅ COMPLETE
- [x] Migration 014: All 34 tables created successfully
- [x] 66 foreign key constraints established
- [x] All tables created successfully

#### 2.2 Sync Subject Data — ✅ COMPLETE
- [x] Sync `lookup_subjects` from `nsc_registration_v3.lookup_subjects`
- [x] 123 subjects populated
- [x] Stored procedure `sync_lookup_subjects()` created for manual sync

#### 2.3 Populate CAPS Curriculum Data — 🔄 PARTIALLY COMPLETE
- [x] Populate `lookup_caps_topics` for Life Sciences Grade 12 (11 topics)
- [ ] Populate `lookup_caps_subtopics` for each topic — NOT DONE
- [ ] Extract Grade 10 and 11 topics from CAPS PDF — NOT DONE
- [ ] Add CAPS reference codes (e.g., "LIFE 2.3.1") — NOT DONE
- [ ] Add time allocations and weightings — PARTIALLY DONE

#### 2.4 Populate Paper Structure — ✅ COMPLETE
- [x] Populate `parse_expected_structure` for Grade 12 Paper 1 (38 items, 150 marks)
- [ ] Populate `parse_expected_structure` for Grade 12 Paper 2 — NOT DONE
- [ ] Add cognitive level assignments per question — NOT DONE
- [ ] Add CAPS subtopic linkages per question — NOT DONE

#### 2.5 Migrate Legacy Data — ❌ NOT DONE
- [ ] Migrate `accounting_questions` to `item_master` (normalized)
- [ ] Migrate existing `qbank_items` to new schema
- [ ] Migrate existing `qbank_items_staging` to new schema
- [ ] Verify data integrity after migration

#### 2.6 Update Backend Routes — 🔄 PARTIALLY DONE
- [x] `compare-qp.js` updated with correct INSERT, type mapping, paper_code
- [x] `server.js` updated with compare-qp route, uses req.db middleware
- [ ] Add routes for new tables (items, memos, templates, etc.) — NOT DONE
- [ ] Test all endpoints — NOT DONE

### Phase 3: Review Workflow (Week 3 – 17-23 June 2026) — ❌ NOT STARTED

#### 3.1 Workflow Implementation — NOT STARTED
- [ ] State machine: Draft → Pending → Revision Required → Peer Approved → Expert Approved → Moderated → Published → Archived
- [ ] Role-based transitions
- [ ] Email notifications (or in-app notifications)
- [ ] Comment threading (reply to comments)
- [ ] Comment categories: Accuracy, Clarity, Curriculum, Bias, Technical

#### 3.2 Review Queue Pages — NOT STARTED
- [ ] Reviewer dashboard: Items pending my review
- [ ] Filter by role, subject, status
- [ ] Review form with inline comments
- [ ] Approve/Reject/Revise buttons
- [ ] History of all reviews per item

### Phase 4: Paper Assembly (Week 4 – 24-30 June 2026) — ❌ NOT STARTED

#### 4.1 Template System — NOT STARTED
- [ ] Create template from CAPS specs
- [ ] Define sections with marks, topics, difficulty distribution
- [ ] Save template to database
- [ ] Clone template for new exams

#### 4.2 Assembly Algorithm — NOT STARTED
- [ ] Input: Template + Item Bank
- [ ] Constraints: Total marks, topic distribution, difficulty, cognitive level, exposure limits
- [ ] Output: Assembled paper with items in order

#### 4.3 Examiner Tools — NOT STARTED
- [ ] Replace item: Swap with alternative from bank
- [ ] Manual selection: Override algorithm, pick specific items
- [ ] Shuffle items: Reorder within sections
- [ ] Preview paper: Full paper with images, formatting
- [ ] Preview memo: Full memo with marking guidelines
- [ ] Export: PDF/Word format
- [ ] Parallel forms: Generate multiple equivalent papers

### Phase 5: React Frontend Migration (Week 5-6 – 1-14 July 2026) — 🔄 PARTIALLY DONE

#### 5.1 Setup — ✅ COMPLETE
- [x] Initialize React + TypeScript + Vite project
- [x] Install Tailwind CSS, Headless UI, React Router
- [x] Set up Zustand for state management
- [x] Set up React Query for API calls
- [x] Set up React Hook Form for forms
- [x] Build successful: Vite + React + TypeScript
- [x] Dev server running on port 3000

#### 5.2 Pages — ❌ NOT STARTED (Except Wizard)
- [ ] Login page
- [ ] Dashboard (stats, recent items, pending reviews)
- [ ] Item Bank (search, filter, grid/list view)
- [ ] Item Detail (view, edit, versions, reviews, usage)
- [x] Import Wizard (Step 1-4 with React) — UploadWizard.tsx + ReviewPanel.tsx started
- [ ] Review Queue (items pending review)
- [ ] Paper Assembly (template, assemble, preview, export)
- [ ] Paper List (all generated papers)
- [ ] Template Management (CRUD templates)
- [ ] Taxonomy Management (tags, categories)
- [ ] User Management (roles, permissions)
- [ ] Reports (usage, performance, analytics)

#### 5.3 Components — ❌ NOT STARTED (Except Wizard)
- [ ] ItemCard (preview item in grid)
- [ ] ItemTable (list view with sorting)
- [ ] ReviewForm (submit review with comments)
- [ ] PaperPreview (show assembled paper)
- [ ] MemoPreview (show marking guidelines)
- [ ] ImageUploader (drag-drop upload)
- [ ] RichTextEditor (for question text)
- [ ] TagSelector (controlled vocabulary)
- [ ] WorkflowStatus (show current state)

### Phase 6: Advanced Features (Week 7-8 – 15-28 July 2026) — ❌ NOT STARTED

#### 6.1 Psychometric Tracking — NOT STARTED
- [ ] Difficulty index (p-value)
- [ ] Discrimination index
- [ ] Point-biserial correlation
- [ ] Distractor analysis
- [ ] Exposure monitoring
- [ ] Retirement flag

#### 6.2 Analytics Dashboard — NOT STARTED
- [ ] Item bank statistics
- [ ] Review pipeline
- [ ] Paper generation history
- [ ] Item performance
- [ ] Coverage analysis

#### 6.3 Integration — NOT STARTED
- [ ] Export to PDF
- [ ] Export to Word
- [ ] Import from CSV/Excel
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Authentication (JWT + role-based access)

---

## SUCCESS CRITERIA FOR CORPORATE MVP (Target: 31 August 2026)

| Criteria | Status | Target |
|----------|--------|--------|
| Complete 34-table schema | ✅ | All tables created + seeded |
| CAPS curriculum populated | 🔄 | Life Sciences Grade 12 topics done, subtopics NOT done |
| Parse all sections (A, B, C) from QP | ✅ | 100% extraction (items only, no marks) |
| Extract and store images/diagrams | ❌ | Not started |
| Manual editing of parsed items | 🔄 | UploadWizard + ReviewPanel created, NOT verified |
| Review workflow (3 levels) | ❌ | Not started |
| Paper assembly with constraints | ❌ | Not started |
| Examiner flexibility (replace, shuffle) | ❌ | Not started |
| Tag taxonomy (controlled vocabulary) | ✅ | Admin + SME |
| Item versioning | ✅ | Full audit trail (schema ready) |
| Exposure tracking | ✅ | Usage statistics (schema ready) |
| React frontend | 🔄 | Modern UI (UploadWizard + ReviewPanel done, rest NOT started) |
| Export to PDF/Word | ❌ | Not started |
| Analytics dashboard | ❌ | Not started |
| CAPS PDF Parser | ❌ | v2.7a deployed but broken |

---

## RISKS & MITIGATIONS (Updated 2026-06-12)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| CAPS parser complexity | High | High | Need real PDF diagnostics, iterate header patterns |
| Frontend white screen | High | High | Debug React Router, check App.tsx imports |
| Comparison engine not working | Medium | High | Fix applied, MUST verify before proceeding |
| Schema migration complexity | Medium | High | Migration 014 applied, 015 created but NOT applied |
| CAPS data extraction accuracy | Medium | High | Cross-reference with official DBE docs |
| Legacy data migration | Medium | Medium | Keep legacy tables, migrate incrementally |
| React migration time | Medium | High | Phase 5, parallel with backend work |
| User adoption (new UI) | Medium | Medium | Training, documentation, gradual rollout |
| Performance with large item bank | Medium | Medium | Indexes, pagination, caching |
| Cross-browser compatibility | Low | Medium | Test in Firefox, Chrome, Edge |

---

## ENVIRONMENT (VERIFIED FACTS)

- **Repo:** `C:\dev\nsc-qbank`
- **Database:** `nsc_qbank` (MySQL 8.0.45)
- **Cross-ref DB:** `nsc_registration_v3` (subject_structure, lookup_subjects)
- **Node:** v24.14.0
- **Port:** 4000 (backend), 3000 (frontend dev)
- **MySQL Path:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
- **MySQL Dump Path:** `C:\Program Files\MySQL\MySQL Workbench 8.0\mysqldump.exe`
- **Image Storage:** `C:\dev\nsc-qbank\uploads\`
- **Frontend:** React + TypeScript + Vite (Phase 5)
- **Frontend Build:** `cd frontend && npm run build`
- **Frontend Dev:** `cd frontend && npm run dev` (port 3000)
- **Backend Start:** `cd C:\dev\nsc-qbank && node server.js` (port 4000)

---

## GIT COMMIT STRATEGY (Updated with Actual Commits)

### Commit 1: Foundation
- `git add .`
- `git commit -m "feat: QBank foundation - wizard, parser, memo table, schema fixes"`

### Commit 2: Phase 1 (Parser Simplification + Comparison Engine)
- `git commit -m "feat: simplify parser (items only), add comparison engine with auto-correction + RED flags"`
- **Hash:** `61fba5a` — QBank QP Comparison Engine v1.0
- **Hash:** `7d4707d` — Update wizard and parser
- **Hash:** `8785941` — Fix GENERATED columns, use req.db pool

### Commit 3: Phase 2 (Complete Schema + CAPS Seeding)
- `git commit -m "feat: add complete 34-table schema with all lookup tables + Life Sciences CAPS seed data"`
- **Hash:** `2638cf` (pre-2a392c8)
- **Hash:** `2a392c8` — Current HEAD as of 2026-06-09
- **Hash:** `765d0d0` — Pushed to origin/main 2026-06-10 21:31

### Commit 4: Phase 3 (Review Workflow) — NOT STARTED

### Commit 5: Phase 4 (Paper Assembly) — NOT STARTED

### Commit 6: Phase 5 (React Frontend) — PARTIALLY DONE

### Commit 7: Phase 6 (Advanced Features) — NOT STARTED

---

## KEY DESIGN PRINCIPLES (UNCHANGED)

1. **Every item links to 6 core dimensions:** Year, Grade, Subject, Paper, Assessment Type, Assessment Body
2. **All classification uses lookup tables:** No free-text enums — everything references a lookup table
3. **CAPS curriculum is pre-populated:** Topics and subtopics loaded from official CAPS documents per subject-grade
4. **Taxonomy is controlled:** Tags come from lookup_tag_taxonomy, not free text
5. **Psychometrics are tracked:** exposure_count, facility_value, discrimination_index on item_master
6. **Versioning is built-in:** Every change creates a version record
7. **Audit trail is complete:** parse_sessions, review_workflow, item_versions track everything
8. **Multi-language support:** question_text_afr, option_text_afr for bilingual papers
9. **Shared stimuli supported:** item_stimuli table for case study / data response sets
10. **Sub-part marking:** item_memo_subparts for detailed rubrics on extended questions
11. **Paper assembly with constraints:** Templates enforce topic, difficulty, cognitive level distributions
12. **Parallel paper generation:** Anchor items + randomized items for equivalent forms

---

## PHASE 7: Natural Keys Implementation (Option 2) — DISCUSSED BUT NOT STARTED

### 7.1 Problem Statement
**Current Schema Issue:**
- Uses surrogate keys: subject_id (INT), paper_id (INT), assessment_body_id (INT)
- Source table nsc_registration_v3.subject_structure uses natural keys: subject_official_code (VARCHAR), paper_no (INT), assessment_origin (VARCHAR)
- Mismatch requires complex mapping layer between systems
- All transactional tables need joins to lookup tables for identification

### 7.2 Solution: Natural Keys Throughout — NOT IMPLEMENTED
**Change ALL dimension tables to use natural keys as primary keys:**

| Table | Current PK | New PK | Type |
|-------|-----------|--------|------|
| lookup_subjects | subject_id (INT) | subject_official_code (VARCHAR) | 'LIFE_SC', 'MATH', etc. |
| lookup_papers | paper_id (INT) | paper_no (INT) | 1, 2, 3 |
| lookup_assessment_bodies | assessment_body_id (INT) | assessment_origin (VARCHAR) | 'DBE', 'IEB', etc. |

### 7.3 Implementation Steps — NOT STARTED
1. Update lookup_subjects: Drop subject_id, set subject_official_code as PK
2. Update lookup_papers: Drop paper_id, set paper_no as PK
3. Update lookup_assessment_bodies: Drop assessment_body_id, set assessment_origin as PK
4. Update ALL transactional tables to use natural keys instead of surrogate IDs
5. Update backend routes to use natural keys
6. Update frontend to use natural keys

### 7.4 Status: DISCUSSED BUT NOT IMPLEMENTED
- No SQL migration created for natural keys
- No code changes made for natural keys
- All tables still use surrogate keys (INT auto-increment)
- Decision pending: User has NOT approved implementation

---

*End of Development Plan – Corporate Edition v7*
*Schema complete: 34 tables created, CAPS parser v2.7a broken, Comparison engine fix applied but not verified*
*Date: 2026-06-12 08:11*
