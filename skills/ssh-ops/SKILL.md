---
name: ssh-ops
description: 通过 SSH 在已接入的 Linux 服务器上执行只读巡检命令、查看文件与进程状态，用于主机排障与远程运维
tags: [ssh, 主机, 服务器, 远程执行, 巡检, 排障]
triggers: [ssh, 远程执行, 登录服务器, 查看进程, 磁盘, 内存, 主机巡检]
---

# SSH 远程运维技能

封装平台「服务器管理 / 服务器命令」能力，供 Agent 在多台已接入主机上执行运维动作。

## 工作流

1. 先列出服务器清单（`servers.list`）确认目标 serverId
2. 只读巡检优先（`ssh.exec` 传只读命令）
3. 写操作走管理员确认（平台侧 `requireRole('admin')` 已强制）

## 平台能力映射

- 服务器清单：`GET /api/servers`
- 命令执行：`POST /api/server-commands/{serverId}/exec`（受命令安全策略约束，命令分 5 级分类）