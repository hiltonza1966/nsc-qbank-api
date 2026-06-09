# QBank Development Plan – Corporate Edition v6
**Date:** 9 June 2026
**Updated:** Complete Schema Defined + Life Sciences CAPS Extraction
**Status:** Phase 1 Complete, Phase 2 In Progress (Schema Migration + CAPS Seeding)
**Architecture:** Enterprise-grade Question Bank System with 34 Tables

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
- **Frontend:** React + TypeScript (migrate from vanilla HTML)
- **Backend:** Node.js + Express (keep)
- **Database:** MySQL 8.0.45 (keep)
- **PDF Processing:** pdf.js + pdf-lib (for image extraction)
- **Image Storage:** Local filesystem → S3/MinIO
- **State Management:** Zustand or Redux Toolkit
- **UI Framework:** Tailwind CSS + Headless UI
- **Build Tool:** Vite

---

## COMPLETE DATABASE SCHEMA (34 Tables)

### Category 1: Core Dimension Lookup Tables (6 tables)
| Table | Purpose | Seed Data |
|-------|---------|-----------|
| `lookup_years` | Academic years 2020-2030 | ✅ Pre-populated |
| `lookup_grades` | Grade 10/11/12 | ✅ Pre-populated |
| `lookup_subjects` | All NSC subjects | ✅ Sync from nsc_registration_v3 |
| `lookup_papers` | Paper types (P1/P2/P3/Practical/PAT/Oral/SBA) | ✅ Pre-populated |
| `lookup_assessment_types` | EXAM/TEST/SBA/PAT/TRIAL/DIAGNOSTIC/BASELINE | ✅ Pre-populated |
| `lookup_assessment_bodies` | DBE/IEB/SACAI/NSC | ✅ Pre-populated |

### Category 2: Secondary Dimension Lookup Tables (6 tables)
| Table | Purpose | Seed Data |
|-------|---------|-----------|
| `lookup_cognitive_levels` | Bloom's Taxonomy (Remember/Understand/Apply/Analyse/Evaluate/Create) | ✅ Pre-populated with CAPS weighting |
| `lookup_difficulty_levels` | Easy/Medium/Hard with p-value ranges | ✅ Pre-populated |
| `lookup_item_types` | MCQ/Short/Medium/Extended/Essay/Diagram/Matching/Practical/Source-Based | ✅ Pre-populated |
| `lookup_languages` | 11 SA official languages | ✅ Pre-populated |
| `lookup_exam_sessions` | June/November/Trial/Baseline/Mid-Year | ✅ Pre-populated |
| `lookup_marking_schemes` | Holistic/Analytic/Rubric/Keyword/Method | ✅ Pre-populated |

### Category 3: Curriculum Lookup Tables — CAPS (2 tables)
| Table | Purpose | Seed Data |
|-------|---------|-----------|
| `lookup_caps_topics` | CAPS topics per subject-grade (e.g., LIFE_12_1_1 = DNA: Code of Life) | 🔄 Extracting from CAPS PDF |
| `lookup_caps_subtopics` | CAPS subtopics per topic (e.g., LIFE 2.3.1 = DNA Structure) | 🔄 Extracting from CAPS PDF |

### Category 4: Taxonomy Lookup Table (1 table)
| Table | Purpose | Seed Data |
|-------|---------|-----------|
| `lookup_tag_taxonomy` | Controlled vocabulary for all tags | ✅ Pre-populated |

### Category 5: Master Data Tables — Items (10 tables)
| Table | Purpose | Status |
|-------|---------|--------|
| `item_master` | Core item table (all 6 dimensions + content + classification) | ✅ Designed |
| `item_mcq_options` | MCQ options A/B/C/D with distractor analysis | ✅ Designed |
| `item_memos` | Marking guidelines/answers | ✅ Designed |
| `item_memo_subparts` | Detailed sub-part rubrics (e.g., 2.1.1=3 marks, 2.1.2=3 marks) | ✅ Designed |
| `item_stimuli` | Shared stimuli (case study, diagram, graph) | ✅ Designed |
| `item_attachments` | Images/diagrams file paths | ✅ Designed |
| `item_tags` | Item-to-tag linkage | ✅ Designed |
| `item_versions` | Audit trail of changes | ✅ Designed |
| `item_reviews` | Review comments (threaded) | ✅ Designed |
| `review_workflow` | State machine transitions | ✅ Designed |

