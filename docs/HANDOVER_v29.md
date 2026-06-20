# QBank Parser Fix - AI Handover Note v29
**Date:** 20 June 2026 20:46 SAST
**System:** NSC QBank Corporate System
**Repository:** C:\dev\nsc-qbank
**Database:** nsc_qbank (MySQL, root/Hilton@66)
**Backend Port:** 4000
**Frontend Port:** 3000
**Git Branch:** main

---

## CRITICAL FINDINGS FROM THIS SESSION

### 1. Parsers DO Extract Text ✅
- `qp_parser_option_b.py` + `fitz`: Extracts 22 items with text and marks for Accounting P1
- `memo_parser_option_b.py` + `fitz`: Extracts 22 items with text and marks for Accounting P1
- **BUT**: Frontend still shows "No text extracted" — data is lost somewhere downstream

### 2. Root Cause: Data Flow Break
The parsers work correctly. The issue is in the chain:
```
Parser → master_harness.py → parser_api.py → parser.js → Frontend
```
The text exists in parser output but disappears before reaching the review panel.

### 3. Corporate Review Requires More Than Text
For Accounting papers, questions ARE tables and financial statements. A proper corporate QBank review requires:
- **Question text** + images/diagrams from QP pages
- **Answer text** + marking guideline tables from Memo pages
- **Side-by-side comparison** of QP vs Memo
- **Page references** for manual verification
- **Complete mark comparison** (QP marks vs Memo marks vs Final)

---

## FILES CREATED IN KIMI HARNESS

| File | Path | Purpose |
|------|------|---------|
| qp_parser_enhanced.py | /mnt/agents/output/ | Extracts text + images + tables + page refs per question |
| memo_parser_enhanced.py | /mnt/agents/output/ | Extracts text + images + tables + page refs per answer |
| master_harness_enhanced.py | /mnt/agents/output/ | Combines QP+Memo with full visual content |
| ParserReviewPanel_enhanced.tsx | /mnt/agents/output/ | Side-by-side review with images/tables inline |

---

## TEST RESULTS

### QP Parser Test (Accounting P1 Nov 2025)
```
Found 22 items
1.1: 6 marks - Refer to Information B. Calculate the correct value of the c...
1.2: 8 marks - Prepare the Ordinary Share Capital Note....
1.3: 36 marks - Prepare the Statement of Financial Position on 28 February 2...
2.1: 4 marks - Calculate the following amounts in respect of the Reconcilia...
2.2: 23 marks - Complete the Cash Flow Statement for the year ended 28 Febru...
2.3: 5 marks - Calculate the following financial indicators for the year en...
2.4: 2 marks - The directors should be concerned about the cash resources o...
3.1.1: 0 marks - Choose the correct word(s) to complete each of the following...
3.1.3: 3 marks - Guidelines for the preparation of financial statements to en...
3.1.2: 0 marks - Choose the correct word(s) to complete each of the following...
3.2.1: 4 marks - Operating efficiency: The CEO believes that the company's pr...
3.2.2: 4 marks - Liquidity: Explain how the credit policy has improved the li...
3.2.3: 2 marks - Shareholding of Lewis Clark in Shorts Ltd Refer to Informati...
3.3.1: 4 marks - Returns and dividends pay-out policy: • The CEOs of both com...
3.3.2: 4 marks - Share price: Comment on the shareholders' satisfaction with ...
3.4: 3 marks - Lynn Ltd The debt-equity ratio indicates that additional loa...
3.5: 2 marks - Audit report of Lynn Ltd • Explain why the shareholders shou...
4.1: 2 marks - Some shareholders are concerned about the donations made for...
4.2: 2 marks - • Explain TWO points why it is important for employees to re...
4.3: 2 marks - Explain the meaning of the term insolvent....
4.4: 3 marks - Comment on how the 'rights issue' improved the solvency of t...
4.5: 4 marks - Give TWO reasons why the existing shareholders responded pos...
```

### Memo Parser Test (Accounting P1 Nov 2025 MG)
```
Found 22 items
1.1: 3 marks - Calculate the correct value of the closing stock of men's i...
1.2: 8 marks - ORDINARY SHARE CAPITAL NOTE...
1.3: 36 marks - STATEMENT OF FINANCIAL POSITION ON 28 FEBRUARY 2025...
2.1: 4 marks - Reconciliation of Profit before Taxation and Cash Generated f...
2.2: 23 marks - CASH FLOW STATEMENT FOR THE YEAR ENDED 28 FEBRUARY 2025...
2.3: 5 marks - Calculate the following financial indicators for the year en...
2.4: 2 marks - Reason Figure/s • The cash and cash equivalents have changed ...
3.1.1: 1 marks - International Financial Reporting Standards (IFRS)...
3.1.2: 1 marks - Director...
3.1.3: 1 marks - Companies and Intellectual Properties Commission (CIPC)...
3.2.1: 4 marks - Operating efficiency: The CEO believes that the company's pr...
3.2.2: 4 marks - Liquidity: Explain how the credit policy has improved the li...
3.2.3: 4 marks - Shareholding of Lewis Clark in Shorts Ltd: Provide a calcula...
3.3.1: 4 marks - Returns and dividends pay-out policy: The CEOs of both comp...
3.3.2: 4 marks - Share price: Comment on the shareholders' satisfaction with ...
3.4: 3 marks - Lynn Ltd The debt-equity ratio indicates that additional loa...
3.5: 2 marks - Audit report of Lynn Ltd: Explain why the shareholders should...
4.1: 2 marks - Some shareholders are concerned about the donations made for...
4.2: 2 marks - Explain TWO points why it is important for employees to repor...
4.3: 2 marks - Explain the meaning of the term insolvent....
4.4: 4 marks - Comment on how the 'rights issue' improved the solvency of t...
4.5: 2 marks - Give TWO reasons why the existing shareholders responded pos...
```

