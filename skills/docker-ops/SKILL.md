---
name: docker-ops
description: 多主机 Docker 运维：查看与操作容器、镜像（支持本机与全部已接入 Linux 服务器）
tags: [docker, 容器, 镜像, 运维, 多主机]
triggers: [docker, 容器, 镜像, 部署, 重启容器, 拉取镜像]
---

# Docker 多主机运维技能

封装平台「容器管理 / 镜像管理」能力（本机 Docker socket + 远端 SSH 双通道）。

## 关键约定

- 所有接口用 `server` 参数切换主机：`local` 为本机，其它取 `GET /api/docker/hosts` 的 id
- 写操作（启停/拉取/删除）仅管理员，且会写入审计日志
- 受保护名单内的容器（网关/平台自身）禁止通过平台启停
- 远端主机的容量统计为近似值（来自 docker CLI 的人类可读值）