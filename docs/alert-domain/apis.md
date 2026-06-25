# 告警域 API 定义
本文档定义告警域的 RESTful API 端点。
## 告警管理 API
### 1. 获取告警列表
**GET** `/api/alerts`
#### 查询参数
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| status | string | 否 | 告警状态：new、acknowledged、resolved |
| severity | string | 否 | 严重程度：critical、high、medium、low |
| limit | number | 否 | 返回数量限制（最大 100） |
#### 响应示例
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "source": "prometheus",
      "severity": "critical",
      "title": "High CPU Usage",
      "status": "new"
    }
  ]
}
```
### 2. 获取单个告警
**GET** `/api/alerts/:id`
#### 响应示例
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "source": "prometheus",
    "severity": "critical",
    "title": "High CPU Usage",
    "status": "new"
  }
}
```
### 3. 创建告警
**POST** `/api/alerts`
#### 请求体
```json
{
  "source": "prometheus",
  "severity": "critical",
  "title": "High CPU Usage",
  "content": "CPU usage exceeds 90%",
  "metadata": {
    "host": "192.168.1.100",
    "tags": ["cpu", "performance"]
  }
}
```
#### 响应示例
```json
{
  "success": true,
  "data": {
    "alert": { "id": "...", "status": "new" },
    "noiseReduction": {
      "shouldNotify": true,
      "isDuplicate": false,
      "occurrenceCount": 1
    }
  }
}
```
### 4. 确认告警
**PUT** `/api/alerts/:id/acknowledge`
#### 响应示例
```json
{
  "success": true,
  "data": { "id": "...", "status": "acknowledged" }
}
```
### 5. 解决告警
**PUT** `/api/alerts/:id/resolve`
#### 响应示例
```json
{
  "success": true,
  "data": { "id": "...", "status": "resolved" }
}
```
### 6. 删除告警
**DELETE** `/api/alerts/:id`
需要 admin 或 operator 权限。
#### 响应示例
```json
{
  "success": true,
  "message": "Alert deleted successfully"
}
```
### 7. 获取告警统计
**GET** `/api/alerts/stats/summary`
#### 响应示例
```json
{
  "success": true,
  "data": {
    "byStatus": [
      { "status": "new", "count": 15 },
      { "status": "acknowledged", "count": 8 }
    ],
    "bySeverity": [
      { "severity": "critical", "count": 5 },
      { "severity": "high", "count": 12 }
    ],
    "total": 65
  }
}
```
### 8. 手动触发告警处理
**POST** `/api/alerts/:id/process`
#### 响应示例
```json
{
  "success": true,
  "message": "成功匹配 2 条修复策略，执行已触发",
  "data": {
    "alertId": "...",
    "matchedPolicies": [
      { "id": "policy-1", "name": "High CPU Remediation", "execution_mode": "auto" }
    ],
    "executionIds": ["exec-123"]
  }
}
```
## Webhook 接入 API
### 1. Prometheus Webhook
**POST** `/api/webhooks/prometheus`
#### 请求体（Prometheus Alertmanager 格式）
```json
{
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighCPU",
        "severity": "critical",
        "instance": "192.168.1.100:9090"
      },
      "annotations": {
        "summary": "High CPU usage detected"
      }
    }
  ]
}
```
### 2. Zabbix Webhook
**POST** `/api/webhooks/zabbix`
#### 请求体（Zabbix 格式）
```json
{
  "event_id": "12345",
  "severity": "disaster",
  "subject": "High CPU usage on server-01",
  "host": "192.168.1.100"
}
```
### 3. Grafana Webhook
**POST** `/api/webhooks/grafana`
### 4. 阿里云 Webhook
**POST** `/api/webhooks/aliyun`
### 5. 腾讯云 Webhook
**POST** `/api/webhooks/tencent`
### 6. 自动检测 Webhook
**POST** `/api/webhooks/auto`
自动检测告警源类型并处理。
#### 响应示例
```json
{
  "success": true,
  "message": "Auto-detected source: prometheus, processed 1 alerts",
  "data": {
    "detectedType": "prometheus",
    "processed": [...]
  }
}
```
### 7. 通用 Webhook
**POST** `/api/webhooks/generic`
#### 请求体验证
| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| title | string | 是 | 告警标题 |
| source | string | 否 | 告警来源（默认 "generic"） |
| severity | string | 否 | 严重程度（默认 "medium"） |
| content | string | 否 | 告警内容 |
| metadata | object | 否 | 元数据 |
| external_id | string | 否 | 外部系统 ID |
| host | string | 否 | 主机/IP |
| status | string | 否 | 状态：firing、resolved |
## 安全机制
### Webhook 签名验证
生产环境必须启用签名验证：
1. 设置 `WEBHOOK_VERIFY_ENABLED=true`
2. 设置 `WEBHOOK_SECRET` 为强随机字符串
3. 在告警源配置相同的 Secret
4. 使用 HTTPS 传输
**签名算法**：HMAC-SHA256
**签名 Header**：`X-Webhook-Signature-{source}`
## WebSocket 事件
| 事件 | 描述 |
|------|------|
| alert:new | 新告警创建 |
| alert:resolved | 告警已解决 |
| remediation:started | 修复流程开始 |
| remediation:result | 修复策略执行结果 |
| remediation:completed | 修复流程完成 |
| remediation:error | 修复流程错误 |