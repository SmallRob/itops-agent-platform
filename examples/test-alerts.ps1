# IT运维多Agent自动化平台 - 告警测试脚本 (PowerShell版本)
# 用于测试 Webhook 告警接收功能

$BACKEND_URL = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "http://localhost:3001" }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  IT运维多Agent自动化平台 - 告警测试" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 测试后端健康检查
function Test-Health {
    Write-Host "[1/5] 测试后端服务健康检查..." -ForegroundColor Blue
    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/health" -Method Get -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  后端服务正常运行" -ForegroundColor Green
        } else {
            Write-Host "  后端服务响应异常 (HTTP $($response.StatusCode))" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "  后端服务无法访问: $_" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# 测试 Prometheus Webhook
function Test-Prometheus {
    Write-Host "[2/5] 测试 Prometheus Webhook..." -ForegroundColor Blue
    
    $prometheusPayload = @{
        alerts = @(
            @{
                status = "firing"
                labels = @{
                    alertname = "HighCPUUsage"
                    severity = "critical"
                    instance = "prod-server-01"
                }
                annotations = @{
                    summary = "CPU usage high"
                    description = "Server CPU usage exceeded 85%"
                }
                startsAt = "2024-01-01T00:00:00Z"
            }
        )
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/webhooks/prometheus" -Method Post `
            -ContentType "application/json" -Body $prometheusPayload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  Prometheus Webhook 测试成功" -ForegroundColor Green
        } else {
            Write-Host "  Prometheus Webhook 测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  Prometheus Webhook 测试失败: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# 测试 Zabbix Webhook
function Test-Zabbix {
    Write-Host "[3/5] 测试 Zabbix Webhook..." -ForegroundColor Blue
    
    $zabbixPayload = @{
        trigger = "Memory usage high"
        host = "database-server"
        item = "System memory usage"
        value = "92%"
        severity = "high"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/webhooks/zabbix" -Method Post `
            -ContentType "application/json" -Body $zabbixPayload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  Zabbix Webhook 测试成功" -ForegroundColor Green
        } else {
            Write-Host "  Zabbix Webhook 测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  Zabbix Webhook 测试失败: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# 测试通用 Webhook - Medium
function Test-Generic-Medium {
    Write-Host "[4/5] 测试通用 Webhook (Medium)..." -ForegroundColor Blue
    
    $genericPayload = @{
        source = "disk-monitor"
        severity = "medium"
        title = "Disk space warning"
        content = "Redis cache server disk usage reached 75%"
        metadata = @{
            disk_usage = "75%"
            mount_point = "/data"
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/webhooks/generic" -Method Post `
            -ContentType "application/json" -Body $genericPayload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  通用 Webhook (Medium) 测试成功" -ForegroundColor Green
        } else {
            Write-Host "  通用 Webhook 测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  通用 Webhook 测试失败: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# 测试通用 Webhook - Low
function Test-Generic-Low {
    Write-Host "[5/5] 测试通用 Webhook (Low)..." -ForegroundColor Blue
    
    $genericPayload = @{
        source = "backup-system"
        severity = "low"
        title = "Backup completed"
        content = "Daily backup for test server completed successfully"
        metadata = @{
            backup_size = "2.3GB"
            duration = "45min"
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-WebRequest -Uri "$BACKEND_URL/api/webhooks/generic" -Method Post `
            -ContentType "application/json" -Body $genericPayload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  通用 Webhook (Low) 测试成功" -ForegroundColor Green
        } else {
            Write-Host "  通用 Webhook 测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  通用 Webhook 测试失败: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# 主函数
function Main {
    Test-Health
    Test-Prometheus
    Test-Zabbix
    Test-Generic-Medium
    Test-Generic-Low

    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "所有测试完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "请访问 http://localhost:8080/alerts 查看告警" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
}

# 执行主函数
Main
