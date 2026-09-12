@echo off
cd /d "%~dp0.."
call pnpm install --frozen-lockfile
exit /b %errorlevel%
