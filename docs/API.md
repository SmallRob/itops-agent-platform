# API 文档

本文档详细描述了企业IT运维多Agent自动化平台的所有API接口。

## 基础信息

- **Base URL**: `http://localhost:3001`
- **认证方式**: JWT Bearer Token
- **数据格式**: JSON

## 认证

### 登录

```HTTP
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

**响应:**

```JSON
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 使用Token

在后续请求的Header中添加：

```
Authorization: Bearer <your_token>
```

## 服务器管理

### 获取服务器列表

```http
GET /api/servers
Authorization: Bearer <token>
```

### 获取单个服务器

```http
GET /api/servers/:id
Authorization: Bearer <token>
```

### 创建服务器

```http
POST /api/servers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "生产服务器",
  "host": "192.168.1.100",
  "port": 22,
  "username": "root",
  "authType": "password",
  "password": "your_password",
  "description": "生产环境服务器",
  "tags": "生产,Web"
}
```

### 更新服务器

```http
PUT /api/servers/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新后的名称",
  "description": "新的描述"
}
```

### 删除服务器

```http
DELETE /api/servers/:id
Authorization: Bearer <token>
```

### 测试服务器连接

```http
POST /api/servers/:id/test
Authorization: Bearer <token>
```

### 执行命令

```http
POST /api/servers/:id/exec
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "df -h"
}
```

### 获取命令历史

```http
GET /api/servers/:id/command-history
Authorization: Bearer <token>
```

### 执行合规检查

```http
POST /api/servers/:id/compliance
Authorization: Bearer <token>
```

### 获取合规检查历史

```http
GET /api/servers/:id/compliance-history
Authorization: Bearer <token>
```

## Agent管理

### 获取Agent列表

```http
GET /api/agents
Authorization: Bearer <token>
```

### 获取单个Agent

```http
GET /api/agents/:id
Authorization: Bearer <token>
```

### 创建Agent

```http
POST /api/agents
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "自定义Agent",
  "emoji": "🤖",
  "description": "Agent描述",
  "systemPrompt": "系统提示词",
  "config": {}
}
```

### 更新Agent

```http
PUT /api/agents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新后的名称",
  "description": "新的描述"
}
```

### 删除Agent

```http
DELETE /api/agents/:id
Authorization: Bearer <token>
```

## 工作流管理

### 获取工作流列表

```http
GET /api/workflows
Authorization: Bearer <token>
```

### 获取单个工作流

```http
GET /api/workflows/:id
Authorization: Bearer <token>
```

### 创建工作流

```http
POST /api/workflows
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "自定义工作流",
  "description": "工作流描述",
  "nodes": [],
  "edges": []
}
```

### 更新工作流

```http
PUT /api/workflows/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新后的名称",
  "nodes": [],
  "edges": []
}
```

### 删除工作流

```http
DELETE /api/workflows/:id
Authorization: Bearer <token>
```

## 任务执行

### 获取任务列表

```http
GET /api/tasks
Authorization: Bearer <token>
```

### 获取任务详情

```http
GET /api/tasks/:id
Authorization: Bearer <token>
```

### 创建并启动任务

```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "workflowId": 1,
  "context": {
    "serverId": 1
  }
}
```

### 暂停任务

```http
PUT /api/tasks/:id/pause
Authorization: Bearer <token>
```

### 继续任务

```http
PUT /api/tasks/:id/resume
Authorization: Bearer <token>
```

### 取消任务

```http
PUT /api/tasks/:id/cancel
Authorization: Bearer <token>
```

## 告警管理

### 获取告警列表

```http
GET /api/alerts
Authorization: Bearer <token>

# 查询参数
?source=zabbix
&severity=critical
&status=open
```

### 创建告警

```http
POST /api/alerts
Authorization: Bearer <token>
Content-Type: application/json

{
  "source": "manual",
  "severity": "medium",
  "title": "告警标题",
  "content": "告警详细内容"
}
```

### 确认告警

```http
PUT /api/alerts/:id/acknowledge
Authorization: Bearer <token>
```

