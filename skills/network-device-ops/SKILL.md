---
name: network-device-ops
description: 网络设备运维：设备清单、SNMP 巡检、LLDP 拓扑发现与端口状态查询
tags: [网络, 交换机, 路由器, snmp, 拓扑, 巡检]
triggers: [网络设备, 交换机, 路由器, snmp, 拓扑, 端口状态, 网络巡检]
---

# 网络设备运维技能

封装平台「网络设备 / SNMP / 拓扑」能力，厂商差异由平台侧适配器接管（华为/华三/思科/锐捷）。

## 工作流

1. `network.devices.list` 确认目标设备
2. 巡检用 `network.device.inspect`（平台侧调用厂商命令模板并解析结果）
3. 拓扑与端口关联参考 `network.topology.get`