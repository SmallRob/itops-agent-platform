# 基础设施域

> **重要**：本文件是进入基础设施域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：平台基础设施服务，提供认证授权、通知推送、数据备份、健康监控等横切关注点。

**边界说明**：
- **负责**：用户认证、JWT管理、通知渠道、数据备份、健康检查、审计日志、脚本管理、系统设置
- **不负责**：具体业务逻辑（各业务域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 认证服务 | JWT认证、Token黑名单 | `backend/src/routes/authRoutes.ts` |
| 用户管理 | 用户CRUD、权限控制 | `backend/src/routes/userRoutes.ts` |
| 通知服务 | 多渠道通知（邮件/钉钉/企微） | `backend/src/services/notificationService.ts` |
| 备份服务 | 数据备份、恢复 | `backend/src/services/backupService.ts` |
| 健康检查 | 系统健康监控 | `backend/src/services/healthService.ts` |
| 审计日志 | 操作审计记录 | `backend/src/services/auditService.ts` |
| 脚本管理 | 运维脚本存储 | `backend/src/routes/scriptRoutes.ts` |
| 系统设置 | 全局配置管理 | `backend/src/routes/settingsRoutes.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| 所有业务域 | 认证、通知、审计 | 各业务域 |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/infrastructure-domain/index.md](../domain-details/infrastructure-domain/index.md) - 完整索引
- [domain-details/infrastructure-domain/entities.md](../domain-details/infrastructure-domain/entities.md) - 实体定义
- [domain-details/infrastructure-domain/services.md](../domain-details/infrastructure-domain/services.md) - 服务接口
- [domain-details/infrastructure-domain/apis.md](../domain-details/infrastructure-domain/apis.md) - API 定义
- [domain-details/infrastructure-domain/flows.md](../domain-details/infrastructure-domain/flows.md) - 业务流程

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
