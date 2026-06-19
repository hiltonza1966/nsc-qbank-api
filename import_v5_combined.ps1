# Copy v5 SQL files from CAPS Documents to repo root
$source = "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents"
$dest = "C:\dev\nsc-qbank"

# Copy all v5 files
Copy-Item "$source\caps_v5_*.sql" $dest

# Verify copied files
Write-Host "Files copied to $dest"
Get-ChildItem "$dest\caps_v5_*.sql" | Select-Object Name

# Now build a combined SQL file that sources all v5 files
$combined = @"
USE nsc_qbank;
"@

$files = Get-ChildItem "$dest\caps_v5_*.sql" | Select-Object -ExpandProperty FullName
foreach ($file in $files) {
    $filename = Split-Path $file -Leaf
    $combined += "source C:/dev/nsc-qbank/$filename;`n"
}

$combinedPath = "$dest\combined_v5_import.sql"
$combined | Set-Content -Path $combinedPath -Encoding UTF8
Write-Host "Combined SQL created: $combinedPath"

# Run the combined import using cmd to avoid PowerShell issues
cmd /c "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 nsc_qbank -e "source C:/dev/nsc-qbank/combined_v5_import.sql"

Write-Host "Import complete!"
