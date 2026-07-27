@echo off
title GovCare EHR - Fresh PostgreSQL Database Setup

echo.
echo ==========================================
echo GovCare EHR - Fresh PostgreSQL Database Setup
echo ==========================================
echo.

set /p PGUSER=PostgreSQL username [postgres]:
if "%PGUSER%"=="" set PGUSER=postgres

echo.
echo WARNING: This will DELETE and recreate the local database named govcare_ehr.
set /p CONFIRM=Type YES to continue:

if /I not "%CONFIRM%"=="YES" (
    echo Cancelled.
    pause
    exit /b
)

echo.
echo Terminating existing database connections...

psql -U %PGUSER% -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='govcare_ehr' AND pid <> pg_backend_pid();"

echo.
echo Dropping database...

dropdb -U %PGUSER% --if-exists govcare_ehr

echo.
echo Creating database...

createdb -U %PGUSER% govcare_ehr

echo.
echo Importing schema...

psql -U %PGUSER% -d govcare_ehr -v ON_ERROR_STOP=1 -f database\postgresql\govcare_ehr_complete.sql

if errorlevel 1 (
    echo.
    echo Database setup failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo Database setup completed successfully.
echo ==========================================
pause