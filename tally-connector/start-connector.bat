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
node tally-connector.mjs
pause
