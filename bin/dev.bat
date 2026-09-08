@echo off
cd /d "%~dp0.."
call npm run watch
exit /b %errorlevel%
