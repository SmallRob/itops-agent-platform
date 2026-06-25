# 项目顶层索引

> **重要**：本文件是 AI 启动时必读的第一个文件，用于建立对项目的全局认知。
> **大小限制**：< 2KB（必须保持精简）

## 1. 项目概览

**项目名称**：ITOps Agent Platform
**一句话描述**：企业级全栈IT运维自动化平台，通过可视化工作流编排多个AI Agent协同工作，实现服务器巡检、告警处理、故障诊断等任务的自动化。
**技术栈定位**：React 18 + Express.js + SQLite + TypeScript

## 2. 技术栈

| 类别 | 技术 |
|------|------|
| 主要语言 | TypeScript (前后端统一) |
| 前端框架 | React 18 + Vite + TailwindCSS |
| 后端框架 | Express.js + Socket.IO |
| 数据库 | SQLite (better-sqlite3) |
| 实时通信 | WebSocket (Socket.IO) |
| 构建工具 | npm + concurrently |

## 3. 领域划分

| 领域 | 职责 | 入口 |
|------|------|------|
| [Agent域](domains/agent-domain.md) | Agent管理、多Agent协作、AI模型集成 | agentExecutor, multiAgentCollaboration |
| [工作流域](domains/workflow-domain.md) | 工作流编排、执行引擎、审批流程 | workflowExecutor, approvalRoutes |
| [告警域](domains/alert-domain.md) | 告警管理、降噪、关联、自动分析 | alertService, alertCorrelationService |
| [服务器域](domains/server-domain.md) | 服务器管理、SSH终端、VNC远程桌面 | serverRoutes, sshService |
| [网络设备域](domains/network-domain.md) | 网络设备管理、SNMP、拓扑发现 | networkDeviceService, snmpService |
| [知识库域](domains/knowledge-domain.md) | 知识库管理、RAG增强检索 | knowledgeRoutes, enhancedRAGService |
| [自动修复域](domains/remediation-domain.md) | 修复策略、执行、审计 | remediationService, aiRemediationService |
| [基础设施域](domains/infrastructure-domain.md) | 认证、通知、备份、健康检查 | authRoutes, notificationService |

## 4. 构建指南

```bash
# 安装依赖
npm run install:all

# 开发模式启动
npm run dev

# 构建生产版本
npm run build

# Docker部署
npm run docker:up
```

## 5. 导航指引

- **理解项目**：阅读本文件（L1）
- **修改某领域**：阅读对应领域索引（L2）
- **执行具体任务**：按需阅读详细内容（L3）

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
