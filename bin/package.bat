@echo off
cd /d "%~dp0.."
call pnpm run package
exit /b %errorlevel%
