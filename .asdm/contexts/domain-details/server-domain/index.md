# 服务器域 - 详细内容索引

> **层级**：L3 详细内容
> **大小**：< 5KB

## 概述

服务器域负责管理远程服务器的连接、认证、命令执行和监控。

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
| 服务器管理 | `backend/src/routes/serverRoutes.ts` |
| SSH 服务 | `backend/src/services/sshService.ts` |
| 终端服务 | `backend/src/services/terminalService.ts` |
| VNC 代理 | `backend/src/services/vncProxyService.ts` |
| 凭据服务 | `backend/src/services/credentialService.ts` |

---

*生成时间：2026-06-21*