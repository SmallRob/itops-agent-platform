# 自动修复域

> **重要**：本文件是进入自动修复域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：AI驱动的自动修复闭环，从告警触发到修复执行、验证的全流程自动化。

**边界说明**：
- **负责**：修复策略管理、修复执行、AI修复建议、修复审计、根因分析
- **不负责**：告警触发（告警域）、审批流程（工作流域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 修复策略 | 策略规则管理、匹配 | `backend/src/services/remediationService.ts` |
| 修复执行 | 命令执行、状态跟踪 | `backend/src/routes/remediationExecutionRoutes.ts` |
| AI修复 | AI生成修复建议 | `backend/src/services/aiRemediationService.ts` |
| 修复审计 | 执行记录、审计日志 | `backend/src/routes/remediationAuditRoutes.ts` |
| 根因分析 | 故障根因分析 | `backend/src/services/rootCauseAnalysisService.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| 告警域 | 告警触发修复流程 | [alert-domain.md](alert-domain.md) |
| 服务器域 | 执行修复命令 | [server-domain.md](server-domain.md) |
| Agent域 | AI分析调用 | [agent-domain.md](agent-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/remediation-domain/index.md](../domain-details/remediation-domain/index.md) - 完整索引
- [domain-details/remediation-domain/entities.md](../domain-details/remediation-domain/entities.md) - 实体定义
- [domain-details/remediation-domain/services.md](../domain-details/remediation-domain/services.md) - 服务接口
- [domain-details/remediation-domain/apis.md](../domain-details/remediation-domain/apis.md) - API 定义
- [domain-details/remediation-domain/flows.md](../domain-details/remediation-domain/flows.md) - 业务流程

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
