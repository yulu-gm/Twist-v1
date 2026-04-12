@echo off
chcp 65001 >nul 2>&1
title Opus World

set "DEV_PORT=%VITE_PORT%"
if not defined DEV_PORT set "DEV_PORT=5173"
set "VITE_PORT=%DEV_PORT%"

:: Kill any process on the target dev port
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%DEV_PORT% " ^| findstr "LISTENING"') do (
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
