@echo off
setlocal
cd /d "%~dp0spring-api"
title GovCare EHR - Spring Boot API (4002)

echo =============================================
echo GovCare EHR - Spring Boot Backend
echo =============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  goto :failed
)

where java >nul 2>nul
if errorlevel 1 (
  echo ERROR: Java was not found in PATH. Java 21 is required.
  goto :failed
)

if not exist .env (
  copy .env.example .env >nul
  echo Created spring-api\.env from .env.example.
  echo If PostgreSQL uses a different password, edit DB_PASSWORD in spring-api\.env.
  echo.
)

if not exist mvnw.cmd (
  echo ERROR: spring-api\mvnw.cmd is missing.
  goto :failed
)

echo Checking port 4002...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr ":4002 "') do (
  echo ERROR: Port 4002 is already in use by PID %%P.
  echo Run: taskkill /PID %%P /F
  goto :failed
)

echo Starting API at http://127.0.0.1:4002
echo This window is intentionally kept open.
echo.
rem Use the same clean build and .env loading as npm run spring:api.
node "..\scripts\run-spring.mjs" run
set EXITCODE=%errorlevel%

echo.
echo Backend exited with code %EXITCODE%.
echo The window will remain open so the error can be read.
pause
exit /b %EXITCODE%

:failed
echo.
echo Backend was not started. Review the message above.
pause
exit /b 1
