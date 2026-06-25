# 附录C 数据库表结构速查

## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="../../frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策



## C.1 概述

ITOps Agent Platform 使用 **SQLite** 作为底层数据库，通过 `better-sqlite3` 驱动提供同步 API 访问。本速查表列出所有数据库表的结构、字段说明和关联关系，共计 **44 张表**。

> **相关章节**: 第5章 项目架构深度解析、第8章 数据库设计与操作

## C.2 表分类总览

| 分类 | 表数量 | 表名 |
|------|--------|------|
| 核心业务表 | 7 | `users`、`servers`、`server_groups`、`server_group_mapping`、`agents`、`workflows`、`ai_models` |
| 任务与执行表 | 5 | `tasks`、`agent_executions`、`scheduled_tasks`、`server_command_history`、`compliance_checks` |
| 告警与通知表 | 8 | `alerts`、`alert_configs`、`alert_notifications`、`alert_workflow_mappings`、`alert_noise_reduction`、`alert_webhook_logs`、`notifications`、`notification_configs` |
| 自愈与根因分析表 | 6 | `remediation_policies`、`remediation_executions`、`remediation_history`、`remediation_cooldowns`、`remediation_audits`、`root_cause_analyses` |
| 知识与脚本表 | 2 | `knowledge_base`、`scripts` |
| 报告表 | 2 | `reports`、`report_schedules` |
| 运维与安全表 | 5 | `audit_logs`、`settings`、`token_blacklist`、`encryption_keys`、`ssh_keys` |
| 监控与备份表 | 3 | `server_metrics`、`network_devices`、`network_inspection_history` |
| 拓扑与变更表 | 2 | `service_topologies`、`change_records` |
| 系统辅助表 | 2 | `copilot_conversations`、`schema_migrations` |

## C.3 核心业务表

### C.3.1 users — 用户表

存储系统用户信息，支持三种角色：`admin`（管理员）、`operator`（操作员）、`viewer`（只读用户）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `username` | TEXT | UNIQUE NOT NULL | 用户名，唯一 |
| `password` | TEXT | NOT NULL | bcrypt 哈希密码 |
| `email` | TEXT | — | 邮箱地址 |
| `role` | TEXT | NOT NULL | 角色：admin/operator/viewer |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用：1=启用，0=禁用 |
| `password_must_change` | INTEGER | DEFAULT 0 | 首次登录是否强制改密 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

### C.3.2 servers — 服务器表

存储被管理的远程服务器信息，支持 SSH 密码和密钥两种认证方式。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 服务器名称 |
| `hostname` | TEXT | NOT NULL | 主机名或 IP 地址 |
| `port` | INTEGER | DEFAULT 22 | SSH 端口 |
| `username` | TEXT | NOT NULL | SSH 登录用户名 |
| `password` | TEXT | — | SSH 密码（AES-256-GCM 加密存储） |
| `private_key` | TEXT | — | SSH 私钥（AES-256-GCM 加密存储） |
| `use_ssh_key` | INTEGER | DEFAULT 0 | 是否使用 SSH 密钥认证 |
| `description` | TEXT | — | 描述信息 |
| `tags` | TEXT | — | 标签（JSON 数组字符串） |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用 |
| `last_connected` | DATETIME | — | 最后连接时间 |
| `os` | TEXT | — | 操作系统类型 |
| `cpu_cores` | INTEGER | — | CPU 核心数 |
| `memory_gb` | REAL | — | 内存大小（GB） |
| `disk_gb` | REAL | — | 磁盘大小（GB） |
| `ip_address` | TEXT | — | 公网 IP |
| `private_ip` | TEXT | — | 私网 IP |
| `cloud_provider` | TEXT | — | 云服务商 |
| `cloud_instance_id` | TEXT | — | 云实例 ID |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_servers_enabled(enabled)`

### C.3.3 server_groups — 服务器分组表

支持树形层级结构的服务器分组。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 分组名称 |
| `description` | TEXT | — | 描述信息 |
| `parent_id` | TEXT | FK → server_groups(id) | 父分组 ID（自引用） |
| `sort_order` | INTEGER | DEFAULT 0 | 排序顺序 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_server_groups_parent(parent_id)`
**外键**: `parent_id` → `server_groups(id)` ON DELETE SET NULL

### C.3.4 server_group_mapping — 服务器分组映射表

多对多关联服务器和分组。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `server_id` | TEXT | PK, FK → servers(id) | 服务器 ID |
| `group_id` | TEXT | PK, FK → server_groups(id) | 分组 ID |

**索引**: `idx_server_group_mapping_server(server_id)`、`idx_server_group_mapping_group(group_id)`
**外键**: `server_id` → `servers(id)` ON DELETE CASCADE; `group_id` → `server_groups(id)` ON DELETE CASCADE

