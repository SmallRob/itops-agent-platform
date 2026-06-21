#!/bin/bash

# Zabbix 告警测试脚本 (Shell)

BACKEND_URL=${1:-"http://localhost:3001"}

echo "========================================"
echo "  Zabbix 告警测试工具"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 测试后端健康检查
test_health() {
    echo -e "${BLUE}[1/6] 测试后端健康检查...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" | grep -q "200"; then
        echo -e "  ${GREEN}✅ 后端服务正常运行${NC}"
        return 0
    else
        echo -e "  ${RED}❌ 后端服务无法访问${NC}"
        return 1
    fi
}

# 测试 Zabbix Webhook - CPU 告警
test_zabbix_cpu() {
    echo -e "${BLUE}[2/6] 测试 CPU 使用率告警...${NC}"
    
    payload='{
        "trigger": "CPU使用率过高",
        "host": "生产服务器-01",
        "item": "CPU使用率",
        "value": "87%",
        "severity": "high"
    }'

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BACKEND_URL/api/webhooks/zabbix")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✅ CPU 告警测试成功${NC}"
        echo -e "  响应: $body"
    else
        echo -e "  ${RED}❌ CPU 告警测试失败 (HTTP $http_code)${NC}"
        echo -e "  响应: $body"
    fi
}

# 测试 Zabbix Webhook - 磁盘告警
test_zabbix_disk() {
    echo -e "${BLUE}[3/6] 测试磁盘空间告警...${NC}"
    
    payload='{
        "trigger": "磁盘空间不足",
        "host": "数据库服务器",
        "item": "磁盘使用率",
        "value": "95%",
        "severity": "critical"
    }'

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BACKEND_URL/api/webhooks/zabbix")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✅ 磁盘告警测试成功${NC}"
        echo -e "  响应: $body"
    else
        echo -e "  ${RED}❌ 磁盘告警测试失败 (HTTP $http_code)${NC}"
        echo -e "  响应: $body"
    fi
}

# 测试 Zabbix Webhook - 内存告警
test_zabbix_memory() {
    echo -e "${BLUE}[4/6] 测试内存使用率告警...${NC}"
    
    payload='{
        "trigger": "内存使用率过高",
        "host": "Redis缓存服务器",
        "item": "系统内存使用率",
        "value": "92%",
        "severity": "high"
    }'

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BACKEND_URL/api/webhooks/zabbix")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✅ 内存告警测试成功${NC}"
        echo -e "  响应: $body"
    else
        echo -e "  ${RED}❌ 内存告警测试失败 (HTTP $http_code)${NC}"
        echo -e "  响应: $body"
    fi
}

# 测试 Zabbix Webhook - 服务告警
test_zabbix_service() {
    echo -e "${BLUE}[5/6] 测试服务异常告警...${NC}"
    
    payload='{
        "trigger": "Nginx服务停止",
        "host": "生产服务器-01",
        "item": "Nginx进程状态",
        "value": "DOWN",
        "severity": "critical"
    }'

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BACKEND_URL/api/webhooks/zabbix")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✅ 服务告警测试成功${NC}"
        echo -e "  响应: $body"
    else
        echo -e "  ${RED}❌ 服务告警测试失败 (HTTP $http_code)${NC}"
        echo -e "  响应: $body"
    fi
}

# 测试 Zabbix Webhook - 信息级别
test_zabbix_info() {
    echo -e "${BLUE}[6/6] 测试信息级别告警...${NC}"
    
    payload='{
        "trigger": "系统定时任务完成",
        "host": "测试服务器",
        "item": "备份任务状态",
        "value": "完成",
        "severity": "info"
    }'

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$BACKEND_URL/api/webhooks/zabbix")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        echo -e "  ${GREEN}✅ 信息告警测试成功${NC}"
        echo -e "  响应: $body"
    else
        echo -e "  ${RED}❌ 信息告警测试失败 (HTTP $http_code)${NC}"
        echo -e "  响应: $body"
    fi
}

# 显示菜单
show_menu() {
    echo -e "${YELLOW}请选择要测试的告警类型:${NC}"
    echo "  1. CPU 使用率告警"
    echo "  2. 磁盘空间告警"
    echo "  3. 内存使用率告警"
    echo "  4. 服务异常告警"
    echo "  5. 信息级别告警"
    echo "  6. 运行所有测试"
    echo "  0. 退出"
    echo ""
    read -p "请输入选项 (0-6): " choice
}

# 运行所有测试
run_all_tests() {
    test_zabbix_cpu
    echo ""
    sleep 0.5
    
    test_zabbix_disk
    echo ""
    sleep 0.5
    
    test_zabbix_memory
    echo ""
    sleep 0.5
    
    test_zabbix_service
    echo ""
    sleep 0.5
    
    test_zabbix_info
}

# 主函数
main() {
    echo -e "${YELLOW}后端地址: $BACKEND_URL${NC}"
    echo ""

    # 健康检查
    if ! test_health; then
        echo ""
        echo -e "${RED}❌ 请先启动后端服务！${NC}"
        return 1
    fi

    echo ""

    # 检查参数
    if [ "$1" = "--all" ] || [ "$2" = "--all" ]; then
        run_all_tests
    else
        show_menu
        
        case $choice in
            1) test_zabbix_cpu ;;
            2) test_zabbix_disk ;;
            3) test_zabbix_memory ;;
            4) test_zabbix_service ;;
            5) test_zabbix_info ;;
            6) run_all_tests ;;
            0) echo -e "${CYAN}再见！${NC}"; return 0 ;;
            *) echo -e "${RED}无效选项${NC}" ;;
        esac
    fi

    echo ""
    echo "========================================"
    echo -e "${GREEN}测试完成！${NC}"
    echo ""
    echo -e "${YELLOW}请访问 ${BACKEND_URL%:*}:8080/alerts 查看告警${NC}"
    echo "========================================"
}

# 执行主函数
main "$@"
