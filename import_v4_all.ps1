# Import all v4 CAPS SQL files
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$folder = "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents"
$files = @(
    "caps_v4_phys.sql",
    "caps_v4_agri.sql",
    "caps_v4_catn.sql",
    "caps_v4_cons.sql",
    "caps_v4_dram.sql",
    "caps_v4_egdn.sql",
    "caps_v4_enfl.sql",
    "caps_v4_engl.sql",
    "caps_v4_htel.sql",
    "caps_v4_inft.sql",
    "caps_v4_lfsc.sql",
    "caps_v4_lo.sql",
    "caps_v4_musi.sql",
    "caps_v4_vsla.sql",
    "caps_v4_xhos.sql"
)

foreach ($file in $files) {
    $path = Join-Path $folder $file
    if (Test-Path $path) {
        Write-Host "Importing $file..."
        & $mysql -u root -pHilton@66 nsc_qbank -e "source $path"
    } else {
        Write-Host "WARNING: File not found: $path"
    }
}

Write-Host "All imports complete!"
