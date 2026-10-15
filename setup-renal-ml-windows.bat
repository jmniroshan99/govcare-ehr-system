@echo off
setlocal
cd /d "%~dp0"
title GovCare EHR - Renal ML Setup
echo.
echo Preparing the renal Python environment and local service configuration.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is missing from PATH. Install Node 22.12+ or Node 24, then reopen this window.
  goto fail
)
where py >nul 2>nul
if errorlevel 1 (
  echo ERROR: The Python launcher is missing. Install Python 3.12+ with its Windows launcher, then reopen this window.
  goto fail
)
py -3 -c "import sys; assert sys.version_info >= (3,12), 'Python 3.12 or newer is required'"
if errorlevel 1 goto fail
if not exist "ML_Server\.venv\Scripts\python.exe" py -3 -m venv ML_Server\.venv
if errorlevel 1 goto fail
ML_Server\.venv\Scripts\python.exe -m pip install -r ML_Server\requirements.txt
if errorlevel 1 goto fail
node scripts\configure-renal-local.cjs
if errorlevel 1 goto fail
echo Renal ML setup completed. Configure PostgreSQL in spring-api\.env, then run start-renal-fullstack-windows.bat.
pause
exit /b 0
:fail
echo Setup failed. See RUN_SRI_LANKAN_RENAL.md.
echo Copy the first ERROR above for troubleshooting.
pause
exit /b 1
