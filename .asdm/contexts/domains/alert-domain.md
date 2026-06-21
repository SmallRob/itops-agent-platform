# 告警域

> **重要**：本文件是进入告警域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：统一告警管理平台，支持多源告警接入、智能降噪、关联分析和自动诊断。

**边界说明**：
- **负责**：告警CRUD、告警降噪、告警关联、自动分析、Webhook接入、告警映射
- **不负责**：修复执行（自动修复域）、通知发送（基础设施域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 告警服务 | 告警生命周期管理 | `backend/src/services/alertService.ts` |
| 告警降噪 | 重复告警合并、规则过滤 | `backend/src/services/alertNoiseReductionService.ts` |
| 告警关联 | 告警分组、关联分析 | `backend/src/services/alertCorrelationService.ts` |
| 自动分析 | AI驱动的告警诊断 | `backend/src/services/alertAutoAnalyzer.ts` |
| Webhook接入 | 外部系统告警推送 | `backend/src/routes/webhookRoutes.ts` |
| 告警映射 | 告警字段映射规则 | `backend/src/routes/alertMappingRoutes.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| 自动修复域 | 告警触发修复策略 | [remediation-domain.md](remediation-domain.md) |
| Agent域 | AI分析调用LLM | [agent-domain.md](agent-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/alert-domain/index.md](../domain-details/alert-domain/index.md) - 完整索引
- [domain-details/alert-domain/entities.md](../domain-details/alert-domain/entities.md) - 实体定义
- [domain-details/alert-domain/services.md](../domain-details/alert-domain/services.md) - 服务接口
- [domain-details/alert-domain/apis.md](../domain-details/alert-domain/apis.md) - API 定义
- [domain-details/alert-domain/flows.md](../domain-details/alert-domain/flows.md) - 业务流程

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
