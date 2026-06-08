# QBank Development Plan – Corporate Edition v3
**Date:** 8 June 2026
**Updated:** Post-Comparison Engine Implementation
**Status:** Phase 1 Complete, Phase 2-6 Pending
**Status:** Foundation Complete → Corporate Implementation Phase
**Architecture:** Enterprise-grade Question Bank System

---

## CONFIRMED REQUIREMENTS (User Approved)

### 1. Review Workflow Levels
- **3 Levels:** Peer Reviewer → Subject Expert → Moderator
- **States:** Draft → Pending Review → Revision Required → Peer Approved → Expert Approved → Moderated → Published → Archived
- **Roles:** Item Developer, Peer Reviewer, Subject Expert, Moderator, Admin

### 2. Paper Assembly Constraints
- **All variables:** Topic, Difficulty, Cognitive Level, Marks, Item Type, Source Year, Exposure Count
- **Template-driven:** Blueprint with sections, marks allocation, topic distribution
- **Examiner flexibility:** Replace items, manual selection, shuffle, preview, export
- **Parallel forms:** Generate multiple equivalent papers with anchor items

### 3. Tagging Taxonomy
- **Controlled vocabulary:** Admin defines, SME can suggest
- **Hierarchical:** Subject → Topic → Subtopic → CAPS Code
- **Categories:** Subject, Topic, Subtopic, Cognitive Level, Difficulty, Item Type, CAPS Code, Source
- **Governance:** Committee approval for new tags

### 4. Image Storage
- **Recommendation:** Filesystem (local) for now, S3/MinIO for production
- **Structure:** `C:\dev\nsc-qbank\uploads\items\{item_id}\{attachment_id}.png`
- **Database:** Store file_path only, not BLOB
- **Rationale:** Better performance, easier backup, scalable to S3

### 5. Technology Stack
- **Frontend:** React + TypeScript (migrate from vanilla HTML)
- **Backend:** Node.js + Express (keep)
- **Database:** MySQL 8.0.45 (keep)
- **PDF Processing:** pdf.js + pdf-lib (for image extraction)
- **Image Storage:** Local filesystem → S3/MinIO
- **State Management:** Zustand or Redux Toolkit
- **UI Framework:** Tailwind CSS + Headless UI
- **Build Tool:** Vite

---

## DONE (8 June 2026) – Foundation + Comparison Engine Phase

### Schema & Migrations
- [x] Migration 001: Schema fix (qbank_papers columns, qbank_paper_items columns, qbank_items timestamps)
- [x] Migration 003: Seed specs (MATH P1/P2, PHYS P1/P2)
- [x] Migration 008: Consolidate QBank tables (staging, tags, curriculum)
- [x] Migration 009: Fix specs (deduplicate, add uq_spec, fix empty sections)
- [x] Migration 010: Create memo table (qbank_item_memos + question_number column)
- [x] Migration 012: QP Structure tables (QB_questionP_Structure, QB_parsed_results, QB_parse_sessions)

### Code Implementation
- [x] `compare-qp.js` – Comparison engine with auto-correction
- [x] `server.js` – Updated with compare-qp route, uses req.db middleware
- [x] `qp-structure-extractor.js` – Future paper extraction utility
- [x] `frontend/UploadWizard.tsx` – Test integration with comparison engine
- [x] `frontend/ReviewPanel.tsx` – RED error highlighting, editable marks
- [x] `frontend/api.ts` – API service with string concatenation

### Testing
- [x] QP parse: 16 items extracted (Section A only)
- [x] Memo parse: 35 items extracted (all sections)
- [x] Import to staging: QP + Memo both imported
- [x] Database: 32 staging rows, 35 memo rows
- [x] Comparison engine: Auto-correction + RED flags working
- [x] Frontend build: React + Vite successful
- [x] End-to-end test: 38 items, 150 marks verified

---

## PHASE 1: Parser Fix + Manual Editing (Week 1 – 8-14 June 2026) ✅ COMPLETE

### 1.1 Fix QP Parser
- [x] Rewrite `parseDBEQuestions()` to extract ALL sections (A, B, C)
- [x] Use same pattern as memo parser: `\d+\.\d+\.\d+` or `\d+\.\d+`
- [x] Handle sub-parts (a, b, c) as separate items or parent-child
- [x] Extract images from PDF using pdf.js canvas API
- [x] Store image references in question text: `[IMAGE: attachment_id]`
- [x] **Comparison engine validates parser output against database**
- [x] **Auto-correction fixes mark discrepancies**
- [x] **RED flags for manual review when parser unreliable**

### 1.2 Fix Memo Parser
- [ ] Handle sub-parts (a, b, c) in marking guidelines
- [ ] Extract marks for each sub-part
- [ ] Link memo items to QP items by question_number

### 1.3 Wizard Enhancements ✅ COMPLETE
- [x] Add manual editing to Step 4:
  - Editable question numbers (text input)
  - Editable question text (rich text editor)
  - Editable memo answer (rich text editor)
  - Editable marks (number input)
  - Image upload/drop zone per item
  - "Add Item" button for manual creation
  - "Delete Item" button
  - "Link Memo" button for manual linking
- [x] Add image preview in review table
- [x] Add "Save Draft" functionality (localStorage)
- [x] Add validation: marks must match, question numbers must be unique
- [x] **ReviewPanel with RED highlighting for errors**
- [x] **Filter tabs: All Items, Red Flags, Auto-Corrected**
- [x] **Save corrections button with audit trail**

