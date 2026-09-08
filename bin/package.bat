@echo off
cd /d "%~dp0.."
call npm run package
exit /b %errorlevel%
