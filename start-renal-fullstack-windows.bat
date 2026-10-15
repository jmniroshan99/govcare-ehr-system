@echo off
setlocal
cd /d "%~dp0"
title GovCare EHR - Renal Full Stack
echo.
echo GovCare EHR - Frontend, Spring API and Renal ML
echo Keep this window open while using GovCare.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is missing from PATH. Install Node 22.12+ or Node 24, then reopen this window.
  goto failed
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm is missing from PATH. Check the Node.js installation, then reopen this window.
  goto failed
)
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit((major === 22 && minor >= 12) || major >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo ERROR: This project requires Node 22.12+ or Node 24. Run node --version to check your installation.
  goto failed
)
if not exist "node_modules\concurrently\package.json" (
  echo ERROR: Frontend dependencies are missing. Open Command Prompt in this folder and run npm ci.
  goto failed
)
if not exist "node_modules\vite\package.json" (
  echo ERROR: Frontend dependencies are incomplete. Run npm ci in this folder.
  goto failed
)
if not defined GOVCARE_RENAL_PYTHON set "GOVCARE_RENAL_PYTHON=%~dp0ML_Server\.venv\Scripts\python.exe"
if not exist "%GOVCARE_RENAL_PYTHON%" (
  echo ERROR: The renal Python environment is missing. Run setup-renal-ml-windows.bat first.
  goto failed
)
if not exist "ML_Server\.env" (
  echo ERROR: Renal configuration is missing. Run setup-renal-ml-windows.bat first.
  goto failed
)
if not exist "spring-api\.env" (
  echo ERROR: Spring configuration is missing. Run setup-renal-ml-windows.bat, then configure PostgreSQL and JWT_SECRET in spring-api\.env.
  goto failed
)
where java >nul 2>nul
if errorlevel 1 (
  echo ERROR: Java is missing from PATH. Install Java 21, then reopen this window.
  goto failed
)
where mvn >nul 2>nul
if errorlevel 1 (
  echo ERROR: Maven is missing from PATH. Install Apache Maven 3.9+, then reopen this window.
  goto failed
)

echo Starting services. The first Maven build may take several minutes.
echo Open the Frontend URL printed below in your browser, usually http://127.0.0.1:5300.
echo Press Ctrl+C to stop the services.
echo.
call npm run dev:renal
set "GOVCARE_RENAL_EXIT=%errorlevel%"
echo.
echo GovCare stopped with exit code %GOVCARE_RENAL_EXIT%.
echo If startup failed, copy the first ERROR above for troubleshooting.
pause
exit /b %GOVCARE_RENAL_EXIT%

:failed
echo.
echo GovCare was not started. Resolve the ERROR above and run this file again.
echo See RUN_SRI_LANKAN_RENAL.md for setup instructions.
pause
exit /b 1
