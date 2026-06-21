# 网络设备域 - 服务接口

## NetworkDeviceService

网络设备管理服务，负责设备 CRUD 和连接测试。

### 方法列表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| getAllDevices() | NetworkDevice[] | 获取所有设备列表 |
| getDeviceById(id) | NetworkDevice | 根据ID获取设备 |
| createDevice(data) | NetworkDevice | 创建新设备 |
| updateDevice(id, data) | NetworkDevice | 更新设备信息 |
| deleteDevice(id) | boolean | 删除设备 |
| testConnection(deviceId) | ConnectionResult | 测试设备连接 |
| testTemporaryConnection(data) | ConnectionResult | 测试临时连接 |

---

## SnmpService

SNMP 协议通信服务，提供标准 SNMP 操作。

### 方法列表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| get(host, port, version, community, oid) | SnmpResult | SNMP GET 单个OID |
| getMultiple(host, port, version, community, oids) | SnmpResult[] | SNMP GET 多个OID |
| walk(host, port, version, community, oid) | SnmpResult[] | SNMP WALK |
| getSystemInfo(host, port, version, community) | SystemInfo | 获取系统信息 |
| getInterfaces(host, port, version, community) | InterfaceInfo[] | 获取接口列表 |
| healthCheck(deviceId) | DeviceHealth | 设备健康检查 |
| discoverDevices(subnet, community) | Device[] | 自动发现设备 |

---

## SnmpPollingService

SNMP 定时轮询服务，定期采集设备数据。

### 方法列表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| start() | void | 启动轮询服务 |
| stop() | void | 停止轮询服务 |
| pollAll() | void | 轮询所有设备 |
| inspectDevice(deviceId) | SnmpInspectionResult | 巡检单个设备 |

### 轮询配置

- 轮询间隔: 5 分钟
- 设备间隔: 200ms（避免拥塞）
- 超时时间: 10 秒

---

## SnmpTrapService

SNMP Trap 接收服务，监听设备主动上报事件。

### 方法列表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| start(port?, address?) | void | 启动Trap监听 |
| stop() | void | 停止Trap监听 |
| getTrapHistory(limit?, sourceIp?) | TrapEvent[] | 获取Trap历史 |

### Trap类型映射

| Trap | 告警级别 | 说明 |
|------|----------|------|
| coldStart | critical | 设备冷启动 |
| warmStart | warning | 设备热启动 |
| linkDown | warning | 接口Down |
| linkUp | info | 接口Up |
| authenticationFailure | high | 认证失败 |

---

## TopologyService

网络拓扑服务，管理服务依赖关系。

### 方法列表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| discoverDependencies(serverId) | DependencyInput[] | 自动发现依赖 |
| addDependency(input) | TopologyEdge | 添加依赖关系 |
| deleteDependency(id) | boolean | 删除依赖关系 |
| getServerTopology(serverId) | TopologyGraph | 获取服务器拓扑 |
| getGlobalTopology() | TopologyGraph | 获取全局拓扑 |
| verifyDependencies() | VerificationResult[] | 验证依赖状态 |
| getAffectedServices(alertId) | AffectedServices | 获取受影响服务 |

---

## NetworkInspectionService

网络巡检服务，通过 SSH 执行设备巡检。

### 方法列表

| 方法 | 返回值 | 说明 |
|------|--------|------|
| inspectDevice(deviceId, type?) | InspectionResult | 执行设备巡检 |
| batchInspect(deviceIds[], type?) | InspectionResult[] | 批量巡检 |

### 巡检类型

| 类型 | 说明 |
|------|------|
| standard | 标准巡检（预定义命令） |
| custom | 自定义巡检（指定检查项） |
| full | 完整巡检（标准+自定义） |

### 巡检项目

- 版本信息: display version
- 接口状态: display interface brief
- CPU使用: display cpu-usage
- 内存使用: display memory
- 环境信息: display environment
