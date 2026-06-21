# 自动修复域 - API 定义

## 1. 自愈执行 `/api/remediation-executions`

**路由文件**：`remediationExecutionRoutes.ts`

### GET `/`
获取执行记录列表。
- 参数：`policy_id`, `alert_id`, `status`, `page`, `limit`
- 响应：`{ success, data: { executions, total } }`

### GET `/:id`
获取执行记录详情。

### POST `/:id/approve`
审批执行请求。
- 请求：`{ action: "approve|reject", comment }`
- 响应：`{ success, message }`

### POST `/:id/retry`
重试失败执行。

### POST `/`
创建修复审计（需认证）。
- 请求：`{ rca_id, policy_id, server_id, risk_level }`

### POST `/:id/execute`
执行修复审计（需认证）。

### POST `/:id/rollback`
回滚修复（需认证）。

### POST `/:id/verify`
验证修复结果（需认证）。

---

## 2. 修复审计 `/api/remediation-audits`

**路由文件**：`remediationAuditRoutes.ts`

### GET `/`
获取审计列表。
- 参数：`status`, `risk_level`, `page`, `limit`
- 响应：`{ success, data: { audits, total } }`

### POST `/`
创建审计。
- 请求：`{ rca_id, policy_id, server_id, risk_level, recommendations }`
- 响应：201

### POST `/:id/approve`
审批审计。
- 请求：`{ action, comment }`

### POST `/:id/execute`
执行审计。

### POST `/:id/verify`
验证结果。

### GET `/:id`
获取审计详情。

---

## 3. 统一格式

**成功**：`{ success: true, data, message? }`
**错误**：`{ success: false, message }`

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

**认证**：需认证接口需请求头 `Authorization: Bearer <token>`
