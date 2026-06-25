# 企业 IT 运维多 Agent 自动化平台 - Windows 启动脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  企业 IT 运维多 Agent 自动化平台" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker 是否安装和运行
Write-Host "[1/6] 检查 Docker 状态..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✓ Docker 已安装: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker 未安装或未运行！请先安装并启动 Docker Desktop。" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 检查 Docker Compose
Write-Host ""
Write-Host "[2/6] 检查 Docker Compose..." -ForegroundColor Yellow
$composeCmd = ""
try {
    $null = docker compose version 2>&1
    $composeCmd = "docker compose"
    Write-Host "✓ Docker Compose 可用 (docker compose)" -ForegroundColor Green
} catch {
    try {
        $null = docker-compose --version 2>&1
        $composeCmd = "docker-compose"
        Write-Host "✓ Docker Compose 可用 (docker-compose)" -ForegroundColor Green
    } catch {
        Write-Host "✗ Docker Compose 检查失败！" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
}

# 检查环境变量
Write-Host ""
Write-Host "[3/6] 检查环境变量配置..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "⚠ 未找到 .env 文件，使用默认配置..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env" -ErrorAction SilentlyContinue
    Write-Host "✓ 已从 .env.example 复制默认配置" -ForegroundColor Green
} else {
    Write-Host "✓ 已找到 .env 文件" -ForegroundColor Green
}

# 停止现有容器
Write-Host ""
Write-Host "[4/6] 停止现有容器（如果有）..." -ForegroundColor Yellow
Invoke-Expression "$composeCmd down 2>$null"
Write-Host "✓ 完成" -ForegroundColor Green

# 构建并启动
Write-Host ""
Write-Host "[5/6] 构建并启动服务..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟，请耐心等待..." -ForegroundColor Gray
Invoke-Expression "$composeCmd up -d --build"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 服务启动成功！" -ForegroundColor Green
} else {
    Write-Host "✗ 服务启动失败！" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

# 等待服务就绪
Write-Host ""
Write-Host "[6/6] 等待服务就绪..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts -and -not $ready) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $ready = $true
        }
    } catch {
        Start-Sleep -Seconds 2
    }
    $attempt++
    Write-Host "  等待中... ($attempt/$maxAttempts)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 启动完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 前端地址: http://localhost:8080" -ForegroundColor White
Write-Host "🔧 后端 API: http://localhost:3001" -ForegroundColor White
Write-Host "📊 查看日志: $composeCmd logs -f" -ForegroundColor Gray
Write-Host "⏹ 停止服务: $composeCmd down" -ForegroundColor Gray
Write-Host ""
Write-Host "提示: 如果无法访问，请确保 Docker Desktop 正在运行。" -ForegroundColor Gray
Write-Host ""

# 询问是否打开浏览器
$openBrowser = Read-Host "是否在浏览器中打开前端? (Y/N)"
if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
    Start-Process "http://localhost:8080"
}
