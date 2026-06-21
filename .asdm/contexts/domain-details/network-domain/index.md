# 网络设备域 - 索引

## 概述

网络设备域是 ITOps Agent Platform 的核心功能模块，负责网络设备的统一管理、监控和巡检。

## 文档结构

| 文件 | 说明 |
|------|------|
| [entities.md](./entities.md) | 实体定义 - 数据模型和类型定义 |
| [services.md](./services.md) | 服务接口 - 核心服务类和方法 |
| [apis.md](./apis.md) | API 定义 - RESTful 接口规范 |
| [flows.md](./flows.md) | 业务流程 - 关键业务流程说明 |

## 核心服务

| 服务 | 文件 | 职责 |
|------|------|------|
| NetworkDeviceService | networkDeviceService.ts | 设备管理（CRUD、连接测试） |
| SnmpService | snmpService.ts | SNMP 协议通信（GET/WALK） |
| SnmpPollingService | snmpPollingService.ts | SNMP 定时轮询采集 |
| SnmpTrapService | snmpTrapService.ts | SNMP Trap 接收和告警 |
| TopologyService | topologyService.ts | 网络拓扑发现和管理 |
| NetworkInspectionService | networkInspectionService.ts | SSH 巡检执行 |

## 技术栈

- **协议支持**: SSH (ssh2)、SNMP (net-snmp)
- **数据库**: SQLite
- **加密**: AES-256-CBC 敏感数据加密
- **厂商适配**: 华为、华三、Cisco 等

## 快速导航

- 查看 [实体定义](./entities.md) 了解数据模型
- 查看 [服务接口](./services.md) 了解服务能力
- 查看 [API 定义](./apis.md) 了解接口规范
- 查看 [业务流程](./flows.md) 了解工作流程
