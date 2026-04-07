@echo off
chcp 65001 >nul 2>&1
title Opus World

:: Kill any process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Start vite dev server (auto-opens browser)
cd /d "%~dp0"
npx vite --open
