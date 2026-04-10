@echo off
chcp 65001 >nul 2>&1
title Scenario Visual Testing

:: Kill any process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start vite dev server and open scenario selection page
cd /d "%~dp0"
npx vite --open /scenario-select.html
