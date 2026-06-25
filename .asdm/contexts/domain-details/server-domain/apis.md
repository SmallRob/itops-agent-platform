# 服务器域 - API 定义

> **层级**：L3 详细内容

## 服务器管理 `/api/servers`

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/servers` | 获取服务器列表 |
| GET | `/api/servers/:id` | 获取单个服务器 |
| POST | `/api/servers` | 创建服务器 |
| PUT | `/api/servers/:id` | 更新服务器 |
| DELETE | `/api/servers/:id` | 删除服务器 |
| GET | `/api/servers/:id/command-history` | 命令历史 |
| GET | `/api/servers/:id/compliance-history` | 合规检查历史 |

## SSH 密钥管理 `/api/ssh-keys`

| Method | Path | 描述 |
|--------|------|------|
| GET | `/api/ssh-keys` | 获取密钥列表 |
| GET | `/api/ssh-keys/:id` | 获取单个密钥 |
| POST | `/api/ssh-keys` | 创建密钥 |
| PUT | `/api/ssh-keys/:id` | 更新密钥 |
| DELETE | `/api/ssh-keys/:id` | 删除密钥 |
| GET | `/api/ssh-keys/:id/usage` | 使用情况 |

---

*生成时间：2026-06-21*