# REQ-20260925-itops-agent-service 需求分析文档

> 需求来源：用户 2026-09-25。`/platform#providers` 中 `agent-service`（远端 Python Agent 服务）一直显示连接被拒（默认 `127.0.0.1:8000` 未部署）。要求：完成 `itops-agent-service` 的开发补全、部署接入生产栈，确保 Agent 调用链路正常；默认模型使用 DeepSeek `deepseek-v4-flash`（key 由用户提供），配置落库（平台模型池 `ai_models` 表）。

## 1. 业务目标

- 打通「平台后端 ↔ 外部 Python Agent 服务」的完整调用链：Provider 健康探测、Agent 注册同步、对话执行（含降级链）。
- 外部服务具备真实 LLM 能力：接入 DeepSeek `deepseek-v4-flash`（OpenAI 兼容协议），并作为平台默认模型。
- 平台模型池（SQLite `ai_models` 表）落库 DeepSeek 配置并设为默认；外部服务自动跟随模型池配置。

## 2. 现状（澄清结论）

| 事项 | 现状 |
|------|------|
| 服务代码 | `itops-agent-service/` 已有 PydanticAI + FastAPI 实现（chat/knowledge/agents/memory/tools/mcp/cli），但存在集成缺口（见 §4） |
| 部署形态 | 生产栈（`docker-compose.yml`：itops-backend 19301 / itops-frontend 19300）未包含该服务；后端容器内 `AGENT_SERVICE_URL` 缺省 `http://localhost:8000` 指向容器自身，必然连接被拒 |
| LLM | 模型池仅有 `volcengine/doubao-1-5-lite-32k` 且 **无 api_key**；宿主机无本地 LLM 端点；用户提供 DeepSeek key，已验证 `deepseek-v4-flash` 真实可用（HTTP 200，注意其为推理模型，reasoning 消耗 token） |
| 运行环境 | 宿主 Python 3.10.12，服务要求 ≥3.11 → 必须容器化部署；docker-compose v1.29.2 + buildx 已就绪（见 runbook） |

## 3. 功能边界

**包含**
1. `itops-agent-service` 集成缺口修复（chat 尊重动态注册的 Agent、LLM 配置运行时生效与持久化、会话历史、知识库注入、LLM 未配置时的结构化错误）。
2. 生产栈接入：新增 `agent-service` 容器（`docker/Dockerfile.agent-service`），backend 通过 `AGENT_SERVICE_URL=http://agent-service:8000` 互通；不暴露宿主端口（仅栈内网络可达）。
3. 平台侧最小改动：启动时向外部服务同步模型池默认配置与平台 Agent 注册表；`sessionKey` 透传以支持会话上下文。
4. DeepSeek `deepseek-v4-flash` 写入平台模型池并设为默认（数据库持久化）。
5. 端到端验证：providers 健康展示、外部服务直连 chat、降级链调用、LLM 真实回复。

**不包含**
- 不改动降级链默认顺序（`local` 仍是默认 Provider，`agent-service` 为后备；切换入口已有 API）。
- 不实现 MCP/CLI 的生产化（代码保留，不在本次验证范围）。
- 不迁移服务器凭据等平台数据。

## 4. 集成缺口清单（本次要修的根因）

| # | 缺口 | 影响 |
|---|------|------|
| G1 | `/api/chat` 只认 4 个内置 Agent 类型，不查动态注册表；而后端按平台 `agents.id` 注册再按 id 调用 | 平台注册的 Agent 全部失效，退化为通用提示词 |
| G2 | Agent 构造时一次性绑定模型（`openai:{settings.llm_model}`），`POST /api/llm/config` 同步后不生效；`_agents` 缓存永不失效 | 模型同步形同虚设 |
| G3 | LLM 配置仅存内存，容器重启即丢失 | 重启后 chat 报错直至下次后端重启重放 |
| G4 | `AgentDeps.knowledge_base` 未注入，知识工具恒返回「知识库未初始化」 | 工具能力为空 |
| G5 | 契约中的 `sessionKey` 未透传到外部服务，无会话上下文 | 多轮对话无记忆 |
| G6 | LLM 未配置时 `/api/chat` 抛裸 500 | 降级链无法区分「服务坏」与「模型缺配置」，错误信息不可行动 |

## 5. 非功能约束

- 容器非 root 运行、资源限额、日志轮转、healthcheck（与生产栈现有容器同级标准）。
- 构建遵循本机网络现实：apt/PyPI 走阿里云镜像 + 超时限制（见 `docs/platform/deployment.md` 前置条件）。
- API key 不落日志、不在 GET 响应中明文返回（GET `/api/llm/config` 已脱敏）。
- 构建期 pip 依赖全部有 py3.11 linux 轮子，镜像内不需要编译器。

## 6. 外部依赖

| 依赖 | 说明 |
|------|------|
| DeepSeek API | `https://api.deepseek.com/v1`，模型 `deepseek-v4-flash`，key 由用户提供（已验证可达） |
| Docker/BuildKit | 宿主已装 buildx 插件 |

## 7. 验收标准

1. `docker ps` 中 `itops-agent-service` healthy；后端 `/api/agent-service/health` 返回 healthy。
2. `/platform#providers` 中 `agent-service` 显示健康（已注册 Agent 数量 > 0）。
3. `POST /api/agents/providers/chat`（显式 `provider=agent-service`）返回 DeepSeek 真实回复。
4. 不指定 provider 时默认链 `[local → agent-service]` 均可用（同一模型池配置）。
5. `itops-agent-service` 单测全绿；平台后端/前端构建通过。
6. 重启 agent-service 容器后 LLM 配置自动恢复（持久化生效）。
