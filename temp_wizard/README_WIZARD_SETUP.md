# QBank Wizard Pipeline - Setup Instructions
# Date: 2026-06-14
# Version: 1.0

## NEW FILES TO ADD

1. scripts/extract_dbe_paper.py        -> C:\dev
sc-qbank\scripts\extract_dbe_paper.py
2. routes/pdfExtract.js                -> C:\dev
sc-qbankoutes\pdfExtract.js
3. routes/wizardImport.js              -> C:\dev
sc-qbankoutes\wizardImport.js
4. database/migrations/017_wizard_pipeline.sql -> C:\dev
sc-qbank\database\migrations_wizard_pipeline.sql
5. frontend/src/pages/WizardPage.tsx   -> C:\dev
sc-qbankrontend\src\pages\WizardPage.tsx

## MODIFICATIONS TO EXISTING FILES

### server.js (C:\dev
sc-qbank\server.js)

Add these two lines near the top with other requires:

    const pdfExtractRouter = require('./routes/pdfExtract');
    const wizardImportRouter = require('./routes/wizardImport');

Add these two lines near other app.use() calls:

    app.use('/api/wizard', pdfExtractRouter);
    app.use('/api/wizard', wizardImportRouter);

### package.json (C:\dev
sc-qbank\package.json)

Add to dependencies if not present:

    "multer": "^1.4.5-lts.1",
    "python-shell": "^5.0.0"

Run:

    cd C:\dev
sc-qbank
    npm install multer python-shell

### Python Dependencies

Run in PowerShell:

    pip install PyMuPDF

## DATABASE MIGRATION

Run the migration file:

    cd C:\dev
sc-qbank
    & "C:\Program Files\MySQL\MySQL Server 8.0in\mysql.exe" -u root -pHilton@66 nsc_qbank < database\migrations_wizard_pipeline.sql

## ROUTE SUMMARY

| Method | Route | Purpose | File |
|--------|-------|---------|------|
| POST   | /api/wizard/extract-qp | Upload QP PDF, extract items | routes/pdfExtract.js |
| POST   | /api/wizard/extract-memo | Upload Memo PDF, extract answers | routes/pdfExtract.js |
| GET    | /api/wizard/extraction-status/:session_id | Check extraction status | routes/pdfExtract.js |
| POST   | /api/wizard/import | Import validated items to item_master | routes/wizardImport.js |

## EXISTING ROUTES (UNCHANGED)

| Method | Route | Purpose | File |
|--------|-------|---------|------|
| POST   | /api/wizard/parse | Server-side QP parsing (fallback) | routes/pdf_parser_structured.js |
| POST   | /api/wizard/compare-qp | Compare parser output vs expected | routes/compare-qp.js |
| POST   | /api/wizard/save-corrections | Save user corrections | routes/compare-qp.js |
| GET    | /api/wizard/comparison/:session_id | Load review data | routes/compare-qp.js |
| POST   | /api/wizard/structure | Save expected structure | routes/compare-qp.js |
| GET    | /api/wizard/structure/:paper_code | Get expected structure | routes/compare-qp.js |
| POST   | /api/wizard/extract-memo | Extract memo (old) | routes/memo-parser.js |
| POST   | /api/wizard/compare-memo | Compare memo vs QP | routes/memo-compare.js |

## KEY DESIGN DECISIONS

1. ALL parsing happens in Python backend using PyMuPDF (fitz)
2. NO client-side parsing — frontend only uploads PDFs via FormData
3. PyMuPDF returns text grouped into lines with font metadata
4. String methods only (NO REGEX) in both Python and JS for parsing logic
5. Human-in-the-loop review via parse_results table before import
6. Import creates item_master records + item_memos links

## TROUBLESHOOTING

- If "PyMuPDF not installed" error: run `pip install PyMuPDF`
- If multer error: run `npm install multer`
- If python-shell error: run `npm install python-shell`
- If migration fails with "column already exists": migration uses IF NOT EXISTS, safe to re-run
