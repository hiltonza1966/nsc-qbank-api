AI HANDOVER NOTE — QP \& Memo Register Surgical Fix

Date: 26 June 2026 07:42 SAST

Status: System tested, filters not working for Parsed data. Database data shows 0 (item\_master empty).

Files: qp\_memo\_register.js (backend), QPMemoRegister.tsx (frontend)

Repo: C:\\dev\\nsc-qbank

Database: nsc\_qbank (MySQL 8.0.45)

PROBLEM STATEMENT

1\. Parsed Data Filters Show "0 Papers"

When Subject=Accounting (12351024), Body=DBE, Language=English, Year=2025, Session=NOV are selected, the register shows 0 papers despite 48 total papers existing in the database.

Root Cause: The backend applies AND logic across ALL filters simultaneously. parse\_sessions table has nullable fields (assessment\_body\_id, assessment\_type\_id, grade\_id, year\_id, subject\_id, paper\_id). When any selected filter value doesn't match a paper's metadata (or the metadata is NULL), that paper is excluded.

Paper code format: ACCO\_P1\_2025\_NOV\_ENG (SUBJ\_P#\_YYYY\_SESSION\_LANG)

2\. Database Data Shows All Zeros

item\_master table has 0 records. item\_memos table has 0 records. The database source query runs but returns empty because no data exists in these tables.

REQUIRED SURGICAL FIX

A. Backend (qp\_memo\_register.js) — 3 Changes

Change 1: Remove Server-Side Filtering

The backend should return ALL data without filtering. The current server-side filter logic must be removed or disabled. The backend should only:



&#x20;   Query all paper\_codes from parse\_results (QP) + parse\_memos

&#x20;   Enrich with metadata from parse\_sessions and lookup\_subjects

&#x20;   Return the complete dataset



Change 2: Derive ALL Filter Values from Data (Not Lookup Tables)

Instead of returning filter options from lookup\_assessment\_bodies, lookup\_assessment\_types, etc., the backend should derive filter options from the actual data:

For Parsed Data:



&#x20;   subjects: DISTINCT subject\_official\_code + subject\_name + subject\_alpha\_code from papers that exist

&#x20;   years: DISTINCT year extracted from paper\_code parts\[2]

&#x20;   sessions: DISTINCT session extracted from paper\_code parts\[3]

&#x20;   languages: DISTINCT language mapped from paper\_code parts\[4]

&#x20;   paper\_nos: DISTINCT paper\_no extracted from paper\_code parts\[1]

&#x20;   grades: DISTINCT grade from parse\_sessions (may be sparse)

&#x20;   assessment\_bodies: DISTINCT body\_code from lookup\_assessment\_bodies joined via parse\_sessions.assessment\_body\_id

&#x20;   assessment\_types: DISTINCT type\_code from lookup\_assessment\_types joined via parse\_sessions.assessment\_type\_id



For Database Data:



&#x20;   Same structure but derived from item\_master + item\_memos



Change 3: Fix Database Source Query

The database source currently uses m.marks for memo corrected marks but should use im.memo\_marks (from item\_master) or handle the fact that item\_memos only has marks column. Also, item\_master is empty so this will always return 0 — this is correct behavior, but the query should not error.

B. Frontend (QPMemoRegister.tsx) — 4 Changes

Change 1: Cascading Filter Logic

When Subject is selected, ALL other filter dropdowns must update to show only values that exist for papers matching the selected subject.

Implementation:

TypeScript



// When selectedSubject changes, derive available filter values from filtered data

const availableFilters = useMemo(() => {

&#x20; const subjectFiltered = selectedSubject 

&#x20;   ? data.filter(r => r.subject\_official\_code === selectedSubject || r.subject\_code === selectedSubject || r.subject\_alpha\_code === selectedSubject)

&#x20;   : data;

&#x20; 

&#x20; return {

&#x20;   bodies: \[...new Set(subjectFiltered.map(r => r.assessment\_body\_id).filter(Boolean))],

&#x20;   types: \[...new Set(subjectFiltered.map(r => r.assessment\_type\_id).filter(Boolean))],

&#x20;   years: \[...new Set(subjectFiltered.map(r => r.year).filter(Boolean))],

&#x20;   sessions: \[...new Set(subjectFiltered.map(r => r.session).filter(Boolean))],

&#x20;   languages: \[...new Set(subjectFiltered.map(r => r.language).filter(Boolean))],

&#x20;   grades: \[...new Set(subjectFiltered.map(r => r.grade).filter(Boolean))],

&#x20;   paper\_nos: \[...new Set(subjectFiltered.map(r => r.paper\_no).filter(Boolean))],

&#x20; };

}, \[data, selectedSubject]);



Change 2: Filter Dropdowns Use Derived Options

Filter dropdowns should use the availableFilters derived from data, not the filters prop from the backend. The filters prop from backend is only used for the initial Subject dropdown.

Change 3: Apply Filters in Correct Order

Filter application order:



&#x20;   Subject (root filter)

&#x20;   All other filters (AND logic within the subject-filtered subset)



TypeScript



const applyFilters = () => {

&#x20; let filtered = \[...data];

&#x20; 

&#x20; // 1. Subject filter first (root)

&#x20; if (selectedSubject) {

&#x20;   filtered = filtered.filter(r => 

&#x20;     r.subject\_official\_code === selectedSubject ||

&#x20;     r.subject\_code === selectedSubject ||

&#x20;     r.subject\_alpha\_code === selectedSubject

&#x20;   );

&#x20; }

&#x20; 

&#x20; // 2. All other filters (AND within subject subset)

&#x20; if (selectedBody) filtered = filtered.filter(r => r.assessment\_body\_id === parseInt(selectedBody));

&#x20; if (selectedType) filtered = filtered.filter(r => r.assessment\_type\_id === parseInt(selectedType));

&#x20; if (selectedSession) filtered = filtered.filter(r => r.session === selectedSession);

&#x20; if (selectedGrade) filtered = filtered.filter(r => String(r.grade) === selectedGrade);

&#x20; if (selectedPaperNo) filtered = filtered.filter(r => String(r.paper\_no) === selectedPaperNo);

&#x20; if (selectedLanguage) filtered = filtered.filter(r => r.language === selectedLanguage);

&#x20; if (selectedYear) filtered = filtered.filter(r => String(r.year) === selectedYear);

&#x20; if (searchTerm) {

&#x20;   const term = searchTerm.toLowerCase();

&#x20;   filtered = filtered.filter(r => 

&#x20;     (r.display\_paper\_code || r.paper\_code).toLowerCase().includes(term)

&#x20;   );

&#x20; }

&#x20; 

&#x20; setFilteredData(filtered);

};



Change 4: Add "Paper No" Filter

Add a Paper No dropdown filter that was missing from the UI.

C. Database Source Fix

The database source (item\_master + item\_memos) currently returns 0 because:



&#x20;   item\_master has 0 records

&#x20;   item\_memos has 0 records



This is correct behavior — there's no data in the database tables. The fix should ensure the query doesn't error when tables are empty, and returns the same structure as parsed data so the UI can handle both sources uniformly.

SCHEMA VERIFICATION NEEDED

Before implementing, verify these fields exist:

sql



\-- Check parse\_sessions nullable fields

SELECT paper\_code, subject\_id, year\_id, grade\_id, paper\_id, assessment\_type\_id, assessment\_body\_id 

FROM parse\_sessions LIMIT 5;



\-- Check item\_master columns

SELECT source\_paper\_code, subject\_official\_code, subject\_alpha\_code, year\_id, grade\_id, 

&#x20;      paper\_no, assessment\_type\_id, assessment\_body\_id, language\_id, marks, qp\_marks, memo\_marks

FROM item\_master LIMIT 1;



\-- Check item\_memos columns  

SELECT item\_id, question\_number, answer\_text, marks, marking\_guideline FROM item\_memos LIMIT 1;



TESTING CHECKLIST

After fix:



&#x20;   \[ ] Load Parsed Data → shows all 48 papers

&#x20;   \[ ] Select Subject=Accounting → shows only Accounting papers

&#x20;   \[ ] With Subject=Accounting selected, Body dropdown shows only bodies available for Accounting papers

&#x20;   \[ ] Select Body=DBE → further filters to DBE Accounting papers

&#x20;   \[ ] Select Year=2025 → further filters to 2025 DBE Accounting papers

&#x20;   \[ ] Clear Subject → all filters reset to show all available values

&#x20;   \[ ] Switch to Database Data → shows 0 papers (correct, no data)

&#x20;   \[ ] No console errors

&#x20;   \[ ] No build errors



FILES TO MODIFY

Table

File	Path	Action

qp\_memo\_register.js	routes/v2/qp\_memo\_register.js	Remove server-side filtering, derive filter options from data

QPMemoRegister.tsx	frontend/src/pages/QPMemoRegister.tsx	Add cascading filters, Paper No filter, derived filter options

CRITICAL RULES



&#x20;   NO HARDCODING — All filter values must come from database/data

&#x20;   NO DROPPING EXISTING CODE — Preserve all existing functionality (CRUD, batch fixes, diagnostics, item editing)

&#x20;   SURGICAL FIX ONLY — Change only filter logic and filter dropdown population

&#x20;   NO SERVER-SIDE FILTERING — Backend returns all data; frontend filters client-side

&#x20;   CASCADING FILTERS — Subject is root; all other filters derive from subject selection



End of Handover Note

Date: 2026-06-26 07:42 SAST

