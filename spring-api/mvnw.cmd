@echo off
setlocal
where mvn >nul 2>nul
if %errorlevel%==0 (
  mvn %*
  exit /b %errorlevel%
)
echo Maven is not installed or not available in PATH.
echo Install Apache Maven 3.9+ or use the Maven wrapper from your IDE.
echo Download: https://maven.apache.org/download.cgi
exit /b 1
