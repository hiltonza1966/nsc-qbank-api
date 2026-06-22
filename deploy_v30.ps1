# QBank Parser v30 Deployment Script
# Run from C:\dev\nsc-qbank

$ErrorActionPreference = "Stop"

Write-Host "=== QBank Parser v30 Deployment ===" -ForegroundColor Cyan

# 1. Backup current parsers
Write-Host "`n[1/6] Backing up current parsers..." -ForegroundColor Yellow
$backupDir = "backend\parsers\backup_v29"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item "backend\parsers\qp_parser_option_b.py" "$backupDir\qp_parser_option_b_v29.py" -Force -ErrorAction SilentlyContinue
Copy-Item "backend\parsers\memo_parser_option_b.py" "$backupDir\memo_parser_option_b_v29.py" -Force -ErrorAction SilentlyContinue
Copy-Item "backend\parsers\master_harness.py" "$backupDir\master_harness_v29.py" -Force -ErrorAction SilentlyContinue
Copy-Item "backend\parsers\parser_api.py" "$backupDir\parser_api_v29.py" -Force -ErrorAction SilentlyContinue
Write-Host "  Backups created in $backupDir" -ForegroundColor Green

# 2. Deploy new four-parser files
Write-Host "`n[2/6] Deploying new four-parser files..." -ForegroundColor Yellow
# Files should be extracted from zip to correct locations
Write-Host "  Please ensure these files are in place:" -ForegroundColor Cyan
Write-Host "    - backend\parsers\qp_content_parser.py" -ForegroundColor White
Write-Host "    - backend\parsers\memo_content_parser.py" -ForegroundColor White
Write-Host "    - backend\parsers\qp_marks_parser.py" -ForegroundColor White
Write-Host "    - backend\parsers\memo_marks_parser.py" -ForegroundColor White
Write-Host "    - backend\parsers\master_harness_v2.py" -ForegroundColor White
Write-Host "    - backend\parsers\parser_api_v2.py" -ForegroundColor White
Write-Host "    - backend\routes\parser.js" -ForegroundColor White

# 3. Verify parser imports
Write-Host "`n[3/6] Verifying parser imports..." -ForegroundColor Yellow
python -c "import sys; sys.path.insert(0, 'backend/parsers'); from qp_content_parser import extract_qp_content; print('qp_content_parser: OK')"
python -c "import sys; sys.path.insert(0, 'backend/parsers'); from memo_content_parser import extract_memo_content; print('memo_content_parser: OK')"
python -c "import sys; sys.path.insert(0, 'backend/parsers'); from qp_marks_parser import extract_qp_marks; print('qp_marks_parser: OK')"
python -c "import sys; sys.path.insert(0, 'backend/parsers'); from memo_marks_parser import extract_memo_marks; print('memo_marks_parser: OK')"
python -c "import sys; sys.path.insert(0, 'backend/parsers'); from master_harness_v2 import run_harness_v2; print('master_harness_v2: OK')"
python -c "import sys; sys.path.insert(0, 'backend/parsers'); from parser_api_v2 import run_parser; print('parser_api_v2: OK')"

# 4. Test parser with sample files
Write-Host "`n[4/6] Testing parser with sample files..." -ForegroundColor Yellow
$testDir = "uploads\parser_test"
New-Item -ItemType Directory -Force -Path $testDir | Out-Null

# Test each parser individually
python backend\parsers\qp_marks_parser.py "uploads\Accounting P1 Nov 2025 Eng.pdf" > "$testDir\qp_marks_test.json"
python backend\parsers\memo_marks_parser.py "uploads\Accounting P1 Nov 2025 MG Eng.pdf" > "$testDir\memo_marks_test.json"

Write-Host "  QP marks test output: $testDir\qp_marks_test.json" -ForegroundColor Green
Write-Host "  Memo marks test output: $testDir\memo_marks_test.json" -ForegroundColor Green

# 5. Rebuild frontend
Write-Host "`n[5/6] Rebuilding frontend..." -ForegroundColor Yellow
cd frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Frontend build FAILED!" -ForegroundColor Red
    exit 1
}
cd ..
Write-Host "  Frontend build: OK" -ForegroundColor Green

# 6. Restart backend
Write-Host "`n[6/6] Restarting backend..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
node server.js

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Check http://localhost:4000/api/parser/status for parser status" -ForegroundColor Cyan
