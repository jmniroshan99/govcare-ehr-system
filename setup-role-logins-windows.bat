@echo off
cd /d "%~dp0"
call npm run accounts:local
exit /b %errorlevel%
