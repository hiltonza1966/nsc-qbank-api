# GIT COMMIT LOG
## nsc-qbank-v4

### Commit 1: Initial foundation
Date: 2026-06-05
Message: feat: initial project structure and Phase 0 documentation

Files:
- docs/NSC_QBank_Development_Plan_v1.md
- docs/concept_documents.txt
- docs/tor_urs.txt
- README.md

### Commit 2: Database migrations
Date: 2026-06-05
Message: migration: add qbank_paper_specs and qbank_items tables

Files:
- database/migrations/001_create_qbank_paper_specs.sql
- database/migrations/002_create_qbank_items.sql

Changes:
- Created qbank_paper_specs linked to subject_structure PK
- Added cognitive_weighting, difficulty_weighting JSON fields
- Created qbank_items with mandatory TOR tagging
- Includes workflow status from Concept Document

### Commit 3: Backend API
Date: 2026-06-05
Message: feat(api): add subjects-with-papers endpoint

Files:
- backend/routes/qbank.js

Changes:
- GET /api/qbank/subjects-with-papers
- Queries subject_structure directly
- Returns paper_mark (not max_mark) as confirmed
- Groups papers by subject_alpha_code
- Includes duration in hours and minutes
