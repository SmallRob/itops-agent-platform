.PHONY: install dev test lint run-api run-cli run-mcp clean

# 安装依赖
install:
	pip install -e .

# 安装开发依赖
dev:
	pip install -e ".[dev]"

# 运行测试
test:
	pytest

# 运行测试带覆盖率
test-cov:
	pytest --cov=src --cov-report=html

# 代码检查
lint:
	ruff check .
	mypy src

# 代码格式化
format:
	ruff format .

# 启动API服务
run-api:
	python run.py api

# 启动CLI
run-cli:
	python run.py cli

# 启动MCP服务
run-mcp:
	python run.py mcp

# 清理
clean:
	rm -rf __pycache__
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .mypy_cache
	rm -rf dist
	rm -rf build
	rm -rf *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# 构建
build:
	python -m build

# 发布
publish:
	twine upload dist/*

# 帮助
help:
	@echo "可用命令:"
	@echo "  make install    - 安装依赖"
	@echo "  make dev        - 安装开发依赖"
	@echo "  make test       - 运行测试"
	@echo "  make test-cov   - 运行测试带覆盖率"
	@echo "  make lint       - 代码检查"
	@echo "  make format     - 代码格式化"
	@echo "  make run-api    - 启动API服务"
	@echo "  make run-cli    - 启动CLI"
	@echo "  make run-mcp    - 启动MCP服务"
	@echo "  make clean      - 清理"
	@echo "  make build      - 构建"
	@echo "  make publish    - 发布"