### 解决告警

```http
PUT /api/alerts/:id/resolve
Authorization: Bearer <token>
```

## 告警自动处理

### 获取映射列表

```http
GET /api/alert-mappings
Authorization: Bearer <token>
```

### 创建映射

```http
POST /api/alert-mappings
Authorization: Bearer <token>
Content-Type: application/json

{
  "source": "zabbix",
  "severity": "critical",
  "titlePattern": "CPU",
  "workflowId": 1,
  "enabled": true
}
```

### 更新映射

```http
PUT /api/alert-mappings/:id
Authorization: Bearer <token>
```

### 删除映射

```http
DELETE /api/alert-mappings/:id
Authorization: Bearer <token>
```

## 告警降噪

### 获取降噪规则

```http
GET /api/alert-noise
Authorization: Bearer <token>
```

### 创建降噪规则

```http
POST /api/alert-noise
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "规则名称",
  "type": "merge",
  "config": {}
}
```

## 根因分析

### 分析告警根因

```http
POST /api/root-cause-analysis
Authorization: Bearer <token>
Content-Type: application/json

{
  "alertId": 1
}
```

### 获取分析历史

```http
GET /api/root-cause-analysis/:alertId
Authorization: Bearer <token>
```

## 脚本管理

### 获取脚本列表

```http
GET /api/scripts
Authorization: Bearer <token>
```

### 创建脚本

```http
POST /api/scripts
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "脚本名称",
  "content": "#!/bin/bash\necho hello",
  "description": "描述",
  "category": "系统监控"
}
```

### 执行脚本

```http
POST /api/scripts/:id/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "serverId": 1,
  "params": {}
}
```

## 定时任务

### 获取定时任务列表

```http
GET /api/scheduled-tasks
Authorization: Bearer <token>
```

### 创建定时任务

```http
POST /api/scheduled-tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "任务名称",
  "description": "描述",
  "cronExpression": "0 0 * * *",
  "workflowId": 1,
  "enabled": true
}
```

### 立即执行定时任务

```http
POST /api/scheduled-tasks/:id/trigger
Authorization: Bearer <token>
```

## 报告系统

### 生成报告

```http
POST /api/reports/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "templateId": 1,
  "variables": {}
}
```

### 获取报告Markdown

```http
GET /api/reports/:taskId/markdown
Authorization: Bearer <token>
```

## 知识库

### 获取知识列表

```http
GET /api/knowledge
Authorization: Bearer <token>
```

### 搜索知识

```http
GET /api/knowledge/search?q=关键词
Authorization: Bearer <token>
```

### 创建知识条目

```http
POST /api/knowledge
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "标题",
  "content": "内容",
  "category": "分类",
  "tags": "标签"
}
```

## 审计日志

### 获取审计日志

```http
GET /api/audit-logs
Authorization: Bearer <token>

# 查询参数
?userId=1
&action=create
&startDate=2024-01-01
&endDate=2024-12-31
```

## 通知系统

### 获取通知列表

```http
GET /api/notifications
Authorization: Bearer <token>
```

### 标记为已读

```http
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

### 通知配置

```http
GET /api/notification-configs
POST /api/notification-configs
PUT /api/notification-configs/:id
DELETE /api/notification-configs/:id
```

## 用户管理

### 获取用户列表

```http
GET /api/users
Authorization: Bearer <token>
```

### 创建用户

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123",
  "role": "operator"
}
```

### 更新用户

```http
PUT /api/users/:id
Authorization: Bearer <token>
```

### 删除用户

```http
DELETE /api/users/:id
Authorization: Bearer <token>
```

## 系统设置

### 获取设置

```http
GET /api/settings
Authorization: Bearer <token>
```

### 更新设置

```http
PUT /api/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "doubanApiKey": "your_key",
  "openaiApiKey": "your_key"
}
```

## Webhook

### Prometheus Alertmanager

```http
POST /api/webhooks/prometheus
Content-Type: application/json

{
  "alerts": [...]
}
```

### Zabbix

