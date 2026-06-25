# 自动修复域 - 实体定义

## 1. RemediationPolicy（修复策略）

定义告警触发后的修复行为规则。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `name` | string | 策略名称 |
| `alert_source` | string | 告警来源（zabbix/prometheus/*） |
| `alert_severity` | string? | 最低匹配级别 |
| `alert_keywords` | JSON? | 关键词数组，`__catch_all__` 匹配全部 |
| `alert_tags` | JSON? | 标签数组 |
| `execution_mode` | enum | auto/approval/suggestion |
| `workflow_id` | string? | 修复工作流 ID |
| `workflow_params` | JSON? | 参数模板（`{{alert.xxx}}`） |
| `max_executions_per_hour` | number | 每小时最大执行次数 |
| `cooldown_seconds` | number | 冷却间隔 |
| `enable_verification` | 0/1 | 启用验证 |
| `verification_workflow_id` | string? | 验证工作流 ID |
| `enable_rollback` | 0/1 | 启用回滚 |
| `rollback_workflow_id` | string? | 回滚工作流 ID |
| `enabled` | 0/1 | 启用状态 |

## 2. RemediationExecution（执行记录）

每次修复触发的执行过程和结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `policy_id` | string | 策略 ID |
| `alert_id` | string | 告警 ID |
| `alert_snapshot` | JSON? | 告警快照 |
| `status` | enum | 执行状态 |
| `approval_required` | 0/1 | 需审批 |
| `approved_by` | string? | 审批人 |
| `workflow_execution_id` | string? | 任务 ID |
| `started_at` | string? | 开始时间 |
| `completed_at` | string? | 完成时间 |
| `execution_result` | JSON? | 执行结果 |
| `verification_status` | enum? | pending/success/failed |
| `rollback_triggered` | 0/1 | 已回滚 |
| `execution_duration_ms` | number? | 执行耗时 |

**状态流转**：pending → waiting_approval → approved → running → success/failed → rolled_back

## 3. RemediationAudit（修复审计）

RCA 驱动的修复审批和执行记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `rca_id` | string | 根因分析 ID |
| `policy_id` | string? | 策略 ID |
| `server_id` | string | 目标服务器 |
| `risk_level` | string | low/medium/high |
| `status` | enum | pending/approved/executing/success/failed/rolled_back |
| `execution_log` | string? | 执行日志 |
| `result` | JSON? | 执行结果 |
| `is_rollback` | 0/1 | 已回滚 |

## 4. AiRemediationRecord（AI 修复记录）

AI 分析后自动生成的修复记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `alert_id` | string | 告警 ID |
| `device_id` | string | 设备 ID |
| `diagnosis` | string | AI 诊断 |
| `remediation_commands` | string[] | 修复命令 |
| `risk_level` | enum | low/medium/high |
| `status` | enum | pending/waiting_approval/approved/executing/completed/failed |
| `task_id` | string? | 任务 ID |
| `workflow_id` | string? | 工作流 ID |

## 5. RootCauseAnalysis（根因分析）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `alert_id` | string? | 告警 ID |
| `title` | string | 分析标题 |
| `status` | enum | pending/analyzing/completed/failed |
| `root_cause` | string? | 根因描述 |
| `symptoms` | JSON? | 症状列表 |
| `timeline` | JSON? | 时间线 |
| `evidence` | JSON? | 证据 |
| `recommendations` | JSON? | 修复建议 |

## 6. PolicyStats（策略统计）

非持久化，查询时计算。

| 字段 | 说明 |
|------|------|
| `total_triggers` | 总触发次数 |
| `success_count` | 成功次数 |
| `success_rate` | 成功率 |
| `avg_duration_ms` | 平均耗时 |
| `daily_stats` | 每日统计 |

## 7. 辅助表

| 表名 | 用途 |
|------|------|
| `remediation_cooldowns` | 策略+告警冷却状态 |
| `remediation_history` | 修复执行历史 |
