# 工作流域

> **重要**：本文件是进入工作流域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：可视化工作流编排引擎，支持串行/并行/条件分支执行，集成HITL人工审批。

**边界说明**：
- **负责**：工作流CRUD、可视化编辑器、执行引擎、审批流程、定时任务
- **不负责**：Agent具体执行逻辑（Agent域）、告警触发（告警域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 工作流管理 | 工作流CRUD、版本管理 | `backend/src/routes/workflowRoutes.ts` |
| 执行引擎 | 节点调度、状态机、并发控制 | `backend/src/services/workflowExecutor.ts` |
| 审批管理 | HITL审批、超时处理 | `backend/src/routes/approvalRoutes.ts` |
| 定时任务 | Cron调度、定时执行 | `backend/src/services/schedulerService.ts` |
| 工作流编辑器 | 前端拖拽式编排 | `frontend/src/pages/WorkflowEditor.tsx` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| Agent域 | 调用Agent执行任务节点 | [agent-domain.md](agent-domain.md) |
| 基础设施域 | 通知推送（审批结果） | [infrastructure-domain.md](infrastructure-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/workflow-domain/index.md](../domain-details/workflow-domain/index.md) - 完整索引

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
