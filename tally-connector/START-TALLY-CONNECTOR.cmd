@echo off
setlocal
cd /d "%~dp0"
set "RELAY_URL=https://tally-relay-anish.onrender.com"
set "CONNECTOR_PORT=9101"
set "CONNECTOR_HOST=0.0.0.0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ANISH TECHNOLOGIES - Tally Connector
  echo Node.js is not installed on this office computer.
  echo Install Node.js LTS, then run this file again.
  echo.
  pause
  exit /b 1
)
echo.
echo ================================================
echo        ANISH TECHNOLOGIES - TALLY CONNECTOR
echo ================================================
echo.
echo Tally must be running with its HTTP server on port 9000.
echo Keep this window open while the website uses Tally.
echo.
node "%~dp0tally-connector.mjs"
pause
