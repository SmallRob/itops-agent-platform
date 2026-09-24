# ITOps Agent Service

基于PydanticAI的智能运维Agent服务，从ITOps Agent Platform抽离封装的独立Agent服务。

## 特性

- **多Agent支持**：通用运维、告警处理、故障诊断、巡检等多种Agent类型
- **知识库集成**：内置运维知识库，支持知识检索和问答
- **多种调用方式**：
  - REST API（FastAPI）
  - CLI命令行工具
  - MCP服务端（Model Context Protocol）
- **类型安全**：基于PydanticAI的类型安全设计
- **可扩展**：易于添加新的Agent类型和工具

## 快速开始

### 安装

```bash
# 进入服务目录
cd itops-agent-service

# 安装依赖
pip install -e .
```

### 配置

创建 `.env` 文件：

```env
# LLM配置
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
OPENAI_API_KEY=your-api-key
OPENAI_API_BASE=https://api.openai.com/v1

# 或使用豆包
# LLN_PROVIDER=doubao
# DOUBAO_API_KEY=your-api-key
# DOUBAO_MODEL=doubao-4o

# 服务配置
HOST=0.0.0.0
PORT=8000
```

### 运行

#### API服务

```bash
# 启动API服务
python -m src.api

# 或使用uvicorn
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

#### CLI工具

```bash
# 交互模式
python -m src.cli

# 指定Agent类型
python -m src.cli --agent alert

# 直接发送消息
python -m src.cli --message "服务器CPU使用率过高怎么办？"
```

#### MCP服务

```bash
# 启动MCP服务
python -m src.mcp
```

## API文档

启动API服务后，访问 http://localhost:8000/docs 查看Swagger文档。

### 主要接口

#### 聊天接口

```bash
# 普通聊天
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "服务器CPU使用率过高怎么办？", "agent_type": "general"}'

# 流式聊天
curl -X POST http://localhost:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "服务器CPU使用率过高怎么办？", "stream": true}'
```

#### 知识库搜索

```bash
curl -X POST http://localhost:8000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "CPU使用率过高", "limit": 5}'
```

#### 列出Agent

```bash
curl http://localhost:8000/api/agents
```

## CLI命令

在交互模式下，可以使用以下命令：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/agent <type>` | 切换Agent类型 |
| `/knowledge <query>` | 搜索知识库 |
| `/clear` | 清屏 |
| `/quit` | 退出程序 |

## Agent类型

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| `general` | 通用运维Agent | 处理各种运维问题 |
| `alert` | 告警处理Agent | 告警分析和处理 |
| `diagnosis` | 故障诊断Agent | 故障诊断和分析 |
| `inspection` | 巡检Agent | 系统巡检和检查 |

## 知识库

知识库支持以下格式：

- YAML文件（`.yaml`, `.yml`）
- JSON文件（`.json`）
- Markdown文件（`.md`，支持YAML frontmatter）

知识文件放置在 `knowledge/` 目录下。

### 知识文件示例

```yaml
articles:
  - id: cpu_high
    title: CPU使用率过高排查指南
    category: troubleshooting
    tags: [cpu, 性能, 排查]
    content: |
      # CPU使用率过高排查指南
      
      ## 常见原因
      1. 进程异常占用
      2. 死循环或无限递归
      ...
```

## 架构设计

```
itops-agent-service/
├── src/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── deps.py            # 依赖注入
│   ├── agents/            # Agent实现
│   │   └── __init__.py
│   ├── tools/             # 工具模块
│   │   └── __init__.py
│   ├── knowledge/         # 知识库
│   │   └── __init__.py
│   ├── memory/            # 记忆模块
│   │   └── __init__.py
│   ├── api/               # FastAPI服务
│   │   └── __init__.py
│   ├── cli/               # CLI工具
│   │   └── __init__.py
│   └── mcp/               # MCP服务
│       └── __init__.py
├── knowledge/             # 知识库文件
├── data/                  # 数据目录
├── pyproject.toml         # 项目配置
├── .env.example           # 环境变量示例
└── README.md              # 项目说明
```

## 与ITOps Agent Platform集成

生产栈中本服务以容器 `itops-agent-service` 运行（`docker-compose.yml` 已接入，仅栈内网络可达），平台后端经 `AGENT_SERVICE_URL=http://agent-service:8000` 调用。启动时平台自动完成两类同步：

1. **Agent 注册**：平台 `agents` 表逐个 `POST /api/agents/{id}/register`（名称 + 系统提示词）；`/api/chat` 按 agent_type **先查注册表**，未命中再落到内置类型。
2. **LLM 配置**：平台模型池默认模型（provider/model/api_key/api_base）`POST /api/llm/config` 同步，落盘 `data/llm_config.json`（0600），容器重启自动恢复——无需重放同步。

会话上下文：平台透传 `sessionKey`（请求 context 内），服务端按会话维护滚动历史注入提示词。

模型凭据来源说明：模型实例在运行时经 `resolve_model()` 显式构造（OpenAI 兼容协议，显式传 base_url/api_key），不依赖进程环境变量；`openai:model` 形式的模型串只取模型名。

```typescript
// 在ITOps Agent Platform后端中调用（等价的 REST 形式）
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '服务器CPU使用率过高',
    agent_type: 'diagnosis',      // 内置类型或已注册的平台 Agent ID
    context: { sessionKey: 'conv-1' }, // 可选：会话上下文
  }),
});
```

## 部署与本地调试

- **生产部署**：`docker/Dockerfile.agent-service`（python:3.12-slim，非 root，healthcheck），`docker-compose build agent-service && docker-compose up -d agent-service`。
- **本地测试**（宿主 Python 3.12）：

```bash
uv venv .venv --python 3.12
uv pip install -e '.[dev]' -i https://mirrors.aliyun.com/pypi/simple/
.venv/bin/pytest -q
```

## 开发

### 运行测试

```bash
pytest
```

### 代码检查

```bash
ruff check .
mypy .
```

## 许可证

MPL-2.0
