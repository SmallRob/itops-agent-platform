# Agent 域 - 详细内容索引

> **层级**：L3 详细内容
> **大小**：< 5KB
> **用途**：Agent 域完整技术参考

## 概述

Agent 域负责 AI Agent 的生命周期管理，支持多 Agent 协作执行复杂运维任务。

## 文件列表

| 文件 | 大小 | 内容 |
|------|------|------|
| [entities.md](entities.md) | < 5KB | Agent 相关实体定义 |
| [services.md](services.md) | < 5KB | Agent 服务接口 |
| [apis.md](apis.md) | < 5KB | Agent API 端点 |
| [flows.md](flows.md) | < 5KB | Agent 执行流程 |

## 核心模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| Agent 管理 | Agent CRUD、预设 Agent | `backend/src/routes/agentRoutes.ts` |
| Agent 执行器 | 单 Agent 任务执行 | `backend/src/services/agentExecutor.ts` |
| 多 Agent 协作 | 多 Agent 协同工作 | `backend/src/services/multiAgentCollaboration.ts` |
| AI 模型服务 | 多模型支持、熔断 | `backend/src/services/llmService.ts` |
| AI 模型管理 | 模型池管理 | `backend/src/services/aiModelService.ts` |
| Copilot 助手 | AI 对话助手 | `backend/src/services/copilotService.ts` |

## 外部依赖

| 依赖领域 | 依赖内容 |
|----------|----------|
| 工作流域 | 工作流节点调用 Agent 执行 |
| 基础设施域 | LLM API 调用、认证 |
| 知识库域 | RAG 知识增强 |

---

*生成时间：2026-06-21*
