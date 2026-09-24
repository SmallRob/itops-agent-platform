# 平台架构（Agent / Skills / Hooks）

> 本文描述 ITOps Agent Platform 的**可扩展内核**：Agent Runtime、Skills（技能插件）、Hooks（事件入站）三层如何解耦协作。
> 系统级的历史描述见 [ARCHITECTURE.md](../ARCHITECTURE.md)，本文是新增能力域的权威文档。

---

## 快速开始

```bash
# 1. 查看 Agent Provider 与降级链（含熔断状态）
curl -s http://localhost:3001/api/agents/providers -H "Authorization: Bearer $TOKEN" | jq .data

# 2. 查看已装载的技能与工具
curl -s http://localhost:3001/api/skills | jq '.data.skills[] | {slug, version, enabled, tools: (.tools|length)}'

# 3. 让技能注册表按自然语言匹配技能（Agent 装载技能的入口）
curl -s -X POST http://localhost:3001/api/skills/match \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"检查服务器磁盘使用情况"}' | jq .data

# 4. 用 Hook 端点投递一条告警（外部系统入口）
curl -s -X POST http://localhost:3001/api/hooks/alert/prometheus \
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"alerts":[{"labels":{"alertname":"CPUHigh","instance":"10.0.0.1","severity":"critical"},"status":"firing"}]}' | jq .data
```

---

