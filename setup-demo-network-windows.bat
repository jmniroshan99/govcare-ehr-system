@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer first.
  pause
  exit /b 1
)
echo Loading 10 demo hospitals: 400 patients, 100 doctors, 100 wards per hospital.
echo Start the Spring API once first so Flyway V32 has completed.
call npm run demo:seed
if errorlevel 1 (
  echo Demo setup failed. Read the error above.
  pause
  exit /b 1
)
call npm run demo:verify
if errorlevel 1 (
  pause
  exit /b 1
)
echo Open database\postgresql\demo-network-credentials.csv for the initial logins.
echo Sign in using a DEMO-HOSP hospital account and change its temporary password.
pause
exit /b 0