### C.3.5 agents — Agent 表

存储 AI Agent 的配置信息，包括预设 Agent 和自定义 Agent。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | Agent 名称 |
| `avatar` | TEXT | — | 头像 URL |
| `role` | TEXT | — | Agent 角色定位 |
| `system_prompt` | TEXT | — | 系统提示词 |
| `model` | TEXT | DEFAULT 'doubao-4o' | 使用的 AI 模型 |
| `temperature` | REAL | DEFAULT 0.7 | 温度参数 |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用 |
| `is_preset` | INTEGER | DEFAULT 0 | 是否为预设 Agent |
| `category` | TEXT | — | 分类 |
| `tags` | TEXT | — | 标签（JSON） |
| `description` | TEXT | — | 描述 |
| `usage_count` | INTEGER | DEFAULT 0 | 使用次数 |
| `last_used_at` | DATETIME | — | 最后使用时间 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_agents_category(category)`、`idx_agents_usage(usage_count)`、`idx_agents_is_preset(is_preset)`、`idx_agents_enabled(enabled)`

### C.3.6 workflows — 工作流表

存储可视化工作流编辑器的节点和边信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 工作流名称 |
| `description` | TEXT | — | 描述 |
| `nodes` | TEXT | — | 节点配置（JSON） |
| `edges` | TEXT | — | 边配置（JSON） |
| `agent_configs` | TEXT | — | Agent 配置（JSON） |
| `is_template` | INTEGER | DEFAULT 0 | 是否为模板 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_workflows_is_template(is_template)`

## C.4 任务与执行表

### C.4.1 tasks — 任务表

存储工作流执行的任务实例。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `workflow_id` | TEXT | FK → workflows(id) | 关联工作流 ID |
| `name` | TEXT | — | 任务名称 |
| `status` | TEXT | DEFAULT 'pending' | 状态：pending/running/paused/completed/failed/cancelled |
| `start_time` | DATETIME | — | 开始时间 |
| `end_time` | DATETIME | — | 结束时间 |
| `current_node_id` | TEXT | — | 当前执行节点 ID |
| `node_results` | TEXT | — | 节点执行结果（JSON） |
| `logs` | TEXT | — | 执行日志（JSON） |
| `context` | TEXT | — | 执行上下文（JSON） |
| `metrics` | TEXT | — | 执行指标（JSON） |
| `execution_order` | TEXT | — | 执行顺序（JSON） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_tasks_status(status)`、`idx_tasks_created_at(created_at)`

### C.4.2 agent_executions — Agent 执行记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `agent_id` | TEXT | NOT NULL, FK → agents(id) | 关联 Agent |
| `agent_name` | TEXT | — | Agent 名称冗余 |
| `input_text` | TEXT | — | 输入文本 |
| `output_text` | TEXT | — | 输出文本 |
| `status` | TEXT | — | 执行状态 |
| `error_message` | TEXT | — | 错误信息 |
| `execution_time_ms` | INTEGER | — | 执行耗时（毫秒） |
| `token_count` | INTEGER | — | Token 消耗 |
| `metadata` | TEXT | — | 元数据（JSON） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_agent_executions_agent_id(agent_id)`、`idx_agent_executions_created_at(created_at)`、`idx_agent_executions_status(status)`
**外键**: `agent_id` → `agents(id)` ON DELETE CASCADE

### C.4.3 scheduled_tasks — 定时任务表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 任务名称 |
| `description` | TEXT | — | 描述 |
| `workflow_id` | TEXT | NOT NULL, FK → workflows(id) | 关联工作流 |
| `schedule` | TEXT | NOT NULL | Cron 表达式 |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用 |
| `last_run` | DATETIME | — | 上次执行时间 |
| `next_run` | DATETIME | — | 下次执行时间 |
| `context` | TEXT | — | 执行上下文（JSON） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_scheduled_enabled(enabled)`
**外键**: `workflow_id` → `workflows(id)` ON DELETE CASCADE

### C.4.4 server_command_history — 命令执行历史表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `server_id` | TEXT | NOT NULL, FK → servers(id) | 服务器 ID |
| `command` | TEXT | NOT NULL | 执行的命令 |
| `stdout` | TEXT | — | 标准输出 |
| `stderr` | TEXT | — | 标准错误 |
| `success` | INTEGER | DEFAULT 0 | 是否成功 |
| `execution_time_ms` | INTEGER | — | 执行耗时 |
| `executed_by` | TEXT | — | 执行人用户 ID |
| `executed_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 执行时间 |

