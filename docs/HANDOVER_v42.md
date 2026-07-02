# QBank Batch Parser Import — AI Handover Note v42
**Date:** 2026-07-01 12:01 SAST
**Status:** IN PROGRESS — Language code mapping fixed, ready to update step1_preprocessing.js and test batch import
**Next AI:** K2.6 (same model, restart chat with "Restart Qbank Parser chat")
**Database:** nsc_qbank (MySQL 8.0.45)
**Repo:** C:\dev\nsc-qbank
**Branch:** main
**Git HEAD:** aeeea08 (2026-06-30)
**Backend Port:** 4000
**Frontend Port:** 3000

---

## 1. WHAT WAS ACCOMPLISHED TODAY (2026-07-01)

### 1.1 Language Code Mapping Fixed ✅
**Problem:** Machine-format filenames use language codes like `ENG`, `AFR`, `SETSWANA`, `ISINDEBELE`, `SASL` but database `lookup_languages` had short codes `EN`, `AF`, `TN`, `ND`, etc.

**Solution:** Added `parser_language_code` column to `lookup_languages` table:
- Maps existing `language_code` → `parser_language_code`
- Added SASL (South African Sign Language) as new entry
- All existing codes preserved, no breaking changes

**Current mappings:**
| language_code | parser_language_code | language_name |
|--------------|---------------------|---------------|
| EN | ENG | English |
| AF | AFR | Afrikaans |
| ZU | ISIZULU | isiZulu |
| XH | ISIXHOSA | isiXhosa |
| ST | SESOTHO | Sesotho |
| TN | SETSWANA | Setswana |
| NS | SISWATI | siSwati |
| ND | ISINDEBELE | isiNdebele |
| TS | XITSONGA | Xitsonga |
| VE | TSHIVENDA | Tshivenda |
| SA | SASL | South African Sign Language |

### 1.2 Rename System Complete ✅
- All 387 files in machine format
- 0 errors, 0 old-format files remaining
- SASL alias working
- Assessment type validation (HL/FAL/SAL) working
- isMachineFormat regex handles all edge cases

---

## 2. WHAT NEEDS TO BE DONE NEXT

### 2.1 Update step1_preprocessing.js (CRITICAL — NEXT STEP)
**File:** `C:\dev\nsc-qbank\routes\v3\step1_preprocessing.js`

**Current problem:** `lookupAllIds` function queries `lookup_languages` by `language_code` but should use `parser_language_code`.

**Current code (line ~287):**
```javascript
const [langRows] = await db.query('SELECT language_id FROM lookup_languages WHERE language_code = ?', [langCode]);
```

**Must change to:**
```javascript
const [langRows] = await db.query('SELECT language_id FROM lookup_languages WHERE parser_language_code = ?', [langCode]);
```

**Also:** The `LANGUAGE_MAP` object (lines ~30-50) maps filename codes to database codes. Since database now has `parser_language_code`, this mapping can be simplified or removed. But keep it as fallback for safety.

### 2.2 Test Batch Parser Import
**Endpoint:** `POST /api/v3/parser/batch`
**Body:**
```json
{
  "folder_path": "C:\\dev\\nsc-qbank\\docs\\Question Papers",
  "year_id": 5,
  "grade_id": 3,
  "assessment_type_id": 1,
  "assessment_body_id": 1,
  "create_production_items": false
}
```

**Expected:** 192 QP+Memo pairs processed, inserted into `parse_sessions`, `parse_results`, `parse_memos`

### 2.3 Verify Auto-Promote to item_master
**From HANDOVER_v40:** Auto-promote was working with 2,436 items. Need to verify it still works with the new batch.

### 2.4 Fix Wrong Subject Codes (if any)
Some files may still have wrong subject codes from buggy rename (e.g., `SETSWANAHOMELANGUAGE_SAL` instead of `SETSWANASECONDADDITIONALLANGUAGE_SAL`). Check during import and fix if needed.

---

## 3. CRITICAL FILES

| File | Purpose | Status |
|------|---------|--------|
| `routes/v3/batch_parser.js` | Main batch parser route | ✅ Fixed (rename system) |
| `routes/v3/step1_preprocessing.js` | File pairing & ID lookup | ⚠️ NEEDS UPDATE (language_code → parser_language_code) |
| `backend/parsers/parser_api_v2.py` | Python parser API | ✅ Working |
| `backend/parsers/master_harness_v2.py` | Combines 4 parsers | ✅ Working |

---

## 4. DATABASE SCHEMA CHANGES (2026-07-01)

### lookup_languages — ADDED COLUMN
```sql
ALTER TABLE lookup_languages 
ADD COLUMN parser_language_code VARCHAR(20) NULL AFTER language_code,
ADD INDEX idx_parser_language_code (parser_language_code);
```

**Data populated for all 11 languages + SASL.**

---

## 5. HOW TO CALL BACK THE AI

**Say exactly:**
```
Restart Qbank Parser chat using the same AI for context and continuity.
```

**Or upload this handover note and say:**
```
Continue from HANDOVER_v42. Update step1_preprocessing.js to use parser_language_code and test batch import.
```

---

## 6. TESTING CHECKLIST

- [ ] Update `step1_preprocessing.js` line ~287: `language_code` → `parser_language_code`
- [ ] Restart backend
- [ ] Test batch parser with 1-2 files first
- [ ] Check `parse_sessions` table for successful entries
- [ ] Check `parse_results` for question items
- [ ] Check `parse_memos` for memo items
- [ ] Verify auto-promote to `item_master` if enabled
- [ ] Run full import for all 192 pairs
- [ ] Commit changes

---

*End of Handover Note v42*
*Date: 2026-07-01 12:01 SAST*
*Next Session: Update step1_preprocessing.js + Test batch import*
