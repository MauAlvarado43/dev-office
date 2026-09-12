@echo off
cd /d "%~dp0.."
call pnpm run check
exit /b %errorlevel%