**索引**: `idx_cmd_history_server_id(server_id)`、`idx_cmd_history_executed_at(executed_at)`
**外键**: `server_id` → `servers(id)` ON DELETE CASCADE

### C.4.5 compliance_checks — 合规检查表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `server_id` | TEXT | NOT NULL, FK → servers(id) | 服务器 ID |
| `check_name` | TEXT | NOT NULL | 检查项名称 |
| `check_results` | TEXT | NOT NULL | 检查结果（JSON） |
| `status` | TEXT | DEFAULT 'pending' | 状态 |
| `started_at` | DATETIME | — | 开始时间 |
| `completed_at` | DATETIME | — | 完成时间 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_compliance_server_id(server_id)`、`idx_compliance_status(status)`、`idx_compliance_created_at(created_at)`
**外键**: `server_id` → `servers(id)` ON DELETE CASCADE

## C.5 告警与通知表

### C.5.1 alerts — 告警表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `source` | TEXT | NOT NULL | 告警来源：zabbix/prometheus/grafana/aliyun/tencent |
| `severity` | TEXT | NOT NULL | 严重程度：critical/warning/info |
| `title` | TEXT | NOT NULL | 告警标题 |
| `content` | TEXT | — | 告警内容 |
| `metadata` | TEXT | — | 元数据（JSON） |
| `related_task_id` | TEXT | — | 关联任务 ID |
| `alert_fingerprint` | TEXT | UNIQUE (partial) | 告警指纹（用于去重） |
| `status` | TEXT | DEFAULT 'new' | 状态：new/acknowledged/resolved/suppressed |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_alerts_status(status)`、`idx_alerts_created_at(created_at)`、`idx_alerts_severity(severity)`、`idx_alerts_source(source, created_at DESC)`、`idx_alerts_status_created(status, created_at DESC)`、`idx_alerts_title(title)`、`idx_alerts_task(related_task_id)`、`idx_alerts_fingerprint_unique(alert_fingerprint) WHERE NOT NULL`

### C.5.2 alert_configs — 告警配置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 配置名称 |
| `level` | TEXT | NOT NULL | 告警级别 |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用 |
| `channels` | TEXT | NOT NULL | 通知渠道（JSON） |
| `webhook_url` | TEXT | — | Webhook URL |
| `email_recipients` | TEXT | — | 邮件接收者 |
| `rate_limit_minutes` | INTEGER | DEFAULT 5 | 频率限制间隔 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_alert_configs_enabled(enabled)`、`idx_alert_configs_level(level)`

### C.5.3 alert_notifications — 告警通知记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `config_id` | TEXT | NOT NULL | 关联配置 ID |
| `level` | TEXT | NOT NULL | 告警级别 |
| `title` | TEXT | NOT NULL | 通知标题 |
| `message` | TEXT | — | 通知内容 |
| `metadata` | TEXT | — | 元数据（JSON） |
| `channels` | TEXT | NOT NULL | 发送渠道（JSON） |
| `status` | TEXT | DEFAULT 'pending' | 发送状态 |
| `triggered_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 触发时间 |

**索引**: `idx_alert_notifications_config_id(config_id)`、`idx_alert_notifications_level(level)`、`idx_alert_notifications_triggered_at(triggered_at)`

### C.5.4 alert_workflow_mappings — 告警-工作流映射表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `alert_source` | TEXT | — | 告警来源 |
| `alert_severity` | TEXT | — | 告警严重程度 |
| `alert_title_pattern` | TEXT | — | 标题匹配模式 |
| `workflow_id` | TEXT | NOT NULL, FK → workflows(id) | 关联工作流 |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_alert_mapping_enabled(enabled)`
**外键**: `workflow_id` → `workflows(id)` ON DELETE CASCADE

### C.5.5 alert_noise_reduction — 告警降噪表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `alert_fingerprint` | TEXT | NOT NULL UNIQUE | 告警指纹 |
| `alert_source` | TEXT | NOT NULL | 告警来源 |
| `alert_title` | TEXT | NOT NULL | 告警标题 |
| `occurrence_count` | INTEGER | DEFAULT 1 | 出现次数 |
| `first_occurrence` | DATETIME | NOT NULL | 首次出现时间 |
| `last_occurrence` | DATETIME | NOT NULL | 最后出现时间 |
| `is_suppressed` | INTEGER | DEFAULT 0 | 是否被抑制 |
| `suppression_reason` | TEXT | — | 抑制原因 |
| `suppression_until` | DATETIME | — | 抑制截止时间 |

**索引**: `idx_noise_reduction_fingerprint(alert_fingerprint)`、`idx_noise_reduction_suppressed(is_suppressed)`、`idx_noise_reduction_last_occurrence(last_occurrence)`

### C.5.6 alert_webhook_logs — Webhook 日志表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `source` | TEXT | NOT NULL | 告警来源 |
| `status` | TEXT | NOT NULL | 处理状态 |
| `alert_count` | INTEGER | DEFAULT 0 | 告警数量 |
| `resolved_count` | INTEGER | DEFAULT 0 | 已解决数量 |
| `error_message` | TEXT | — | 错误信息 |
| `request_body` | TEXT | — | 请求体 |
| `ip_address` | TEXT | — | 请求 IP |
| `user_agent` | TEXT | — | 客户端标识 |
| `processing_time_ms` | INTEGER | — | 处理耗时 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_webhook_logs_source(source)`、`idx_webhook_logs_created(created_at)`、`idx_webhook_logs_status(status)`