---

## KNOWN ISSUES

### Issue 1: Mark Mismatches
Some items have different marks in QP vs Memo:
- 1.1: QP=6, Memo=3 (Memo only shows part-marks, not total)
- 2.1: QP=4, Memo=4 (but QP has sub-parts 3+4=7?)
- 2.3: QP=5, Memo=5 (but QP has sub-parts 3+5+5=13?)
- 3.1.1: QP=0, Memo=1 (QP shows "3x 1" combined)

### Issue 2: Missing Visual Content
Current parser extracts text only. Images and tables are lost. For Accounting:
- Financial statements (tables) are not preserved
- Marking guideline tables are not preserved
- Diagrams/formulas are not extracted

### Issue 3: Data Flow Break
Text exists in parser output but frontend shows "No text extracted". Need to trace:
- master_harness.py return format
- parser_api.py JSON serialization
- parser.js response formatting
- ParserReviewPanel.tsx field mapping

---

## NEXT STEPS (Priority Order)

### P1: Fix Data Flow (Critical)
1. Run `test_harness.py` to see full harness output
2. Verify field names match between backend and frontend
3. Fix any mismatches in parser.js or parser_api.py

### P2: Deploy Enhanced Parsers (High)
1. Update `qp_parser_option_b.py` with enhanced version
2. Update `memo_parser_option_b.py` with enhanced version
3. Update `master_harness.py` with enhanced version
4. Add image extraction directories

### P3: Update Review Panel (High)
1. Deploy `ParserReviewPanel_enhanced.tsx`
2. Add image display components
3. Add table rendering components
4. Add page reference links

### P4: Handle Sub-Questions (Medium)
- Items like 2.1 have sub-parts (3 + 4 marks)
- Items like 3.1.1-3.1.3 are grouped (3x 1 marks)
- Need to either split or combine properly

### P5: Batch Processing (Low)
- Add batch mode UI to WizardPage
- Enable multi-subject processing
- Add folder scanning endpoint

---

## FILES TO DEPLOY

### Backend Parsers
```
backend/parsers/qp_parser_option_b.py          → Enhanced version with image extraction
backend/parsers/memo_parser_option_b.py        → Enhanced version with image extraction
backend/parsers/master_harness.py              → Enhanced version with full data
backend/parsers/bilingual_cleaner.py           → No changes needed
```

### Frontend Components
```
frontend/src/components/ParserReviewPanel.tsx  → Enhanced version with images/tables
frontend/src/pages/WizardPage.tsx               → May need batch mode tabs
```

### Routes
```
routes/parser.js                                 → Verify /parse-qp and /parse-memo endpoints
```

---

## DEPLOYMENT COMMANDS

```powershell
# 1. Backup current files
cd C:\dev\nsc-qbank\backend\parsers
Copy-Item qp_parser_option_b.py qp_parser_option_b_v28.py
Copy-Item memo_parser_option_b.py memo_parser_option_b_v28.py
Copy-Item master_harness.py master_harness_v28.py

# 2. Copy enhanced files (adjust paths as needed)
Copy-Item "C:\Users\visagie.h\Downloads\qp_parser_enhanced.py" qp_parser_option_b.py
Copy-Item "C:\Users\visagie.h\Downloads\memo_parser_enhanced.py" memo_parser_option_b.py
Copy-Item "C:\Users\visagie.h\Downloads\master_harness_enhanced.py" master_harness.py

# 3. Create image directories
New-Item -ItemType Directory -Force -Path "C:\dev\nsc-qbank\uploads\qp_images"
New-Item -ItemType Directory -Force -Path "C:\dev\nsc-qbank\uploads\memo_images"

# 4. Rebuild frontend
cd C:\dev\nsc-qbank\frontend
npm run build

# 5. Restart backend
Get-Process node | Stop-Process -Force
cd C:\dev\nsc-qbank
node server.js
```

---

## TEST PLAN

1. Upload Accounting P1 Nov 2025 QP + Memo
2. Verify all 22 items show in review panel
3. Verify each item shows:
   - Question text (not "No text extracted")
   - QP Marks and Memo Marks
   - Final marks
   - Expandable to see full content
4. Verify images are extracted and displayed
5. Verify tables are rendered properly
6. Approve and import to database
7. Verify imported items in QBank

---

## ROLLBACK PLAN

If issues occur:
```powershell
cd C:\dev\nsc-qbank\backend\parsers
Copy-Item qp_parser_option_b_v28.py qp_parser_option_b.py
Copy-Item memo_parser_option_b_v28.py memo_parser_option_b.py
Copy-Item master_harness_v28.py master_harness.py
Get-Process node | Stop-Process -Force
cd C:\dev\nsc-qbank
node server.js
```

---

*End of Handover Note v29*
*Date: 2026-06-20 20:46 SAST*
