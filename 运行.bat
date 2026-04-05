@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "PORT=5173"

echo [%~nx0] 正在清理占用端口 %PORT% 的进程...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-NetTCPConnection -LocalPort ([int]$env:PORT) -State Listen -ErrorAction SilentlyContinue; if (-not $c) { Write-Host '端口空闲，无需清理。' } else { $c.OwningProcess | Select-Object -Unique | ForEach-Object { $procId = $_; try { Stop-Process -Id $procId -Force -ErrorAction Stop; Write-Host ('已结束占用端口的进程 PID ' + $procId) } catch { Write-Host ('无法结束 PID ' + $procId + ' : ' + $_.Exception.Message) } } }"

if not exist "%~dp0node_modules\vite\bin\vite.js" (
  echo [%~nx0] 未检测到 Vite 依赖，正在执行 npm install...
  call npm install
  if errorlevel 1 (
    echo [%~nx0] npm install 失败，请检查本机是否已安装 Node.js 与 npm。
    pause
    exit /b 1
  )
)

echo.
echo [%~nx0] 启动 Vite（独立窗口，关闭该窗口即停止服务）...
rem 不用裸命令 vite，避免部分环境下 PATH 未含 node_modules\.bin 时报「不是内部或外部命令」
start "Twist Vite" /D "%~dp0" cmd /k "node node_modules\vite\bin\vite.js"

echo [%~nx0] 等待开发服务器就绪...
timeout /t 3 /nobreak >nul

echo [%~nx0] 打开浏览器 http://localhost:%PORT%/
start "" "http://localhost:%PORT%/"

echo.
echo 若页面未加载，请稍等几秒后刷新；或根据机器速度增大本脚本中的等待秒数。
pause