```http
POST /api/webhooks/zabbix
Content-Type: application/json

{
  "trigger": "告警名称",
  "host": "主机名",
  "severity": "high"
}
```

### 通用Webhook

```http
POST /api/webhooks/generic
Content-Type: application/json

{
  "source": "your-system",
  "severity": "medium",
  "title": "标题",
  "content": "内容"
}
```

## Copilot

### 发送消息

```http
POST /api/copilot/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "帮我检查服务器状态"
}
```

## 仪表盘

### 获取仪表盘数据

```http
GET /api/dashboard
Authorization: Bearer <token>
```

### 获取告警趋势

```http
GET /api/dashboard/alert-trends
Authorization: Bearer <token>

# 查询参数
?days=7
```

### 获取任务统计

```http
GET /api/dashboard/task-stats
Authorization: Bearer <token>
```

## 数据导入导出

### 导入服务器列表（CSV）

```http
POST /api/import-export/servers/import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <CSV文件>
```

**CSV 格式要求：**

- 列：hostname, name, port, username, authType, password/privateKey, description, tags, groupIds
- authType 可选值：password / privateKey
- 自动去重：hostname+name 联合去重
- 事务保证：全部成功或全部失败

**响应：**

```json
{
  "success": true,
  "data": {
    "total": 10,
    "imported": 8,
    "skipped": 2,
    "errors": [
      {
        "row": 5,
        "hostname": "server-5",
        "error": "SSH 连接失败"
      }
    ]
  }
}
```

### 导出服务器列表

```http
GET /api/import-export/servers/export?format=csv
Authorization: Bearer <token>
```

### 导出告警数据

```http
GET /api/import-export/alerts/export?format=csv&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

### 导出审计日志

```http
GET /api/import-export/audit-logs/export?format=csv&startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <token>
```

### 导出报表

```http
GET /api/import-export/reports/export?format=csv
Authorization: Bearer <token>
```

### 下载服务器导入模板

```http
GET /api/import-export/template/servers
```

## 备份与恢复

### 创建备份

```http
POST /api/backups
Authorization: Bearer <token>
```

### 获取备份列表

```http
GET /api/backups
Authorization: Bearer <token>
```

### 恢复备份

```http
POST /api/backups/restore/:id
Authorization: Bearer <token>
```

**响应：**

```json
{
  "success": true,
  "message": "数据库已恢复，系统将在1秒后自动重启",
  "requiresRestart": true
}
```

> 恢复备份后系统会自动优雅重启：关闭HTTP/WS服务 → 停止定时任务 → 替换数据库文件 → 退出进程（由进程管理器自动重启）

### 删除备份

```http
DELETE /api/backups/:id
Authorization: Bearer <token>
```

## 服务器分组管理

### 获取分组列表

```http
GET /api/server-groups
Authorization: Bearer <token>
```

### 创建分组

```http
POST /api/server-groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "生产环境",
  "description": "生产环境服务器",
  "parentId": null,
  "sortOrder": 1
}
```

### 更新分组

```http
PUT /api/server-groups/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新后的名称",
  "description": "新描述"
}
```

### 删除分组

```http
DELETE /api/server-groups/:id
Authorization: Bearer <token>
```

### 获取分组下的服务器

```http
GET /api/server-groups/:id/servers
Authorization: Bearer <token>
```

### 添加服务器到分组

```http
POST /api/server-groups/:id/servers
Authorization: Bearer <token>
Content-Type: application/json

{
  "serverId": "server-uuid"
}
```

### 从分组移除服务器

```http
DELETE /api/server-groups/:id/servers/:serverId
Authorization: Bearer <token>
```

## 多 Agent 协作

### 创建多 Agent 任务

```http
POST /api/multi-agent
Authorization: Bearer <token>
Content-Type: application/json

