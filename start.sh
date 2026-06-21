#!/bin/bash

# 企业 IT 运维多 Agent 自动化平台 - Linux/Mac 启动脚本
echo "========================================"
echo -e "\033[32m  企业 IT 运维多 Agent 自动化平台\033[0m"
echo "========================================"
echo ""

# 检查 Docker 是否安装和运行
echo -e "[1/6] \033[33m检查 Docker 状态...\033[0m"
if ! command -v docker &> /dev/null; then
    echo -e "\033[31m✗ Docker 未安装！请先安装 Docker。\033[0m"
    read -p "按回车键退出"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "\033[31m✗ Docker 未运行！请先启动 Docker。\033[0m"
    read -p "按回车键退出"
    exit 1
fi

DOCKER_VERSION=$(docker --version)
echo -e "\033[32m✓ Docker 已安装: $DOCKER_VERSION\033[0m"

# 检查 Docker Compose
echo ""
echo -e "[2/6] \033[33m检查 Docker Compose...\033[0m"
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "\033[31m✗ Docker Compose 未找到！\033[0m"
    read -p "按回车键退出"
    exit 1
fi

echo -e "\033[32m✓ Docker Compose 可用\033[0m"

# 检查环境变量
echo ""
echo -e "[3/6] \033[33m检查环境变量配置...\033[0m"
if [ ! -f ".env" ]; then
    echo -e "\033[33m⚠ 未找到 .env 文件，使用默认配置...\033[0m"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "\033[32m✓ 已从 .env.example 复制默认配置\033[0m"
    fi
else
    echo -e "\033[32m✓ 已找到 .env 文件\033[0m"
fi

# 停止现有容器
echo ""
echo -e "[4/6] \033[33m停止现有容器（如果有）...\033[0m"
$COMPOSE_CMD down 2>/dev/null
echo -e "\033[32m✓ 完成\033[0m"

# 构建并启动
echo ""
echo -e "[5/6] \033[33m构建并启动服务...\033[0m"
echo -e "\033[90m这可能需要几分钟，请耐心等待...\033[0m"
$COMPOSE_CMD up -d --build

if [ $? -eq 0 ]; then
    echo -e "\033[32m✓ 服务启动成功！\033[0m"
else
    echo -e "\033[31m✗ 服务启动失败！\033[0m"
    read -p "按回车键退出"
    exit 1
fi

# 等待服务就绪
echo ""
echo -e "[6/6] \033[33m等待服务就绪...\033[0m"
MAX_ATTEMPTS=30
ATTEMPT=0
READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && [ "$READY" = false ]; do
    if curl -f "http://localhost:3001/health" -m 2 &>/dev/null; then
        READY=true
    else
        sleep 2
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -e "\033[90m  等待中... ($ATTEMPT/$MAX_ATTEMPTS)\033[0m"
done

echo ""
echo "========================================"
echo -e "\033[32m  ✅ 启动完成！\033[0m"
echo "========================================"
echo ""
echo -e "🌐 前端地址: http://localhost:8080"
echo -e "🔧 后端 API: http://localhost:3001"
echo -e "\033[90m📊 查看日志: $COMPOSE_CMD logs -f\033[0m"
echo -e "\033[90m⏹ 停止服务: $COMPOSE_CMD down\033[0m"
echo ""
echo -e "\033[90m提示: 如果无法访问，请确保 Docker 正在运行。\033[0m"
echo ""

# 询问是否打开浏览器
read -p "是否在浏览器中打开前端? (Y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open "http://localhost:8080"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "http://localhost:8080"
    else
        echo -e "\033[33m无法自动打开浏览器，请手动访问: http://localhost:8080\033[0m"
    fi
fi