### Category 6: Paper Assembly Tables (4 tables)
| Table | Purpose | Status |
|-------|---------|--------|
| `paper_templates` | Paper blueprints with constraints | ✅ Designed |
| `paper_template_sections` | Sections within templates (A/B/C) | ✅ Designed |
| `generated_papers` | Assembled papers | ✅ Designed |
| `generated_paper_items` | Items in assembled papers | ✅ Designed |

### Category 7: Parser & Comparison Tables (3 tables)
| Table | Purpose | Status |
|-------|---------|--------|
| `parse_sessions` | Parser audit trail | ✅ Designed |
| `parse_expected_structure` | Gold standard (expected question numbers, marks, types) | ✅ Designed |
| `parse_results` | Parser output with auto-correction + RED flags | ✅ Designed |

### Category 8: User & Admin Tables (2 tables)
| Table | Purpose | Status |
|-------|---------|--------|
| `qbank_users` | System users (Examiners, Moderators, Admins, etc.) | ✅ Designed |
| `user_subject_assignments` | Subject expert assignments | ✅ Designed |

**Total: 34 tables (15 lookup + 19 transactional)**

---

## LIFE SCIENCES CAPS EXTRACTION (Grade 12)

### Knowledge Strands (4)
| Strand | Description | Grades |
|--------|-------------|--------|
| Strand 1 | Life at the Molecular, Cellular and Tissue Level | 10, 11, 12 |
| Strand 2 | Life Processes in Plants and Animals | 10, 11, 12 |
| Strand 3 | Environmental Studies | 10, 11, 12 |
| Strand 4 | Diversity, Change and Continuity | 10, 11, 12 |

### Grade 12 Topics (11 topics across 4 terms)
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

### Grade 12 Paper Structure (from CAPS)

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

## DONE (9 June 2026) – Schema Definition + CAPS Extraction + Migration 014

### Phase 2 Complete (2026-06-09)
- [x] Migration 014: All 34 tables created successfully
- [x] 66 foreign key constraints established
- [x] 15 lookup tables seeded with data
- [x] 123 subjects synced from nsc_registration_v3.lookup_subjects
- [x] 38 items populated in parse_expected_structure for LIFE_SC_P1_NOV_2025
- [x] Backend running on port 4000 with all API endpoints active
- [x] Old tables dropped (qbank_items, qbank_papers, etc.)
- [x] Legacy tables preserved (accounting_questions, qbank_users_legacy)
- [x] Stored procedure sync_lookup_subjects() created for manual sync

### Schema & Migrations
- [x] Migration 001: Schema fix (qbank_papers columns, qbank_paper_items columns, qbank_items timestamps)
- [x] Migration 003: Seed specs (MATH P1/P2, PHYS P1/P2)
- [x] Migration 008: Consolidate QBank tables (staging, tags, curriculum)
- [x] Migration 009: Fix specs (deduplicate, add uq_spec, fix empty sections)
- [x] Migration 010: Create memo table (qbank_item_memos + question_number column)
- [x] Migration 012: QP Structure tables (QB_questionP_Structure, QB_parsed_results, QB_parse_sessions)
- [x] **Migration 014: Complete schema (34 tables with all lookup tables + seed data)**

### CAPS Extraction
- [x] Life Sciences Grade 12: 11 topics extracted across 4 strands
- [x] Paper 1 structure: 38 items, 150 marks, sections A/B/C
- [x] Paper 2 structure: 5 content areas, 150 marks
- [x] Cognitive level weighting: 40/25/20/15% (CAPS page 72)
- [x] Grade 10 and 11 topics identified (to be extracted)

