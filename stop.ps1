# 企业 IT 运维多 Agent 自动化平台 - Windows 停止脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  停止 IT 运维平台服务" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 确定 Docker Compose 命令
$composeCmd = ""
try {
    $null = docker compose version 2>&1
    $composeCmd = "docker compose"
} catch {
    try {
        $null = docker-compose --version 2>&1
        $composeCmd = "docker-compose"
    } catch {
        Write-Host "✗ Docker Compose 未找到！" -ForegroundColor Red
        Read-Host "按回车键退出"
        exit 1
    }
}

# 停止容器
Write-Host "[1/2] 停止容器..." -ForegroundColor Yellow
Invoke-Expression "$composeCmd down"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 容器已停止" -ForegroundColor Green
} else {
    Write-Host "⚠ 停止过程中有警告，但可能已完成" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[2/2] 清理（可选）..." -ForegroundColor Yellow
$cleanUp = Read-Host "是否清理未使用的 Docker 资源? (Y/N)"
if ($cleanUp -eq "Y" -or $cleanUp -eq "y") {
    Write-Host "正在清理未使用的资源（这将保留卷数据）..." -ForegroundColor Gray
    docker system prune -f
    Write-Host "✓ 清理完成" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ 已停止服务！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示: 如需重新启动，请运行 .\start.ps1" -ForegroundColor Gray
