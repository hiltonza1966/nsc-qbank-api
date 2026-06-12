# Deploy Sub-Pages (ItemDetail + PaperDetail + updated App)
# Date: 2026-06-12
# Run from: C:\dev\nsc-qbank

cd C:\dev\nsc-qbank

# Ensure pages directory exists
New-Item -ItemType Directory -Path "frontend\src\pages" -Force | Out-Null

# Copy new files
Write-Host "Copying sub-page files..." -ForegroundColor Cyan
Copy-Item "C:\Users\visagie.h\Downloads\App_v5.tsx" "frontend\src\App.tsx" -Force
Copy-Item "C:\Users\visagie.h\Downloads\ItemDetail.tsx" "frontend\src\pages\ItemDetail.tsx" -Force
Copy-Item "C:\Users\visagie.h\Downloads\PaperDetail.tsx" "frontend\src\pages\PaperDetail.tsx" -Force
Write-Host "Files copied." -ForegroundColor Green

# Rebuild
Write-Host "`nRebuilding frontend..." -ForegroundColor Cyan
cd frontend
npm run build
cd ..
Write-Host "Build complete." -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "SUB-PAGES DEPLOYED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Start: cd frontend && npm run dev" -ForegroundColor Yellow
Write-Host "Hard refresh: Ctrl+Shift+R" -ForegroundColor Yellow