### C.5.7 notifications — 通知表

系统内部通知（非告警通知）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `type` | TEXT | NOT NULL | 通知类型 |
| `title` | TEXT | NOT NULL | 通知标题 |
| `content` | TEXT | — | 通知内容 |
| `status` | TEXT | DEFAULT 'unread' | 状态：unread/read |
| `recipient` | TEXT | — | 接收人 |
| `metadata` | TEXT | — | 元数据（JSON） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_notifications_status(status)`、`idx_notifications_created_at(created_at)`

### C.5.8 notification_config — 通知配置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `webhook_enabled` | INTEGER | DEFAULT 1 | Webhook 是否启用 |
| `webhook_url` | TEXT | — | Webhook URL |
| `email_enabled` | INTEGER | DEFAULT 0 | 邮件是否启用 |
| `email_config` | TEXT | — | 邮件配置（JSON） |
| `wechat_enabled` | INTEGER | DEFAULT 0 | 企业微信是否启用 |
| `wechat_config` | TEXT | — | 企业微信配置（JSON） |
| `dingtalk_enabled` | INTEGER | DEFAULT 0 | 钉钉是否启用 |
| `dingtalk_config` | TEXT | — | 钉钉配置（JSON） |
| `alert_notification` | TEXT | — | 告警通知配置（JSON） |
| `task_notification` | TEXT | — | 任务通知配置（JSON） |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

## C.6 自愈与根因分析表

### C.6.1 remediation_policies — 自愈策略表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 策略名称 |
| `description` | TEXT | — | 描述 |
| `alert_source` | TEXT | NOT NULL | 匹配的告警来源 |
| `alert_severity` | TEXT | — | 匹配的严重程度 |
| `alert_keywords` | TEXT | — | 匹配关键词（JSON） |
| `alert_tags` | TEXT | — | 匹配标签（JSON） |
| `execution_mode` | TEXT | NOT NULL DEFAULT 'approval' | 执行模式：approval/auto |
| `workflow_id` | TEXT | — | 关联工作流 |
| `workflow_params` | TEXT | — | 工作流参数（JSON） |
| `max_executions_per_hour` | INTEGER | DEFAULT 5 | 每小时最大执行次数 |
| `cooldown_seconds` | INTEGER | DEFAULT 300 | 冷却时间（秒） |
| `require_confirmations` | TEXT | — | 需要的确认（JSON） |
| `enable_verification` | BOOLEAN | DEFAULT 1 | 是否启用验证 |
| `verification_workflow_id` | TEXT | — | 验证工作流 |
| `verification_params` | TEXT | — | 验证参数 |
| `verification_timeout_seconds` | INTEGER | DEFAULT 120 | 验证超时时间 |
| `enable_rollback` | BOOLEAN | DEFAULT 1 | 是否启用回滚 |
| `rollback_workflow_id` | TEXT | — | 回滚工作流 |
| `rollback_on_failure` | BOOLEAN | DEFAULT 1 | 失败时是否回滚 |
| `enabled` | BOOLEAN | DEFAULT 1 | 是否启用 |
| `created_by` | TEXT | — | 创建人 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_remediation_policies_alert_source(alert_source)`、`idx_remediation_policies_enabled(enabled)`、`idx_remediation_policies_execution_mode(execution_mode)`

