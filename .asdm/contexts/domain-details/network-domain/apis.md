# 网络设备域 - API 定义

## 设备管理 API

### 获取设备列表
```
GET /api/network-devices
响应: { success: true, data: NetworkDevice[] }
```

### 获取设备详情
```
GET /api/network-devices/:id
响应: { success: true, data: NetworkDevice }
```

### 创建设备
```
POST /api/network-devices
请求: { name, ip_address, vendor, username, password, ... }
响应: { success: true, data: NetworkDevice }
```

### 更新设备
```
PUT /api/network-devices/:id
请求: { name?, location?, ... }
响应: { success: true, data: NetworkDevice }
```

### 删除设备
```
DELETE /api/network-devices/:id
响应: { success: true }
```

---

## 连接测试 API

### 测试设备连接
```
POST /api/network-devices/:id/test-connection
响应: { success: true, data: { success, message, latency } }
```

### 测试临时连接
```
POST /api/network-devices/test-temporary-connection
请求: { ip_address, ssh_port, username, password }
响应: { success: true, data: { success, message, latency } }
```

---

## SNMP 管理 API

### SNMP 凭证管理
```
GET    /api/snmp-credentials
POST   /api/snmp-credentials
PUT    /api/snmp-credentials/:id
DELETE /api/snmp-credentials/:id
```

### SNMP 查询
```
POST /api/snmp/query
请求: { host, port, version, community, oids[] }
响应: { success: true, data: SnmpResult[] }
```

### 设备健康检查
```
GET /api/network-devices/:id/health
响应: { success: true, data: DeviceHealth }
```

---

## 巡检管理 API

### 执行设备巡检
```
POST /api/network-devices/:id/inspect
请求: { inspectionType, customTypes? }
响应: { success: true, data: InspectionResult }
```

### 批量巡检
```
POST /api/network-devices/batch-inspect
请求: { deviceIds[], inspectionType }
响应: { success: true, data: InspectionResult[] }
```

### 获取巡检历史
```
GET /api/network-devices/:id/inspection-history?limit=20
响应: { success: true, data: InspectionHistory[] }
```

---

## Trap 管理 API

### 获取 Trap 历史
```
GET /api/snmp/traps?limit=50&sourceIp=192.168.1.1
响应: { success: true, data: TrapEvent[] }
```

### Trap 监听状态
```
GET /api/snmp/traps/status
响应: { success: true, data: { running, port, address } }
```

---

## 拓扑管理 API

### 获取全局拓扑
```
GET /api/topology
响应: { success: true, data: { nodes[], edges[] } }
```

### 获取服务器拓扑
```
GET /api/topology/server/:serverId
响应: { success: true, data: { nodes[], edges[] } }
```

### 添加依赖关系
```
POST /api/topology/dependencies
请求: { source_server_id, target_server_id, dependency_type, protocol?, port? }
响应: { success: true, data: TopologyEdge }
```

### 自动发现依赖
```
POST /api/topology/discover/:serverId
响应: { success: true, data: DependencyInput[] }
```

### 验证依赖状态
```
POST /api/topology/verify
响应: { success: true, data: VerificationResult[] }
```

---

## 设备发现 API

### SNMP 自动发现
```
POST /api/network-devices/discover
请求: { subnet, community?, version?, port? }
响应: { success: true, data: DiscoveredDevice[] }
```

---

## 错误响应格式

```json
{ "success": false, "error": "错误信息", "code": "ERROR_CODE" }
```

### 常见错误码

| 错误码 | 说明 |
|--------|------|
| DEVICE_NOT_FOUND | 设备不存在 |
| CONNECTION_FAILED | 连接失败 |
| SNMP_TIMEOUT | SNMP超时 |
| INSPECTION_FAILED | 巡检失败 |
| INVALID_CREDENTIALS | 凭证无效 |
