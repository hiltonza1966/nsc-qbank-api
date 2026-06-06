# AI Handover Note – 5 June 2026

**Project:** NSC QBank API (`E:\dev\nsc-qbank-api`)
**Owner:** Hilton Visagie
**Date:** 2026-06-05 17:45 SAST

## What we fixed today
- Schema mismatch in `qbank_papers` and `qbank_paper_items` prevented generation
- Applied ALTER statements:
  - `qbank_papers`: added `spec_id`, `total_marks`, `duration_minutes`, `status`
  - `qbank_paper_items`: ensured `marks`, `order_index` columns exist
- Commit: `fe87b41` – "fix: align schema for paper generation"

## Tests that passed
1. `POST /api/qbank/papers/generate`
   - Body: `{ "subject": "MATH", "paper": "P1", "grade": 12, "year": 2024 }`
   - Result: 201 Created
   - paper_id: `a02cae58-af01-470e-8a44-ce48a3ce0bd4`
2. Second generation with same spec – dedup logic working

## Current blockers resolved
- `LIMIT 20` hardcoded in `routes/papers.js:47` – still present, needs parameterization
- Missing specs for MATH P2 and PHYS P1/P2 in `qbank_paper_specs`

## Environment
- Node 20, PostgreSQL 15
- Repo: E:\dev\nsc-qbank-api
- Branch: main (working)

## Next session goals (6 June)
1. Create `/migrations/001_schema_fix.sql` from today's ALTERs
2. Seed `qbank_paper_specs` for MATH P2, PHYS P1, PHYS P2
3. Replace hardcoded LIMIT with spec-driven value
4. Add validation for total_marks vs sum(items.marks)