### Code Implementation
- [x] `compare-qp.js` – Comparison engine with auto-correction
- [x] `server.js` – Updated with compare-qp route, uses req.db middleware
- [x] `qp-structure-extractor.js` – Future paper extraction utility
- [x] `frontend/UploadWizard.tsx` – Test integration with comparison engine
- [x] `frontend/ReviewPanel.tsx` – RED error highlighting, editable marks
- [x] `frontend/api.ts` – API service with string concatenation

---

## PHASE 1: Parser Fix + Manual Editing (Week 1 – 8-14 June 2026) ✅ COMPLETE

### 1.1 Fix QP Parser ✅ COMPLETE
- [x] **ABANDON marks extraction from parser** — parser now extracts items only
- [x] Use `QB_questionP_Structure` table for marks (database-driven gold standard)
- [x] Extract ALL sections (A, B, C) using position-based detection
- [x] Handle sub-parts (a, b, c) as separate items or parent-child
- [x] Extract images from PDF using pdf.js canvas API
- [x] Store image references in question text: `[IMAGE: attachment_id]`
- [x] **Comparison engine validates parser output against database**
- [x] **Auto-correction fixes mark discrepancies within tolerance (≤2× expected)**
- [x] **RED flags for manual review when parser unreliable or variance > 2×**

### 1.2 Fix Memo Parser ⚠️ IN PROGRESS
- [ ] Handle sub-parts (a, b, c) in marking guidelines
- [ ] Extract marks for each sub-part (from QB_questionP_Structure)
- [ ] Link memo items to QP items by question_number
- [ ] **Same comparison engine process as QP**

### 1.3 Wizard Enhancements ✅ COMPLETE
- [x] Add manual editing to Step 4:
  - Editable question numbers (text input)
  - Editable question text (rich text editor)
  - Editable memo answer (rich text editor)
  - Editable marks (number input) — **pre-populated from QB_questionP_Structure**
  - Image upload/drop zone per item
  - "Add Item" button for manual creation
  - "Delete Item" button
  - "Link Memo" button for manual linking
- [x] Add image preview in review table
- [x] Add "Save Draft" functionality (localStorage)
- [x] Add validation: marks must match expected from DB, question numbers must be unique
- [x] **ReviewPanel with RED highlighting for errors**
- [x] **Filter tabs: All Items, Red Flags, Auto-Corrected**
- [x] **Save corrections button with audit trail to QB_parsed_results**

### 1.4 Clean Up Data ⚠️ PENDING
- [ ] Remove duplicate items from staging (if any reappear)
- [ ] Add unique constraint on item_code in staging
- [ ] Verify question_number linking works end-to-end
- [ ] **Test with actual LIFE P1 PDF upload**

---

## PHASE 2: Corporate Schema Implementation (Week 2 – 9-16 June 2026) 🔄 IN PROGRESS

### 2.1 Run Complete Schema Migration
- [ ] Run `014_complete_qbank_schema.sql` to create all 34 tables
- [ ] Verify all tables created successfully
- [ ] Verify all foreign key constraints
- [ ] Test referential integrity

### 2.2 Sync Subject Data
- [ ] Sync `lookup_subjects` from `nsc_registration_v3.lookup_subjects`
- [ ] Verify all NSC subjects populated
- [ ] Verify Life Sciences subject ID and codes

### 2.3 Populate CAPS Curriculum Data
- [ ] Populate `lookup_caps_topics` for Life Sciences Grade 12 (11 topics)
- [ ] Populate `lookup_caps_subtopics` for each topic
- [ ] Extract Grade 10 and 11 topics from CAPS PDF
- [ ] Add CAPS reference codes (e.g., "LIFE 2.3.1")
- [ ] Add time allocations and weightings

### 2.4 Populate Paper Structure
- [ ] Populate `parse_expected_structure` for Grade 12 Paper 1 (38 items, 150 marks)
- [ ] Populate `parse_expected_structure` for Grade 12 Paper 2 (content areas, 150 marks)
- [ ] Add cognitive level assignments per question
- [ ] Add CAPS subtopic linkages per question

### 2.5 Migrate Legacy Data
- [ ] Migrate `accounting_questions` to `item_master` (normalized)
- [ ] Migrate existing `qbank_items` to new schema
- [ ] Migrate existing `qbank_items_staging` to new schema
- [ ] Verify data integrity after migration

