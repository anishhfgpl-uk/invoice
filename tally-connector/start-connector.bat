@echo off
setlocal
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
set RELAY_URL=https://tally-relay-anish.onrender.com
if "%OFFICE_CODE%"=="" (
  echo.
  echo ===============================================
  echo TallySync Pro - Remote Office Connector
  echo ===============================================
  echo.
  echo Enter the same Office Code you use on the website.
  echo This keeps the Tally computer paired securely with your account.
  set /p OFFICE_CODE=Office Code: 
)
if "%OFFICE_CODE%"=="" (
  echo Office Code is required.
  pause
  exit /b 1
)
node tally-connector.mjs
pause
