@echo off
setlocal
cd /d "%~dp0"
title GovCare EHR - PostgreSQL Database Creation

echo.
echo ==========================================
echo GovCare EHR - Create PostgreSQL Database
ECHO ==========================================
echo.

where psql >nul 2>nul
if errorlevel 1 (
  echo ERROR: PostgreSQL command-line tools were not found in PATH.
  echo You can create the same database using pgAdmin instead.
  pause
  exit /b 1
)

set /p PGUSER=PostgreSQL username [postgres]: 
if "%PGUSER%"=="" set "PGUSER=postgres"
set /p DBNAME=Database name [govcare_ehr_v2]: 
if "%DBNAME%"=="" set "DBNAME=govcare_ehr_v2"

echo Creating database %DBNAME% when it does not already exist...
psql -U "%PGUSER%" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='%DBNAME%'" | findstr /x "1" >nul
if errorlevel 1 (
  createdb -U "%PGUSER%" "%DBNAME%"
  if errorlevel 1 goto :failed
) else (
  echo Database already exists. Existing records will not be deleted.
)

if not exist spring-api\.env copy spring-api\.env.example spring-api\.env >nul

echo.
echo Database is ready.
echo Edit spring-api\.env and set DB_PASSWORD.
echo Spring Boot Flyway will create or upgrade the tables automatically.
pause
exit /b 0

:failed
echo Database creation failed. Check PostgreSQL service, username, password and PATH.
pause
exit /b 1
