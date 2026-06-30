# QBank Batch Parser Rename System Fix — AI Handover Note v41
**Date:** 2026-06-30
**Status:** COMPLETE — Batch parser rename system fully functional, all files in machine format

---

## 1. WHAT WAS FIXED (2026-06-30 Session)

### 1.1 SASL Subject Alias
- **Problem:** "SASL" (South African Sign Language) files failed rename because "SASL" shares zero words with "South African Sign Language Home Language"
- **Fix:** Added hardcoded alias mapping in `buildRenamePreview`: `SASL` → `SOUTHAFRICANSIGNLANGUAGEHOMELANGUAGE`
- **Result:** All 6 SASL files now rename correctly

### 1.2 Assessment Type Validation (HL/FAL/SAL)
- **Problem:** FAL/SAL files were mapping to Home Language subjects via fuzzy matching (e.g., "English FAL" → `ENGLISHHOMELANGUAGE` instead of `ENGLISHFIRSTADDITIONALLANGUAGE`)
- **Fix:** Added post-fuzzy-match validation that checks if the matched `parser_subject_code` ends with the correct assessment type suffix (HOMELANGUAGE/FIRSTADDITIONALLANGUAGE/SECONDADDITIONALLANGUAGE)
- **Result:** FAL/SAL files now correctly map to their respective subject variants

### 1.3 Duplicate Language Code Fix
- **Problem:** QP files with type suffixes (e.g., "Transcription") had language code appended twice: `_SASL_QP_Transcription_SASL.pdf`
- **Fix:** Removed trailing `+ '_' + language` in `buildMachineFilename` for QP+typeSuffix branch
- **Result:** Filenames now correctly end with type suffix only

### 1.4 isMachineFormat Regex Fixes
- **Problem 1:** Hyphen in `MAY-JUNE` not matched by `[A-Z0-9_&]`
- **Fix 1:** Added hyphen `-` to character class: `[A-Z0-9_&-]`
- **Problem 2:** `Memo` has lowercase letters (`e`, `m`, `o`) but regex was case-sensitive
- **Fix 2:** Added case-insensitive flag `/i`: `/^[A-Z0-9_&-]+$/i`
- **Problem 3:** `&` in "Engineering Graphics & Design" not matched (was already in regex, but case sensitivity was the real issue)
- **Result:** All machine-format files now correctly recognized as machine format

### 1.5 Old-Format Duplicate Cleanup
- **Problem:** Old-format files coexisted with machine-format files after rename, causing repeated rename attempts
- **Fix:** Deleted old-format files that had machine-format equivalents
- **Result:** Zero duplicate files, clean folder state

---

## 2. FILES CHANGED
- `routes/v3/batch_parser.js` — Core rename logic fixes (SASL alias, assessment type validation, duplicate language, isMachineFormat regex)

---

## 3. RENAME SYSTEM STATUS

### Current State (2026-06-30 21:42)
- **Total files in Question Papers folder:** 387
- **Machine format (skipped):** 387
- **Old format (renamed):** 0
- **Errors:** 0
- **All files successfully renamed to standard format**

### Standard Filename Format
```
{SUBJECT}_{PAPER}_{YEAR}_{SESSION}_{LANGUAGE}_{TYPE}.pdf
```

Examples:
- `ACCOUNTING_P1_2025_NOV_ENG_QP.pdf`
- `AFRIKAANSHOMELANGUAGE_HL_P1_2025_NOV_AFR_Memo_AFR.pdf`
- `SOUTHAFRICANSIGNLANGUAGEHOMELANGUAGE_HL_P1_2025_MAY_JUNE_SASL_QP_Transcription.pdf`

---

## 4. KNOWN ISSUES (For Next Session)

### 4.1 Wrong Subject Codes from Buggy Rename
Some files were renamed with the old buggy code (before assessment type fix) and have incorrect subject codes:
- `SETSWANAHOMELANGUAGE_SAL_P1...` → Should be `SETSWANASECONDADDITIONALLANGUAGE_SAL_P1...`
- `ENGLISHHOMELANGUAGE_FAL_P1...` → Should be `ENGLISHFIRSTADDITIONALLANGUAGE_FAL_P1...`
- `TSHIVENDAHOMELANGUAGE_FAL_P3...` → Should be `TSHIVENDAFIRSTADDITIONALLANGUAGE_FAL_P3...`
- `SISWATIHOMELANGUAGE_FAL_P3...` → Should be `SISWATIFIRSTADDITIONALLANGUAGE_FAL_P3...`

**Impact:** These files will FAIL database lookup when batch parser tries to import them, because the `parser_subject_code` doesn't exist in `lookup_subjects`.

### 4.2 Language Code Inconsistency for Language Subjects
Language subjects use the full subject name as language code (e.g., `ISINDEBELE`, `SETSWANA`, `XITSONGA`) instead of short codes (`AFR`, `ENG`). This is inconsistent with non-language subjects but functional.

### 4.3 Grade Not in parser_subject_code
Current `parser_subject_code` values don't include grade (e.g., `ACCOUNTING` not `ACCOUNTING_G12`). When adding Grade 10/11, we'll need to either:
- Append `_G10`, `_G11`, `_G12` to `parser_subject_code`
- Or add a `grade` column to `lookup_subjects` with composite unique key

---

## 5. BATCH PARSER IMPORT READINESS

### Can all 387 files be imported now?
**NO** — Not yet. The wrong subject codes (Issue 4.1) will cause import failures.

### Required before import:
1. Fix wrong subject codes in renamed files (re-rename with correct codes)
2. Verify batch parser can parse machine-format filenames
3. Test import with a small batch first

---

## 6. CRITICAL RULES (Updated)

1. **Verify with DESCRIBE before writing SQL**
2. **Surgical fixes only** — change only what's needed
3. **Use API versioning** — never share routes between features
4. **Restart backend after every route change**
5. **No assumptions** — verify schema before every change
6. **Export router directly:** module.exports = router;
7. **Always use correct official codes from caps_subjects_master**
8. **Delete old data before re-seeding to avoid duplicates**
9. **Commit after every working change**
10. **isMachineFormat regex must handle:** hyphens, ampersands, case-insensitive, no spaces

---

## 7. NEXT STEPS (Pending)

1. **Fix Wrong Subject Codes** — Re-rename files with incorrect HOMELANGUAGE/FAL/SAL mismatches
2. **Test Batch Parser Import** — Verify machine-format filenames can be parsed
3. **Run Full Import** — Process all 387 files into parse_sessions/parse_results
4. **Auto-Promote to item_master** — Verify auto-promote works with corrected data
5. **Add Grade to parser_subject_code** — When adding Grade 10/11 support

---

*End of Handover Note v41*
*Date: 2026-06-30 22:00 SAST*
*Next Session: Fix wrong subject codes + Test batch import*
