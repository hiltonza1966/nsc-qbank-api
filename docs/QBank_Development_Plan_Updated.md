# QBank Development Plan – Updated 7 June 2026

## DONE (7 June 2026)

### Schema & Migrations
- [x] Create formal migration `001_schema_fix.sql` (replaces manual ALTERs)
  - `qbank_papers`: added `spec_id`, `subject_official_code`, `paper_no`, `duration_minutes`, `status`, `created_by`, `total_marks`
  - `qbank_paper_items`: added `section_name`, `position`, `marks_allocated`
  - `qbank_items`: added `created_at`, `updated_at`
  - Created `v_item_usage` view
- [x] Create `003_seed_specs.sql` — seeded MATH P1/P2, PHYS P1/P2 with valid `sections_config`
- [x] Create `008_consolidate_qbank_tables.sql` — all QBank tables in `nsc_qbank`:
  - `qbank_items_staging` (23 columns with `content_hash` deduplication)
  - `qbank_item_tags`, `qbank_item_curriculum` (with FKs)
  - `qbank_items_staging_tags`, `qbank_items_staging_curriculum` (no FKs)
  - Added `item_code`, `caps_topic`, `item_type`, `difficulty_level`, `caps_subtopic`, `source_reference` to `qbank_items` and `qbank_items_staging`
- [x] Create `009_fix_specs.sql` — deduplicated specs, added `uq_spec` unique key, fixed MATH P1 empty `sections_config`
- [x] All migrations use MySQL 8.0.45 compatible syntax (dynamic `PREPARE/EXECUTE`, no `IF NOT EXISTS`)

### Code Fixes
- [x] `papers.js` — Complete rewrite:
  - Replaced hardcoded `LIMIT 20` with spec-driven `fetchLimit` per section
  - Added `spec_id` linkage to `qbank_papers`
  - Added `usedItemIds` Set to prevent duplicate `item_id` in composite PK
  - Fixed `RAND() + LIMIT ?` MySQL prepared statement issue (uses `query()`)
  - Added transaction wrapper with validation
  - Added 2-year usage warnings
  - Added input validation (400 for missing fields)
- [x] `items.js` — Fixed INSERT (removed `updated_at` reference), added validation
- [x] `staging.js` — Complete rewrite with all tables in `nsc_qbank`
- [x] `server.js` — Added DB error handling, startup connection test, PORT env var

### Testing
- [x] `GET /health` — 200 OK
- [x] `GET /api/qbank/items?subject=MATH` — 200 OK, 3 items returned
- [x] `POST /api/qbank/papers/generate` — 200 OK, generates paper with 3 items, 20 marks
- [x] MySQL migrations — all applied successfully
- [x] Server startup — DB pool created, connection verified

### Documentation
- [x] `QBank_Discovery_File_v2.md` — Complete factual schema (all tables, columns, indexes, views, row counts)
- [x] `AI_Handover_Note_2026-06-07.md` — Updated with all 7 June changes

---

## IN PROGRESS
- [ ] Import more MATH P1 items (need 20+ for 150-mark paper)
- [ ] Test paper retrieval (`GET /api/qbank/papers/:id`)
- [ ] Test staging workflow end-to-end

---

## TODO – Week of 8-14 June 2026

### Priority 1: Data Import
1. Import MATH P1 items (source: 2022-2024 DBE papers)
   - Target: 50+ approved items covering Algebra, Calculus, Geometry
   - Marks distribution: 5-15 marks per item
   - Use staging API: `POST /api/staging/bulk` → `POST /api/staging/approve/:id`
2. Import MATH P2 items
   - Target: 50+ approved items
3. Import PHYS P1/P2 items
   - Target: 50+ approved items per paper

### Priority 2: Paper Generation Enhancement
1. Add topic weighting to item selection
   - Current: `ORDER BY RAND()` (random)
   - Target: Weighted by CAPS topic allocation per section
   - Use `qbank_item_curriculum` table for weighting
2. Add marks validation per section
   - Ensure `sum(items.marks) = section.marks` for each section
   - Current: warns if insufficient, doesn't enforce exact match
3. Add topic coverage validation
   - Ensure all CAPS topics are represented in generated paper

### Priority 3: API Expansion
1. Add `PUT /api/qbank/papers/:id` — Update paper (title, status)
2. Add `DELETE /api/qbank/papers/:id` — Delete paper (cascade to `qbank_paper_items`)
3. Add `GET /api/qbank/papers` — List all papers with pagination
4. Add `POST /api/qbank/papers/:id/publish` — Change status from 'Draft' to 'Published'
5. Add `GET /api/qbank/papers/:id/export` — Export paper to PDF/Word

### Priority 4: Quality Assurance
1. Add `question_reviews` workflow
   - `POST /api/qbank/items/:id/review` — Submit review
   - `GET /api/qbank/items/:id/reviews` — Get review history
   - Status transitions: Draft → Panel Review → Chief Approved → Moderated → Locked
2. Add item versioning
   - Track changes to `question_text`, `marks`, `topic`
   - Store previous versions in `qbank_item_versions` table
3. Add audit logging
   - Log all CRUD operations to `qbank_audit_log` table

### Priority 5: Performance
1. Add database indexes for common queries
   - `qbank_items`: index on `(subject_official_code, paper_no, status)`
   - `qbank_paper_items`: index on `(paper_id)`
   - `qbank_papers`: index on `(subject_official_code, paper_no, status)`
2. Add connection pooling optimization
   - Monitor pool usage, adjust `connectionLimit` based on load
3. Add query caching for specs and subject structure
   - Cache `qbank_paper_specs` in memory (rarely changes)
   - Cache `v_subject_structure` in memory (rarely changes)

---

## Success Criteria for MVP (Target: 30 June 2026)

| Criteria | Status | Target |
|----------|--------|--------|
| Generate valid MATH P1, P2 papers on demand | ⚠️ Partial | 150 marks, all sections filled |
| Generate valid PHYS P1, P2 papers on demand | ❌ Not started | 150 marks, all sections filled |
| Papers respect marks and duration from specs | ✅ | 150 marks, 180 minutes |
| All schema changes in versioned migrations | ✅ | 001-009 applied |
| Staging workflow (import → approve → generate) | ⚠️ Partial | Tested with 3 items, need 50+ |
| Topic weighting in selection | ❌ Not started | Weighted by CAPS allocation |
| Paper export (PDF/Word) | ❌ Not started | Export generated papers |
| Review workflow (Draft → Locked) | ❌ Not started | Full status transitions |
| Audit logging | ❌ Not started | All operations logged |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Insufficient items for paper generation | High | High | Import 50+ items per subject/paper |
| MySQL 8.0.45 syntax limitations | Medium | Medium | Use dynamic SQL (PREPARE/EXECUTE) |
| Cross-database dependency on `nsc_registration_v3` | Medium | Medium | Monitor `subject_structure` changes |
| Random selection doesn't match CAPS weighting | High | Medium | Implement topic weighting (Priority 2) |
| No item versioning (changes lost) | Medium | High | Add `qbank_item_versions` table |
| No audit trail for compliance | High | High | Add `qbank_audit_log` table |

---

## Environment

- **Repo:** `C:\dev\nsc-qbank`
- **Database:** `nsc_qbank` (MySQL 8.0.45)
- **Cross-ref DB:** `nsc_registration_v3` (subject_structure only)
- **Node:** v24.14.0
- **Port:** 4000
- **MySQL Path:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`

---

*End of Development Plan — Updated 7 June 2026*
*All tasks based on actual system state and tested functionality*
