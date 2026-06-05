# NSC QBank API v1

Phase 3 implementation for nsc_registration_v3

## Setup
1. npm install
2. cp .env.example .env (edit credentials)
3. npm start

## Endpoints

### Items
POST /api/qbank/items - create item
GET /api/qbank/items?subject=19331054&paper=1 - list
GET /api/qbank/items/:id - get with options

### Papers
POST /api/qbank/papers/generate
Body: {"subject_official_code":"19331054","paper_no":1,"title":"MATH P1 Trial 2026"}

GET /api/qbank/papers/:id
GET /api/qbank/papers/:id/export

### Specs
GET /api/qbank/specs
GET /api/qbank/specs/10351024/1

## Field Mapping (CRITICAL)
- Uses subject_official_code: '10351024' (AGRM), '19331054' (MATH)
- NOT alpha codes
- All FKs validated against subject_structure