{
  "agentIds": ["agent-1", "agent-2"],
  "task": "任务描述",
  "collaborationMode": "sequential"
}
```

### 获取多 Agent 任务状态

```http
GET /api/multi-agent/:id
Authorization: Bearer <token>
```

## 自动修复（Auto Remediation）

### 获取修复策略列表

```http
GET /api/remediation-policies
Authorization: Bearer <token>
```

### 创建修复策略

```http
POST /api/remediation-policies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "CPU 过高自动重启",
  "alertRule": "cpu_usage > 90",
  "action": "restart_service",
  "enabled": true
}
```

### 获取修复执行记录

```http
GET /api/remediation-executions
Authorization: Bearer <token>
```

## 备份与恢复

### 创建数据库备份

```http
POST /api/backups
Authorization: Bearer <token>
```

### 获取备份列表

```http
GET /api/backups
Authorization: Bearer <token>
```

### 恢复备份

```http
POST /api/backups/:id/restore
Authorization: Bearer <token>
```

## 数据库管理

### 获取数据库信息

```http
GET /api/database/info
Authorization: Bearer <token>
```

### 数据库健康检查

```http
GET /api/database/health
Authorization: Bearer <token>
```

## 健康检查

```http
GET /health
```

**响应:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## WebSocket事件

### 客户端 → 服务端

- `task:subscribe` - 订阅任务执行
- `task:unsubscribe` - 取消订阅
- `alert:subscribe` - 订阅告警

### 服务端 → 客户端

- `task:started`
- `task:node:started`
- `task:node:thinking`
- `task:node:output`
- `task:node:completed`
- `task:completed`
- `task:failed`
- `alert:new`
- `alert:updated`
- `notification:new`
- `remediation:executed` - 修复执行通知

## SSH 密钥管理

### 获取密钥列表

```http
GET /api/ssh-keys
Authorization: Bearer <token>
```

### 获取单个密钥

```http
GET /api/ssh-keys/:id
Authorization: Bearer <token>
```

### 获取密钥使用情况

```http
GET /api/ssh-keys/:id/usage
Authorization: Bearer <token>
```

### 创建密钥

```http
POST /api/ssh-keys
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "生产服务器密钥",
  "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----...",
  "passphrase": "optional-key-password"
}
```

### 更新密钥

```http
PUT /api/ssh-keys/:id
Authorization: Bearer <token>
```

### 删除密钥

```http
DELETE /api/ssh-keys/:id
Authorization: Bearer <token>
```

## 网络设备管理

### 获取设备列表

```http
GET /api/network-devices
Authorization: Bearer <token>
```

### 获取单个设备

```http
GET /api/network-devices/:id
Authorization: Bearer <token>
```

### 创建设备

```http
POST /api/network-devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "核心交换机",
  "host": "192.168.1.1",
  "deviceType": "switch",
  "vendor": "huawei",
  "username": "admin",
  "password": "password"
}
```

### 更新设备

```http
PUT /api/network-devices/:id
Authorization: Bearer <token>
```

### 删除设备

```http
DELETE /api/network-devices/:id
Authorization: Bearer <token>
```

### 测试设备连接

```http
POST /api/network-devices/test-connection
Authorization: Bearer <token>
```

### 执行设备巡检

```http
POST /api/network-devices/:id/inspect
Authorization: Bearer <token>
```

### 批量巡检

```http
POST /api/network-devices/batch-inspect
Authorization: Bearer <token>
```

### SNMP 巡检

```http
POST /api/network-devices/:id/inspect-snmp
Authorization: Bearer <token>
```

### 获取巡检历史

```http
GET /api/network-devices/:id/history
Authorization: Bearer <token>
```

### 获取巡检详情

```http
GET /api/network-devices/history/:inspectionId
Authorization: Bearer <token>
```

### 生成巡检命令

```http
POST /api/network-devices/:id/generate-commands
Authorization: Bearer <token>
```

### 分析巡检输出

```http
POST /api/network-devices/analyze-output
Authorization: Bearer <token>
```

## 网络高级功能

```http
GET    /api/network-advanced          # 获取高级功能列表
POST   /api/network-advanced          # 创建高级功能配置
GET    /api/network-advanced/:id      # 获取配置详情
PUT    /api/network-advanced/:id      # 更新配置
DELETE /api/network-advanced/:id      # 删除配置
```

## 网络发现

```http
GET    /api/network-discovery             # 获取发现任务列表
POST   /api/network-discovery             # 创建发现任务
GET    /api/network-discovery/:id         # 获取发现任务详情
PUT    /api/network-discovery/:id         # 更新发现任务
DELETE /api/network-discovery/:id         # 删除发现任务
POST   /api/network-discovery/:id/start   # 启动发现
POST   /api/network-discovery/:id/stop    # 停止发现
```

## SNMP 管理

### 获取 SNMP 配置列表

```http
GET /api/snmp
Authorization: Bearer <token>
```

### 创建 SNMP 配置

```http
POST /api/snmp
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "设备SNMP配置",
  "host": "192.168.1.1",
  "community": "public",
  "version": "2c",
  "port": 161
}
```

### 获取 SNMP 配置详情

```http
GET /api/snmp/:id
Authorization: Bearer <token>
```

### 更新 SNMP 配置

```http
PUT /api/snmp/:id
Authorization: Bearer <token>
```

### 删除 SNMP 配置

```http
DELETE /api/snmp/:id
Authorization: Bearer <token>
```

### 执行 SNMP 查询

```http
POST /api/snmp/:id/query
Authorization: Bearer <token>
```

### 获取 SNMP Trap 日志

```http
GET /api/snmp/traps
Authorization: Bearer <token>
```

### 获取 OID 注册表

```http
GET /api/snmp/oids
Authorization: Bearer <token>
```

## 网络拓扑

### 获取拓扑数据

```http
GET /api/topology
Authorization: Bearer <token>
```

### 获取拓扑节点

```http
GET /api/topology/nodes
Authorization: Bearer <token>
```

### 获取拓扑边

```http
GET /api/topology/edges
Authorization: Bearer <token>
```

### 创建拓扑节点

```http
POST /api/topology/nodes
Authorization: Bearer <token>
```

### 更新拓扑节点

```http
PUT /api/topology/nodes/:id
Authorization: Bearer <token>
```

### 删除拓扑节点

```http
DELETE /api/topology/nodes/:id
Authorization: Bearer <token>
```

## 变更管理

### 获取变更记录列表

```http
GET /api/changes
Authorization: Bearer <token>
```

### 创建变更记录

```http
POST /api/changes
Authorization: Bearer <token>
```

### 获取变更详情

```http
GET /api/changes/:id
Authorization: Bearer <token>
```

### 更新变更记录

```http
PUT /api/changes/:id
Authorization: Bearer <token>
```

## AI 模型管理

### 获取模型列表

```http
GET /api/ai-models
Authorization: Bearer <token>
```

### 获取默认模型

```http
GET /api/ai-models/default
Authorization: Bearer <token>
```

### 获取单个模型

```http
GET /api/ai-models/:id
Authorization: Bearer <token>
```

### 创建模型

```http
POST /api/ai-models
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "豆包-4o",
  "provider": "doubao",
  "modelId": "doubao-4o",
  "apiKey": "your-api-key",
  "apiBase": "https://ark.cn-beijing.volces.com/api/v3",
  "isDefault": true
}
```

### 更新模型

```http
PUT /api/ai-models/:id
Authorization: Bearer <token>
```

### 重新排序模型

```http
PUT /api/ai-models/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "modelIds": ["id-1", "id-2", "id-3"]
}
```

### 删除模型

```http
DELETE /api/ai-models/:id
Authorization: Bearer <token>
```

### 测试模型连通性

```http
POST /api/ai-models/:id/test
Authorization: Bearer <token>
```

## 审批中心（HITL）

### 获取审批列表

```http
GET /api/approvals
Authorization: Bearer <token>