### 2.6 Update Backend Routes
- [ ] Update `compare-qp.js` to use new table names (`parse_results`, `parse_expected_structure`)
- [ ] Update `server.js` to mount all new routes
- [ ] Add routes for new tables (items, memos, templates, etc.)
- [ ] Test all endpoints

---

## PHASE 3: Review Workflow (Week 3 – 17-23 June 2026)

### 3.1 Workflow Implementation
- [ ] State machine: Draft → Pending → Revision Required → Peer Approved → Expert Approved → Moderated → Published → Archived
- [ ] Role-based transitions:
  - Developer: Draft → Pending
  - Peer Reviewer: Pending → Peer Approved / Revision Required
  - Subject Expert: Peer Approved → Expert Approved / Revision Required
  - Moderator: Expert Approved → Moderated / Rejected
  - Admin: Any state → Any state
- [ ] Email notifications (or in-app notifications)
- [ ] Comment threading (reply to comments)
- [ ] Comment categories: Accuracy, Clarity, Curriculum, Bias, Technical

### 3.2 Review Queue Pages
- [ ] Reviewer dashboard: Items pending my review
- [ ] Filter by role, subject, status
- [ ] Review form with inline comments
- [ ] Approve/Reject/Revise buttons
- [ ] History of all reviews per item

---

## PHASE 4: Paper Assembly (Week 4 – 24-30 June 2026)

### 4.1 Template System
- [ ] Create template from CAPS specs (Paper 1: 38 items, 150 marks, sections A/B/C)
- [ ] Define sections with marks, topics, difficulty distribution
- [ ] Save template to database
- [ ] Clone template for new exams

### 4.2 Assembly Algorithm
- [ ] Input: Template + Item Bank
- [ ] Constraints:
  - Total marks = template total_marks
  - Topic distribution matches CAPS weighting
  - Difficulty distribution (e.g., 30% Easy, 50% Medium, 20% Hard)
  - Cognitive level distribution
  - Item exposure limits (not used in last 2 years)
  - No duplicate items across parallel papers
- [ ] Output: Assembled paper with items in order

### 4.3 Examiner Tools
- [ ] Replace item: Swap with alternative from bank
- [ ] Manual selection: Override algorithm, pick specific items
- [ ] Shuffle items: Reorder within sections
- [ ] Preview paper: Full paper with images, formatting
- [ ] Preview memo: Full memo with marking guidelines
- [ ] Export: PDF/Word format
- [ ] Parallel forms: Generate multiple equivalent papers

---

## PHASE 5: React Frontend Migration (Week 5-6 – 1-14 July 2026)

### 5.1 Setup ✅ COMPLETE
- [x] Initialize React + TypeScript + Vite project
- [x] Install Tailwind CSS, Headless UI, React Router
- [x] Set up Zustand for state management
- [x] Set up React Query for API calls
- [x] Set up React Hook Form for forms
- [x] **Build successful: Vite + React + TypeScript**
- [x] **Dev server running on port 3000**

### 5.2 Pages
- [ ] Login page
- [ ] Dashboard (stats, recent items, pending reviews)
- [ ] Item Bank (search, filter, grid/list view)
- [ ] Item Detail (view, edit, versions, reviews, usage)
- [ ] Import Wizard (Step 1-4 with React) — **UploadWizard.tsx + ReviewPanel.tsx started**
- [ ] Review Queue (items pending review)
- [ ] Paper Assembly (template, assemble, preview, export)
- [ ] Paper List (all generated papers)
- [ ] Template Management (CRUD templates)
- [ ] Taxonomy Management (tags, categories)
- [ ] User Management (roles, permissions)
- [ ] Reports (usage, performance, analytics)

### 5.3 Components
- [ ] ItemCard (preview item in grid)
- [ ] ItemTable (list view with sorting)
- [ ] ReviewForm (submit review with comments)
- [ ] PaperPreview (show assembled paper)
- [ ] MemoPreview (show marking guidelines)
- [ ] ImageUploader (drag-drop upload)
- [ ] RichTextEditor (for question text)
- [ ] TagSelector (controlled vocabulary)
- [ ] WorkflowStatus (show current state)

