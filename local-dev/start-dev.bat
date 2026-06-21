@echo off
REM ============================================================
REM ITOps Agent Platform - 本地开发环境启动脚本 (Windows)
REM ============================================================
REM 使用说明:
REM   start-dev.bat          - 启动开发环境
REM   start-dev.bat --build  - 强制重新构建镜像
REM   start-dev.bat --help   - 显示帮助信息
REM ============================================================

cd /d "%~dp0"

if "%1"=="--help" goto :help
if "%1"=="-h" goto :help

echo.
echo ==========================================
echo  ITOps Agent Platform - 本地开发环境
echo ==========================================
echo.

REM 检查.env文件是否存在
if not exist ".env" (
    echo [INFO] .env file not found, creating from .env.example...
    copy .env.example .env >nul
    echo [INFO] Created .env file
    echo [WARN] Please check and modify .env if needed
    echo.
)

REM 检查Docker是否运行
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [INFO] Starting development environment...
echo.

if "%1"=="--build" (
    echo [INFO] Building images...
    docker-compose build --no-cache
) else (
    echo [INFO] Building images if needed...
    docker-compose build
)

echo.
echo [INFO] Starting services...
docker-compose up -d

echo.
echo ==========================================
echo  Development environment is starting...
echo ==========================================
echo.
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:5173
echo  Debug:    http://localhost:9229 (Node.js debugger)
echo.
echo  Useful commands:
echo    docker-compose logs -f          - View logs
echo    docker-compose logs -f backend  - View backend logs only
echo    docker-compose logs -f frontend - View frontend logs only
echo    docker-compose down             - Stop environment
echo    docker-compose restart          - Restart services
echo.
echo  To stop: press Ctrl+C in the compose window or run: stop-dev.bat
echo ==========================================
echo.

REM 显示服务状态
docker-compose ps

goto :end

:help
echo.
echo ITOps Agent Platform - Local Development Environment
echo.
echo Usage: start-dev.bat [OPTIONS]
echo.
echo Options:
echo   --build    Force rebuild of Docker images
echo   --help, -h Show this help message
echo.
echo Without options, starts the environment using existing images if available.
echo.
exit /b 0

:end
pause