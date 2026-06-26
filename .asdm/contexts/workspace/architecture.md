# 项目架构概览

> 📊 可视化架构图：[SVG](../../../docs/architecture/itops-architecture-v1.svg) | [PNG](../../../docs/architecture/itops-architecture-v1.png)

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    ITOps Agent Platform                       │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React 18 + Vite + TailwindCSS)                   │
│  ├── 45+ 页面组件 (按需加载)                                │
│  ├── 状态管理 (Zustand + React Query)                       │
│  └── 实时通信 (Socket.IO Client)                            │
├─────────────────────────────────────────────────────────────┤
│  Backend (Express.js + TypeScript)                          │
│  ├── 47 个路由模块                                          │
│  ├── 55+ 服务模块                                           │
│  ├── WebSocket 服务                                         │
│  └── 定时任务调度器                                         │
├─────────────────────────────────────────────────────────────┤
│  数据层                                                      │
│  ├── SQLite (better-sqlite3)                                │
│  ├── 17+ 数据库迁移                                         │
│  └── 文件存储 (知识库、备份)                                │
└─────────────────────────────────────────────────────────────┘
```

## 2. 技术栈详情

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite 5
- **样式**: TailwindCSS 3
- **路由**: React Router 6
- **状态**: Zustand + React Query
- **实时**: Socket.IO Client
- **终端**: xterm.js
- **流程图**: @xyflow/react

### 后端
- **框架**: Express.js 4
- **语言**: TypeScript 5
- **数据库**: SQLite (better-sqlite3)
- **实时**: Socket.IO
- **SSH**: ssh2
- **SNMP**: net-snmp
- **定时**: node-schedule

## 3. 目录结构

```
itops-agent-platform/
├── backend/                 # 后端服务
│   └── src/
│       ├── routes/          # API路由 (47个)
│       ├── services/        # 业务服务 (55+)
│       ├── models/          # 数据模型、迁移
│       ├── middleware/       # 中间件
│       ├── utils/           # 工具函数
│       └── websocket/       # WebSocket处理
├── frontend/                # 前端应用
│   └── src/
│       ├── pages/           # 页面组件 (45+)
│       ├── components/      # 公共组件
│       ├── contexts/        # React Context
│       ├── hooks/           # 自定义Hook
│       └── lib/             # 工具库
└── docker/                  # Docker配置
```
