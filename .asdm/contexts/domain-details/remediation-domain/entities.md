# 自动修复域 - 实体定义

> **层级**：L3 详细内容

## RemediationPolicy（修复策略）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | string | 策略名称 |
| alert_source | string | 告警来源 |
| alert_severity | string | 最低匹配级别 |
| alert_keywords | JSON | 关键词数组 |
| execution_mode | enum | auto/approval/suggestion |
| workflow_id | string | 修复工作流 ID |
| enabled | 0/1 | 启用状态 |

## RemediationExecution（执行记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| policy_id | string | 策略 ID |
| alert_id | string | 告警 ID |
| status | enum | 执行状态 |
| approval_required | 0/1 | 需审批 |
| workflow_execution_id | string | 任务 ID |

**状态流转**：pending → waiting_approval → approved → running → success/failed

## AiRemediationRecord（AI 修复记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| alert_id | string | 告警 ID |
| diagnosis | string | AI 诊断 |
| remediation_commands | string[] | 修复命令 |
| risk_level | enum | low/medium/high |
| status | enum | pending/waiting_approval/approved/executing/completed/failed |

---

*生成时间：2026-06-21*