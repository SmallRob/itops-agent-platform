# 自动修复域 - 详细内容索引

> **层级**：L3 详细内容
> **大小**：< 5KB

## 概述

AI 驱动的自动修复闭环，从告警触发到修复执行、验证的全流程自动化。

## 文件列表

| 文件 | 说明 |
|------|------|
| [entities.md](entities.md) | 实体定义 |
| [services.md](services.md) | 服务接口 |
| [apis.md](apis.md) | API 定义 |
| [flows.md](flows.md) | 业务流程 |

## 核心模块

| 模块 | 关键文件 |
|------|----------|
| 修复策略 | `backend/src/services/remediationService.ts` |
| AI 修复 | `backend/src/services/aiRemediationService.ts` |
| 根因分析 | `backend/src/services/rootCauseAnalysisService.ts` |
| 执行记录 | `backend/src/routes/remediationExecutionRoutes.ts` |
| 审计管理 | `backend/src/routes/remediationAuditRoutes.ts` |

---

*生成时间：2026-06-21*