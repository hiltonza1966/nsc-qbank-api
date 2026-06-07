# AI Handover Note – 7 June 2026

**Project:** NSC QBank API (`C:\dev\nsc-qbank`)
**Owner:** Hilton Visagie
**Date:** 2026-06-07 08:35 SAST
**Database:** nsc_qbank (MySQL 8.0.45)
**Node.js:** v24.14.0
**Branch:** main
**Last Commit:** b46999a (5 June 2026)

---

## What we fixed today (7 June 2026)

### 1. Schema Migrations (Complete)
- **001_schema_fix.sql** — Formal migration replacing manual ALTERs:
  - `qbank_papers`: added `spec_id`, `subject_official_code`, `paper_no`, `duration_minutes`, `status`, `created_by`, `total_marks`
  - `qbank_paper_items`: added `section_name`, `position`, `marks_allocated`
  - `qbank_items`: added `created_at`, `updated_at`
  - Created `v_item_usage` view
  - Used `PREPARE/EXECUTE` dynamic SQL for MySQL 8.0.45 compatibility (no `IF NOT EXISTS`)

- **003_seed_specs.sql** — Seeded specs for:
  - MATH P1: 150 marks, 180 min, sections `[Algebra(50), Calculus(50), Geometry(50)]`
  - MATH P2: 150 marks, 180 min, sections `[Section A(75), Section B(75)]`
  - PHYS P1: 150 marks, 180 min, sections `[Section A(75), Section B(75)]`
  - PHYS P2: 150 marks, 180 min, sections `[Section A(75), Section B(75)]`

- **008_consolidate_qbank_tables.sql** — Consolidated all QBank tables into `nsc_qbank`:
  - Created `qbank_items_staging` (23 columns, with `content_hash` SHA1 deduplication)
  - Created `qbank_item_tags` (FK to `qbank_items`)
  - Created `qbank_item_curriculum` (FK to `qbank_items`)
  - Created `qbank_items_staging_tags` (no FK, allows orphaned staging)
  - Created `qbank_items_staging_curriculum` (no FK)
  - Added `item_code`, `caps_topic`, `item_type`, `difficulty_level`, `caps_subtopic`, `source_reference` to both `qbank_items` and `qbank_items_staging`
  - **No columns dropped** — all existing data preserved

- **009_fix_specs.sql** — Fixed duplicate and empty specs:
  - Deleted specs with `sections_config = '[]'` or NULL
  - Removed duplicate specs (kept most recent per subject/paper)
  - Added `uq_spec` unique key on `(subject_official_code, paper_no)`
  - Inserted MATH P1 with valid `sections_config`

### 2. Code Fixes
- **papers.js** — Complete rewrite:
  - Replaced hardcoded `LIMIT 20` with spec-driven `fetchLimit` per section
  - Added `spec_id` linkage to `qbank_papers` INSERT
  - Added `usedItemIds` Set to prevent duplicate `item_id` in composite PK `(paper_id, item_id)`
  - Fixed `RAND() + LIMIT ?` MySQL prepared statement issue — uses `conn.query()` instead of `conn.execute()`
  - Added transaction wrapper (`beginTransaction`/`commit`/`rollback`)
  - Added validation: `totalAllocatedMarks` vs `spec.total_marks`
  - Added 2-year usage warning via `v_item_usage`
  - Added section fill warnings
  - Added input validation (400 for missing fields)

