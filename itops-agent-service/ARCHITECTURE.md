# ITOps Agent Service 架构设计文档

## 1. 概述

ITOps Agent Service 是从 ITOps Agent Platform 抽离封装的独立Agent服务，基于 PydanticAI 框架构建，提供智能运维Agent能力。

### 1.1 设计目标

- **独立部署**：可独立运行，不依赖原平台
- **多种调用方式**：支持REST API、CLI、MCP协议
- **类型安全**：基于PydanticAI的类型安全设计
- **可扩展**：易于添加新的Agent类型和工具
- **知识库集成**：内置运维知识库，支持RAG检索

### 1.2 技术选型

根据技术选型报告，采用以下技术栈：

| 组件 | 技术选型 | 说明 |
|------|---------|------|
| Agent框架 | PydanticAI | 类型安全、依赖注入、原生MCP支持 |
| Web框架 | FastAPI | 高性能、自动API文档 |
| CLI框架 | Click + Rich | 命令行解析 + 美化输出 |
| MCP服务 | MCP Python SDK | Model Context Protocol支持 |
| 配置管理 | Pydantic Settings | 类型安全的配置管理 |
| 知识库 | 自研文件知识库 | 支持YAML/JSON/Markdown |

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ITOps Agent Service                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  REST API   │  │    CLI      │  │  MCP Server │         │
│  │  (FastAPI)  │  │   (Click)   │  │   (MCP SDK) │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                    ┌─────▼─────┐                            │
│                    │   Agent   │                            │
│                    │  (PydanticAI) │                         │
│                    └─────┬─────┘                            │
│                          │                                  │
│         ┌────────────────┼────────────────┐                 │
│         │                │                │                 │
│    ┌────▼────┐    ┌─────▼─────┐    ┌────▼────┐            │
│    │  Tools  │    │ Knowledge │    │ Memory  │            │
│    │  模块   │    │   模块    │    │  模块   │            │
│    └─────────┘    └───────────┘    └─────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块说明

#### 2.2.1 核心模块

| 模块 | 路径 | 说明 |
|------|------|------|
| config | `src/config.py` | 配置管理，支持环境变量和.env文件 |
| deps | `src/deps.py` | 依赖注入，定义Agent运行时依赖 |
| agents | `src/agents/` | Agent实现，包含多种Agent类型 |
| tools | `src/tools/` | 工具模块，Agent可用的工具 |
| knowledge | `src/knowledge/` | 知识库模块，支持知识检索 |
| memory | `src/memory/` | 记忆模块，对话历史管理 |

#### 2.2.2 接口模块

| 模块 | 路径 | 说明 |
|------|------|------|
| api | `src/api/` | FastAPI REST API服务 |
| cli | `src/cli/` | CLI命令行工具 |
| mcp | `src/mcp/` | MCP服务端 |

### 2.3 Agent类型

| 类型 | 名称 | 说明 |
|------|------|------|
| general | 通用运维Agent | 处理各种运维问题 |
| alert | 告警处理Agent | 专注于告警分析和处理 |
| diagnosis | 故障诊断Agent | 专注于故障诊断和分析 |
| inspection | 巡检Agent | 专注于系统巡检和检查 |

## 3. 核心设计

### 3.1 Agent设计

```python
class ITOpsAgent:
    """IT运维Agent基类"""
    
    def __init__(self, name, system_prompt, model):
        # 创建PydanticAI Agent
        self._agent = Agent(
            model,
            system_prompt=system_prompt,
            deps_type=AgentDeps,
            result_type=str,
        )
        # 注册工具
        self._register_tools()
    
    async def run(self, message, deps, context):
        """运行Agent"""
        result = await self._agent.run(message, deps=deps)
        return AgentResponse(content=result.data)
    
    async def run_stream(self, message, deps, context):
        """流式运行Agent"""
        async with self._agent.run_stream(message, deps=deps) as stream:
            async for text in stream.stream_text():
                yield text
```

### 3.2 依赖注入

```python
@dataclass
class AgentDeps:
    """Agent运行时依赖"""
    settings: Settings
    db_session: Optional[AsyncSession] = None
    user_id: str = "system"
    context: dict[str, Any] = field(default_factory=dict)
    
    # 服务引用
    knowledge_base: Any = None
    vector_store: Any = None
    ssh_manager: Any = None
    alert_manager: Any = None
```

### 3.3 工具系统

```python
class BaseTool(ABC):
    """工具基类"""
    
    @property
    @abstractmethod
    def name(self) -> str: ...
    
    @property
    @abstractmethod
    def description(self) -> str: ...
    
    @abstractmethod
    async def execute(self, **kwargs) -> ToolResult: ...
```

