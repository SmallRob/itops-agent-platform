# Zabbix 告警测试脚本 (PowerShell)

param(
    [string]$BackendUrl = "http://localhost:3001",
    [switch]$AllTests
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Zabbix 告警测试工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 测试后端健康检查
function Test-Health {
    Write-Host "[1/6] 测试后端健康检查..." -ForegroundColor Blue
    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/health" -Method Get -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ 后端服务正常运行" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ 后端服务响应异常 (HTTP $($response.StatusCode))" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ❌ 后端服务无法访问: $_" -ForegroundColor Red
        return $false
    }
}

# 测试 Zabbix Webhook - CPU 告警
function Test-Zabbix-CPU {
    Write-Host "[2/6] 测试 CPU 使用率告警..." -ForegroundColor Blue
    
    $payload = @{
        trigger = "CPU使用率过高"
        host = "生产服务器-01"
        item = "CPU使用率"
        value = "87%"
        severity = "high"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/webhooks/zabbix" -Method Post `
            -ContentType "application/json" -Body $payload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ CPU 告警测试成功" -ForegroundColor Green
            Write-Host "  响应: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ CPU 告警测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ CPU 告警测试失败: $_" -ForegroundColor Red
    }
}

# 测试 Zabbix Webhook - 磁盘告警
function Test-Zabbix-Disk {
    Write-Host "[3/6] 测试磁盘空间告警..." -ForegroundColor Blue
    
    $payload = @{
        trigger = "磁盘空间不足"
        host = "数据库服务器"
        item = "磁盘使用率"
        value = "95%"
        severity = "critical"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/webhooks/zabbix" -Method Post `
            -ContentType "application/json" -Body $payload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ 磁盘告警测试成功" -ForegroundColor Green
            Write-Host "  响应: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ 磁盘告警测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ 磁盘告警测试失败: $_" -ForegroundColor Red
    }
}

# 测试 Zabbix Webhook - 内存告警
function Test-Zabbix-Memory {
    Write-Host "[4/6] 测试内存使用率告警..." -ForegroundColor Blue
    
    $payload = @{
        trigger = "内存使用率过高"
        host = "Redis缓存服务器"
        item = "系统内存使用率"
        value = "92%"
        severity = "high"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/webhooks/zabbix" -Method Post `
            -ContentType "application/json" -Body $payload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ 内存告警测试成功" -ForegroundColor Green
            Write-Host "  响应: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ 内存告警测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ 内存告警测试失败: $_" -ForegroundColor Red
    }
}

# 测试 Zabbix Webhook - 服务告警
function Test-Zabbix-Service {
    Write-Host "[5/6] 测试服务异常告警..." -ForegroundColor Blue
    
    $payload = @{
        trigger = "Nginx服务停止"
        host = "生产服务器-01"
        item = "Nginx进程状态"
        value = "DOWN"
        severity = "critical"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/webhooks/zabbix" -Method Post `
            -ContentType "application/json" -Body $payload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ 服务告警测试成功" -ForegroundColor Green
            Write-Host "  响应: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ 服务告警测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ 服务告警测试失败: $_" -ForegroundColor Red
    }
}

# 测试 Zabbix Webhook - 信息级别
function Test-Zabbix-Info {
    Write-Host "[6/6] 测试信息级别告警..." -ForegroundColor Blue
    
    $payload = @{
        trigger = "系统定时任务完成"
        host = "测试服务器"
        item = "备份任务状态"
        value = "完成"
        severity = "info"
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$BackendUrl/api/webhooks/zabbix" -Method Post `
            -ContentType "application/json" -Body $payload -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "  ✅ 信息告警测试成功" -ForegroundColor Green
            Write-Host "  响应: $($response.Content)" -ForegroundColor Gray
        } else {
            Write-Host "  ❌ 信息告警测试失败 (HTTP $($response.StatusCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ 信息告警测试失败: $_" -ForegroundColor Red
    }
}

# 主函数
function Main {
    Write-Host "后端地址: $BackendUrl" -ForegroundColor Yellow
    Write-Host ""

    # 健康检查
    if (-not (Test-Health)) {
        Write-Host ""
        Write-Host "❌ 请先启动后端服务！" -ForegroundColor Red
        return
    }

    Write-Host ""

    if ($AllTests) {
        # 运行所有测试
        Test-Zabbix-CPU
        Write-Host ""
        Start-Sleep -Milliseconds 500
        
        Test-Zabbix-Disk
        Write-Host ""
        Start-Sleep -Milliseconds 500
        
        Test-Zabbix-Memory
        Write-Host ""
        Start-Sleep -Milliseconds 500
        
        Test-Zabbix-Service
        Write-Host ""
        Start-Sleep -Milliseconds 500
        
        Test-Zabbix-Info
    } else {
        # 交互式菜单
        Write-Host "请选择要测试的告警类型:" -ForegroundColor Yellow
        Write-Host "  1. CPU 使用率告警"
        Write-Host "  2. 磁盘空间告警"
        Write-Host "  3. 内存使用率告警"
        Write-Host "  4. 服务异常告警"
        Write-Host "  5. 信息级别告警"
        Write-Host "  6. 运行所有测试"
        Write-Host "  0. 退出"
        
        $choice = Read-Host "请输入选项 (0-6)"
        
        Write-Host ""
        
        switch ($choice) {
            "1" { Test-Zabbix-CPU }
            "2" { Test-Zabbix-Disk }
            "3" { Test-Zabbix-Memory }
            "4" { Test-Zabbix-Service }
            "5" { Test-Zabbix-Info }
            "6" { 
                Test-Zabbix-CPU; Write-Host ""; Start-Sleep -Milliseconds 500
                Test-Zabbix-Disk; Write-Host ""; Start-Sleep -Milliseconds 500
                Test-Zabbix-Memory; Write-Host ""; Start-Sleep -Milliseconds 500
                Test-Zabbix-Service; Write-Host ""; Start-Sleep -Milliseconds 500
                Test-Zabbix-Info
            }
            "0" { Write-Host "再见！" -ForegroundColor Cyan; return }
            default { Write-Host "无效选项" -ForegroundColor Red }
        }
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "测试完成！" -ForegroundColor Green
    Write-Host ""
    Write-Host "请访问 ${BackendUrl%:*}:8080/alerts 查看告警" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
}

# 执行主函数
Main