---

## PHASE 6: Advanced Features (Week 7-8 – 15-28 July 2026)

### 6.1 Psychometric Tracking
- [ ] Difficulty index (p-value): proportion correct
- [ ] Discrimination index: separates high/low performers
- [ ] Point-biserial correlation: item-total correlation
- [ ] Distractor analysis: MCQ option performance
- [ ] Exposure monitoring: usage count, last used date
- [ ] Retirement flag: auto-retire after exposure threshold

### 6.2 Analytics Dashboard
- [ ] Item bank statistics: total items, by subject, by status
- [ ] Review pipeline: items in each state
- [ ] Paper generation history: papers created, by subject
- [ ] Item performance: difficulty trends over time
- [ ] Coverage analysis: topics covered vs CAPS requirements

### 6.3 Integration
- [ ] Export to PDF (with proper formatting)
- [ ] Export to Word (with proper formatting)
- [ ] Import from CSV/Excel (bulk item creation)
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Authentication (JWT + role-based access)

---

## SUCCESS CRITERIA FOR CORPORATE MVP (Target: 31 August 2026)

| Criteria | Status | Target |
|----------|--------|--------|
| Complete 34-table schema | 🔄 | All tables created + seeded |
| CAPS curriculum populated | 🔄 | Life Sciences Grades 10-12 |
| Parse all sections (A, B, C) from QP | ✅ | 100% extraction (items only, no marks) |
| Extract and store images/diagrams | ❌ | All images saved |
| Manual editing of parsed items | ✅ | Full CRUD in wizard (ReviewPanel) |
| Review workflow (3 levels) | ❌ | Peer → Expert → Moderator |
| Paper assembly with constraints | ❌ | Topic, difficulty, marks |
| Examiner flexibility (replace, shuffle) | ❌ | Full control |
| Tag taxonomy (controlled vocabulary) | ✅ | Admin + SME |
| Item versioning | ✅ | Full audit trail |
| Exposure tracking | ✅ | Usage statistics |
| React frontend | 🔄 | Modern UI (UploadWizard + ReviewPanel done) |
| Export to PDF/Word | ❌ | Corporate format |
| Analytics dashboard | ❌ | Performance metrics |

---

## RISKS & MITIGATIONS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Schema migration complexity | Medium | High | Run in dev first, verify all FKs |
| CAPS data extraction accuracy | Medium | High | Cross-reference with official DBE docs |
| Legacy data migration | Medium | Medium | Keep legacy tables, migrate incrementally |
| React migration time | Medium | High | Phase 5, parallel with backend work |
| User adoption (new UI) | Medium | Medium | Training, documentation, gradual rollout |
| Performance with large item bank | Medium | Medium | Indexes, pagination, caching |
| Cross-browser compatibility | Low | Medium | Test in Firefox, Chrome, Edge |

---

## ENVIRONMENT

