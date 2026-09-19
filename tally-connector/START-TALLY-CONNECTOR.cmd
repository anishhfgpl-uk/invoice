@echo off
setlocal
cd /d "%~dp0"
set "RELAY_URL=https://tally-relay-anil-sharma.onrender.com"
set "TALLY_URL=http://127.0.0.1:9000"
set "CONNECTOR_PORT=9101"
set "CONNECTOR_HOST=0.0.0.0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ANISH TECHNOLOGIES - Tally Connector
  echo Node.js is not installed on this office computer.
  echo Please run START-ANISH-TALLY-CONNECTOR.cmd which downloads Node.js automatically,
  echo or install Node.js LTS from https://nodejs.org.
  echo.
  pause
  exit /b 1
)

echo.
echo ================================================
echo        ANISH TECHNOLOGIES - TALLY CONNECTOR
echo ================================================
echo.
echo Tally must be running with ODBC/XML enabled on port 9000.
echo Relay: %RELAY_URL%
echo Keep this window open while the website uses Tally.
echo.
node "%~dp0tally-connector.mjs"
pause
