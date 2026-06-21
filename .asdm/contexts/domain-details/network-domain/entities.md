# 网络设备域 - 实体定义

## 核心实体

### NetworkDevice（网络设备）

网络设备主实体，存储设备基本信息和认证凭据。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string (UUID) | 是 | 设备唯一标识 |
| name | string | 是 | 设备名称 |
| ip_address | string | 是 | 管理IP地址 |
| vendor | VendorType | 是 | 厂商类型（huawei/h3c/cisco） |
| model | string | 否 | 设备型号 |
| os_version | string | 否 | 操作系统版本 |
| ssh_port | number | 否 | SSH端口（默认22） |
| ssh_key_id | string | 否 | SSH凭证ID |
| username | string | 是 | 登录用户名 |
| password | string | 是 | 登录密码（加密存储） |
| enable_password | string | 否 | 特权密码（加密存储） |
| location | string | 否 | 设备位置 |
| role | string | 否 | 设备角色 |
| status | string | 是 | 设备状态（online/offline） |
| snmp_enabled | number | 否 | SNMP是否启用（0/1） |
| snmp_credential_id | string | 否 | SNMP凭证ID |
| snmp_port | number | 否 | SNMP端口（默认161） |
| last_inspection_at | string | 否 | 最后巡检时间 |
| last_inspection_result | string | 否 | 最后巡检结果摘要 |
| created_at | string | 是 | 创建时间 |
| updated_at | string | 是 | 更新时间 |

### SnmpCredential（SNMP凭证）

SNMP 认证凭据，支持 v1/v2c/v3 版本。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string (UUID) | 是 | 凭证唯一标识 |
| device_id | string | 否 | 关联设备ID（NULL为全局） |
| name | string | 是 | 凭证名称 |
| community | string | 否 | Community String（v1/v2c） |
| snmp_user | string | 否 | SNMP用户（v3） |
| snmp_auth_protocol | string | 否 | 认证协议（MD5/SHA） |
| snmp_auth_key | string | 否 | 认证密钥（加密） |
| snmp_priv_protocol | string | 否 | 加密协议（DES/AES） |
| snmp_priv_key | string | 否 | 加密密钥（加密） |
| snmp_version | SnmpVersion | 是 | SNMP版本 |
| snmp_port | number | 否 | SNMP端口（默认161） |

### TrapEvent（Trap事件）

SNMP Trap 接收事件记录。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string (UUID) | 是 | 事件唯一标识 |
| source_ip | string | 是 | 来源IP地址 |
| trap_type | string | 是 | Trap类型 |
| enterprise_oid | string | 否 | 企业OID |
| agent_address | string | 否 | 代理地址 |
| generic_type | number | 是 | 通用类型（0-6） |
| specific_type | number | 是 | 特定类型 |
| timestamp | string | 是 | 事件时间 |
| varbinds | Array | 是 | Varbind列表 |

### InterfaceInfo（接口信息）

网络接口状态和性能数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| index | number | 接口索引 |
| name | string | 接口名称 |
| descr | string | 接口描述 |
| type | number | 接口类型（IANA） |
| typeName | string | 类型名称 |
| speed | number | 接口速率（bps） |
| mtu | number | MTU值 |
| mac | string | MAC地址 |
| adminStatus | string | 管理状态（up/down） |
| operStatus | string | 运行状态（up/down） |
| alias | string | 接口别名 |
| inOctets | number | 入方向字节数 |
| outOctets | number | 出方向字节数 |
| inErrors | number | 入方向错误数 |
| outErrors | number | 出方向错误数 |
| inUtilization | number | 入方向利用率（%） |
| outUtilization | number | 出方向利用率（%） |

### TopologyNode（拓扑节点）

网络拓扑图节点。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 节点ID |
| server_id | string | 关联服务器ID |
| name | string | 节点名称 |
| ip | string | IP地址 |
| status | string | 节点状态 |
| type | string | 节点类型（server/network） |

### TopologyEdge（拓扑边）

网络拓扑图连接关系。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 边ID |
| source | string | 源节点ID |
| target | string | 目标节点ID |
| type | string | 连接类型 |
| dependency_type | string | 依赖类型 |
| protocol | string | 协议 |
| port | number | 端口 |
| status | string | 连接状态 |

## 枚举类型

### VendorType（厂商类型）

```
'huawei' | 'h3c' | 'cisco' | 'juniper' | 'arista' | 'generic'
```

### SnmpVersion（SNMP版本）

```
'v1' | 'v2c' | 'v3'
```

### InspectionType（巡检类型）

```
'version' | 'interface' | 'cpu' | 'memory' | 'environment' | 'routing' | 'mac' | 'arp' | 'log'
```
