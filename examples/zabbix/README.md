# Zabbix 配置示例

本目录包含 Zabbix 集成的配置示例和测试工具。

## 📁 文件说明

- `zabbix_webhook_config.json` - Webhook 媒介类型配置示例
- `test_zabbix_alert.ps1` - PowerShell 测试脚本
- `test_zabbix_alert.sh` - Shell 测试脚本

## 🚀 快速开始

### 1. 配置 Webhook

参考主文档 [ZABBIX_CONFIG.md](../../docs/ZABBIX_CONFIG.md) 配置 Zabbix。

### 2. 测试告警

使用测试脚本验证配置：

#### Windows
```powershell
cd examples/zabbix
.\test_zabbix_alert.ps1
```

#### Linux/Mac
```bash
cd examples/zabbix
chmod +x test_zabbix_alert.sh
./test_zabbix_alert.sh
```

## 📊 测试场景

### 场景1：CPU 使用率告警
```json
{
  "trigger": "CPU使用率过高",
  "host": "生产服务器-01",
  "item": "CPU使用率",
  "value": "87%",
  "severity": "high"
}
```

### 场景2：磁盘空间告警
```json
{
  "trigger": "磁盘空间不足",
  "host": "数据库服务器",
  "item": "磁盘使用率",
  "value": "95%",
  "severity": "critical"
}
```

### 场景3：内存告警
```json
{
  "trigger": "内存使用率过高",
  "host": "Redis缓存服务器",
  "item": "系统内存使用率",
  "value": "92%",
  "severity": "high"
}
```

### 场景4：服务异常告警
```json
{
  "trigger": "Nginx服务停止",
  "host": "生产服务器-01",
  "item": "Nginx进程状态",
  "value": "DOWN",
  "severity": "critical"
}
```

## 🔧 自定义配置

### 添加更多字段

在 Zabbix 媒介类型中可以添加更多参数：

| 参数名称 | Zabbix 宏 | 说明 |
|----------|-----------|------|
| `trigger_id` | `{TRIGGER.ID}` | 触发器ID |
| `event_id` | `{EVENT.ID}` | 事件ID |
| `host_ip` | `{HOST.IP}` | 主机IP |
| `host_name` | `{HOST.NAME}` | 主机名 |
| `item_key` | `{ITEM.KEY}` | 监控项Key |
| `item_value` | `{ITEM.LASTVALUE}` | 当前值 |
| `trigger_severity` | `{TRIGGER.SEVERITY}` | 严重程度 |
| `trigger_description` | `{TRIGGER.DESCRIPTION}` | 触发器描述 |
| `event_date` | `{EVENT.DATE}` | 事件日期 |
| `event_time` | `{EVENT.TIME}` | 事件时间 |

所有额外参数都会存储在告警的 `metadata` 字段中。

### 修改告警格式

如果需要自定义告警格式，可以修改 Zabbix 媒介类型中的脚本部分。

**示例脚本（JavaScript）：**
```javascript
var params = JSON.parse(value);
var alert = {
  trigger: params.trigger,
  host: params.host,
  item: params.item,
  value: params.value,
  severity: params.severity,
  metadata: {
    trigger_id: params.trigger_id,
    event_id: params.event_id,
    timestamp: new Date().toISOString()
  }
};

try {
  var response = HttpRequest();
  response.addHeader('Content-Type: application/json');
  var result = response.post(params.webhook_url, JSON.stringify(alert));
  
  return JSON.stringify({
    status: 'success',
    result: result
  });
} catch (error) {
  return JSON.stringify({
    status: 'error',
    error: error.message
  });
}
```

## 📖 相关文档

- [完整配置指南](../../docs/ZABBIX_CONFIG.md)
- [项目README](../../README.md)