### C.6.2 remediation_executions — 自愈执行记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `policy_id` | TEXT | NOT NULL, FK → remediation_policies(id) | 策略 ID |
| `alert_id` | TEXT | NOT NULL, FK → alerts(id) | 告警 ID |
| `alert_snapshot` | TEXT | — | 告警快照（JSON） |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | 状态 |
| `status_reason` | TEXT | — | 状态原因 |
| `approval_required` | BOOLEAN | DEFAULT 0 | 是否需要审批 |
| `approved_by` | TEXT | — | 审批人 |
| `approved_at` | DATETIME | — | 审批时间 |
| `approval_comment` | TEXT | — | 审批备注 |
| `workflow_execution_id` | TEXT | — | 工作流执行 ID |
| `started_at` | DATETIME | — | 开始时间 |
| `completed_at` | DATETIME | — | 完成时间 |
| `execution_result` | TEXT | — | 执行结果 |
| `verification_status` | TEXT | — | 验证状态 |
| `verification_result` | TEXT | — | 验证结果 |
| `verification_completed_at` | DATETIME | — | 验证完成时间 |
| `rollback_triggered` | BOOLEAN | DEFAULT 0 | 是否触发回滚 |
| `rollback_execution_id` | TEXT | — | 回滚执行 ID |
| `rollback_completed_at` | DATETIME | — | 回滚完成时间 |
| `rollback_result` | TEXT | — | 回滚结果 |
| `execution_duration_ms` | INTEGER | — | 执行耗时 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_remediation_executions_policy(policy_id)`、`idx_remediation_executions_alert(alert_id)`、`idx_remediation_executions_status(status)`、`idx_remediation_executions_created(created_at)`
**外键**: `policy_id` → `remediation_policies(id)`; `alert_id` → `alerts(id)` ON DELETE CASCADE

### C.6.3 remediation_history — 自愈历史表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `policy_id` | TEXT | NOT NULL, FK → remediation_policies(id) | 策略 ID |
| `alert_source` | TEXT | — | 告警来源 |
| `alert_severity` | TEXT | — | 告警严重程度 |
| `execution_status` | TEXT | — | 执行状态 |
| `root_cause` | TEXT | — | 根因分析 |
| `resolution` | TEXT | — | 解决方案 |
| `duration_ms` | INTEGER | — | 处理耗时 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_remediation_history_policy(policy_id)`、`idx_remediation_history_status(execution_status)`

### C.6.4 remediation_cooldowns — 自愈冷却表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `policy_id` | TEXT | PK, FK → remediation_policies(id) | 策略 ID |
| `alert_id` | TEXT | PK, FK → alerts(id) | 告警 ID |
| `cooldown_until` | DATETIME | NOT NULL | 冷却截止时间 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_remediation_cooldowns_until(cooldown_until)`
**外键**: `policy_id` → `remediation_policies(id)` ON DELETE CASCADE; `alert_id` → `alerts(id)` ON DELETE CASCADE

### C.6.5 root_cause_analyses — 根因分析表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `alert_id` | TEXT | FK → alerts(id) | 关联告警 |
| `title` | TEXT | NOT NULL | 分析标题 |
| `description` | TEXT | — | 描述 |
| `status` | TEXT | DEFAULT 'pending' | 状态：pending/in_progress/completed/failed |
| `root_cause` | TEXT | — | 根因结论 |
| `symptoms` | TEXT | — | 症状列表（JSON） |
| `timeline` | TEXT | — | 时间线（JSON） |
| `evidence` | TEXT | — | 证据（JSON） |
| `recommendations` | TEXT | — | 建议措施（JSON） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |
| `completed_at` | DATETIME | — | 完成时间 |

**索引**: `idx_rca_alert_id(alert_id)`、`idx_rca_status(status)`、`idx_rca_created(created_at)`
**外键**: `alert_id` → `alerts(id)`

## C.7 知识与脚本表

### C.7.1 knowledge_base — 知识库表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `title` | TEXT | NOT NULL | 知识标题 |
| `category` | TEXT | — | 分类 |
| `content` | TEXT | NOT NULL | 知识内容 |
| `tags` | TEXT | — | 标签（JSON） |
| `solutions` | TEXT | — | 解决方案（JSON） |
| `related_alerts` | TEXT | — | 关联告警（JSON） |
| `usage_count` | INTEGER | DEFAULT 0 | 使用次数 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_kb_category(category)`、`idx_kb_usage(usage_count)`

### C.7.2 scripts — 脚本表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 脚本名称 |
| `description` | TEXT | — | 描述 |
| `content` | TEXT | NOT NULL | 脚本内容 |
| `language` | TEXT | DEFAULT 'bash' | 脚本语言 |
| `tags` | TEXT | — | 标签（JSON） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

## C.8 报告表

