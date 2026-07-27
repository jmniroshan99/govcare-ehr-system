@echo off
setlocal
cd /d "%~dp0"

echo GovCare EHR - PostgreSQL Edition
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found. Install Node.js 22 LTS or 24.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 goto :failed
)

if not exist server\node_modules (
  echo Installing API dependencies...
  call npm --prefix server install
  if errorlevel 1 goto :failed
)

echo Starting frontend at http://127.0.0.1:5300
echo Starting PostgreSQL API at http://127.0.0.1:4001
echo Press Ctrl+C to stop both services.
call npm run dev:full
exit /b %errorlevel%

:failed
echo Dependency installation failed. Check the npm error shown above.
pause
exit /b 1