# 查询参数
?status=pending
&type=remediation
&page=1&limit=20
```

### 获取待审批数量

```http
GET /api/approvals/pending/count
Authorization: Bearer <token>
```

### 获取审批详情

```http
GET /api/approvals/:id
Authorization: Bearer <token>
```

### 通过审批

```http
POST /api/approvals/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "comment": "已确认，可以执行"
}
```

### 拒绝审批

```http
POST /api/approvals/:id/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "需要进一步评估风险"
}
```

## AI 智能修复

### 获取修复记录列表

```http
GET /api/ai-remediations
Authorization: Bearer <token>
```

### 获取单个修复记录

```http
GET /api/ai-remediations/:id
Authorization: Bearer <token>
```

### 创建修复任务

```http
POST /api/ai-remediations
Authorization: Bearer <token>
```

## 告警自动分析

```http
GET  /api/alert-auto/analysis          # 获取分析记录列表
GET  /api/alert-auto/analysis/:id      # 获取分析详情
POST /api/alert-auto/analyze           # 触发告警分析
```

## 告警关联分析

```http
GET    /api/alert-correlation/groups           # 获取关联组列表
GET    /api/alert-correlation/groups/:id       # 获取关联组详情
POST   /api/alert-correlation/groups           # 创建关联组
DELETE /api/alert-correlation/groups/:id       # 删除关联组
POST   /api/alert-correlation/analyze          # 触发关联分析
```

## 联动规则

```http
GET    /api/linkage/rules              # 获取联动规则列表
POST   /api/linkage/rules              # 创建联动规则
GET    /api/linkage/rules/:id          # 获取规则详情
PUT    /api/linkage/rules/:id          # 更新规则
DELETE /api/linkage/rules/:id          # 删除规则
POST   /api/linkage/rules/:id/trigger  # 手动触发规则
```

## 数据库连接管理

### 获取数据库连接列表

```http
GET /api/db-connections
Authorization: Bearer <token>
```

### 创建数据库连接

```http
POST /api/db-connections
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "生产数据库",
  "type": "mysql",
  "host": "192.168.1.100",
  "port": 3306,
  "username": "dbuser",
  "password": "dbpassword",
  "database": "production"
}
```

### 获取连接详情

```http
GET /api/db-connections/:id
Authorization: Bearer <token>
```

### 更新连接

```http
PUT /api/db-connections/:id
Authorization: Bearer <token>
```

### 删除连接

```http
DELETE /api/db-connections/:id
Authorization: Bearer <token>
```

### 测试连接

```http
POST /api/db-connections/:id/test
Authorization: Bearer <token>
```

## VNC 远程桌面

### 获取 VNC 会话列表

```http
GET /api/vnc/sessions
Authorization: Bearer <token>
```

### 创建 VNC 会话

```http
POST /api/vnc/sessions
Authorization: Bearer <token>
```

## QAnything 知识库

```http
GET    /api/knowledge/qanything/status         # 获取 QAnything 服务状态
POST   /api/knowledge/qanything/sync           # 同步知识库到 QAnything
GET    /api/knowledge/qanything/search         # 搜索 QAnything 知识库
```

## 服务器管理增强

```http
GET    /api/server-management/servers             # 获取增强服务器列表（含分组/信息）
POST   /api/server-management/import              # 批量导入服务器
GET    /api/server-management/template/servers    # 下载导入模板
POST   /api/server-management/collect/:id         # 采集主机信息
```

## 命令执行历史

```http
GET    /api/server-commands                      # 获取命令执行历史
GET    /api/server-commands/:id                   # 获取命令执行详情
POST   /api/server-commands                       # 执行新命令
```

## 通知配置

```http
GET    /api/notification-config                   # 获取通知配置
POST   /api/notification-config                   # 创建通知配置
PUT    /api/notification-config/:id               # 更新通知配置
DELETE /api/notification-config/:id               # 删除通知配置
```

## 修复审计

```http
GET    /api/remediation-audits                    # 获取修复审计记录
GET    /api/remediation-audits/:id                # 获取审计详情
```

## 错误响应

所有API在出错时返回统一格式：

```json
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

HTTP状态码：

- 200: 成功
- 400: 请求参数错误
- 401: 未认证
- 403: 无权限
- 404: 资源不存在
- 500: 服务器内部错误

