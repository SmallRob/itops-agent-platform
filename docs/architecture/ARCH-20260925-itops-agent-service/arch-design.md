# ARCH-20260925-itops-agent-service 架构设计

## 1. 组件与变更清单

### itops-agent-service（Python 3.11 / FastAPI / PydanticAI）

| 文件 | 变更 | 职责 |
|------|------|------|
| `src/agents/__init__.py` | 重构 | `ITOpsAgent` 改为**惰性构建**：`__init__` 只存配置；`_build()` 在每次 `run/run_stream` 时创建 PydanticAI Agent（注册工具），并用 `resolve_model()` 从 LLM 配置管理器解析模型实例。彻底消除「模型配置变更后缓存失效」问题 |
| `src/agents/__init__.py` | 新增 | `resolve_model(model=None)`：把「provider 前缀串 / 纯模型名 / None」统一解析为 `OpenAIModel/OpenAIChatModel + OpenAIProvider(base_url, api_key)`；凭据一律来自 LLM 配置管理器（不依赖进程环境变量） |
| `src/api/__init__.py` | 修改 | `chat`：**注册表优先**（`agent_registry.get_agent(agent_type)`）→ 内置工厂兜底；`AgentDeps` 注入 `knowledge_base`；会话历史注入与记录；LLM 未配置映射为结构化 503 |
| `src/api/llm_config_manager.py` | 修改 | 配置持久化到 `data/llm_config.json`（原子写、0600），启动时加载；`update_config` 幂等 |
| `src/api/sessions.py` | 新增 | 轻量会话历史（每 sessionKey 环形缓冲，默认保留最近 6 轮），线程安全 |
| `pyproject.toml` | 修改 | `pydantic-ai>=0.4.0,<1.0.0`（锁定 0.x API：`result.data`/`stream_text` 仍可用） |

### 平台后端（Express/TS）

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/services/agent/providers/remoteAgentProvider.ts` | 修改 | chat 的 `context` 增加 `sessionKey`（+ provider 标记），供外部服务维护会话 |
| `src/app.ts` | 修改 | `registerExistingAgents` 增加：注册平台 Agent 后，把模型池默认模型（含 key/base）经 `syncLLMConfig` 推送到外部服务 |

### 部署

| 文件 | 变更 | 说明 |
|------|------|------|
| `docker/Dockerfile.agent-service` | 新增 | python:3.11-slim；apt/PyPI 阿里云镜像 + 超时；非 root；healthcheck（urllib 探活）；`uvicorn` 启动 |
| `docker-compose.yml` | 修改 | 新增 `agent-service`（itops-network、数据卷 `agent-data:/app/data`、限额、日志轮转）；backend 增加 `AGENT_SERVICE_URL=http://agent-service:8000`、`depends_on: agent-service (healthy)`、LLM env 透传 |

## 2. 数据流

```
平台模型池 ai_models（SQLite，唯一配置源）
   │  backend 启动：syncLLMConfig(provider/model/api_key/api_base)
   ▼
itops-agent-service ──持久化──▶ data/llm_config.json（卷，抗重启）
   ▲                                   │
   │ /api/chat（agent_type, message, context{sessionKey,…}）        │ 启动加载
   │                                        ▼
agentRegistry.chat（降级链 local→agent-service）        LLM 配置管理器 ──▶ resolve_model ──▶ DeepSeek
```

- 平台 Agent 注册：backend 启动把 `agents` 表逐个 `POST /api/agents/{id}/register`（name/system_prompt）。
- 对话：`/api/agents/providers/chat` → `agentRegistry.chat` → `RemoteAgentProvider` → 外部服务 → PydanticAI → DeepSeek。

## 3. 接口契约（外部服务）

沿用 `AgentServiceClient` 已有约定，全部已实现并保持兼容：

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/api/health` | `{status:"healthy"}`，Provider 健康探测走 `GET /api/agents/registered` |
| POST | `/api/chat` | `{message, agent_type, context, stream}` → `{content, agent_type, thinking?, tools_used, suggestions}` |
| POST/POST/GET | `/api/agents/{type}/register|unregister`、`/api/agents/registered` | 动态 Agent 注册表 |
| POST/GET | `/api/llm/config` | 模型配置同步（GET 脱敏） |
| POST | `/api/knowledge/search` | 知识检索代理 |

错误语义新增：LLM 未配置 → `503 {"detail": "LLM 未配置：请通过 POST /api/llm/config 或环境变量设置模型"}`，使降级链可区分「配置缺失」与「服务不可达」。

## 4. 安全设计

- `agent-service` 仅加入 `itops-network`，**不发布宿主端口**；外部只能经 backend 的 `/api/agent-service/*`（受 JWT 鉴权）访问。
- api_key 经内部桥接网络明文同步（与 backend 调云端 LLM 同级风险面），落盘 `llm_config.json` 权限 0600；`GET /api/llm/config` 与日志不回显 key。
- 容器非 root（uid 1001）、只读代码层、数据仅写卷；资源限额 1C/512M。
- chat 入参 `agent_type` 沿用 `[a-zA-Z0-9_-]+` 校验（客户端与服务端双侧）。

## 5. 数据建模

- 平台库：`ai_models` 新增一行 DeepSeek 默认模型（`provider_type=deepseek, model_id=deepseek-v4-flash, api_key, enabled=1, is_default=1`）；原 volcengine 行 `is_default=0`。无 Schema 变更。
- 外部服务：`data/llm_config.json`（单对象）；会话历史仅内存（重启即弃，符合无状态服务边界）。
