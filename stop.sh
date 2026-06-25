#!/bin/bash

# 企业 IT 运维多 Agent 自动化平台 - Linux/Mac 停止脚本
echo "========================================"
echo -e "\033[33m  停止 IT 运维平台服务\033[0m"
echo "========================================"
echo ""

# 确定 Docker Compose 命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "\033[31m✗ Docker Compose 未找到！\033[0m"
    exit 1
fi

# 停止容器
echo -e "[1/2] \033[33m停止容器...\033[0m"
$COMPOSE_CMD down

if [ $? -eq 0 ]; then
    echo -e "\033[32m✓ 容器已停止\033[0m"
else
    echo -e "\033[33m⚠ 停止过程中有警告，但可能已完成\033[0m"
fi

echo ""
echo -e "[2/2] \033[33m清理（可选）...\033[0m"
read -p "是否清理未使用的 Docker 资源? (Y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\033[90m正在清理未使用的资源（这将保留卷数据）...\033[0m"
    docker system prune -f
    echo -e "\033[32m✓ 清理完成\033[0m"
fi

echo ""
echo "========================================"
echo -e "\033[32m  ✅ 已停止服务！\033[0m"
echo "========================================"
echo ""
echo -e "\033[90m提示: 如需重新启动，请运行 ./start.sh\033[0m"
