@echo off
chcp 65001 >nul 2>&1
title Opus World

:: Kill any process on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo [launcher] Node.js was not found in PATH.
    echo [launcher] Install Node.js and try again.
    pause
    exit /b 1
)

node scripts\launch-dev.mjs main
if errorlevel 1 (
    echo.
    echo [launcher] run.bat failed.
    pause
    exit /b %errorlevel%
)
