# QBank Development Plan – Updated 5 June 2026

## DONE (5 June)
- [x] Diagnose generation failure (missing columns)
- [x] Apply schema fix to qbank_papers and qbank_paper_items
- [x] Test paper generation – 2 successful papers
- [x] Commit fix fe87b41

## IN PROGRESS
- [ ] Create formal migration 001_schema_fix.sql
- [ ] Document current DB state

## TODO – Week of 6 June
### Priority 1: Make generation reproducible
1. Create `/migrations/001_schema_fix.sql`
   ```sql
   ALTER TABLE qbank_papers ADD COLUMN IF NOT EXISTS spec_id uuid;
   ALTER TABLE qbank_papers ADD COLUMN IF NOT EXISTS total_marks int;
   ALTER TABLE qbank_papers ADD COLUMN IF NOT EXISTS duration_minutes int;
   ALTER TABLE qbank_papers ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'draft';
   ```
2. Seed specs:
   ```sql
   INSERT INTO qbank_paper_specs (subject, paper, grade, total_marks, duration_minutes, total_items)
   VALUES ('MATH','P2',12,150,180,20), ('PHYS','P1',12,150,180,20), ('PHYS','P2',12,150,180,20);
   ```

### Priority 2: Code cleanup
- Replace `LIMIT 20` in routes/papers.js:47 with `spec.total_items`
- Add transaction wrapper for paper + items insert
- Validate sum(marks) = spec.total_marks

### Priority 3: Data
- Import MATH P2 items (source: 2022-2024 DBE papers)
- Tag PHYS items by topic for weighted selection

## Success criteria for MVP
- Generate valid MATH P1, P2, PHYS P1, P2 papers on demand
- Papers respect marks and duration from specs
- All schema changes in versioned migrations
