#!/bin/bash

# IT运维多Agent自动化平台 - 告警测试脚本
# 用于测试 Webhook 告警接收功能

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "=========================================="
echo "  IT运维多Agent自动化平台 - 告警测试"
echo "=========================================="
echo ""

# 颜色定义颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 测试后端健康检查
test_health() {
    echo -e "${BLUE}[1/5] 测试后端服务健康检查...${NC}"
    response=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/health")
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ 后端服务正常运行${NC}"
    else
        echo -e "${RED}❌ 后端服务响应异常 (HTTP ${response})${NC}"
        exit 1
    fi
    echo ""
}

# 测试 Prometheus Webhook
test_prometheus() {
    echo -e "${BLUE}[2/5] 测试 Prometheus Webhook...${NC}"
    
    prometheus_payload='{
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "HighCPUUsage",
                    "severity": "critical",
                    "instance": "prod-server-01"
                },
                "annotations": {
                    "summary": "CPU 使用率过高",
                    "description": "服务器 prod-server-01 的 CPU 使用率超过 85%"
                },
                "startsAt": "2024-01-01T00:00:00Z"
            }
        ]
    }'

    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$prometheus_payload" \
        "${BACKEND_URL}/api/webhooks/prometheus")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Prometheus Webhook 测试成功${NC}"
    else
        echo -e "${RED}❌ Prometheus Webhook 测试失败 (HTTP ${response})${NC}"
    fi
    echo ""
}

# 测试 Zabbix Webhook
test_zabbix() {
    echo -e "${BLUE}[3/5] 测试 Zabbix Webhook...${NC}"
    
    zabbix_payload='{
        "trigger": "内存使用率过高",
        "host": "数据库服务器",
        "item": "系统内存使用率",
        "value": "92%",
        "severity": "high"
    }'

    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$zabbix_payload" \
        "${BACKEND_URL}/api/webhooks/zabbix")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Zabbix Webhook 测试成功${NC}"
    else
        echo -e "${RED}❌ Zabbix Webhook 测试失败 (HTTP ${response})${NC}"
    fi
    echo ""
}

# 测试通用 Webhook - Medium 告警
test_generic_medium() {
    echo -e "${BLUE}[4/5] 测试通用 Webhook (Medium)...${NC}"
    
    generic_payload='{
        "source": "disk-monitor",
        "severity": "medium",
        "title": "磁盘空间预警",
        "content": "Redis 缓存服务器的磁盘空间使用量达到 75%",
        "metadata": {
            "disk_usage": "75%",
            "mount_point": "/data"
        }
    }'

    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$generic_payload" \
        "${BACKEND_URL}/api/webhooks/generic")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ 通用 Webhook (Medium) 测试成功${NC}"
    else
        echo -e "${RED}❌ 通用 Webhook 测试失败 (HTTP ${response})${NC}"
    fi
    echo ""
}

# 测试通用 Webhook - low 级别
test_generic_low() {
    echo -e "${BLUE}[5/5] 测试通用 Webhook (Low)...${NC}"
    
    generic_payload='{
        "source": "backup-system",
        "severity": "low",
        "title": "备份任务完成",
        "content": "测试服务器的日常备份任务成功完成",
        "metadata": {
            "backup_size": "2.3GB",
            "duration": "45min"
        }
    }'

    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$generic_payload" \
        "${BACKEND_URL}/api/webhooks/generic")

    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ 通用 Webhook (Low) 测试成功${NC}"
    else
        echo -e "${RED}❌ 通用 Webhook 测试失败 (HTTP ${response})${NC}"
    fi
    echo ""
}

# 主函数
main() {
    test_health
    test_prometheus
    test_zabbix
    test_generic_medium
    test_generic_low

    echo "=========================================="
    echo -e "${GREEN}所有测试完成！${NC}"
    echo ""
    echo -e "请访问 ${YELLOW}http://localhost:8080/alerts${NC} 查看告警"
    echo "=========================================="
}

# 执行主函数
main