- **Repo:** `C:\dev\nsc-qbank`
- **Database:** `nsc_qbank` (MySQL 8.0.45)
- **Cross-ref DB:** `nsc_registration_v3` (subject_structure, lookup_subjects)
- **Node:** v24.14.0
- **Port:** 4000
- **MySQL Path:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
- **Image Storage:** `C:\dev\nsc-qbank\uploads\`
- **Frontend:** React + TypeScript + Vite (Phase 5)

---

## GIT COMMIT STRATEGY

### Commit 1: Foundation (Current)
- `git add .`
- `git commit -m "feat: QBank foundation - wizard, parser, memo table, schema fixes"`

### Commit 2: Phase 1 (Parser Simplification + Comparison Engine) ✅ COMPLETE
- `git commit -m "feat: simplify parser (items only), add comparison engine with auto-correction + RED flags"`
- **Hash:** `61fba5a` — QBank QP Comparison Engine v1.0
- **Hash:** `7d4707d` — Update wizard and parser
- **Hash:** `8785941` — Fix GENERATED columns, use req.db pool

### Commit 3: Phase 2 (Complete Schema + CAPS Seeding) 🔄 IN PROGRESS
- `git commit -m "feat: add complete 34-table schema with all lookup tables + Life Sciences CAPS seed data"`

### Commit 4: Phase 3 (Review Workflow)
- `git commit -m "feat: implement 3-level review workflow with comments and notifications"`

### Commit 5: Phase 4 (Paper Assembly)
- `git commit -m "feat: paper assembly with templates, constraints, examiner tools"`

### Commit 6: Phase 5 (React Frontend)
- `git commit -m "feat: migrate to React + TypeScript with modern UI"`

### Commit 7: Phase 6 (Advanced Features)
- `git commit -m "feat: psychometrics, analytics, export, integration"`

---

## KEY DESIGN PRINCIPLES

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

*End of Development Plan – Corporate Edition v6*
*Schema complete: 34 tables defined, CAPS data extracted, ready for migration*
*Phase 2 in progress: Run migration 014_complete_qbank_schema.sql*


## PHASE 7: Natural Keys Implementation (Option 2) 🔄 IN PROGRESS

### 7.1 Problem Statement
**Current Schema Issue:**
- Uses surrogate keys: subject_id (INT), paper_id (INT), assessment_body_id (INT)
- Source table nsc_registration_v3.subject_structure uses natural keys: subject_official_code (VARCHAR), paper_no (INT), assessment_origin (VARCHAR)
- Mismatch requires complex mapping layer between systems
- All transactional tables need joins to lookup tables for identification

### 7.2 Solution: Natural Keys Throughout
**Change ALL dimension tables to use natural keys as primary keys:**

| Table | Current PK | New PK | Type |
|-------|-----------|--------|------|
| lookup_subjects | subject_id (INT) | subject_official_code (VARCHAR) | 'LIFE_SC', 'MATH', etc. |
| lookup_papers | paper_id (INT) | paper_no (INT) | 1, 2, 3 |
| lookup_assessment_bodies | assessment_body_id (INT) | assessment_origin (VARCHAR) | 'DBE', 'IEB', etc. |

### 7.3 Implementation Steps
1. **Update lookup_subjects:**
   - Drop subject_id (INT) as PK
   - Set subject_official_code (VARCHAR) as PK
   - Update all FK references in transactional tables

2. **Update lookup_papers:**
   - Drop paper_id (INT) as PK
   - Set paper_no (INT) as PK
   - Update all FK references

3. **Update lookup_assessment_bodies:**
   - Drop assessment_body_id (INT) as PK
   - Set assessment_origin (VARCHAR) as PK
   - Update all FK references

4. **Update ALL transactional tables:**
   - item_master: subject_id → subject_official_code, paper_id → paper_no, assessment_body_id → assessment_origin
   - item_stimuli: same changes
   - parse_sessions: same changes
   - parse_expected_structure: same changes
   - paper_templates: same changes
   - generated_papers: same changes
   - All other dimension-referencing tables

5. **Update backend routes:**
   - All queries use natural keys instead of surrogate IDs
   - API endpoints accept/return natural keys

6. **Update frontend:**
   - UploadWizard.tsx uses natural keys
   - ReviewPanel.tsx uses natural keys
   - api.ts updated for natural key endpoints

### 7.4 Benefits
- ✅ Self-documenting: subject_official_code = 'LIFE_SC' is immediately meaningful
- ✅ No mapping layer needed between QBank and registration system
- ✅ Direct alignment with nsc_registration_v3.subject_structure
- ✅ Simpler queries: no joins to lookup tables for basic identification
- ✅ Immutable: DBE subject codes rarely change

### 7.5 Risks & Mitigations
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance impact (VARCHAR vs INT) | Medium | Medium | Test with large datasets, add indexes |
| Storage increase | Medium | Low | Acceptable trade-off for simplicity |
| Code refactoring time | High | Medium | Phase 7 dedicated, no other changes |
| FK constraint complexity | Medium | High | Drop and recreate all FKs carefully |

**Commit:** `git commit -m "feat: implement natural keys (Option 2) - subject_official_code, paper_no, assessment_origin"`

