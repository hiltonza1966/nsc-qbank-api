@echo off
cd /d "C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS SQL Output"
for %%f in (caps_*.sql) do (
    echo Inserting: %%f
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -pHilton@66 nsc_qbank < %%f
)