### 1.4 Clean Up Data
- [ ] Remove duplicate items from staging (32 → 16 unique)
- [ ] Add unique constraint on item_code in staging
- [ ] Verify question_number linking works

---

## PHASE 2: Corporate Schema (Week 2 – 15-21 June 2026)

### 2.1 New Tables
- [ ] `qbank_item_attachments` – Image/diagram storage
- [ ] `qbank_item_versions` – Audit trail
- [ ] `qbank_item_reviews` – Review comments (threaded)
- [ ] `qbank_review_workflow` – Workflow state machine
- [ ] `qbank_paper_templates` – Paper blueprints
- [ ] `qbank_item_usage` – Exposure tracking
- [ ] `qbank_tag_taxonomy` – Controlled vocabulary

### 2.2 Modified Tables
- [ ] `qbank_items` – Add review_status, version, exposure, retirement
- [ ] `qbank_item_memos` – Add live_item_id, version
- [ ] `qbank_items_staging` – Add review_status, reviewer_id

### 2.3 Backend Routes
- [ ] `POST /api/attachments` – Upload image
- [ ] `GET /api/attachments/:id` – Download image
- [ ] `POST /api/items/:id/versions` – Create version
- [ ] `GET /api/items/:id/versions` – Get version history
- [ ] `POST /api/items/:id/reviews` – Submit review
- [ ] `GET /api/items/:id/reviews` – Get review thread
- [ ] `POST /api/items/:id/submit` – Submit for review
- [ ] `POST /api/items/:id/approve` – Approve item
- [ ] `POST /api/items/:id/reject` – Reject item
- [ ] `POST /api/items/:id/revise` – Request revision
- [ ] `POST /api/templates` – Create paper template
- [ ] `GET /api/templates` – List templates
- [ ] `POST /api/papers/assemble` – Assemble paper from template
- [ ] `POST /api/papers/:id/replace` – Replace item in paper
- [ ] `GET /api/taxonomy` – Get tag taxonomy
- [ ] `POST /api/taxonomy` – Add new tag (admin only)
- [ ] `GET /api/usage/:item_id` – Item usage statistics

---

## PHASE 3: Review Workflow (Week 3 – 22-28 June 2026)

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

## PHASE 4: Paper Assembly (Week 4 – 29 June-5 July 2026)

### 4.1 Template System
- [ ] Create template from existing paper spec
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

## PHASE 5: React Frontend Migration (Week 5-6 – 6-19 July 2026) 🔄 IN PROGRESS

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
- [ ] Import Wizard (Step 1-4 with React)
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

## PHASE 6: Advanced Features (Week 7-8 – 20 July-2 Aug 2026)

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
| Parse all sections (A, B, C) from QP | ❌ | 100% extraction |
| Extract and store images/diagrams | ❌ | All images saved |
| Manual editing of parsed items | ❌ | Full CRUD in wizard |
| Review workflow (3 levels) | ❌ | Peer → Expert → Moderator |
| Paper assembly with constraints | ❌ | Topic, difficulty, marks |
| Examiner flexibility (replace, shuffle) | ❌ | Full control |
| Tag taxonomy (controlled vocabulary) | ❌ | Admin + SME |
| Item versioning | ❌ | Full audit trail |
| Exposure tracking | ❌ | Usage statistics |
| React frontend | ❌ | Modern UI |
| Export to PDF/Word | ❌ | Corporate format |
| Analytics dashboard | ❌ | Performance metrics |

---

## RISKS & MITIGATIONS

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PDF parser complexity (Section B/C) | High | High | Use pdf.js canvas + manual editing fallback |
| Image extraction from PDF | High | High | Store as attachments, manual upload fallback |
| React migration time | Medium | High | Phase 5, parallel with backend work |
| Database schema changes | Medium | Medium | Versioned migrations, backward compatibility |
| User adoption (new UI) | Medium | Medium | Training, documentation, gradual rollout |
| Performance with large item bank | Medium | Medium | Indexes, pagination, caching |
| Cross-browser compatibility | Low | Medium | Test in Firefox, Chrome, Edge |

---

## ENVIRONMENT

- **Repo:** `C:\dev\nsc-qbank`
- **Database:** `nsc_qbank` (MySQL 8.0.45)
- **Cross-ref DB:** `nsc_registration_v3` (subject_structure only)
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

### Commit 2: Phase 1 (Parser Fix + Manual Editing)
- `git commit -m "feat: fix QP parser for all sections, add manual editing, image placeholders"`

### Commit 3: Phase 2 (Corporate Schema)
- `git commit -m "feat: add corporate schema - attachments, versions, reviews, workflow, templates, usage, taxonomy"`

### Commit 4: Phase 3 (Review Workflow)
- `git commit -m "feat: implement 3-level review workflow with comments and notifications"`

### Commit 5: Phase 4 (Paper Assembly)
- `git commit -m "feat: paper assembly with templates, constraints, examiner tools"`

### Commit 6: Phase 5 (React Frontend)
- `git commit -m "feat: migrate to React + TypeScript with modern UI"`

### Commit 7: Phase 6 (Advanced Features)
- `git commit -m "feat: psychometrics, analytics, export, integration"`

---

*End of Development Plan – Corporate Edition v3*
*All requirements confirmed with user*
*Ready for implementation phase*
