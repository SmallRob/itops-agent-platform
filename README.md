<p align="center">
  <img src="./frontend/public/itops-agent.svg" width="120" alt="ITOps Agent Platform Logo" />
</p>

<h1 align="center">ITOps Agent Platform</h1>

<p align="center">
  <strong>企业级全栈 IT 运维自动化平台</strong>
</p>

<p align="center">
  通过可视化工作流编排多个 AI Agent 协同工作，实现服务器巡检、告警处理、故障诊断等任务的自动化
</p>

<p align="center">
  <a href="https://github.com/qinshihu/itops-agent-platform/actions/workflows/ci.yml"><img src="https://github.com/qinshihu/itops-agent-platform/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/qinshihu/itops-agent-platform/actions/workflows/release.yml"><img src="https://github.com/qinshihu/itops-agent-platform/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="https://github.com/qinshihu/itops-agent-platform/releases/latest"><img src="https://img.shields.io/github/v/release/qinshihu/itops-agent-platform?include_prereleases&sort=semver" alt="GitHub release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/python-%3E%3D3.11-blue.svg" alt="Python">
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
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [API 端点概览](#api-端点概览)
- [开发指南](#开发指南)
- [部署指南](#部署指南)
- [安全特性](#安全特性)
- [贡献指南](#贡献指南)
- [许可证](#许可证)
- [联系方式](#联系方式)

---

## 功能特性

### :robot: 智能 Agent 系统

- **多 Agent 协作执行** -- 9 个预设运维 Agent，支持自定义创建，覆盖告警、诊断、巡检、变更等场景
- **Copilot AI 助手** -- 自然语言对话式运维助手，自动感知系统状态，基于规则 + LLM 深度分析
- **可视化工作流编排** -- 拖拽式编辑器，43+ 节点类型，支持串行/并行/条件分支/HITL 审批节点
- **自动修复闭环** -- 告警触发 AI 分析 -> 生成修复命令 -> 审批确认 -> 自动执行 -> 结果验证

### :brain: AI 增强能力

- **多 Provider 路由器** -- 支持 OpenAI / Anthropic / 智谱 GLM / Gemini / 豆包 / DeepSeek / 通义千问 / 本地模型（Ollama/vLLM）
- **Token 预算控制** -- 按日/月/用户维度的 Token 用量限制与熔断机制
- **增强 RAG 检索** -- 22 条预设知识条目，关键词 + 语义相关度排序，自动注入 LLM 上下文
- **根因分析 (RCA)** -- AI 驱动的告警根因分析，展示完整推理链
- **主备模型降级** -- 主备模型降级链，每个 Provider 独立熔断器，拖拽排序优先级

### :lock: 安全与合规

- **命令安全策略** -- 5 级分类、读写分离、路径沙箱，防止危险命令执行
- **JWT 双令牌认证** -- Access Token + Refresh Token 机制，自动刷新，黑名单登出
- **凭证加密存储** -- AES-256-GCM 加密存储服务器密码和 SSH 密钥
- **操作审计日志** -- 所有登录、命令执行、配置变更均有详细审计记录

### :chart_with_upwards_trend: 监控与可观测性

- **Prometheus 指标暴露** -- 9 个自定义指标，兼容 Grafana 可视化
- **健康检查** -- 完整的健康检查端点，Docker 容器自动探测
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
| 测试用例 | 5500+ |
| API 端点 | 336+ |

---

## 技术栈

| 层 | 技术 |
|:---|:---|
| **前端** | React 18 + Vite + TailwindCSS + TypeScript + Socket.IO |
| **状态管理** | Zustand + React Query |
| **工作流编辑器** | @xyflow/react |
| **后端** | Express.js + TypeScript + better-sqlite3 |
| **Agent 服务** | Python + PydanticAI + FastAPI |
| **数据库** | SQLite (WAL 模式) |
| **实时通信** | Socket.IO (WebSocket) |
| **远程连接** | SSH2 + noVNC |
| **部署** | Docker + Docker Compose + Nginx |
| **CI/CD** | GitHub Actions |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          浏览器 (Browser)                           │
│                    React 18 + Vite + TailwindCSS                    │
│                   45+ 页面 | Socket.IO Client                       │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTP / WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Nginx 反向代理 / 负载均衡                       │
│              SSL 终止 | 静态资源 | 安全头 (HSTS/CSP)                  │
└──────────┬──────────────────────────────┬───────────────────────────┘
           │ /api/*                       │ 静态文件
           ▼                              │
┌─────────────────────────┐               │
│   Express.js 后端        │               │
│   47 路由模块 | 336 API  │               │
│   JWT 认证 | 审计日志     │               │
│   WebSocket Server      │               │
└─────┬───┬───┬───┬───────┘               │
      │   │   │   │                        │
      ▼   │   │   │                        │
┌─────────┐│   │   │          ┌────────────┘
│ SQLite  ││   │   │          │
│ (WAL)   ││   │   │          ▼
│ AES-256 ││   │   │   ┌──────────────┐
└─────────┘│   │   │   │  前端静态文件  │
           ▼   │   │   └──────────────┘
   ┌───────────┐│   │
   │ LLM 池    ││   │
   │ OpenAI    ││   │
   │ 豆包      ││   │
   │ DeepSeek  ││   │
   │ 本地模型   ││   │
   └───────────┘│   │
                ▼   │
        ┌───────────┐│
        │ SSH 远程   ││
        │ 服务器     ││
        └───────────┘│
                     ▼
             ┌──────────────┐
             │ Python Agent │
             │ PydanticAI   │
             │ FastAPI      │
             │ 43+ 节点      │
             └──────────────┘
```

> 完整架构文档：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | [docs/ARCHITECTURE_DIAGRAM.md](./docs/ARCHITECTURE_DIAGRAM.md)

---

## 快速开始

### 前置条件

- **Docker** >= 20.10 与 **Docker Compose** >= 2.0
- （本地开发）**Node.js** >= 18、**Python** >= 3.11

### 方式一：一键脚本部署（推荐）

```bash
git clone https://github.com/qinshihu/itops-agent-platform.git
cd itops-agent-platform

# Linux / macOS
chmod +x deploy.sh && ./deploy.sh

# Windows PowerShell
.\deploy.ps1
```

脚本会自动拉取镜像、生成配置、启动服务并验证健康状态。

### 方式二：Docker Compose 部署

```bash
git clone https://github.com/qinshihu/itops-agent-platform.git
cd itops-agent-platform

# 1. 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 JWT_SECRET

# 2. 构建并启动
docker-compose up -d --build

# 3. 访问
# 前端: http://localhost:19300
# 后端: http://localhost:19301
# 健康检查: http://localhost:19301/health
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

---

## 项目结构

```
itops-agent-platform/
├── backend/                        # Express.js 后端
│   └── src/
│       ├── app.ts                  # 应用入口
│       ├── models/                 # 数据库模型与迁移 (17+ 版本)
│       ├── routes/                 # API 路由 (47 个模块)
│       ├── services/               # 业务逻辑 (55+ 个服务)
│       ├── middleware/             # 中间件 (认证/限流/校验/审计/命令过滤)
│       ├── websocket/              # WebSocket 实时通信
│       └── utils/                  # 工具函数
├── frontend/                       # React 前端
│   └── src/
│       ├── pages/                  # 页面组件 (45+ 个)
│       ├── components/             # 通用组件 (20+ 个)
│       ├── contexts/               # React Context
│       ├── hooks/                  # 自定义 Hooks
│       └── lib/                    # 工具库 (API/XSS 防护/日期)
├── itops-agent-service/            # Python Agent 服务
│   └── src/
│       ├── agents/                 # Agent 定义
│       ├── api/                    # FastAPI 端点
│       ├── tools/                  # Agent 工具集
│       └── knowledge/              # 知识库管理
├── docker/                         # Docker 生产配置
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
├── local-dev/                      # 本地开发环境 (热重载)
├── docs/                           # 技术文档
├── md-docs/                        # 详细开发教程 (28 章)
├── examples/                       # 测试脚本与示例
├── .github/workflows/              # CI/CD 流水线
├── docker-compose.yml              # 生产级 Docker Compose
├── docker-compose.simple.yml       # 简化版 Docker Compose
├── deploy.sh / deploy.ps1          # 一键部署脚本
├── start.sh / start.ps1            # 一键启动
├── stop.sh / stop.ps1              # 一键停止
├── SKILL.md                        # AI 编程助手 Skill
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
| **Web 终端** | `/api/terminal/*` | WebSocket SSH 终端会话管理 |
| **Agent 系统** | `/api/agents` | Agent CRUD、执行、历史记录 |
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
3. **Agent**：在 `itops-agent-service/src/` 扩展 Agent 或工具
4. **测试**：运行 `npm test` 或 `cd itops-agent-service && make test`

> 详细开发文档：[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | [md-docs/](./md-docs/) (28 章教程)

---

## 部署指南

### Docker Compose 生产部署

```bash
# 1. 克隆代码
git clone https://github.com/qinshihu/itops-agent-platform.git
cd itops-agent-platform

# 2. 配置环境变量（必须设置 JWT_SECRET）
cp .env.example .env
openssl rand -hex 32   # 生成安全密钥
# 编辑 .env 设置 JWT_SECRET、AI 模型密钥等

# 3. 启动服务
docker-compose up -d --build

# 4. 验证部署
curl http://localhost:19301/health
```

### 资源要求

| 组件 | CPU | 内存 |
|:---|:---|:---|
| 后端 | 0.5 ~ 2 核 | 512MB ~ 2GB |
| 前端 | 0.25 ~ 1 核 | 128MB ~ 512MB |

### 环境变量

| 变量 | 说明 | 默认值 |
|:---|:---|:---|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | 后端端口 | `3001` |
| `DATABASE_PATH` | SQLite 数据库路径 | `./data/app.db` |
| `JWT_SECRET` | JWT 签名密钥 | 开发环境自动生成 |
| `JWT_EXPIRES_IN` | Access Token 有效期 | `24h` |
| `DOUBAO_API_KEY` | 豆包 API 密钥 | - |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `LOCAL_AI_API_BASE` | 本地 AI 地址 (Ollama 等) | - |
| `WEBHOOK_VERIFY_ENABLED` | 启用 Webhook 签名验证 | `false` |
| `LOG_LEVEL` | 日志级别 | `info` |

> 完整环境变量参考：[.env.example](./.env.example) | [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

### CI/CD 流水线

| 流水线 | 触发条件 | 功能 |
|:---|:---|:---|
| [CI](.github/workflows/ci.yml) | Push/PR 到 main | Lint + 检查 + 测试 + Docker 构建验证 |
| [Release](.github/workflows/release.yml) | 推送 `v*` tag 或手动 | 构建镜像 -> 推送阿里云 -> 创建 GitHub Release |
| [Mirror](.github/workflows/mirror.yml) | Push 到 main | 同步代码到 Gitee/Gitcode |

---

## 安全特性

| 安全措施 | 说明 |
|:---|:---|
| **AES-256-GCM 加密** | 服务器密码和 SSH 密钥加密存储，密钥自动生成 |
| **JWT 双令牌认证** | Access Token + Refresh Token，自动刷新，黑名单登出 |
| **登录失败锁定** | 连续 5 次失败自动锁定 30 分钟 |
| **密码复杂度校验** | 要求大小写字母 + 数字 + 特殊字符（8 位以上） |
| **命令安全策略** | 5 级分类、读写分离、路径沙箱 |
| **API 速率限制** | 防止恶意请求和暴力破解 |
| **Webhook 签名验证** | HMAC-SHA256 签名 + IP 白名单 |
| **审计日志** | 所有登录、命令执行、配置变更可追溯 |
| **非 root 运行** | Docker 容器以非 root 用户运行 |
| **Nginx 安全头** | HSTS / CSP / X-Frame-Options / XSS 防护 |
| **本地 AI 支持** | 支持 Ollama / vLLM，数据 100% 不出域 |

> 零信任安全模型：所有服务器凭证只在本地加密存储，不会发送给任何第三方 AI。详细安全策略：[SECURITY.md](./SECURITY.md)

---

## 文档导航

| 文档 | 说明 |
|:---|:---|
| [架构设计](./docs/ARCHITECTURE.md) | 系统架构详解 |
| [API 文档](./docs/API.md) | 完整 API 接口文档 |
| [部署手册](./docs/DEPLOYMENT.md) | 详细部署操作说明 |
| [开发指南](./docs/DEVELOPMENT.md) | 本地开发环境搭建 |
| [工作流指南](./docs/WORKFLOW_GUIDE.md) | 工作流编排使用指南 |
| [自动修复设计](./docs/AUTO_REMEDIATION_DESIGN.md) | 告警自动修复功能设计 |
| [变更日志](./docs/CHANGELOG.md) | 版本更新记录 |
| [测试指南](./docs/TEST_GUIDE.md) | 功能测试说明 |
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

### 贡献入口

- [提交 Bug 报告](https://github.com/qinshihu/itops-agent-platform/issues/new?template=bug_report.yml)
- [提出新功能建议](https://github.com/qinshihu/itops-agent-platform/issues/new?template=feature_request.yml)
- [改进文档](https://github.com/qinshihu/itops-agent-platform/issues/new?template=docs_update.yml)
- [报告安全问题](./SECURITY.md)

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
| GitHub | [qinshihu/itops-agent-platform](https://github.com/qinshihu/itops-agent-platform) |
| 微信公众号 | **IT Online** |

<p>
  <img src="./frontend/public/wechaterweima.png" width="180" alt="IT Online 微信公众号" />
</p>

### 社区贡献者

<a href="https://github.com/qinshihu/itops-agent-platform/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=qinshihu/itops-agent-platform" />
</a>

---

<p align="center">
  如果这个项目对你有帮助，请给一个 :star: Star 支持一下！
</p>
