@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the Tally connector.
  echo Install Node.js LTS, then run this file again.
  pause
  exit /b 1
)
set CONNECTOR_PORT=9101
set TALLY_URL=http://127.0.0.1:9000
set RELAY_URL=https://tally-relay-anil-sharma.onrender.com
set CODE_FILE=%~dp0office-code.txt

rem Load the saved Office Code. If none exists, create one automatically.
if exist "%CODE_FILE%" (
  set /p OFFICE_CODE=<"%CODE_FILE%"
)
if not defined OFFICE_CODE (
  echo.
  echo ===============================================
  echo TallySync Pro - Remote Office Connector
  echo ===============================================
  echo Generating a unique Office Code for this computer...
  for /f "usebackq delims=" %%C in (`powershell -NoProfile -Command "$b=New-Object byte[] 8; [Security.Cryptography.RandomNumberGenerator]::Fill($b); 'ANISH-' + (($b | ForEach-Object { $_.ToString('X2') }) -join '')"`) do set "OFFICE_CODE=%%C"
  >"%CODE_FILE%" echo !OFFICE_CODE!
)

if not defined OFFICE_CODE (
  echo Could not create Office Code.
  pause
  exit /b 1
)

set "OFFICE_CODE=!OFFICE_CODE: =!"
>"%CODE_FILE%" echo !OFFICE_CODE!

echo.
echo ===============================================
echo TallySync Pro - Remote Office Connector
echo ===============================================
echo Office Code: !OFFICE_CODE!
echo Tally:       %TALLY_URL%
echo Relay:       %RELAY_URL%
echo.
echo Keep this window running while remote Tally access is needed.
echo Enter this Office Code on https://anish-tech.online/invoice/
echo ===============================================
echo.
node tally-connector.mjs
pause
