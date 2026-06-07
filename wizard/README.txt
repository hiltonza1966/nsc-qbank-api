NSC QBank Wizard - Item Import (Updated 7 June 2026)

1. Extract this zip to C:\dev\nsc-qbank\
   You will get: C:\dev\nsc-qbank\wizard\index.html

2. No changes to server.js, routes, or database required.
   All migrations already applied.

3. Start API:
   cd C:\dev\nsc-qbank
   npm start

4. Open wizard in browser:
   Double-click wizard\index.html
   or visit file:///C:/dev/nsc-qbank/wizard/index.html

Workflow (Updated):
- POST to /api/staging/bulk (NOT /api/qbank/items/bulk)
- Fields: subject_official_code, paper_no, question_text, marks, cognitive_level, difficulty, created_by, source_year, source_exam_board, source_paper_code, batch
- No tagging during import — tagging done at later stage
- Items saved to qbank_items_staging (not live qbank_items)
- Markdown preview shown for each item
- Image paste detected — OCR placeholder added (server-side OCR to be implemented)
- PDFs rendered client-side only for reference

Verified against routes/staging.js lines 14-52.