## 分层总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 接入层 Gateway                                                            │
│  React SPA(React18+Vite) │ REST /api/* │ WebSocket 任务进度 │ /api/hooks/* │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │                                  │
┌───────────────▼───────────────┐   ┌──────────────▼───────────────────────┐
│ Agent Runtime                 │   │ Hooks（事件入站标准化）                │
│  ├ AgentProvider 契约 + 注册表 │   │  ├ 声明式来源映射表 hookMappings       │
│  │   ├ local（内建 LLM）       │   │  ├ 适配器：prometheus/zabbix/grafana  │
│  │   └ agent-service（外部）   │   │  │         aliyun/tencent/generic     │
│  ├ 降级链 + 健康熔断           │   │  └ 分发：alert → alertIngest 流水线    │
│  └ 工作流执行器（agent 节点）  │       │      agent → Agent Runtime        │
│         │ 按意图装载技能       │       │      wake  → 通知 + 审计           │
└─────────┼─────────────────────┘   └──────────────┬───────────────────────┘
          │                                        │
┌─────────▼────────────────────────────────────────▼───────────────────────┐
│ Skills（技能插件，目录即插件）                                             │
│  skillRegistry：装载 / 启停 / reload / match / listTools                  │
│  契约：SKILL.md(front-matter) + skill.json(tools) + _meta.json            │
└──────────────────────────────────┬───────────────────────────────────────┘
                                   │ 工具契约（endpoint / kind / 治理标记）
┌──────────────────────────────────▼───────────────────────────────────────┐
│ 基础支撑                                                                  │
│ 认证与 RBAC │ 审计日志 │ SSH/命令执行 │ Docker 引擎 │ 数据库连接(dbskiter)  │
│ 告警与修复策略 │ 通知 │ 定时任务 │ settings 配置 │ SQLite(WAL)             │
└──────────────────────────────────────────────────────────────────────────┘
```

**核心原则**

| 原则 | 落地方式 |
|------|----------|
| 契约优先 | `AgentProvider` / `SkillManifest` / `HookSourceMapping` 三类接口，实现方可替换、可插拔 |
| 声明式优于 if/else | 技能能力写在 `skill.json`；告警来源差异写在映射表 + 适配器，调用方零分支 |
| 目录即插件 | 技能目录增删 = 安装/卸载，`reload` 即生效；zip 包安装走同一校验路径 |
| 可观测与可治理 | 审计日志记录技能启停/安装/降级链变更；Provider 熔断状态与尝试链对外暴露 |
| 最小信任 | 凭据加密存储、写操作二次确认与保护名单、Hook 入站令牌、管理端点 RBAC |

---

## 三条典型链路

**① 异构告警入站（Hooks）**

```
Prometheus/Zabbix/… → POST /api/hooks/alert/:source
   → authorizeHook（X-Hook-Token → HOOKS_TOKEN / WEBHOOK_SECRET / 管理员 JWT）
   → hookMappings 取适配器 → 标准告警 {title,severity,host,status,…}
   → alertIngest.processNormalizedAlert（与 /api/webhooks/* 共用流水线）
   → 落库 → 降噪/关联 → RCA → 修复策略 → 通知
```

**② Agent 对话（Agent Runtime）**

```
POST /api/agents/providers/chat（或 /api/hooks/agent、工作流 agent 节点）
   → skillRegistry.match(message)              技能意图匹配
   → orderProviders()                          降级链（settings 可覆盖）
   → 跳过熔断中的 Provider，依次尝试并记录 attempts
   → Provider.chat()                           本地内建 LLM / 外部 agent-service
   → 结果携带 skills / attempts / degraded 返回
```

**③ 工作流 Agent 节点装载技能**

```
workflowExecutor（type=agent 节点）
   → executeAgentNodeWithSkills(agentId, input, context)
        ├ skillRegistry.match(input, 3)
        ├ LLM 类 Agent：把技能与工具契约注入提示词
        └ 返回 { output, skills }
   → node_results[nodeId].metadata.skills   持久化（任务详情可回溯）
   → WebSocket task:node:skills + 任务日志「装载技能：…」
```

---

## 代码结构与职责

```
backend/src/services/
├── agent/
│   ├── contracts.ts            # AgentProvider / AgentChatRequest / 熔断与尝试契约
│   ├── agentRegistry.ts        # 注册表：插拔 / 降级链 / 熔断 / 统一 chat 入口
│   ├── bootstrap.ts            # 启动时注册内置 Provider + 装载技能目录
│   ├── agentExecutor.ts        # 工作流 agent 节点执行 + 技能装载
│   └── providers/              # localAgentProvider / remoteAgentProvider
├── skills/
│   ├── types.ts                # SkillManifest / SkillToolContract / SkillMatch
│   ├── skillLoader.ts          # SKILL.md(front-matter) + skill.json 解析与校验
│   ├── skillRegistry.ts        # 装载 / 启停 / reload / match / listTools / 目录监听
│   └── skillInstaller.ts       # zip 安装（防穿越、原子替换）与卸载
└── hooks/
    ├── hookMappings.ts         # 声明式来源映射表（新增来源只改这里）
    ├── hookService.ts          # 归一化 → 分发（alert / agent / wake）
    ├── alertIngest.ts          # 标准告警落库与处置流水线（新旧入口共用）
    └── types.ts                # HookEvent / HookIngestResult
skills/                         # 技能包目录（SKILLS_DIR，容器内 /app/skills）
```

对应路由：[skillsRoutes.ts](../../backend/src/routes/skillsRoutes.ts)、[agentRoutes.ts](../../backend/src/routes/agentRoutes.ts)、[hooksRoutes.ts](../../backend/src/routes/hooksRoutes.ts)。
前端入口：「能力中心」（`/platform`，见 [PlatformPage.tsx](../../frontend/src/pages/PlatformPage.tsx)）承载三个治理面板——
技能插件（`#skills`）、Agent Provider 治理（`#providers`）、Hooks 接入（`#hooks`）。

---

## 外部 Agent 服务（itops-agent-service）

`agent-service` Provider 的执行后端：独立 Python 服务（FastAPI + PydanticAI，容器 `itops-agent-service`，仅栈内网络可达），生产栈中经 `AGENT_SERVICE_URL=http://agent-service:8000` 直连。

| 机制 | 说明 |
|------|------|
| Agent 注册表优先 | `/api/chat` 先查动态注册表（backend 启动时把 `agents` 表按 id 注册进去，含平台提示词），未命中再落到内置类型（general/alert/diagnosis/inspection） |
| LLM 配置同步 | 唯一事实源是平台模型池（`ai_models` 表）；backend 启动把默认模型（provider/model/key/base）`POST /api/llm/config` 同步过去，外部服务落盘 `data/llm_config.json`（0600）抗重启 |
| 惰性模型解析 | Agent 实例构造只存配置，每次执行现场解析模型实例（OpenAI 兼容协议，显式传 base_url/api_key，不读进程环境变量）；配置变更即时生效 |
| 会话上下文 | Provider 契约的 `sessionKey` 透传到外部服务，按会话维护滚动历史注入提示词（内存态，LRU 有界） |
| 错误语义 | LLM 未配置 → `503` + 可行动信息（区别于 500 故障），降级链可识别 |
| 知识库 | 内置 YAML/JSON/MD 知识库（`knowledge/`），经 `search_knowledge` 工具与 `/api/knowledge/search` 代理暴露 |

## 配置

| 配置项 | 位置 | 说明 |
|--------|------|------|
| `SKILLS_DIR` / `SKILLS_WATCH` | 环境变量 | 技能目录与开发期热监听开关 |
| `HOOKS_TOKEN` | 环境变量 | Hook 入站令牌（未配置回退 `WEBHOOK_SECRET`） |
| `AGENT_BREAKER_THRESHOLD` / `AGENT_BREAKER_COOLDOWN_MS` | 环境变量 | 熔断阈值与冷却时间的默认值 |
| `agent_fallback_chain` | settings 表（API） | 降级顺序，`POST /api/agents/providers/chain` |
| `agent_breaker_config` | settings 表 | 熔断参数运行时覆盖 |
| `skills_disabled` | settings 表（API） | 技能停用集合，`POST /api/skills/:slug/toggle` |

完整清单见 [configuration.md](./configuration.md) 与 [environment-variables.md](./environment-variables.md)。

---

## 扩展点

| 想做的事 | 落点 |
|----------|------|
| 接入新 Agent 实现（自研/第三方） | 实现 `AgentProvider`（id/name/kind/capabilities/health/chat）后在启动序列 `agentRegistry.register()` |
| 调整优先顺序 / 降级顺序 | `POST /api/agents/providers/chain`（管理员） |
| 新增能力域（如 K8s、中间件） | 新增技能目录 `skills/<slug>/`，见 [skills.md](./skills.md) |
| 接入新的监控/告警来源 | 在 `hookMappings.ts` 增加一条映射 + 适配器，见 [hooks.md](./hooks.md) |
| 新工作流节点类型 | `workflowExecutor` 增加 `node.type` 分支，重活交给服务层的契约实现 |

---

## 排障

| 现象 | 排查 |
|------|------|
| `/api/skills` 返回空 | `SKILLS_DIR` 是否指向正确目录（容器内 `/app/skills`）；查看响应中的 `errors` 字段（缺 SKILL.md、slug 非法） |
| 技能存在但 Agent 不装载 | 技能 `enabled=false`（`?all=1` 查看），或输入未命中触发词/标签 → 用 `POST /api/skills/match` 验证打分 |
| `/api/hooks/*` 返回 401 | 未配置 `HOOKS_TOKEN` 且未带管理员 JWT；响应 `error` 字段给出原因，审计表记录 `hook_auth_failed` |
| Agent 调用总是走后备 Provider | `GET /api/agents/providers` 看首选 `circuit.state`；`open` 表示已熔断，等待 `retryAt` 后自动 half-open 探测 |
| 工作流节点看不到技能 | 节点类型必须是 `agent`；技能日志以任务日志 `type=thinking` 与 `node_results.metadata.skills` 呈现 |