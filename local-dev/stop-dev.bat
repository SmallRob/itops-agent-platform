@echo off
REM ============================================================
REM ITOps Agent Platform - 本地开发环境停止脚本 (Windows)
REM ============================================================
REM 使用说明:
REM   stop-dev.bat           - 停止开发环境
REM   stop-dev.bat --clean   - 停止并清理数据卷
REM ============================================================

cd /d "%~dp0"

if "%1"=="--clean" goto :clean

echo.
echo ==========================================
echo  Stopping Development Environment
echo ==========================================
echo.

docker-compose down

echo.
echo [INFO] Development environment stopped.
echo.
pause
goto :end

:clean
echo.
echo ==========================================
echo  Stopping and Cleaning Development Environment
echo ==========================================
echo.
echo [WARN] This will remove all development data!
echo.

docker-compose down -v

echo.
echo [INFO] Development environment stopped and cleaned.
echo.
pause

:end
exit /b 0