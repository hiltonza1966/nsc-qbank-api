# QBank Discovery File

**Generated:** 5 June 2026

## Architecture
- Express API with routes under `/api/qbank`
- PostgreSQL tables: `qbank_items`, `qbank_papers`, `qbank_paper_items`, `qbank_paper_specs`
- Generation logic in `routes/papers.js`

## Key Findings
### 1. Schema drift
- Production DB missing columns added in code first approach
- `qbank_papers.spec_id` referenced in INSERT but column absent
- Fixed via manual ALTER – needs migration

### 2. Generation flow
```
POST /generate → lookup spec → SELECT items WHERE subject/paper/grade
→ ORDER BY RANDOM() LIMIT 20 → INSERT paper → INSERT items
```
- LIMIT 20 is temporary; should read from `qbank_paper_specs.total_items`

### 3. Data coverage
- MATH P1: 187 items (Grade 12, 2020-2024)
- MATH P2: 0 items – needs import
- PHYS P1/P2: items exist but no specs

### 4. API endpoints verified
- `GET /api/qbank/items?subject=MATH` – OK
- `POST /api/qbank/papers/generate` – OK after fix
- `GET /api/qbank/papers/:id` – returns paper with items

## Risks
- No migrations folder – schema changes not reproducible
- No validation of marks allocation
- Random selection without topic weighting
