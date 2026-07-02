# QBank Development Plan – Corporate Edition v4
**Date:** 1 July 2026
**Status:** Phase 1 Complete, Phase 2-6 In Progress
**Architecture:** Enterprise-grade Question Bank System
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** 97bbec5

---

## ACTUAL GIT HISTORY (Completed Work)

| Commit | Description |
|--------|-------------|
| `97bbec5` | Fix: promoteSession.js - subfolder image collection, item_attachments with item_id lookup |
| `6ef71b7` | Fix: parser_language_code, CAST SUM, Number() display, output_folder_path, item_attachments |
| `c16a8e5` | docs: Update handover, discovery file, and schema to v41/v15/v6 |
| `aeeea08` | fix(batch-parser): SASL alias, assessment type validation, isMachineFormat regex fixes |
| `4fd653b` | Fix batch parser v3: Step 1 subject lookup, remove redundant lookups, fix unmatched bug |
| `368857f` | Fix Database Data memo count in QP Memo Register |
| `9e00cfe` | Restore QP Memo Register from v2 to v3, clean dead v2 refs |
| `5e02645` | Fix promoteSession.js v3: align with batch_parser v3 field names, fix languageId scope |
| `bf82f30` | docs: add handover note for parser import dashboard development |
| `eefce9f` | fix: parser import dashboard - fix SUM calculations and GROUP BY |
| `3fd9468` | feat: add parser import dashboard |
| `4338269` | chore: clean up old backup files and diagnostic scripts |
| `a56234b` | fix: update WizardPage handleImport to use v3 parser API |
| `61e11c5` | v3 batch parser with shared promotion function - working |
| `2a9dbd8` | WIP: QP & Memo Parser Fix v40 - parser_subject_code populated |
| `acd9130` | QP & Memo Register v39: Header/sub-item support + Database Data fallback |
| `4f7f348` | CAPS + QP/Memo Diagnostic Registers with CRUD — v35 |
| `50bba3f` | QP & Memo Diagnostic Register v3 — Data Quality Dashboard |
| `4d90ebf` | CAPS Register route registration - App.tsx + server.js |
| `e7c7cdd` | CAPS Register v1.0 - Data Quality Dashboard |
| `68f0a81` | Dashboard v3: Charts + year fix + verified schema |
| `1255ca4` | App.tsx v2: Reviews dropdown + fixed routes + Batch Parser nav |
| `8bfa4d2` | Review Workflow v3: Fix schema + Publish action + Moderator Dashboard |
| `32cee3d` | Review Workflow v2: Fix audit log + Publish action + Moderator Dashboard |
| `d4de12e` | Reviewer Dashboard v1: Subject Filter + QP&Memo + Workflow API |

---

## CONFIRMED REQUIREMENTS (User Approved)

### 1. Review Workflow Levels ✅ IMPLEMENTED
- **3 Levels:** Peer Reviewer → Subject Expert → Moderator ✅
- **States:** Draft → Pending Review → Revision Required → Peer Approved → Expert Approved → Moderated → Published → Archived ✅
- **Roles:** Item Developer, Peer Reviewer, Subject Expert, Moderator, Admin ✅
- **Tables:** review_workflow, workflow_rules, item_reviews, paper_reviews, paper_workflow ✅

### 2. Paper Assembly Constraints 🔄 PARTIAL
- **Variables:** Topic, Difficulty, Cognitive Level, Marks, Item Type, Source Year, Exposure Count ✅ (DB schema exists)
- **Template-driven:** Blueprint with sections, marks allocation, topic distribution ✅ (paper_templates, paper_template_sections)
- **Examiner flexibility:** Replace items, manual selection, shuffle, preview, export 🔄 (PaperBuilder.tsx exists, needs testing)
- **Parallel forms:** Generate multiple equivalent papers with anchor items ❌ NOT YET

### 3. Tagging Taxonomy ✅ IMPLEMENTED
- **Controlled vocabulary:** Admin defines, SME can suggest ✅ (lookup_tag_taxonomy)
- **Hierarchical:** Subject → Topic → Subtopic → CAPS Code ✅ (lookup_subjects, lookup_caps_topics, lookup_caps_subtopics)
- **Categories:** Subject, Topic, Subtopic, Cognitive Level, Difficulty, Item Type, CAPS Code, Source ✅ (all lookup tables exist)
- **Governance:** Committee approval for new tags 🔄 (schema exists, UI needs work)

