@echo off
setlocal
where mvn >nul 2>nul
if errorlevel 1 goto :missing_maven

rem CALL returns here after mvn.cmd. Read ERRORLEVEL on its own line so CMD
rem does not expand the earlier WHERE result inside a parenthesized block.
call mvn %*
set "GOVCARE_MAVEN_EXIT=%errorlevel%"
exit /b %GOVCARE_MAVEN_EXIT%

:missing_maven
echo Maven is not installed or not available in PATH.
echo Install Apache Maven 3.9+ or use the Maven wrapper from your IDE.
echo Download: https://maven.apache.org/download.cgi
exit /b 1
