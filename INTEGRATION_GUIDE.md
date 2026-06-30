
# ============================================================
# QBank Parser Fix - Integration Guide
# Date: 2026-06-30
# ============================================================

## CURRENT STATE
- 397 files in docs\Question Papers folder
- 191 QP files + 187 MG files = 378 parseable PDFs
- 160 matched QP+MG pairs (320 files)
- 30 unmatched QP + 23 unmatched MG = 53 files without pairs
- Missing files: Combined memos (Afr & Eng), missing QP/MG files, session mismatches

## OPTION 1: Rename Files to Machine Format (RECOMMENDED)
### What it does:
- Renames 160 QP files to: SUBJECT_P1_2025_NOV_AFR_QP.pdf
- Renames 160 MG files to: SUBJECT_P1_2025_NOV_AFR_Memo_AFR.pdf
- After renaming, batch parser can process them as separate files
- Combined QP+Memo files can be created by merging if needed

### Steps:
1. Run the PowerShell script: rename_files.ps1
   cd "C:\dev\nsc-qbank\docs\Question Papers"
   .\rename_files.ps1

2. Verify renamed files:
   Get-ChildItem | Where-Object { $_.Name -like "*_QP.pdf" -or $_.Name -like "*_Memo_*.pdf" }

3. Run batch parser on renamed files:
   The parser will now find files in machine format and process them

### Pros:
- Simple, no parser changes needed
- Works with existing parser logic
- Files are consistently named

### Cons:
- Requires renaming 320 files
- Doesn't handle combined memos (Afr & Eng)
- Doesn't create combined QP+Memo files

## OPTION 2: Modify Batch Parser to Handle Separate Files
### What it does:
- Adds pairSeparateFiles() function to batch_parser.js
- Parser scans folder, pairs QP and MG files by parsing names
- Processes each pair as a combined session
- Handles all naming conventions automatically

### Steps:
1. Copy pair_separate_files.js to routes/v3/ folder
2. Modify batch_parser.js to require and use pairSeparateFiles()
3. Update the folder scanning logic to use paired files instead of combined files

### Code changes needed in batch_parser.js:
```javascript
const { pairSeparateFiles } = require('./pair_separate_files');

// In the batch processing function, replace:
// const files = fs.readdirSync(folderPath).filter(...)
// With:
const { pairs, unmatchedQP, unmatchedMG } = await pairSeparateFiles(folderPath);

// Then process each pair:
for (const pair of pairs) {
  // Process QP file
  await processFile(pair.qpPath, pair.paperCode, 'qp');
  // Process Memo file
  await processFile(pair.memoPath, pair.paperCode, 'memo');
}
```

### Pros:
- No file renaming needed
- Handles all naming conventions
- Can process partial pairs (QP only or MG only)
- More flexible for future files

### Cons:
- Requires parser code changes
- More complex integration
- Needs testing

## RECOMMENDATION
Use OPTION 1 (Rename) for immediate fix:
- It's simpler and safer
- No parser code changes needed
- Can be done quickly
- Then use OPTION 2 for long-term flexibility

## MISSING FILES (30 QP + 23 MG)
These files don't have matching pairs and will be skipped:
- Combined memos (Afr & Eng): Need to be split or QP combined
- Missing QP: Consumer Studies Afr, Dramatic Arts, English FAL P1, SASL, etc.
- Missing MG: Setswana SAL, Siswati FAL P3, Visual Arts P2, etc.
- Session mismatches: Afrikaans HL P3 (Nov QP, May-June MG)

Download these missing files when available and re-run.

## NEXT STEPS
1. Choose Option 1 or Option 2
2. Apply the fix
3. Re-run batch parser
4. Verify all 160+ pairs are processed
5. Check Parser Import Dashboard for completeness
