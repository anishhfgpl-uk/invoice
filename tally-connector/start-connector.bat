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
if "%DEVICE_CODE%"=="" (
  echo.
  echo ===============================================
  echo TallySync Pro - Remote Office Connector
  echo ===============================================
  echo.
  echo Enter the Office Code shown on the TallySync website.
  echo Leave blank for direct LAN/IP mode only.
  set /p DEVICE_CODE=Office Code: 
)
node tally-connector.mjs
pause