- **items.js** — Fixed:
  - Removed `updated_at` from INSERT (column didn't exist in schema at time of fix)
  - Added input validation for required fields
  - Wrapped GET response in `{success, count, items}`

- **staging.js** — Complete rewrite:
  - All tables reference `nsc_qbank` only (no cross-database queries)
  - `subject_structure` remains in `nsc_registration_v3` (cross-referenced only when needed)
  - `QBANK_DB` env var controls database name
  - Added `validateItem()` function for required fields
  - `bulk` endpoint: inserts to `qbank_items_staging` with deduplication handling
  - `approve/:id` endpoint: migrates staging → live with tags/curriculum copy

- **server.js** — Added:
  - DB pool error handling with `process.exit(1)` on failure
  - Startup connection test (`SELECT 1`)
  - `PORT` env var support (`process.env.PORT || 4000`)

### 3. Database State (as of 2026-06-07 08:30)

| Table | Rows | Status |
|-------|------|--------|
| qbank_items | 6 | 3 MATH P1 approved, 3 others |
| qbank_papers | 4 | 4 test papers generated |
| qbank_paper_items | 3 | 3 items linked to papers |
| qbank_paper_specs | 4 | MATH P1/P2, PHYS P1/P2 |
| qbank_items_staging | 0 | Ready for import |
| qbank_item_tags | 0 | Ready for tagging |
| qbank_item_curriculum | 0 | Ready for curriculum mapping |
| qbank_users | 0 | Empty |
| question_reviews | 0 | Empty |
| questions | 3 | Legacy data |
| accounting_questions | 10 | Legacy data |

### 4. Tests That Passed

1. `GET /health` — 200 OK
2. `GET /api/qbank/items?subject=MATH` — 200 OK, returns 3 items
3. `POST /api/qbank/papers/generate` — 200 OK with `paper_id`, `spec_id`, `total_items=3`, `total_allocated_marks=20`
4. MySQL migrations — all applied without errors (dynamic SQL approach)
5. Server startup — DB pool created, connection verified, port 4000

### 5. Known Blockers Resolved

| Blocker | Resolution |
|---------|------------|
| `LIMIT 20` hardcoded | Replaced with `Math.max(sectionMarks, 50)` per section |
| Missing specs for MATH P2, PHYS P1/P2 | Seeded via 003_seed_specs.sql |
| MATH P1 spec had empty `sections_config` | Fixed via 009_fix_specs.sql |
| Duplicate specs allowed | Added `uq_spec` unique key |
| `RAND()` in prepared statements | Uses `query()` instead of `execute()` |
| `IF NOT EXISTS` not supported | Uses `PREPARE/EXECUTE` dynamic SQL |
| Cross-database table references | Consolidated all QBank tables into `nsc_qbank` |
| Missing `updated_at` in `qbank_items` | Added via 001_schema_fix.sql |
| Missing `item_code`, `caps_topic`, etc. | Added via 008_consolidate_qbank_tables.sql |

### 6. Files Modified (Git Status)

```
Modified:
  README.md
  package-lock.json
  package.json
  routes/items.js
  routes/papers.js
  server.js

Untracked (new):
  COMMIT_LOG.md
  VERSION.txt
  backend/
  database/migrations/001_schema_fix.sql
  database/migrations/003_seed_specs.sql
  database/migrations/008_consolidate_qbank_tables.sql
  database/migrations/009_fix_specs.sql
  docs/AI_Handover_Note_2026-06-05.md
  docs/QBank_Development_Plan_Updated.md
  docs/QBank_Discovery_File.md
  routes/staging.js
  wizard/
```

---

## Next Session Goals (Post-7 June)

1. **Import more items** — Need 20+ approved MATH P1 items to fill 150-mark papers
2. **Test paper retrieval** — `GET /api/qbank/papers/:id` with full item details
3. **Test staging workflow** — Bulk import → approve → verify live items
4. **Add topic weighting** — Current selection is random, not weighted by CAPS
5. **Add marks validation** — Ensure sum of section marks equals spec total
6. **Commit to Git** — All changes ready for commit
7. **Update docs** — Discovery file, development plan, handover note all need commit

---

## Environment

- **Repo:** `C:\dev\nsc-qbank`
- **Database:** `nsc_qbank` (MySQL 8.0.45)
- **Cross-ref DB:** `nsc_registration_v3` (subject_structure only)
- **Node:** v24.14.0
- **Port:** 4000
- **MySQL User:** root (password: Hilton@66)
- **MySQL Path:** `C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`

---

*End of AI Handover Note — 7 June 2026*
*All data verified from actual database queries and file system*
