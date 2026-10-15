@echo off
setlocal
cd /d "%~dp0"
title GovCare EHR - Target Windows/PostgreSQL Verification
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\verify-target-windows-postgres.ps1" %*
set "CODE=%errorlevel%"
echo.
if "%CODE%"=="0" echo GovCare target validation PASSED.
if "%CODE%"=="2" echo GovCare target validation completed with PENDING live-fixture checks. See verification\target-windows-postgres\TARGET_VALIDATION_RESULTS.md
if not "%CODE%"=="0" if not "%CODE%"=="2" echo GovCare target validation FAILED. Review verification\target-windows-postgres\*.log and TARGET_VALIDATION_RESULTS.md
pause
exit /b %CODE%
