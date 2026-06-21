# 告警域实体定义
本文档定义告警域相关的数据实体和类型。
## 1. 告警实体
### Alert（告警）
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 告警唯一标识（UUID） |
| source | string | 告警来源 |
| severity | AlertSeverity | 严重程度 |
| title | string | 告警标题 |
| content | string | 告警详细内容 |
| status | AlertStatus | 告警状态 |
| metadata | object | 元数据（JSON） |
| alert_fingerprint | string | 告警指纹 |
| related_task_id | string? | 关联任务 ID |
| created_at | string | 创建时间 |
### AlertSeverity
```typescript
type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
```
### AlertStatus
```typescript
type AlertStatus = 'new' | 'acknowledged' | 'resolved';
```
## 2. 告警规则
### AlertRule
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 规则 ID |
| name | string | 规则名称 |
| description | string | 规则描述 |
| severity | AlertSeverity | 严重程度 |
| condition | string | 监控指标 |
| threshold | number | 阈值 |
| enabled | boolean | 是否启用 |
| channels | AlertChannel[] | 通知渠道 |
| cooldownMs | number | 冷却时间 |
### AlertChannel
```typescript
type AlertChannel = 'email' | 'webhook' | 'log';
```
## 3. 告警通知
### AlertNotification
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 通知 ID |
| ruleId | string | 规则 ID |
| ruleName | string | 规则名称 |
| severity | AlertSeverity | 严重程度 |
| message | string | 通知消息 |
| timestamp | string | 时间戳 |
| channels | AlertChannel[] | 通知渠道 |
## 4. 告警降噪
### AlertNoiseRecord
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 记录 ID |
| alert_fingerprint | string | 告警指纹 |
| alert_source | string | 告警来源 |
| alert_title | string | 告警标题 |
| occurrence_count | number | 出现次数 |
| first_occurrence | Date | 首次出现 |
| last_occurrence | Date | 最后出现 |
| is_suppressed | boolean | 是否抑制 |
| suppression_reason | string? | 抑制原因 |
| suppression_until | Date? | 抑制截止 |
## 5. 告警关联
### CorrelationGroup
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 组 ID |
| title | string | 组标题 |
| status | GroupStatus | 组状态 |
| root_alert_id | string? | 根因告警 ID |
| root_cause | string? | 根因描述 |
| alert_count | number | 告警数量 |
| device_ids | string | 设备 ID 列表 |
| severity | string | 最高严重程度 |
| auto_detected | number | 自动检测 |
| created_at | string | 创建时间 |
### CorrelationMember
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 成员 ID |
| group_id | string | 组 ID |
| alert_id | string | 告警 ID |
| device_id | string? | 设备 ID |
| device_name | string? | 设备名称 |
| is_root | number | 是否根因 |
| created_at | string | 创建时间 |
## 6. 自动分析
### AutoAnalysisResult
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 分析 ID |
| alert_id | string | 告警 ID |
| device_id | string | 设备 ID |
| device_name | string | 设备名称 |
| device_ip | string | 设备 IP |
| device_type | DeviceType | 设备类型 |
| status | AnalysisStatus | 分析状态 |
| diagnosis | string | 诊断结论 |
| summary | string | 摘要 |
| raw_output | string | 原始输出 |
| commands_executed | string[] | 执行命令 |
| error_message | string? | 错误信息 |
| duration_ms | number | 耗时 |
| created_at | string | 创建时间 |
### DeviceType
```typescript
type DeviceType = 'network_device' | 'server';
```
### AnalysisStatus
```typescript
type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';
```
### DeviceInfo
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 设备 ID |
| name | string | 设备名称 |
| ip_address | string | IP 地址 |
| username | string? | SSH 用户名 |
| password | string? | SSH 密码 |
| ssh_port | number? | SSH 端口 |
| device_type | DeviceType | 设备类型 |
| auth_method | 'ssh' \| 'snmp' | 认证方式 |
## 7. Webhook 实体
### NormalizedAlert
| 字段 | 类型 | 描述 |
|------|------|------|
| external_id | string? | 外部 ID |
| source | string | 来源 |
| severity | string | 严重程度 |
| title | string | 标题 |
| content | string | 内容 |
| metadata | object | 元数据 |
| status | 'firing' \| 'resolved' | 状态 |
| host | string? | 主机 |
### WebhookLog
| 字段 | 类型 | 描述 |
|------|------|------|
| id | string | 日志 ID |
| source | string | 来源 |
| status | 'success' \| 'error' | 状态 |
| alert_count | number | 告警数量 |
| error_message | string? | 错误信息 |
| processing_time_ms | number? | 处理耗时 |
## 8. 默认规则
| ID | 名称 | 条件 | 阈值 | 严重程度 |
|----|------|------|------|----------|
| high-memory-usage | 高内存使用率 | memory_percent | 90 | critical |
| high-cpu-usage | 高 CPU 使用率 | cpu_percent | 85 | warning |
| database-slow | 数据库响应慢 | db_latency | 1000 | critical |
| high-error-rate | 高错误率 | error_rate | 10 | critical |
| disk-space-low | 磁盘空间不足 | disk_percent | 90 | warning |