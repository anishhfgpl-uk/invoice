@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "RELAY_URL=https://tally-relay-anish.onrender.com"
set "TALLY_URL=http://127.0.0.1:9000"
set "CONNECTOR_PORT=9101"
set "CONNECTOR_HOST=0.0.0.0"
set "NODE_VER=22.14.0"
set "NODE_DIR=%~dp0node-v%NODE_VER%-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"

where node >nul 2>nul
if "%ERRORLEVEL%"=="0" (
  set "RUN_NODE=node"
  goto got_node
)

if exist "%NODE_EXE%" (
  set "RUN_NODE=%NODE_EXE%"
  goto got_node
)

echo Downloading Node.js runtime for Anish Tally Connector...
curl.exe -L --fail --retry 3 --retry-delay 2 "https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip" -o "%TEMP%\anish-node.zip"
if errorlevel 1 goto fail

echo Extracting Node.js runtime...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%TEMP%\anish-node.zip' -DestinationPath '%~dp0' -Force"
if errorlevel 1 goto fail
del /q "%TEMP%\anish-node.zip" >nul 2>&1

if exist "%NODE_EXE%" (
  set "RUN_NODE=%NODE_EXE%"
  goto got_node
)

:fail
echo.
echo ================================================
echo Connector could not start or update.
echo Node.js runtime could not be prepared.
echo Please check internet access and try again.
echo ================================================
pause
exit /b 1

:got_node
if not exist "%~dp0tally-connector.mjs" (
  echo Downloading tally-connector.mjs...
  curl.exe -L --fail --retry 3 "https://raw.githubusercontent.com/anishhfgpl-uk/invoice/main/tally-connector/tally-connector.mjs" -o "%~dp0tally-connector.mjs"
  if errorlevel 1 goto fail
)

echo.
echo ================================================
echo       ANISH TECHNOLOGIES - TALLY CONNECTOR
echo ================================================
echo.
echo TallyPrime must be running on port 9000.
echo Connector: http://127.0.0.1:9101
echo Relay: %RELAY_URL%
echo.
"%RUN_NODE%" "%~dp0tally-connector.mjs"
echo.
echo Connector stopped. Press any key to close.
pause >nul
exit /b 0
