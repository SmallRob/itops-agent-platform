# Agent 域

> **重要**：本文件是进入 Agent 域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：管理AI Agent的生命周期，支持多Agent协作执行复杂运维任务。

**边界说明**：
- **负责**：Agent CRUD、Agent执行器、多Agent协作、AI模型集成、Copilot助手
- **不负责**：工作流编排（工作流域）、告警处理（告警域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| Agent管理 | Agent的增删改查、预设Agent | `backend/src/routes/agentRoutes.ts` |
| Agent执行器 | 单Agent任务执行、LLM调用 | `backend/src/services/agentExecutor.ts` |
| 多Agent协作 | 多Agent协同工作、任务分解 | `backend/src/services/multiAgentCollaboration.ts` |
| AI模型服务 | 多模型支持、负载均衡、熔断 | `backend/src/services/llmService.ts`, `aiModelService.ts` |
| Copilot助手 | AI对话助手、上下文感知 | `backend/src/services/copilotService.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| 工作流域 | 工作流节点执行Agent | [workflow-domain.md](workflow-domain.md) |
| 基础设施域 | LLM API调用、认证 | [infrastructure-domain.md](infrastructure-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/agent-domain/index.md](../domain-details/agent-domain/index.md) - 完整索引
- [domain-details/agent-domain/entities.md](../domain-details/agent-domain/entities.md) - 实体定义
- [domain-details/agent-domain/services.md](../domain-details/agent-domain/services.md) - 服务接口
- [domain-details/agent-domain/apis.md](../domain-details/agent-domain/apis.md) - API 定义
- [domain-details/agent-domain/flows.md](../domain-details/agent-domain/flows.md) - 业务流程

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
