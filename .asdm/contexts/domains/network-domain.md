# 网络设备域

> **重要**：本文件是进入网络设备域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：网络设备全生命周期管理，支持SNMP协议、拓扑发现、配置备份等网络运维能力。

**边界说明**：
- **负责**：网络设备CRUD、SNMP轮询/Trap、拓扑发现、LLDP、配置备份、网络巡检
- **不负责**：服务器管理（服务器域）、告警处理（告警域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 设备管理 | 网络设备CRUD、凭据 | `backend/src/services/networkDeviceService.ts` |
| SNMP服务 | SNMP查询、OID管理 | `backend/src/services/snmpService.ts` |
| SNMP轮询 | 定期设备状态采集 | `backend/src/services/snmpPollingService.ts` |
| SNMP Trap | Trap告警接收 | `backend/src/services/snmpTrapService.ts` |
| 拓扑服务 | 网络拓扑发现、LLDP | `backend/src/services/topologyService.ts` |
| 网络巡检 | 自动化巡检任务 | `backend/src/services/networkInspectionService.ts` |
| 配置备份 | 设备配置备份 | `backend/src/services/configBackupService.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| 告警域 | 设备告警上报 | [alert-domain.md](alert-domain.md) |
| 基础设施域 | 厂商适配、加密 | [infrastructure-domain.md](infrastructure-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/network-domain/index.md](../domain-details/network-domain/index.md) - 完整索引
- [domain-details/network-domain/entities.md](../domain-details/network-domain/entities.md) - 实体定义
- [domain-details/network-domain/services.md](../domain-details/network-domain/services.md) - 服务接口
- [domain-details/network-domain/apis.md](../domain-details/network-domain/apis.md) - API 定义
- [domain-details/network-domain/flows.md](../domain-details/network-domain/flows.md) - 业务流程

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
