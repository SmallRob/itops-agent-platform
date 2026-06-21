# 工作流域索引

## 概述

工作流域是 ITOps Agent Platform 的核心业务模块，负责管理和执行自动化运维工作流。支持可视化编排、审批控制、定时调度等功能。

## 文档结构

| 文档 | 说明 |
|------|------|
| [entities.md](./entities.md) | 实体定义 - 数据模型和类型 |
| [services.md](./services.md) | 服务接口 - 核心业务逻辑 |
| [apis.md](./apis.md) | API 定义 - RESTful 接口 |
| [flows.md](./flows.md) | 业务流程 - 流程图和时序 |

## 核心概念

### 工作流 (Workflow)
由多个节点和边组成的有向无环图(DAG)，定义了运维任务的执行顺序和依赖关系。

### 节点类型
- **Agent 节点**: 调用 AI Agent 执行具体任务
- **审批节点**: 暂停工作流等待人工审批

### 执行模式
- **手动执行**: 通过 API 触发
- **定时执行**: 通过调度器自动触发
- **告警触发**: 根据告警策略自动触发

## 技术架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│  Workflow API   │───▶│ WorkflowExecutor│
│  (React Flow)   │    │  (Express)      │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Scheduler     │    │   Agent System  │
                       │   Service       │    │   (LLM/API)     │
                       └─────────────────┘    └─────────────────┘
```

## 相关文件

- `backend/src/services/workflowExecutor.ts` - 工作流执行引擎
- `backend/src/services/schedulerService.ts` - 定时调度服务
- `backend/src/routes/workflowRoutes.ts` - 工作流 API
- `backend/src/routes/approvalRoutes.ts` - 审批 API
- `backend/src/types/index.ts` - 类型定义
