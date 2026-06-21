# 知识库域

> **重要**：本文件是进入知识库域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：运维知识库管理，支持文档上传、RAG增强检索、QAnything集成，为AI提供领域知识。

**边界说明**：
- **负责**：知识库CRUD、文档管理、向量检索、RAG增强、QAnything集成
- **不负责**：Agent调用知识库（Agent域）、脚本管理（基础设施域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 知识库管理 | 知识库CRUD、分类 | `backend/src/routes/knowledgeRoutes.ts` |
| RAG服务 | 增强检索、上下文注入 | `backend/src/services/enhancedRAGService.ts` |
| QAnything集成 | 第三方知识库接入 | `backend/src/services/qanythingService.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| Agent域 | Agent调用知识库增强 | [agent-domain.md](agent-domain.md) |
| 基础设施域 | 文件上传、存储 | [infrastructure-domain.md](infrastructure-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/knowledge-domain/index.md](../domain-details/knowledge-domain/index.md) - 完整索引
- [domain-details/knowledge-domain/entities.md](../domain-details/knowledge-domain/entities.md) - 实体定义
- [domain-details/knowledge-domain/services.md](../domain-details/knowledge-domain/services.md) - 服务接口
- [domain-details/knowledge-domain/apis.md](../domain-details/knowledge-domain/apis.md) - API 定义
- [domain-details/knowledge-domain/flows.md](../domain-details/knowledge-domain/flows.md) - 业务流程

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
