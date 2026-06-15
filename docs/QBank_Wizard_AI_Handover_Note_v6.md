# QBank Wizard - AI Handover Note v6
**Version:** v6.0  
**Date:** 15 June 2026 16:40 SAST  
**System:** NSC QBank Corporate System  
**Repository:** `C:\dev\nsc-qbank`  
**Database:** `nsc_qbank` (MySQL, root/Hilton@66)  
**Backend Port:** 4000 (`node server.js` from repo root)  
**Frontend Port:** 3000 (`npm run dev` from `frontend/`)  
**Git Branch:** main  
**Last Commit:** `2c2fdec` — Documentation updated  

---

## PARSER PROBLEMS DETECTED (2026-06-15)

### Database Evidence (Verified via SQL)

| Problem | Evidence | Severity |
|---------|----------|----------|
| **Duplicate sessions** | GEOG_P2_NOV_2024: 9 sessions, 1 unique hash | 🔴 Critical |
| **Duplicate questions** | `1.1` appears 10× in same session | 🔴 Critical |
| **Section total bug** | `2.4.4`: parser=38, expected=4, variance=+34 | 🔴 Critical |
| **Parent headers as items** | `1.1`, `1.2`, `2.1`, `2.4` have empty text, 0 marks | 🔴 Critical |
| **Memo paper codes wrong** | `_1_EXAM_2025`, `16351054_P2_EXAM_2024` | 🟡 Medium |

### Root Cause Analysis

**1. Over-splitting (the big one)**
- Parser finds 76 items but loads 104 results
- Cause: `1.1`, `2.4` etc. are **parent headers**, not actual questions
- The regex `r'(\d+\.\d+)'` matches 2-part numbers which are section headers
- Fix: Only match 3-part numbers `r'^\s*(\d+\.\d+\.\d+)'` at line start

**2. Section total marks bug**
- `2.4.4` should have 4 marks, parser extracts 38
- Cause: `extract_marks_qp()` searches entire text block (500+ chars)
- It finds `(38)` — the section total for 2.4 — instead of `(4)` near the question
- Fix: Limit search window to 80 characters after question number

**3. Duplicate insertions**
- Same question number inserted multiple times per session
- Cause: No `UNIQUE KEY` on `(session_id, question_number)`
- Fix: Add `ALTER TABLE parse_results ADD UNIQUE KEY uniq_session_question (session_id, question_number)`
- Also: Check before insert in Python parser

**4. Null questions**
- `1.1`, `1.2`, `2.1` etc. have empty question_text
- Cause: These are parent headers with no actual question text
- Fix: Skip 2-part numbers entirely — they are not questions

**5. Memo paper codes**
- Memo gets codes like `_1_EXAM_2025` instead of `GEOGRAPHY_P2_NOV_2024`
- Cause: Frontend sends wrong paper_code or backend builds it incorrectly
- Fix: Verify memo upload uses same paper_code as QP

---

## FIX PLAN (Approved for Implementation)

### Fix 1: Database Constraint (SQL)
```sql
ALTER TABLE parse_results ADD UNIQUE KEY uniq_session_question (session_id, question_number);
```
**Prevents:** Duplicate question numbers per session

### Fix 2: Python Parser — Question Number Pattern
**File:** `scripts/extract_dbe_paper.py`
**Current:** `r'(\d+\.\d+)'` — matches 2-part numbers (parent headers)
**New:** `r'^\s*(\d+\.\d+\.\d+)'` — only matches 3-part numbers at line start
**Result:** Skips `1.1`, `2.4` (headers), extracts `1.1.1`, `2.4.4` (actual questions)

### Fix 3: Python Parser — Marks Search Window
**File:** `scripts/extract_dbe_paper.py`
**Function:** `extract_marks_qp(text)`
**Current:** Searches entire text block for `(XX)`
**New:** Only search within 80 characters after the question number
**Result:** Finds `(4)` near `2.4.4`, ignores `(38)` at section header

### Fix 4: Python Parser — Skip Section Headers
**File:** `scripts/extract_dbe_paper.py`
**Current:** Extracts any line starting with `1.1`, `2.4` etc.
**New:** Skip lines where question number has only 2 parts (e.g., `1.1`, `3.2`)
**Result:** Only actual sub-questions (3 parts) become items

### Fix 5: Memo Paper Code
**File:** `frontend/src/pages/WizardPage.tsx` or `routes/pdfExtract.js`
**Current:** Memo may get different paper_code than QP
**New:** Ensure memo uses exact same paper_code as QP session
**Result:** Memo links correctly to QP items

---

## EXPECTED RESULTS AFTER FIX

| Metric | Current | After Fix | Target |
|--------|---------|-----------|--------|
| QP Items | 76 | ~40 | ~40 |
| Memo Items | 104 | ~40 | ~40 |
| Total Marks | 177 | 150 | 150 |
| Red Flags | 57 | <5 | 0 |
| Null Questions | 10 | 0 | 0 |
| Duplicate Questions | 10× | 1× | 1× |

---

## BACKUP PLAN

Before any parser changes:
1. Copy `extract_dbe_paper.py` to `scripts/BACKUP/` 
2. Commit current state to git
3. Test fix on one Geography PDF
4. Verify no regression on Accounting PDF (which currently works)

---

## CRITICAL RULES FOR PARSER FIX

1. **Accounting PDF must still work** — it's the baseline (17 items, 0 red flags)
2. **Only change question number regex and marks search window** — don't touch other logic
3. **Test on Geography first** — it has the section total bug
4. **Verify with SQL after each test** — check `parse_results` for duplicates and red flags
5. **Add UNIQUE KEY before parser fix** — prevents duplicate insertions during testing

---

## END OF HANDOVER NOTE v6

*Parser problems documented. Fix plan approved. Ready for implementation.*
*Date: 2026-06-15 16:40 SAST*