### C.8.1 reports — 报告表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 报告名称 |
| `type` | TEXT | NOT NULL DEFAULT 'generated' | 类型：generated/template |
| `content` | TEXT | — | 报告内容 |
| `format` | TEXT | DEFAULT 'markdown' | 格式：markdown/pdf/html |
| `template_id` | TEXT | FK → reports(id) | 关联模板 ID |
| `task_id` | TEXT | — | 关联任务 ID |
| `variables` | TEXT | — | 报告变量（JSON） |
| `metadata` | TEXT | — | 元数据（JSON） |
| `is_preset` | INTEGER | DEFAULT 0 | 是否为预设 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_reports_type(type)`、`idx_reports_task_id(task_id)`、`idx_reports_template_id(template_id)`、`idx_reports_is_preset(is_preset)`、`idx_reports_created_at(created_at DESC)`

### C.8.2 report_schedules — 定时报告表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `name` | TEXT | NOT NULL | 报告名称 |
| `template_id` | TEXT | NOT NULL, FK → reports(id) | 关联模板 |
| `cron_expression` | TEXT | NOT NULL | Cron 表达式 |
| `enabled` | INTEGER | DEFAULT 1 | 是否启用 |
| `recipients` | TEXT | — | 接收人（JSON） |
| `format` | TEXT | DEFAULT 'markdown' | 输出格式 |
| `last_generated` | DATETIME | — | 最后生成时间 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_report_schedules_enabled(enabled)`、`idx_report_schedules_template(template_id)`
**外键**: `template_id` → `reports(id)` ON DELETE CASCADE

## C.9 运维与安全表

### C.9.1 audit_logs — 审计日志表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `user_id` | TEXT | — | 操作用户 ID |
| `action` | TEXT | NOT NULL | 操作类型：login/logout/create/update/delete/execute 等 |
| `resource_type` | TEXT | — | 资源类型 |
| `resource_id` | TEXT | — | 资源 ID |
| `details` | TEXT | — | 操作详情（JSON） |
| `ip_address` | TEXT | — | 操作 IP |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_audit_user(user_id)`、`idx_audit_created_at(created_at)`

### C.9.2 settings — 系统设置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 自增主键 |
| `key` | TEXT | UNIQUE NOT NULL | 配置键名 |
| `value` | TEXT | — | 配置值 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_settings_key(key)`

### C.9.3 token_blacklist — Token 黑名单表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `token` | TEXT | NOT NULL UNIQUE | 被加入黑名单的 Token |
| `user_id` | TEXT | — | 关联用户 |
| `reason` | TEXT | — | 加入黑名单原因 |
| `expires_at` | DATETIME | NOT NULL | Token 过期时间 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_token_blacklist_token(token)`、`idx_token_blacklist_expires(expires_at)`

### C.9.4 encryption_keys — 加密密钥表

存储用于 AES-256-GCM 加密的密钥。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `key_type` | TEXT | NOT NULL | 密钥类型 |
| `key_value` | TEXT | NOT NULL | 密钥值 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `active` | INTEGER | DEFAULT 1 | 是否活跃 |

**索引**: `idx_encryption_active(active)`

## C.10 监控与辅助表

### C.10.1 server_metrics — 服务器指标表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `server_id` | TEXT | NOT NULL, FK → servers(id) | 服务器 ID |
| `cpu_usage` | REAL | — | CPU 使用率 (%) |
| `memory_usage` | REAL | — | 内存使用率 (%) |
| `memory_total_gb` | REAL | — | 内存总量（GB） |
| `memory_used_gb` | REAL | — | 内存已用（GB） |
| `disk_usage` | REAL | — | 磁盘使用率 (%) |
| `disk_total_gb` | REAL | — | 磁盘总量（GB） |
| `disk_used_gb` | REAL | — | 磁盘已用（GB） |
| `network_in_mbps` | REAL | — | 网络入站（Mbps） |
| `network_out_mbps` | REAL | — | 网络出站（Mbps） |
| `load_1min` | REAL | — | 1 分钟负载 |
| `load_5min` | REAL | — | 5 分钟负载 |
| `load_15min` | REAL | — | 15 分钟负载 |
| `uptime_seconds` | INTEGER | — | 运行时长（秒） |
| `collected_at` | DATETIME | — | 采集时间 |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**: `idx_server_metrics_server(server_id)`、`idx_server_metrics_collected(collected_at)`
**外键**: `server_id` → `servers(id)` ON DELETE CASCADE

### C.10.2 copilot_conversations — Copilot 对话表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID 主键 |
| `user_id` | TEXT | NOT NULL | 用户 ID |
| `messages` | TEXT | NOT NULL | 对话消息（JSON 数组） |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**索引**: `idx_copilot_user_id(user_id)`

## C.11 表关系图

```
┌──────────┐     1:N      ┌─────────────────────┐
│  users   │◄─────────────│  audit_logs          │
│          │     1:N      │  (user_id)           │
│          ├─────────────►│                      │
│          │     1:N      └─────────────────────┘
│          ├─────────────►┌─────────────────────┐
│          │              │  notifications       │
│          │              │  (recipient)          │
└──────────┘              └─────────────────────┘

