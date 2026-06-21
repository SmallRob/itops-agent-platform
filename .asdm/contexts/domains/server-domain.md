# 服务器域

> **重要**：本文件是进入服务器域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：服务器资产管理，提供SSH终端、VNC远程桌面、批量命令执行等运维能力。

**边界说明**：
- **负责**：服务器CRUD、分组管理、SSH连接、VNC代理、命令执行、凭据管理
- **不负责**：网络设备管理（网络设备域）、工作流调度（工作流域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 服务器管理 | 服务器CRUD、分组、标签 | `backend/src/routes/serverRoutes.ts` |
| SSH服务 | SSH连接、命令执行 | `backend/src/services/sshService.ts` |
| 终端服务 | Web Terminal会话管理 | `backend/src/services/terminalService.ts` |
| VNC代理 | VNC远程桌面代理 | `backend/src/services/vncProxyService.ts` |
| SSH密钥 | SSH密钥管理、密码支持 | `backend/src/routes/sshKeyRoutes.ts` |
| 凭据服务 | 加密存储API密钥 | `backend/src/services/credentialService.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| 工作流域 | 工作流执行服务器命令 | [workflow-domain.md](workflow-domain.md) |
| 网络设备域 | 部分设备信息共享 | [network-domain.md](network-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/server-domain/index.md](../domain-details/server-domain/index.md) - 完整索引

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
