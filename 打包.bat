@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist "%~dp0node_modules\vite\bin\vite.js" (
  echo [%~nx0] 未检测到依赖，正在执行 npm install...
  call npm install
  if errorlevel 1 (
    echo [%~nx0] npm install 失败，请检查本机是否已安装 Node.js 与 npm。
    pause
    exit /b 1
  )
)

echo [%~nx0] 正在打包为单个 HTML 到 release\ ...
set "TWIST_RELEASE=1"
call npm run build:release
if errorlevel 1 (
  echo [%~nx0] 构建失败。
  pause
  exit /b 1
)

echo.
echo [%~nx0] 完成。产物：release\index.html（单文件，可直接用浏览器打开）
explorer.exe /select,"%CD%\release\index.html"
pause
