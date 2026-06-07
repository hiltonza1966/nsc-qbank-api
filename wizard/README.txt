NSC QBank Wizard - Installation

1. Extract this zip to C:\dev\nsc-qbank\
   You will get: C:\dev\nsc-qbank\wizard\index.html

2. No changes to server.js, routes, or database.

3. Start API:
   cd C:\dev\nsc-qbank
   npm run dev

4. Open wizard in browser:
   Double-click wizard\index.html
   or visit file:///C:/dev/nsc-qbank/wizard/index.html

Workflow matches your API exactly:
- POST to /api/qbank/items/bulk
- Fields: subject_official_code, paper_no, question_text, marks, topic, cognitive_level, difficulty, created_by, source_year, source_exam_board, source_paper_code
- Verified against routes/items.js lines 6-12 and 26-32

No regex used. PDFs are rendered client-side only for reference.