### 3.4 知识库设计

```python
class BaseKnowledgeBase(ABC):
    """知识库基类"""
    
    @abstractmethod
    async def initialize(self) -> None: ...
    
    @abstractmethod
    async def search(self, query, category, limit) -> list[SearchResult]: ...
    
    @abstractmethod
    async def get_article(self, article_id) -> Optional[KnowledgeArticle]: ...
```

## 4. 接口设计

### 4.1 REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/chat` | POST | 聊天接口 |
| `/api/chat/stream` | POST | 流式聊天接口 |
| `/api/knowledge/search` | POST | 知识库搜索 |
| `/api/knowledge/categories` | GET | 获取知识类别 |
| `/api/agents` | GET | 列出可用Agent |

### 4.2 CLI命令

| 命令 | 说明 |
|------|------|
| `itops-agent` | 启动交互模式 |
| `itops-agent -m "message"` | 直接发送消息 |
| `itops-agent -a alert` | 指定Agent类型 |
| `/help` | 显示帮助 |
| `/agent <type>` | 切换Agent类型 |
| `/knowledge <query>` | 搜索知识库 |

### 4.3 MCP工具

| 工具 | 说明 |
|------|------|
| `chat` | 与Agent对话 |
| `search_knowledge` | 搜索知识库 |
| `list_agents` | 列出可用Agent |
| `list_knowledge_categories` | 列出知识类别 |

## 5. 部署方式

### 5.1 独立部署

```bash
# 安装
pip install -e .

# 配置
cp .env.example .env
# 编辑.env文件

# 启动API服务
python -m src.api

# 启动CLI
python -m src.cli

# 启动MCP服务
python -m src.mcp
```

### 5.2 Docker部署

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install -e .

COPY . .

CMD ["python", "-m", "src.api"]
```

### 5.3 与ITOps Agent Platform集成

```typescript
// 在ITOps Agent Platform后端中调用
const response = await fetch('http://localhost:8000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: '服务器CPU使用率过高',
    agent_type: 'diagnosis',
  }),
});
```

## 6. 扩展指南

### 6.1 添加新Agent类型

1. 在 `src/agents/__init__.py` 中创建新Agent类
2. 定义系统提示词
3. 注册相关工具
4. 在 `create_agent` 工厂函数中注册

```python
class CustomAgent(ITOpsAgent):
    def __init__(self, model=None):
        super().__init__(
            name="custom-agent",
            system_prompt="自定义系统提示词...",
            model=model,
        )
```

### 6.2 添加新工具

1. 在 `src/tools/__init__.py` 中创建新工具类
2. 实现 `BaseTool` 接口
3. 在工具注册表中注册

```python
class CustomTool(BaseTool):
    @property
    def name(self) -> str:
        return "custom_tool"
    
    @property
    def description(self) -> str:
        return "自定义工具描述"
    
    async def execute(self, **kwargs) -> ToolResult:
        # 实现工具逻辑
        return ToolResult(success=True, output="结果")
```

### 6.3 添加知识条目

在 `knowledge/` 目录下创建YAML/JSON/Markdown文件：

```yaml
articles:
  - id: custom_article
    title: 自定义文章
    category: custom
    tags: [tag1, tag2]
    content: |
      文章内容...
```

## 7. 测试

### 7.1 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_agents.py

# 运行带覆盖率的测试
pytest --cov=src
```

### 7.2 测试结构

```
tests/
├── conftest.py          # 测试配置
├── test_agents.py       # Agent测试
├── test_config.py       # 配置测试
├── test_knowledge.py    # 知识库测试
└── ...
```

## 8. 后续规划

### 8.1 短期目标

- [ ] 完善工具系统，添加更多运维工具
- [ ] 集成向量数据库，支持语义搜索
- [ ] 添加单元测试和集成测试
- [ ] 完善API文档

### 8.2 中期目标

- [ ] 集成Mem0记忆系统
- [ ] 支持多轮对话上下文
- [ ] 添加更多Agent类型
- [ ] 实现Agent编排能力

### 8.3 长期目标

- [ ] 支持A2A协议
- [ ] 实现Agent协作能力
- [ ] 集成可观测性平台
- [ ] 支持自定义工作流

## 9. 参考资料

- [PydanticAI文档](https://ai.pydantic.dev/)
- [FastAPI文档](https://fastapi.tiangolo.com/)
- [MCP协议规范](https://modelcontextprotocol.io/)
- [技术选型报告](../6a3be4b16d544a8bf620028d_AI-Agent技术选型报告-2026Q2.md)