┌──────────────┐    1:N     ┌──────────────────────────┐
│server_groups │◄───────────│  server_group_mapping    │
│              │    1:N     │  (server_id, group_id)   │
│              ├───────────►│                          │
│ (self-ref)   │    M:N     └────────────┬─────────────┘
│              │                         │
└──────────────┘                         │ 1:N
                                         ▼
                               ┌─────────────────────┐
                               │     servers          │
                               │                     │
                               │ 1:N                 │
                               ▼                     │ 1:N
┌──────────────────────┐    ┌──────────────────┐    │
│ server_command_history│    │ compliance_checks│    │
│ (server_id)          │    │ (server_id)      │    │
└──────────────────────┘    └──────────────────┘    │
                                                    │
                                       ┌────────────┘ 1:N
                                       ▼
                              ┌──────────────────┐
                              │ server_metrics   │
                              │ (server_id)      │
                              └──────────────────┘

┌──────────┐     1:N      ┌─────────────────────┐
│  agents  │◄─────────────│  agent_executions   │
│          │              │  (agent_id)          │
└──────────┘              └─────────────────────┘

┌───────────┐    1:N      ┌─────────────────────┐
│ workflows │◄────────────│  tasks              │
│           │    1:N      │  (workflow_id)      │
│           ├────────────►│                     │
│           │    1:N      └─────────────────────┘
│           ├────────────►┌─────────────────────┐
│           │             │ scheduled_tasks     │
│           │             │ (workflow_id)       │
│           │             └─────────────────────┘
│           │    1:N      ┌─────────────────────┐
│           ├────────────►│alert_workflow_mapping│
│           │             │ (workflow_id)       │
└───────────┘             └─────────────────────┘

┌──────────┐     1:N      ┌─────────────────────┐
│  alerts  │◄─────────────│ root_cause_analyses │
│          │    1:N       │ (alert_id)          │
│          ├─────────────►│                     │
│          │    1:N       └─────────────────────┘
│          ├─────────────►┌─────────────────────┐
│          │              │remediation_executions│
│          │              │ (alert_id)           │
│          │              └─────────────────────┘
│          │    1:N       ┌─────────────────────┐
│          ├─────────────►│remediation_cooldowns │
│          │              │ (alert_id)           │
└──────────┘              └─────────────────────┘

┌───────────────────┐  1:N  ┌─────────────────────┐
│remediation_policies│◄─────│remediation_executions │
│                   │  1:N  │ (policy_id)          │
│                   ├──────►│                      │
│                   │  1:N  └─────────────────────┘
│                   ├──────►┌─────────────────────┐
│                   │       │remediation_history   │
│                   │       │ (policy_id)          │
└───────────────────┘       └─────────────────────┘

┌──────────┐     1:N      ┌─────────────────────┐
│ reports  │◄─────────────│ report_schedules    │
│(template)│              │ (template_id)       │
└──────────┘              └─────────────────────┘
```

## C.12 数据库维护命令

### 常用 PRAGMA 命令

```sql
-- 检查数据库完整性
PRAGMA integrity_check;

-- 查看外键约束状态
PRAGMA foreign_key_check;

-- 查看数据库大小信息
PRAGMA page_count;
PRAGMA page_size;

-- 重建数据库释放空间
VACUUM;

-- 更新查询优化器统计信息
ANALYZE;
```

### 常用查询

```sql
-- 查看所有表
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- 查看表结构
PRAGMA table_info(table_name);

-- 查看表的索引
PRAGMA index_list(table_name);

-- 查看索引详情
PRAGMA index_info(index_name);

-- 查看某表数据量
SELECT COUNT(*) FROM table_name;

