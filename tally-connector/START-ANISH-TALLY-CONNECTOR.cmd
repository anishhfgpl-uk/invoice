@echo off
setlocal
cd /d "%~dp0"
set "NODE_VER=22.14.0"
set "NODE_DIR=%~dp0node-v%NODE_VER%-win-x64"
set "NODE_EXE=%NODE_DIR%\node.exe"
if not exist "%NODE_EXE%" (
  echo Downloading Node.js runtime for Anish Tally Connector...
  curl.exe -L --fail --retry 3 "https://nodejs.org/dist/v%NODE_VER%/node-v%NODE_VER%-win-x64.zip" -o "%TEMP%\anish-node.zip"
  if errorlevel 1 goto fail
  tar.exe -xf "%TEMP%\anish-node.zip" -C "%~dp0"
  del /q "%TEMP%\anish-node.zip" >nul 2>&1
)
if not exist "%NODE_EXE%" goto fail

echo Updating Anish Tally Connector from GitHub...
curl.exe -L --fail --retry 3 "https://raw.githubusercontent.com/anishhfgpl-uk/invoice/main/tally-connector/tally-connector.mjs" -o "%~dp0tally-connector.mjs"
if errorlevel 1 goto fail

echo.
echo ================================================
echo       ANISH TECHNOLOGIES - TALLY CONNECTOR
echo ================================================
echo.
echo Keep this window open while Tally is connected.
echo TallyPrime must be running on port 9000.
echo Relay: https://tally-relay-anil-sharma.onrender.com
echo.
"%NODE_EXE%" "%~dp0tally-connector.mjs"
echo.
echo Connector stopped. Press any key to close.
pause >nul
exit /b 0
:fail
echo.
echo Connector could not start or update.
echo Please check internet access and try again.
pause
exit /b 1
