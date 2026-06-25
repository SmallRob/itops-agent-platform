# 自动修复域 - API 定义

> **层级**：L3 详细内容

## 执行记录 `/api/remediation-executions`

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/remediation-executions` | 获取执行记录 |
| GET | `/api/remediation-executions/:id` | 获取详情 |
| POST | `/api/remediation-executions/:id/approve` | 审批 |
| POST | `/api/remediation-executions/:id/retry` | 重试 |

## 审计管理 `/api/remediation-audits`

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/remediation-audits` | 获取审计列表 |
| POST | `/api/remediation-audits` | 创建审计 |
| POST | `/api/remediation-audits/:id/approve` | 审批审计 |
| POST | `/api/remediation-audits/:id/execute` | 执行审计 |

---

*生成时间：2026-06-21*