-- 查看所有表的数据量
SELECT name,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = t.name) as row_count
FROM sqlite_master t
WHERE type='table' AND name NOT LIKE 'sqlite_%'
ORDER BY row_count DESC;
```

## C.13 索引清单

| 表名 | 索引名 | 字段 | 类型 |
|------|--------|------|------|
| servers | idx_servers_enabled | enabled | 普通 |
| server_groups | idx_server_groups_parent | parent_id | 普通 |
| server_group_mapping | idx_server_group_mapping_server | server_id | 普通 |
| server_group_mapping | idx_server_group_mapping_group | group_id | 普通 |
| server_command_history | idx_cmd_history_server_id | server_id | 普通 |
| server_command_history | idx_cmd_history_executed_at | executed_at | 普通 |
| compliance_checks | idx_compliance_server_id | server_id | 普通 |
| compliance_checks | idx_compliance_status | status | 普通 |
| compliance_checks | idx_compliance_created_at | created_at | 普通 |
| encryption_keys | idx_encryption_active | active | 普通 |
| agents | idx_agents_category | category | 普通 |
| agents | idx_agents_usage | usage_count | 普通 |
| agents | idx_agents_is_preset | is_preset | 普通 |
| agents | idx_agents_enabled | enabled | 普通 |
| agent_executions | idx_agent_executions_agent_id | agent_id | 普通 |
| agent_executions | idx_agent_executions_created_at | created_at | 普通 |
| agent_executions | idx_agent_executions_status | status | 普通 |
| workflows | idx_workflows_is_template | is_template | 普通 |
| tasks | idx_tasks_status | status | 普通 |
| tasks | idx_tasks_created_at | created_at | 普通 |
| alerts | idx_alerts_status | status | 普通 |
| alerts | idx_alerts_created_at | created_at | 普通 |
| alerts | idx_alerts_severity | severity | 普通 |
| alerts | idx_alerts_source_created | source, created_at DESC | 复合 |
| alerts | idx_alerts_status_created | status, created_at DESC | 复合 |
| alerts | idx_alerts_title | title | 普通 |
| alerts | idx_alerts_task | related_task_id | 普通 |
| alerts | idx_alerts_fingerprint_unique | alert_fingerprint | 唯一(部分) |
| knowledge_base | idx_kb_category | category | 普通 |
| knowledge_base | idx_kb_usage | usage_count | 普通 |
| reports | idx_reports_type | type | 普通 |
| reports | idx_reports_task_id | task_id | 普通 |
| reports | idx_reports_template_id | template_id | 普通 |
| reports | idx_reports_is_preset | is_preset | 普通 |
| reports | idx_reports_created_at | created_at DESC | 普通 |
| report_schedules | idx_report_schedules_enabled | enabled | 普通 |
| report_schedules | idx_report_schedules_template | template_id | 普通 |
| scheduled_tasks | idx_scheduled_enabled | enabled | 普通 |
| alert_workflow_mappings | idx_alert_mapping_enabled | enabled | 普通 |
| settings | idx_settings_key | key | 普通 |
| audit_logs | idx_audit_user | user_id | 普通 |
| audit_logs | idx_audit_created_at | created_at | 普通 |
| notifications | idx_notifications_status | status | 普通 |
| notifications | idx_notifications_created_at | created_at | 普通 |
| root_cause_analyses | idx_rca_alert_id | alert_id | 普通 |
| root_cause_analyses | idx_rca_status | status | 普通 |
| root_cause_analyses | idx_rca_created | created_at | 普通 |
| copilot_conversations | idx_copilot_user_id | user_id | 普通 |
| alert_configs | idx_alert_configs_enabled | enabled | 普通 |
| alert_configs | idx_alert_configs_level | level | 普通 |
| alert_notifications | idx_alert_notifications_config_id | config_id | 普通 |
| alert_notifications | idx_alert_notifications_level | level | 普通 |
| alert_notifications | idx_alert_notifications_triggered_at | triggered_at | 普通 |
| token_blacklist | idx_token_blacklist_token | token | 普通 |
| token_blacklist | idx_token_blacklist_expires | expires_at | 普通 |
| remediation_policies | idx_remediation_policies_alert_source | alert_source | 普通 |
| remediation_policies | idx_remediation_policies_enabled | enabled | 普通 |
| remediation_policies | idx_remediation_policies_execution_mode | execution_mode | 普通 |
| remediation_executions | idx_remediation_executions_policy | policy_id | 普通 |
| remediation_executions | idx_remediation_executions_alert | alert_id | 普通 |
| remediation_executions | idx_remediation_executions_status | status | 普通 |
| remediation_executions | idx_remediation_executions_created | created_at | 普通 |
| remediation_history | idx_remediation_history_policy | policy_id | 普通 |
| remediation_history | idx_remediation_history_status | execution_status | 普通 |
| remediation_cooldowns | idx_remediation_cooldowns_until | cooldown_until | 普通 |
| server_metrics | idx_server_metrics_server | server_id | 普通 |
| server_metrics | idx_server_metrics_collected | collected_at | 普通 |
| alert_webhook_logs | idx_webhook_logs_source | source | 普通 |
| alert_webhook_logs | idx_webhook_logs_created | created_at | 普通 |
| alert_webhook_logs | idx_webhook_logs_status | status | 普通 |
| alert_noise_reduction | idx_noise_reduction_fingerprint | alert_fingerprint | 普通 |
| alert_noise_reduction | idx_noise_reduction_suppressed | is_suppressed | 普通 |
| alert_noise_reduction | idx_noise_reduction_last_occurrence | last_occurrence | 普通 |
| report_schedules | idx_report_schedules_enabled | enabled | 普通 |
| report_schedules | idx_report_schedules_template | template_id | 普通 |
