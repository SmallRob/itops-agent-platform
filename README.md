<p align="center">
  <img src="./frontend/public/itops-agent.svg" width="120" alt="ITOps Agent Platform Logo" />
</p>

<h1 align="center">ITOps Agent Platform</h1>

<p align="center">
  <strong>企业级全栈 IT 运维自动化平台</strong>
</p>

<p align="center">
  通过可视化工作流编排多个 AI Agent 协同工作，实现服务器巡检、告警处理、故障诊断等任务的自动化。<br/>
  内建 LLM 直连与外部 Python Agent 服务双通道（Provider 契约 + 降级链），技能插件即插即用，异构告警统一入站。
</p>

<p align="center">
  <a href="https://github.com/SmallRob/itops-agent-platform/actions/workflows/ci.yml"><img src="https://github.com/SmallRob/itops-agent-platform/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/SmallRob/itops-agent-platform/releases/latest"><img src="https://img.shields.io/github/v/release/SmallRob/itops-agent-platform?include_prereleases&sort=semver" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/python-3.12-blue.svg" alt="Python">
  <img src="https://img.shields.io/badge/version-3.1.1-orange.svg" alt="Version">
</p>

<p align="center">
  <a href="https://www.zjzwfw.cloud/ITOpsAgentinfo">项目官网</a> &middot;
  <a href="https://aiopsdoc-0mwug01t6.maozi.io/">文档网站</a> &middot;
  <a href="https://agentdemo-0mwug01t6.maozi.io/">演示环境</a> &middot;
  <a href="README.en.md">English</a>
</p>

---

## 目录

- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [外部 Agent 服务](#外部-agent-服务itops-agent-service)
- [项目结构](#项目结构)
- [API 端点概览](#api-端点概览)
- [开发指南](#开发指南)
- [部署指南](#部署指南)
- [安全特性](#安全特性)
- [文档导航](#文档导航)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [联系方式](#联系方式)

---

## 功能特性

### :robot: 智能 Agent 系统

- **12 个预设运维 Agent（全部真实可调用）** -- 告警处理、故障诊断、日志分析、系统巡检、变更执行、文档生成、合规检查、服务器命令执行、命令生成专家、自动巡检、网络巡检专家、数据库运维；主模型统一接入平台模型池，逐个通过真实调用验证
- **Agent 管理主从工作台** -- 左侧列表 + 右侧详情（概览 / 测试 / 执行历史页签），支持选择目标服务器/数据库做真实执行测试，一键「批量验证」全部启用的 Agent
- **Copilot AI 助手** -- 自然语言对话式运维助手，自动感知系统状态，基于规则 + LLM 深度分析
- **可视化工作流编排** -- 拖拽式编辑器，43+ 节点类型，支持串行/并行/条件分支/HITL 审批节点
- **自动修复闭环** -- 告警触发 AI 分析 → 生成修复命令 → 审批确认 → 自动执行 → 结果验证

### :jigsaw: 平台扩展能力（Agent / Skills / Hooks）

- **Agent Provider 契约与降级链** -- Agent 执行抽象为可注册/注销的 Provider：`local`（平台内建 LLM 直连）与 `agent-service`（外部 Python 服务）双通道；按降级链依次尝试，带健康熔断（阈值 → 熔断 → 冷却探测恢复），每次调用的尝试链可回溯
- **外部 Agent 服务（itops-agent-service）** -- FastAPI + PydanticAI 独立服务，随生产栈容器化部署：动态注册表优先（平台 Agent 含提示词真实生效）、LLM 配置运行时同步并落盘抗重启、`sessionKey` 会话上下文、内置运维知识库与系统工具集，详见 [外部 Agent 服务](#外部-agent-服务itops-agent-service)
- **技能插件（Skills）** -- 技能 = 目录 + `SKILL.md` + `skill.json`，声明式描述能力与工具契约；目录增删即插即用，支持 zip 包安装/卸载、运行时启停、按意图自动匹配装载（内置 4 个技能包 / 18 个工具）
- **Hooks 事件接入** -- `/api/hooks/*` 统一机器入口：异构告警（Prometheus/Zabbix/Grafana/阿里云/腾讯云/通用自动识别）标准化后进入既有处置流水线，另提供 Agent 隔离回合与事件唤醒
- **能力中心（可视化）** -- 左侧导航「AI 运维 → 能力中心」（`/platform`）：技能管理、Provider 治理与降级链编排、Hooks 接入指引

### :brain: AI 增强能力

- **AI 模型池（唯一 LLM 配置源）** -- 多 Provider 管理（OpenAI / 豆包 / DeepSeek / 通义千问 / 智谱 / 本地 Ollama/vLLM），连通性测试、主备降级链；配置存数据库，backend 启动自动同步给外部 Agent 服务
- **Token 预算控制** -- 按日/月/用户维度的 Token 用量限制与熔断机制
- **增强 RAG 检索** -- 22 条预设知识条目，关键词 + 语义相关度排序，自动注入 LLM 上下文
- **根因分析 (RCA)** -- AI 驱动的告警根因分析，展示完整推理链

### :lock: 安全与合规

- **命令安全策略** -- 5 级分类、读写分离、路径沙箱，防止危险命令执行；Agent 对服务器的操作全部留痕（`server_command_history`）
- **JWT 双令牌认证** -- Access Token + Refresh Token 机制，自动刷新，黑名单登出
- **凭证加密存储** -- AES-256-GCM 加密存储服务器密码和 SSH 密钥
- **操作审计日志** -- 所有登录、命令执行、配置变更均有详细审计记录

### :chart_with_upwards_trend: 监控与可观测性

- **Prometheus 指标暴露** -- 9 个自定义指标，兼容 Grafana 可视化
- **健康检查** -- 后端 `/health`、外部 Agent 服务容器 healthcheck，Docker 自动探测
- **WebSocket 实时通信** -- 终端、工作流、审批状态的实时推送

### :wrench: 运维功能

- **服务器管理** -- SSH 终端（xterm.js）、VNC 远程桌面、批量导入、分组管理
- **告警管理** -- Webhook 接收 Prometheus/Zabbix/通用告警，智能降噪/关联/自动分析
- **网络设备管理** -- SNMP 巡检、LLDP 拓扑发现、华为/华三/思科/锐捷等厂商适配
- **配置备份与恢复** -- 自动/手动备份，gzip 压缩，完整性校验，恢复后优雅重启
- **知识库管理** -- 文档管理、规则引擎、增强 RAG 检索、批量导入导出
- **定时任务** -- Cron 表达式配置，自动执行指定工作流
- **大屏仪表盘** -- 全屏可视化运维大屏，适合 NOC 监控中心

### :bar_chart: 代码规模

| 维度 | 数量 |
|:---|:---|
| 后端路由模块 | 47 |
| 服务模块 | 55+ |
| 前端页面 | 45+ |
| 工作流节点 | 43+ |
| 数据库迁移 | 17+ |
| 测试用例 | 5500+（后端）+ 101（Agent 服务） |
| API 端点 | 336+ |

---

## 系统架构

```
浏览器 ──HTTPS──▶ 宿主 Nginx（可反代，非必选）
                     │  /            → itops-frontend:80     （React 静态产物）
                     │  /api         → itops-backend:3001    （Express API）
                     │  /socket.io   → itops-backend:3001    （WebSocket）
                     ▼
        ┌──────────────────────────────────────────────┐
        │        Docker Compose 生产栈（itops-network）  │
        │                                              │
        │  ┌──────────────────┐   ┌─────────────────┐  │
        │  │ itops-frontend   │   │ itops-backend   │  │
        │  │ React 18 :80     │   │ Express :3001   │  │
        │  └──────────────────┘   │ 47 路由 | 审计   │  │
        │                         └───┬──────┬──────┘  │
        │            AGENT_SERVICE_URL│      │         │
        │            (栈内直连)        │      │         │
        │                 ┌───────────▼──┐   │         │
        │                 │ itops-agent- │   │         │
        │                 │ service :8000│   │         │
        │                 │ FastAPI +    │   │         │
        │                 │ PydanticAI   │   │         │
        │                 └───────┬──────┘   │         │
        │      仅栈内可达，         │          │         │
        │      不发布宿主端口       │          │         │
        └─────────────────────────┼──────────┼─────────┘
                                  │          │
                    LLM 配置同步   │          │ SSH（AES-256-GCM 凭据）
                    ▲ 模型池落库   │          ▼
        ┌───────────────────┐  ┌────────────────────┐
        │ 平台模型池         │  │ 受管服务器 / 网络设备 │
        │ SQLite ai_models  │  │ 巡检/命令/合规检查    │
        │ DeepSeek(默认) 等  │  └────────────────────┘
        └───────┬───────────┘
                │ OpenAI 兼容协议
                ▼
        DeepSeek / 豆包 / OpenAI / 千问 / 本地模型
```

**Agent 执行双通道（Provider 契约）**

```
/api/agents/providers/chat
        │
        ▼
agentRegistry（降级链：local → agent-service，带健康熔断）
        │
        ├─▶ local          平台内建 LLM：executeAgentWithLLM（模型池直连）
        │                   服务器/巡检/数据库类 Agent 由平台真实执行采集
        │                   （SSH 命令、合规检查、dbskiter），LLM 分析真实数据
        │
        └─▶ agent-service  外部 Python 服务：/api/chat（PydanticAI + 工具循环）
                            动态注册表优先（平台 Agent 提示词生效）
                            会话上下文（sessionKey）+ 知识库工具
```

> 完整架构文档：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | [平台能力文档](./docs/platform/README.md) | [本服务器投产 runbook](./docs/platform/deployment.md)

---

## 快速开始

### 前置条件

- **Docker** >= 20.10 与 **Docker Compose** >= 2.0
- （本地开发）**Node.js** >= 18、**Python** 3.12（Agent 服务）

### 方式一：一键脚本部署（推荐）

```bash
git clone https://github.com/SmallRob/itops-agent-platform.git
cd itops-agent-platform

# Linux / macOS
chmod +x deploy.sh && ./deploy.sh

# Windows PowerShell
.\deploy.ps1
```

脚本会自动拉取镜像、生成配置、启动服务并验证健康状态。

### 方式二：Docker Compose 部署

```bash
git clone https://github.com/SmallRob/itops-agent-platform.git
cd itops-agent-platform

# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 JWT_SECRET

# 2. 构建并启动（backend / frontend / agent-service 三容器）
docker-compose up -d --build

# 3. 访问
# 前端:            http://localhost:19300
# 后端:            http://localhost:19301
# 健康检查:        http://localhost:19301/health
# Agent 服务:      仅栈内可达（AGENT_SERVICE_URL=http://agent-service:8000），不发布宿主端口
```

### 方式三：使用预构建镜像

```bash
cp .env.example .env

# 拉取阿里云镜像
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest

docker-compose up -d
```

### 默认登录

| 字段 | 值 |
|:---|:---|
| 用户名 | `admin` |
| 密码 | `admin` |

> 首次登录后系统会强制要求修改默认密码。

### 部署后验证

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep itops-
# itops-backend / itops-frontend / itops-agent-service 三者应为 (healthy)

curl -s localhost:19301/health
# 登录后检查外部 Agent 通道：
#   GET /api/agents/providers  →  agent-service healthy:true
```

---

## 外部 Agent 服务（itops-agent-service）

`itops-agent-service/` 是从平台抽离的独立 Python Agent 服务（Python 3.12 + FastAPI + PydanticAI），作为 `agent-service` Provider 的执行后端：

| 机制 | 说明 |
|------|------|
| **动态注册表优先** | 平台启动时把 `agents` 表按 id 注册（含系统提示词），`/api/chat` 先查注册表，未命中再落内置类型（general/alert/diagnosis/inspection） |
| **LLM 配置同步** | 平台模型池（`ai_models` 表）是唯一事实源；backend 启动把默认模型（provider/model/api_key/api_base）`POST /api/llm/config` 同步过去，外部服务原子落盘 `data/llm_config.json`（0600），容器重启自动恢复 |
| **惰性模型解析** | Agent 实例构造只存配置，每次执行现场解析模型实例（OpenAI 兼容协议，显式传 base_url/api_key）；模型配置变更即时生效 |
| **会话上下文** | Provider 契约的 `sessionKey` 透传，按会话维护滚动历史注入提示词（内存 LRU，有界） |
| **知识库与工具** | 内置 YAML/JSON/MD 运维知识库 + 系统信息/进程/网络/日志/服务/磁盘等只读工具集 |
| **错误语义** | LLM 未配置返回结构化 `503`（与故障 500 区分），降级链可识别 |

```bash
# 本地运行与测试
cd itops-agent-service
uv venv .venv --python 3.12
uv pip install -e '.[dev]' -i https://mirrors.aliyun.com/pypi/simple/
.venv/bin/pytest -q          # 101 个测试

# 单独启动（生产由 docker-compose 管理）
.venv/bin/uvicorn src.api:app --host 0.0.0.0 --port 8000
```

---

## 项目结构

```
itops-agent-platform/
├── backend/                        # Express.js 后端
│   └── src/
│       ├── app.ts                  # 应用入口（启动时同步模型配置/Agent 注册到外部服务）
│       ├── models/                 # 数据库模型与迁移 (17+ 版本)
│       ├── routes/                 # API 路由 (47 个模块)
│       ├── services/               # 业务逻辑 (55+ 个服务)
│       │   ├── agent/              # AgentProvider 契约 / 注册表 / 降级链 / 执行器
│       │   ├── ai/                 # 模型池服务 / LLM 调用（Transport 架构）
│       │   └── server/             # SSH 执行 / 合规检查
│       ├── middleware/             # 中间件 (认证/限流/校验/审计/命令过滤)
│       ├── websocket/              # WebSocket 实时通信
│       └── constants/              # Agent 名称等常量
├── frontend/                       # React 前端
│   └── src/
│       ├── pages/                  # 页面组件 (45+ 个)
│       │   ├── Agents.tsx          # Agent 管理主从工作台
│       │   └── agents/             # 测试面板 / 编辑弹窗 / 执行历史 / 共享类型
│       ├── components/             # 通用组件 (20+ 个)
│       ├── contexts/               # React Context
│       └── lib/                    # 工具库 (API/XSS 防护/日期)
├── itops-agent-service/            # Python Agent 服务（生产栈容器 itops-agent-service）
│   ├── src/
│   │   ├── agents/                 # Agent 定义（惰性构建 + 运行时模型解析）
│   │   ├── api/                    # FastAPI 端点（chat/注册表/LLM 配置/知识检索）
│   │   ├── tools/                  # 只读运维工具集
│   │   ├── knowledge/              # 内置知识库
│   │   └── sessions.py             # 会话滚动历史
│   ├── knowledge/                  # 知识库文件
│   └── tests/                      # 101 个测试（pytest）
├── docker/                         # Docker 生产配置
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── Dockerfile.agent-service    # python:3.12-slim + 非 root + healthcheck
│   └── nginx.conf
├── local-dev/                      # 本地开发环境 (热重载)
├── docs/
│   ├── platform/                   # 能力文档（架构/部署 runbook/环境变量/技能/Hooks）
│   ├── requirements/ architecture/ features/   # 需求/架构/PRD 产物（dev-loop）
│   └── CHANGELOG.md
├── skills/                         # 技能插件目录（挂载即插拔）
├── md-docs/                        # 详细开发教程 (28 章)
├── docker-compose.yml              # 生产级 Docker Compose（三容器）
├── docker-compose.simple.yml       # 简化版 Docker Compose
├── deploy.sh / deploy.ps1          # 一键部署脚本
├── SECURITY.md                     # 安全策略
└── .env.example                    # 环境变量模板
```

---

## API 端点概览

平台共暴露 **336+** 个 RESTful API 端点，以下为核心模块分组：

| 模块 | 路径前缀 | 说明 |
|:---|:---|:---|
| **认证** | `POST /api/auth/*` | 登录、注册、Token 刷新、密码修改 |
| **用户管理** | `/api/users` | 用户 CRUD、角色管理 (admin/operator/viewer) |
| **服务器管理** | `/api/servers` | 服务器 CRUD、SSH 连接测试、主机信息采集 |
| **命令执行** | `/api/server-commands` | 远程命令执行（安全策略过滤）、连接测试、合规检查 |
| **Web 终端** | `/api/terminal/*` | WebSocket SSH 终端会话管理 |
| **Agent 系统** | `/api/agents` | Agent CRUD、执行测试、历史记录、**Provider 契约与降级链** |
| **Agent 服务代理** | `/api/agent-service/*` | 对外部 Python 服务的受鉴权代理（chat/注册表/LLM 配置/知识检索） |
| **技能插件** | `/api/skills` | 技能清单/详情、启停、重载、意图匹配、**zip 安装与卸载** |
| **事件接入** | `/api/hooks/*` | 异构告警标准化入站、Agent 隔离回合、事件唤醒 |
| **工作流** | `/api/workflows` | 工作流 CRUD、执行、拓扑排序、模板 |
| **任务执行** | `/api/tasks` | 任务状态查询、进度追踪、暂停/取消 |
| **告警中心** | `/api/alerts` | 告警 CRUD、Webhook 接收、降噪、关联 |
| **知识库** | `/api/knowledge` | 知识条目 CRUD、RAG 检索、批量导入导出 |
| **网络设备** | `/api/network-devices` | 设备 CRUD、SNMP 巡检、厂商适配 |
| **拓扑发现** | `/api/topology` | LLDP 发现、拓扑图数据 |
| **AI 模型池** | `/api/ai-models` | 模型 CRUD、主备降级链、连通性测试 |
| **定时任务** | `/api/scheduled-tasks` | Cron 任务管理、执行历史 |
| **审批中心** | `/api/approvals` | HITL 审批请求、通过/拒绝操作 |
| **自动修复** | `/api/remediation` | 修复策略、执行记录、工作流生成 |
| **备份恢复** | `/api/backup` | 数据库备份、恢复、历史管理 |
| **通知** | `/api/notifications` | 通知配置、发送记录 |
| **审计日志** | `/api/audit-logs` | 操作审计查询、导出 |
| **健康检查** | `GET /health` | 服务健康状态 |
| **监控指标** | `GET /metrics` | Prometheus 格式指标 |

> 完整 API 文档：[docs/API.md](./docs/API.md)

---

## 开发指南

### 本地开发环境（Docker 热重载，推荐）

```bash
cd local-dev

# Linux / macOS
./start-dev.sh

# Windows
.\start-dev.bat
```

- 前端热重载：`http://localhost:5173`
- 后端热重载：`http://localhost:3001`
- Node.js 调试端口：`localhost:9229`

### 传统本地开发

```bash
# 安装所有依赖
npm run install:all

# 同时启动前后端开发服务器
npm run dev
```

### Agent 服务本地开发（Python 3.12）

```bash
cd itops-agent-service
uv venv .venv --python 3.12
uv pip install -e '.[dev]' -i https://mirrors.aliyun.com/pypi/simple/
.venv/bin/pytest -q     # 101 个测试
.venv/bin/ruff check src tests
```

### 常用命令

```bash
# 构建生产版本
npm run build

# Docker 操作
npm run docker:build      # 构建镜像
npm run docker:up          # 启动容器
npm run docker:down        # 停止容器
npm run docker:logs        # 查看日志
npm run docker:rebuild     # 重新构建并启动
```

### 添加新功能的流程

1. **后端**：在 `backend/src/routes/` 添加路由 -> `services/` 实现业务逻辑 -> 如需数据库变更，在 `models/migrations/` 添加迁移
2. **前端**：在 `frontend/src/pages/` 添加页面 -> `App.tsx` 注册路由
3. **Agent**：在 `itops-agent-service/src/` 扩展 Agent 或工具；改后跑 `pytest`
4. **平台 Agent**：能力中心 / Agent 管理页直接创建，或向 `agents` 表添加（注意：名称含「服务器/巡检/数据库运维」的 Agent 会被路由到真实执行器）

> 详细开发文档：[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | [md-docs/](./md-docs/) (28 章教程)

---

## 部署指南

### Docker Compose 生产部署

```bash
git clone https://github.com/SmallRob/itops-agent-platform.git
cd itops-agent-platform

cp .env.example .env
openssl rand -hex 32   # 生成 JWT_SECRET
# 编辑 .env 设置 JWT_SECRET 等

docker-compose up -d --build
curl http://localhost:19301/health
```

生产栈包含三个容器：`itops-backend`（宿主 19301）、`itops-frontend`（宿主 19300）、`itops-agent-service`（仅栈内网络，不发布宿主端口）。域名反代、数据迁移、回滚等完整投产流程见 **[docs/platform/deployment.md](./docs/platform/deployment.md)**（本服务器实测 runbook，含国内构建镜像源、buildx、PyPI 镜像等前置条件）。

### 资源要求

| 组件 | CPU | 内存 |
|:---|:---|:---|
| 后端 | 0.5 ~ 2 核 | 512MB ~ 2GB |
| 前端 | 0.25 ~ 1 核 | 128MB ~ 512MB |
| Agent 服务 | 0.25 ~ 1 核 | 128MB ~ 512MB |

### 环境变量

| 变量 | 说明 | 默认值 |
|:---|:---|:---|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 后端端口 | `3001` |
| `DATABASE_PATH` | SQLite 数据库路径 | `./data/app.db` |
| `JWT_SECRET` | JWT 签名密钥 | 开发环境自动生成 |
| `JWT_EXPIRES_IN` | Access Token 有效期 | `24h` |
| `HOOKS_TOKEN` | Hooks 入站令牌（`/api/hooks/*`） | 空（回退 `WEBHOOK_SECRET`） |
| `AGENT_SERVICE_URL` | 外部 Agent 服务地址 | 生产栈 `http://agent-service:8000` |
| `AGENT_SERVICE_TIMEOUT` | 外部 Agent 服务调用超时（推理模型建议放宽） | `120000` |
| `DEEPSEEK_API_KEY` 等 | LLM 兜底密钥（平台模型池为唯一事实源） | - |
| `WEBHOOK_VERIFY_ENABLED` | 启用 Webhook 签名验证 | `false` |
| `LOG_LEVEL` | 日志级别 | `info` |

> 完整环境变量参考：[.env.example](./.env.example) | [docs/platform/environment-variables.md](./docs/platform/environment-variables.md)

### CI/CD 流水线

| 流水线 | 触发条件 | 功能 |
|:---|:---|:---|
| [CI](.github/workflows/ci.yml) | Push/PR 到 main | Lint + 检查 + 测试 + Docker 构建验证 |
| [Release](.github/workflows/release.yml) | 推送 `v*` tag 或手动 | 构建镜像 -> 推送镜像仓库 -> 创建 GitHub Release |
| [Mirror](.github/workflows/mirror.yml) | Push 到 main | 同步代码到 Gitee/Gitcode |

---

## 安全特性

| 安全措施 | 说明 |
|:---|:---|
| **AES-256-GCM 加密** | 服务器密码和 SSH 密钥加密存储，密钥自动生成 |
| **JWT 双令牌认证** | Access Token + Refresh Token，自动刷新，黑名单登出 |
| **CSRF 防护** | 状态变更请求需携带会话绑定的 CSRF Token |
| **登录失败锁定** | 连续 5 次失败自动锁定 30 分钟 |
| **密码复杂度校验** | 要求大小写字母 + 数字 + 特殊字符（8 位以上） |
| **命令安全策略** | 5 级分类、读写分离、路径沙箱；Agent 执行的命令全部留痕 |
| **API 速率限制** | 防止恶意请求和暴力破解 |
| **Webhook 签名验证** | HMAC-SHA256 签名 + IP 白名单 |
| **审计日志** | 所有登录、命令执行、配置变更可追溯 |
| **非 root 运行** | Docker 容器（含 agent-service）以非 root 用户运行 |
| **最小暴露面** | agent-service 仅栈内网络可达，外部访问一律经受 JWT 鉴权的代理路由 |
| **API Key 脱敏** | 模型密钥落盘 0600、GET 响应与日志脱敏 |
| **本地 AI 支持** | 支持 Ollama / vLLM，数据 100% 不出域 |

> 零信任安全模型：所有服务器凭证只在本地加密存储，不会发送给任何第三方 AI。详细安全策略：[SECURITY.md](./SECURITY.md)

---

## 文档导航

| 文档 | 说明 |
|:---|:---|
| [平台能力文档](./docs/platform/README.md) | Agent/Skills/Hooks 能力总览 |
| [平台架构](./docs/platform/architecture.md) | Provider 契约 / 技能 / Hooks 分层设计 |
| [投产 Runbook](./docs/platform/deployment.md) | 本服务器实测部署流程与验证清单 |
| [环境变量清单](./docs/platform/environment-variables.md) | 全量环境变量说明 |
| [架构设计](./docs/ARCHITECTURE.md) | 系统架构详解 |
| [API 文档](./docs/API.md) | 完整 API 接口文档 |
| [部署手册](./docs/DEPLOYMENT.md) | 详细部署操作说明 |
| [开发指南](./docs/DEVELOPMENT.md) | 本地开发环境搭建 |
| [工作流指南](./docs/WORKFLOW_GUIDE.md) | 工作流编排使用指南 |
| [自动修复设计](./docs/AUTO_REMEDIATION_DESIGN.md) | 告警自动修复功能设计 |
| [变更日志](./docs/CHANGELOG.md) | 版本更新记录（最新 3.1.1） |
| [28 章教程](./md-docs/) | 从入门到精通的完整开发教程 |

---

## 贡献指南

我们欢迎任何形式的贡献！

1. **Fork** 本仓库
2. 创建你的特性分支：`git checkout -b feature/amazing-feature`
3. 提交你的更改：`git commit -m 'feat: add amazing feature'`
4. 推送到分支：`git push origin feature/amazing-feature`
5. 提交 **Pull Request**

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 新功能
fix: 修复 Bug
docs: 文档更新
style: 代码格式（不影响功能）
refactor: 重构
test: 测试相关
chore: 构建/工具变更
```

> 完整贡献指南请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 许可证

本项目采用 [Mozilla Public License 2.0 (MPL-2.0)](./LICENSE) 开源。

- 2026 年 5 月 27 日之前提交的代码仍遵循 MIT 许可证
- 不允许闭源二次开发、打包销售、SaaS 化运营等商业用途
- 承诺永久开源

---

## 联系方式

**谭策** -- 独立开发者 | AIOps 领域探索者

| 渠道 | 链接 |
|:---|:---|
| 项目官网 | [zjzwfw.cloud/ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo) |
| 博客 | [zjzwfw.cloud](https://www.zjzwfw.cloud/) |
| 邮箱 | huawei_network@foxmail.com |
| 微信公众号 | **IT Online** |

<p>
  <img src="./frontend/public/wechaterweima.png" width="180" alt="IT Online 微信公众号" />
</p>

---

<p align="center">
  如果这个项目对你有帮助，请给一个 :star: Star 支持一下！
</p>
