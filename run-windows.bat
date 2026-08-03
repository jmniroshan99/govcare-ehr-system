@echo off
setlocal
cd /d "%~dp0"
title GovCare EHR - React and Spring Boot

echo.
echo ==========================================
echo GovCare EHR - React + Spring Boot
ECHO ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  pause
  exit /b 1
)

where java >nul 2>nul
if errorlevel 1 (
  echo ERROR: Java 21 was not found in PATH.
  pause
  exit /b 1
)

where mvn >nul 2>nul
if errorlevel 1 (
  echo ERROR: Apache Maven 3.9+ was not found in PATH.
  echo Install Maven, restart VS Code/CMD, then run this file again.
  pause
  exit /b 1
)

if not exist spring-api\.env (
  copy spring-api\.env.example spring-api\.env >nul
  echo Created spring-api\.env from the example.
  echo Edit DB_PASSWORD and JWT_SECRET before continuing.
  pause
)

if not exist .env (
  copy .env.example .env >nul
)

if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 goto :failed
)

echo Starting frontend at http://127.0.0.1:5300
echo Starting Spring Boot API at http://127.0.0.1:4001
echo Press Ctrl+C to stop both services.
call npm run dev:full
exit /b %errorlevel%

:failed
echo Installation or startup failed. Review the error shown above.
pause
exit /b 1
