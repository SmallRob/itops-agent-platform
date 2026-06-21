# 服务器域 - 实体定义

> **层级**：L3 详细内容

## Server（服务器）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 服务器名称 |
| hostname | TEXT | 主机名/IP |
| port | INTEGER | SSH 端口，默认 22 |
| username | TEXT | 登录用户名 |
| password | TEXT | 加密后的密码 |
| private_key | TEXT | 加密后的私钥 |
| ssh_key_id | TEXT | 关联 SSH 密钥 ID |
| enabled | INTEGER | 是否启用 |
| created_at | DATETIME | 创建时间 |

## SSHKey（SSH 密钥）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT (UUID) | 主键 |
| name | TEXT | 密钥名称 |
| auth_type | TEXT | 认证类型：key/password |
| private_key | TEXT | 加密后的私钥 |
| password | TEXT | 加密后的密码 |
| created_at | DATETIME | 创建时间 |

## Credential（凭据）

| 字段 | 类型 | 说明 |
|------|------|------|
| provider | TEXT | 提供者标识（主键） |
| encrypted_value | TEXT | 加密后的值 |
| created_at | DATETIME | 创建时间 |

---

*生成时间：2026-06-21*