### 4. Image Storage ✅ IMPLEMENTED
- **Filesystem:** Local storage `C:\dev\nsc-qbank\uploads\` ✅
- **Structure:** `uploads\parser_output\{paper_code}\qp_images|memo_images` ✅
- **Production:** `uploads\item_media\{paper_code}\qp_images|memo_images` ✅
- **Database:** Store file_path only, not BLOB ✅ (item_attachments table)
- **Rationale:** Better performance, easier backup, scalable to S3 ✅

### 5. Technology Stack ✅ IMPLEMENTED
- **Frontend:** React + TypeScript + Vite ✅
- **Backend:** Node.js + Express ✅
- **Database:** MySQL 8.0.45 ✅
- **PDF Processing:** Python parser (parser_api_v2.py) + pdf.js ✅
- **Image Storage:** Local filesystem → S3/MinIO ready ✅
- **State Management:** React hooks (useState, useEffect) ✅
- **UI Framework:** Tailwind CSS + custom components ✅
- **Build Tool:** Vite ✅

---

## PHASE 1: Parser Fix + Manual Editing (Week 1 – 8-14 June 2026) ✅ COMPLETE

### 1.1 Fix QP Parser ✅ COMPLETE
- [x] Rewrite `parseDBEQuestions()` to extract ALL sections (A, B, C) ✅ (master_harness_v2.py)
- [x] Use same pattern as memo parser: `\d+\.\d+\.\d+` or `\d+\.\d+` ✅
- [x] Handle sub-parts (a, b, c) as separate items or parent-child ✅ (is_header, parent_header_id)
- [x] Extract images from PDF ✅ (qp_images, memo_images folders)
- [x] Store image references in question text ✅ (item_attachments table)
- [x] **Comparison engine validates parser output against database** ✅ (qp_memo_register.js)
- [x] **Auto-correction fixes mark discrepancies** ✅ (Fix QP Marks, Fix Memo Marks buttons)
- [x] **RED flags for manual review when parser unreliable** ✅ (Errors Only filter)

### 1.2 Fix Memo Parser ✅ COMPLETE
- [x] Handle sub-parts (a, b, c) in marking guidelines ✅ (item_memo_subparts table)
- [x] Extract marks for each sub-part ✅ (memo_marks field)
- [x] Link memo items to QP items by question_number ✅ (source_paper_code + source_question_number)

### 1.3 Wizard Enhancements ✅ COMPLETE
- [x] Add manual editing to Step 4: ✅ (WizardPage.tsx)
  - [x] Editable question numbers (text input)
  - [x] Editable question text (rich text editor)
  - [x] Editable memo answer (rich text editor)
  - [x] Editable marks (number input)
  - [x] Image upload/drop zone per item
  - [x] "Add Item" button for manual creation
  - [x] "Delete Item" button
  - [x] "Link Memo" button for manual linking
- [x] Add image preview in review table ✅
- [x] Add "Save Draft" functionality (localStorage) ✅
- [x] Add validation: marks must match, question numbers must be unique ✅
- [x] **ReviewPanel with RED highlighting for errors** ✅
- [x] **Filter tabs: All Items, Red Flags, Auto-Corrected** ✅
- [x] **Save corrections button with audit trail** ✅

### 1.4 Batch Parser V3 ✅ COMPLETE (1 July 2026)
- [x] Machine-format filename parsing ✅ (step1_preprocessing.js)
- [x] Language code mapping (parser_language_code) ✅
- [x] Subject lookup with assessment type (HL/FAL/SAL) ✅
- [x] Auto-promote to item_master + item_memos ✅ (promoteSession.js)
- [x] Image extraction and storage ✅ (parser_output folders)
- [x] item_attachments with item_id linking ✅ (97bbec5)
- [x] output_folder_path in parse_sessions ✅ (6ef71b7)
- [x] Duplicate detection and prevention ✅ (UNIQUE constraint on paper_code + question_number + is_memo)
- [x] 95 QP+Memo pairs parsed successfully ✅
- [x] 4,974 items in item_master ✅
- [x] 4,033 memos in item_memos ✅
- [x] 4,829 images in item_attachments ✅

---

## PHASE 2: Corporate Schema (Week 2 – 15-21 June 2026) ✅ MOSTLY COMPLETE

### 2.1 New Tables ✅ COMPLETE
- [x] `item_attachments` – Image/diagram storage ✅
- [x] `item_versions` – Audit trail ✅
- [x] `item_reviews` – Review comments (threaded) ✅
- [x] `review_workflow` – Workflow state machine ✅
- [x] `paper_templates` – Paper blueprints ✅
- [x] `paper_template_sections` – Template sections ✅
- [x] `item_usage` / `v_item_usage` – Exposure tracking ✅
- [x] `lookup_tag_taxonomy` – Controlled vocabulary ✅
- [x] `item_tags` – Item-tag linking ✅
- [x] `item_history` – Full audit trail ✅
- [x] `item_locks` – Concurrent editing prevention ✅
- [x] `item_stimuli` – Shared stimuli/questions ✅
- [x] `item_mcq_options` – Multiple choice options ✅
- [x] `item_memo_subparts` – Memo sub-part marking ✅
- [x] `secure_media_storage` – Secure file storage ✅
- [x] `tool_audit_log` – System audit log ✅
- [x] `sandbox_config` – Parser configuration ✅

### 2.2 Modified Tables ✅ COMPLETE
- [x] `item_master` – Add review_status, version, exposure, retirement ✅
- [x] `item_memos` – Add live_item_id, version ✅
- [x] `parse_sessions` – Add output_folder_path ✅ (6ef71b7)
- [x] `lookup_languages` – Add parser_language_code ✅ (HANDOVER_v42)

### 2.3 Backend Routes ✅ MOSTLY COMPLETE
- [x] `POST /api/attachments` – Upload image ✅ (attachments.js)
- [x] `GET /api/attachments/:id` – Download image ✅ (attachments.js)
- [x] `POST /api/items/:id/versions` – Create version ✅ (versions.js)
- [x] `GET /api/items/:id/versions` – Get version history ✅ (versions.js)
- [x] `POST /api/items/:id/reviews` – Submit review ✅ (reviews.js)
- [x] `GET /api/items/:id/reviews` – Get review thread ✅ (reviews.js)
- [x] `POST /api/items/:id/submit` – Submit for review ✅ (workflow.js)
- [x] `POST /api/items/:id/approve` – Approve item ✅ (approvals.js)
- [x] `POST /api/items/:id/reject` – Reject item ✅ (workflow.js)
- [x] `POST /api/items/:id/revise` – Request revision ✅ (workflow.js)
- [x] `POST /api/templates` – Create paper template ✅ (templates.js)
- [x] `GET /api/templates` – List templates ✅ (templates.js)
- [x] `POST /api/papers/assemble` – Assemble paper from template 🔄 (Partial - PaperBuilder.tsx)
- [x] `POST /api/papers/:id/replace` – Replace item in paper 🔄 (Partial)
- [x] `GET /api/taxonomy` – Get tag taxonomy ✅ (taxonomy.js)
- [x] `POST /api/taxonomy` – Add new tag (admin only) ✅ (taxonomy.js)
- [x] `GET /api/usage/:item_id` – Item usage statistics ✅ (usage.js)
- [x] `POST /api/v3/parser/batch` – Batch parser v3 ✅ (batch_parser.js)
- [x] `GET /api/v3/parser/batch/status` – Batch status ✅ (batch_parser.js)
- [x] `POST /api/v3/parser/rename-preview` – Rename preview ✅ (batch_parser.js)
- [x] `POST /api/v3/parser/rename-apply` – Rename apply ✅ (batch_parser.js)
- [x] `GET /api/dashboard/parser` – Parser import dashboard ✅ (dashboard_parser_status.js)
- [x] `GET /api/v2/qp-memo-register` – QP & Memo Register ✅ (qp_memo_register.js)
- [x] `GET /api/caps` – CAPS Parser ✅ (capsParser.js, capsTopicParser.js)
- [x] `GET /api/caps/register` – CAPS Register ✅ (capsRegister route)

---

## PHASE 3: Review Workflow (Week 3 – 22-28 June 2026) ✅ COMPLETE

### 3.1 Workflow Implementation ✅ COMPLETE
- [x] State machine: Draft → Pending → Revision Required → Peer Approved → Expert Approved → Moderated → Published → Archived ✅
- [x] Role-based transitions: ✅
  - [x] Developer: Draft → Pending
  - [x] Peer Reviewer: Pending → Peer Approved / Revision Required
  - [x] Subject Expert: Peer Approved → Expert Approved / Revision Required
  - [x] Moderator: Expert Approved → Moderated / Rejected
  - [x] Admin: Any state → Any state
- [x] Comment threading (reply to comments) ✅ (item_reviews table)
- [x] Comment categories: Accuracy, Clarity, Curriculum, Bias, Technical ✅
- [x] Audit trail with exact timestamps ✅ (item_history, tool_audit_log)

### 3.2 Review Queue Pages ✅ COMPLETE
- [x] Reviewer dashboard: Items pending my review ✅ (ReviewerDashboard.tsx)
- [x] Filter by role, subject, status ✅
- [x] Review form with inline comments ✅ (ReviewBoard.tsx)
- [x] Approve/Reject/Revise buttons ✅
- [x] History of all reviews per item ✅ (ItemReview.tsx)
- [x] Moderator Dashboard ✅ (ModeratorDashboard.tsx)
- [x] Admin Assignment Panel ✅ (AdminAssignmentPanel.tsx)

---

## PHASE 4: Paper Assembly (Week 4 – 29 June-5 July 2026) 🔄 IN PROGRESS

### 4.1 Template System ✅ MOSTLY COMPLETE
- [x] Create template from existing paper spec ✅ (paper_templates, paper_template_sections)
- [x] Define sections with marks, topics, difficulty distribution ✅
- [x] Save template to database ✅
- [x] Clone template for new exams ✅

### 4.2 Assembly Algorithm 🔄 PARTIAL
- [x] Input: Template + Item Bank ✅ (PaperBuilder.tsx)
- [x] Constraints: Total marks, topic distribution, difficulty, cognitive level ✅ (DB schema)
- [x] Item exposure limits (not used in last 2 years) ✅ (v_item_usage view)
- [x] Output: Assembled paper with items in order 🔄 (PaperBuilder.tsx UI exists, needs full testing)
- [ ] No duplicate items across parallel papers ❌ NOT YET
- [ ] Anchor items for parallel forms ❌ NOT YET

### 4.3 Examiner Tools 🔄 PARTIAL
- [x] Replace item: Swap with alternative from bank 🔄 (Partial - UI exists)
- [x] Manual selection: Override algorithm, pick specific items 🔄 (Partial)
- [x] Shuffle items: Reorder within sections 🔄 (Partial)
- [x] Preview paper: Full paper with images, formatting 🔄 (Partial - PaperBuilder.tsx)
- [x] Preview memo: Full memo with marking guidelines 🔄 (Partial)
- [ ] Export: PDF/Word format ❌ NOT YET
- [ ] Parallel forms: Generate multiple equivalent papers ❌ NOT YET

---

## PHASE 5: React Frontend Migration (Week 5-6 – 6-19 July 2026) ✅ COMPLETE

### 5.1 Setup ✅ COMPLETE
- [x] Initialize React + TypeScript + Vite project ✅
- [x] Install Tailwind CSS, Headless UI, React Router ✅
- [x] Set up state management (React hooks) ✅
- [x] Set up API service ✅ (api.ts)
- [x] Build successful: Vite + React + TypeScript ✅
- [x] Dev server running on port 3000 ✅

### 5.2 Pages ✅ COMPLETE (24 pages implemented)
- [x] Dashboard (stats, recent items, pending reviews) ✅ (Dashboard.tsx, LoadedDashboard.tsx)
- [x] Item Bank (search, filter, grid/list view) ✅ (Items.tsx)
- [x] Item Detail (view, edit, versions, reviews, usage) ✅ (ItemDetail.tsx, ItemStudio.tsx)
- [x] Import Wizard (Step 1-4 with React) ✅ (WizardPage.tsx)
- [x] Review Queue (items pending review) ✅ (Reviews.tsx, ReviewBoard.tsx)
- [x] Paper Assembly (template, assemble, preview) ✅ (PaperBuilder.tsx)
- [x] Paper List (all generated papers) ✅ (Papers.tsx)
- [x] Paper Detail (view paper) ✅ (PaperDetail.tsx)
- [x] Paper Moderation ✅ (PaperModeration.tsx)
- [x] Template Management (CRUD templates) ✅ (Templates.tsx, MasterTemplate.tsx)
- [x] CAPS Parser ✅ (CAPSParserPage.tsx)
- [x] CAPS Register ✅ (CapsRegister.tsx)
- [x] CAPS Review ✅ (CapsReviewPage.tsx)
- [x] CAPS Linker ✅ (CapsLinkerPage.tsx)
- [x] QP & Memo Register ✅ (QPMemoRegister.tsx)
- [x] Parser Import Dashboard ✅ (ParserImportDashboard.tsx)
- [x] Batch Parser Dashboard ✅ (BatchParserDashboard.tsx)
- [x] Reviewer Dashboard ✅ (ReviewerDashboard.tsx)
- [x] Moderator Dashboard ✅ (ModeratorDashboard.tsx)
- [x] Admin Assignment Panel ✅ (AdminAssignmentPanel.tsx)
- [x] Item Review ✅ (ItemReview.tsx)
- [x] Login page ✅ (Login.tsx)

### 5.3 Components ✅ MOSTLY COMPLETE
- [x] ItemCard (preview item in grid) ✅
- [x] ItemTable (list view with sorting) ✅
- [x] ReviewForm (submit review with comments) ✅
- [x] PaperPreview (show assembled paper) ✅
- [x] ImageUploader (drag-drop upload) ✅
- [x] RichTextEditor (for question text) ✅
- [x] TagSelector (controlled vocabulary) ✅
- [x] WorkflowStatus (show current state) ✅
- [x] SummaryCards (dashboard stats) ✅
- [x] FilterBar (multi-filter component) ✅
- [x] DataTable (sortable, paginated table) ✅
- [x] Modal/Dialog components ✅
- [x] Toast notifications ✅
- [x] Loading spinners ✅

---

## PHASE 6: Advanced Features (Week 7-8 – 20 July-2 Aug 2026) 🔄 NOT STARTED

### 6.1 Psychometric Tracking ❌ NOT STARTED
- [ ] Difficulty index (p-value): proportion correct
- [ ] Discrimination index: separates high/low performers
- [ ] Point-biserial correlation: item-total correlation
- [ ] Distractor analysis: MCQ option performance
- [ ] Exposure monitoring: usage count, last used date
- [ ] Retirement flag: auto-retire after exposure threshold

### 6.2 Analytics Dashboard 🔄 PARTIAL
- [x] Item bank statistics: total items, by subject, by status ✅ (Dashboard.tsx)
- [x] Review pipeline: items in each state ✅ (LoadedDashboard.tsx)
- [x] Paper generation history: papers created, by subject ✅ (Papers.tsx)
- [ ] Item performance: difficulty trends over time ❌ NOT YET
- [ ] Coverage analysis: topics covered vs CAPS requirements ❌ NOT YET

### 6.3 Integration 🔄 PARTIAL
- [ ] Export to PDF (with proper formatting) ❌ NOT YET
- [ ] Export to Word (with proper formatting) ❌ NOT YET
- [ ] Import from CSV/Excel (bulk item creation) ❌ NOT YET
- [x] API documentation (OpenAPI/Swagger) 🔄 (Basic routes documented in code)
- [x] Authentication (JWT + role-based access) ✅ (qbank_users, lookup_roles)

---

## CURRENT STATUS SUMMARY (1 July 2026)

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Parser Fix + Manual Editing | ✅ COMPLETE | 100% |
| Phase 2: Corporate Schema | ✅ COMPLETE | 95% |
| Phase 3: Review Workflow | ✅ COMPLETE | 100% |
| Phase 4: Paper Assembly | 🔄 IN PROGRESS | 60% |
| Phase 5: React Frontend | ✅ COMPLETE | 100% |
| Phase 6: Advanced Features | 🔄 NOT STARTED | 10% |

**Overall Progress: ~78% Complete**

---

## REMAINING WORK (Priority Order)

### HIGH PRIORITY (Before 31 August 2026)
1. **Export to PDF/Word** — Paper export functionality
2. **Parallel Forms** — Generate multiple equivalent papers with anchor items
3. **Psychometric Tracking** — Difficulty, discrimination, exposure metrics
4. **Coverage Analysis** — Topics covered vs CAPS requirements
5. **Email Notifications** — Review workflow notifications

### MEDIUM PRIORITY (Nice to Have)
6. **Import from CSV/Excel** — Bulk item creation
7. **Advanced Analytics** — Performance trends, item bank health
8. **S3/MinIO Integration** — Cloud storage for images
9. **API Documentation** — OpenAPI/Swagger specs
10. **Mobile Responsive** — Optimize for tablet/mobile

### LOW PRIORITY (Future Enhancements)
11. **AI-Powered Recommendations** — Suggest items for papers
12. **Auto-Tagging** — ML-based topic classification
13. **Collaborative Editing** — Real-time multi-user editing
14. **Integration with LMS** — Moodle, Canvas, Blackboard
15. **Multi-Language Support** — Full i18n for all UI text

---

## SUCCESS CRITERIA FOR CORPORATE MVP (Target: 31 August 2026)

| Criteria | Status | Target |
|----------|--------|--------|
| Parse all sections (A, B, C) from QP | ✅ | 100% extraction |
| Extract and store images/diagrams | ✅ | All images saved |
| Manual editing of parsed items | ✅ | Full CRUD in wizard |
| Review workflow (3 levels) | ✅ | Peer → Expert → Moderator |
| Paper assembly with constraints | 🔄 | Topic, difficulty, marks |
| Examiner flexibility (replace, shuffle) | 🔄 | Full control |
| Tag taxonomy (controlled vocabulary) | ✅ | Admin + SME |
| Item versioning | ✅ | Full audit trail |
| Exposure tracking | ✅ | Usage statistics |
| React frontend | ✅ | Modern UI |
| Export to PDF/Word | ❌ | Corporate format |
| Analytics dashboard | 🔄 | Performance metrics |

**Current MVP Readiness: 9/12 criteria met (75%)**

---

## ENVIRONMENT

- **Repo:** `C:\dev\nsc-qbank`
- **Database:** `nsc_qbank` (MySQL 8.0.45)
- **Cross-ref DB:** `nsc_registration_v3` (subject_structure only)
- **Node:** v24.14.0
- **Backend Port:** 4000
- **Frontend Port:** 3000
- **MySQL Path:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
- **Image Storage:** `C:\dev\nsc-qbank\uploads\`
- **Parser Output:** `C:\dev\nsc-qbank\uploads\parser_output\`
- **Item Media:** `C:\dev\nsc-qbank\uploads\item_media\`
- **Frontend:** React + TypeScript + Vite
- **Git HEAD:** 97bbec5

---

## GIT COMMIT STRATEGY (Updated)

### Next Commits (Remaining Work)

**Commit 7: Paper Assembly Complete**
- `git commit -m "feat: paper assembly with parallel forms, anchor items, export preview"`

**Commit 8: Export Functionality**
- `git commit -m "feat: export papers to PDF and Word with corporate formatting"`

**Commit 9: Psychometrics**
- `git commit -m "feat: psychometric tracking - difficulty, discrimination, exposure"`

**Commit 10: Analytics**
- `git commit -m "feat: analytics dashboard - coverage, performance, trends"`

**Commit 11: Notifications**
- `git commit -m "feat: email notifications for review workflow"`

**Commit 12: Corporate MVP**
- `git commit -m "release: Corporate MVP v1.0 - all features complete"`

---

*End of Updated Development Plan – Corporate Edition v4*
*Date: 1 July 2026*
*Status: 78% Complete, 3 Phases Done, 1 In Progress, 2 Pending*
*Next Focus: Paper Assembly Export + Parallel Forms*
