# Zabbix 告警自动修复使用指南

> 版本：v1.0\
> 日期：2026-06-14\
> 适用版本：ITOps Agent Platform v3.0.5+

***

## 一、功能概述

### 1.1 核心能力

系统支持从 Zabbix 告警接收、AI 智能分析、自动修复、人工审批、结果验证到自动回滚的完整闭环。

### 1.2 完整链路

```
Zabbix 告警
    ↓
[1] Webhook 接收（签名验证 + IP 白名单）
    ↓
[2] AI 自动分析（SSH 诊断 + LLM 分析）
    ↓
[3] 生成结构化修复建议（JSON 格式）
    ↓
[4] 自动创建修复工作流（4 节点）
    ↓
[5] 发送审批通知（企业微信/钉钉/邮箱）
    ↓
[6] 人工审批（审批中心页面）
    ↓
[7] 审批通过 → 执行修复命令
    ↓
[8] 验证修复结果
    ↓
[9] 反馈通知 + 记录审计日志
    ↓
[10] 验证失败 → 自动回滚
```

***

## 二、系统架构

### 2.1 工作流结构

AI 自动生成的修复工作流包含 4 个节点：

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  审批节点     │ ──▶ │  执行修复节点 │ ──▶ │  验证结果节点 │
│  (Approval)  │     │  (Execution) │     │ (Verification)│
└──────────────┘     └──────────────┘     └──────────────┘
                                                   │
                                              验证失败
                                                   │
                                                   ▼
                                          ┌──────────────┐
                                          │  自动回滚节点 │
                                          │  (Rollback)  │
                                          └──────────────┘
```

| 节点     | 类型         | 说明                                  |
| ------ | ---------- | ----------------------------------- |
| 审批节点   | `approval` | 等待人工审批，支持超时自动拒绝                     |
| 执行修复节点 | `agent`    | 使用 `server-command-agent` 执行修复命令    |
| 验证结果节点 | `agent`    | 验证修复是否成功，检查系统状态                     |
| 自动回滚节点 | `agent`    | 断开连接，验证失败时由 `finalizeWorkflow` 自动触发 |

### 2.2 数据流

```
告警数据 → 设备识别 → SSH/SNMP 诊断 → LLM 分析
    ↓
修复命令 JSON → 工作流创建 → 审批暂停
    ↓
审批通过 → 执行修复 → 验证结果
    ↓
成功 → 通知 + 审计日志
失败 → 自动回滚 → 通知 + 审计日志
```

***

## 三、配置步骤

### 3.1 Zabbix 端配置

#### 3.1.1 创建告警媒介

1. 登录 Zabbix 管理界面
2. 进入 **管理 → 报警媒介类型 → 创建媒介类型**
3. 配置如下：

| 配置项          | 值                                               |
| ------------ | ----------------------------------------------- |
| 名称           | `ITOps Webhook`                                 |
| 类型           | `Webhook`                                       |
| URL          | `http://<your-server>:3001/api/webhooks/zabbix` |
| 请求方法         | `POST`                                          |
| Content-Type | `application/json`                              |

#### 3.1.2 配置 Webhook 参数

```json
{
  "alertid": "{ALERT.ID}",
  "host": "{HOST.NAME}",
  "ip": "{HOST.IP}",
  "trigger": "{TRIGGER.NAME}",
  "severity": "{TRIGGER.SEVERITY}",
  "status": "{TRIGGER.STATUS}",
  "description": "{TRIGGER.DESCRIPTION}",
  "value": "{TRIGGER.VALUE}",
  "event_id": "{EVENT.ID}",
  "time": "{EVENT.DATE} {EVENT.TIME}"
}
```

#### 3.1.3 配置告警动作

1. 进入 **配置 → 动作 → 创建动作**
2. 条件：选择需要自动修复的触发器
3. 操作：选择 `ITOps Webhook` 媒介类型
4. 发送到：选择接收用户组

### 3.2 系统端配置

#### 3.2.1 环境变量配置

在 `.env` 文件中配置：

```bash
# Webhook 安全配置
WEBHOOK_IP_WHITELIST=192.168.1.100,10.0.0.0/8    # Zabbix 服务器 IP
WEBHOOK_SECRET=your-webhook-secret-key             # HMAC 签名密钥（可选）

# 通知渠道配置
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=alert@example.com
SMTP_PASSWORD=your-password
NOTIFICATION_EMAIL=admin@example.com

# AI 分析配置
LLM_API_KEY=your-api-key
LLM_API_BASE=https://api.example.com/v1
LLM_MODEL=gpt-4

# 审批超时配置（秒）
APPROVAL_TIMEOUT_HIGH=7200    # 高风险 2 小时
APPROVAL_TIMEOUT_MEDIUM=3600  # 中风险 1 小时
APPROVAL_TIMEOUT_LOW=1800     # 低风险 30 分钟
```

#### 3.2.2 设备信息配置

确保以下表中包含目标设备信息：

- `network_devices`：网络设备（交换机、路由器）
- `servers`：服务器

AI 分析时会根据告警 IP 自动查找设备，获取 SSH 凭证进行诊断。

***

## 四、AI 自动分析

### 4.1 诊断方式

| 方式      | 条件         | 说明           |
| ------- | ---------- | ------------ |
| SSH 诊断  | 设备有 SSH 凭证 | 登录设备执行诊断命令   |
| SNMP 诊断 | 无 SSH 凭证   | 使用 SNMP 巡检数据 |

### 4.2 厂商适配

系统支持以下厂商的自动诊断命令：

| 厂商        | 诊断命令示例                                      |
| --------- | ------------------------------------------- |
| 华为        | `display cpu-usage`, `display memory-usage` |
| 思科        | `show cpu`, `show memory`                   |
| H3C       | `display cpu-usage`, `display memory`       |
| 锐捷        | `show cpu`, `show memory`                   |
| 中兴        | `show cpu`, `show memory`                   |
| Linux 服务器 | `top -bn1`, `free -m`, `df -h`              |

### 4.3 LLM 分析输出

AI 分析后生成结构化 JSON：

```json
{
  "diagnosis": "CPU 使用率过高，由进程 java (PID: 12345) 占用 95%",
  "summary": "Java 进程 CPU 占用异常",
  "remediationCommands": [
    "kill -9 12345",
    "systemctl restart myapp"
  ],
  "riskLevel": "medium"
}
```

***

## 五、审批流程

### 5.1 审批通知

审批请求创建后，系统会通过以下渠道发送通知：

| 渠道      | 配置项                             | 说明            |
| ------- | ------------------------------- | ------------- |
| 企业微信    | `WECHAT_WEBHOOK_URL`            | Markdown 格式消息 |
| 钉钉      | `DINGTALK_WEBHOOK_URL`          | Markdown 格式消息 |
| 邮箱      | `SMTP_*` + `NOTIFICATION_EMAIL` | HTML 邮件       |
| Webhook | 自定义 URL                         | JSON 格式推送     |

### 5.2 审批操作

#### 审批中心页面

访问 `/approval-center` 页面，可以看到：

- 待审批列表
- 审批详情（修复方案、风险等级、目标设备）
- 操作按钮：通过 / 拒绝

#### API 操作

```bash
# 审批通过
POST /api/approvals/{id}/approve
Authorization: Bearer <token>
{
  "comment": "同意执行"
}

# 审批拒绝
POST /api/approvals/{id}/reject
Authorization: Bearer <token>
{
  "reason": "当前时间段不允许变更"
}
```

### 5.3 审批超时

| 风险等级 | 默认超时  | 超时行为 |
| ---- | ----- | ---- |
| 高风险  | 2 小时  | 自动拒绝 |
| 中风险  | 1 小时  | 自动拒绝 |
| 低风险  | 30 分钟 | 自动拒绝 |

***

## 六、验证机制

### 6.1 智能验证命令

系统根据修复命令自动推断验证命令：

| 修复类型                          | 验证命令                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `systemctl restart <service>` | `systemctl status <service>`, `systemctl is-active <service>`     |
| 磁盘清理（`rm`, `clean`）           | `df -h`                                                           |
| 内存相关（`memory`, `swap`）        | `free -m`                                                         |
| CPU 相关（`kill`, `top`）         | `uptime`, `top -bn1 \| head -5`                                   |
| 网络相关（`iptables`, `nginx`）     | `ss -tlnp`                                                        |
| Docker 相关                     | `docker ps --format "table {{.Names}}\t{{.Status}}"`              |
| 无法推断                          | `uptime`, `systemctl list-units --failed`, `dmesg -T \| tail -10` |

### 6.2 验证结论

验证节点输出三种结论：

- ✅ **修复成功**：指标恢复正常
- ⚠️ **部分恢复**：部分指标改善但仍有异常
- ❌ **修复失败**：指标未改善或恶化

***

## 七、自动回滚

### 7.1 触发条件

当验证节点执行失败时，系统自动触发回滚：

1. 检测验证节点状态为 `failed`
2. 查找工作流中的回滚节点（label 包含 "回滚"）
3. 执行回滚命令
4. 更新 `ai_remediations` 表状态
5. 发送回滚通知
6. 记录审计日志

### 7.2 智能回滚命令

系统根据修复命令自动推断回滚命令：

| 修复命令                            | 回滚命令                                                    |
| ------------------------------- | ------------------------------------------------------- |
| `systemctl start <service>`     | `systemctl stop <service>`                              |
| `systemctl restart <service>`   | `systemctl stop <service>`                              |
| `systemctl stop <service>`      | `systemctl start <service>`                             |
| `cp <file> <file>.bak`          | `cp <file>.bak <file>`                                  |
| `docker run --name <container>` | `docker stop <container> && docker rm <container>`      |
| `iptables -A ...`               | 列出当前规则（需手动确认）                                           |
| 无法推断                            | `systemctl list-units --failed`, `dmesg -T \| tail -20` |

### 7.3 回滚通知

回滚执行后，系统发送额外通知：

```json
{
  "type": "remediation_rollback",
  "title": "⚠️ AI 修复验证失败并已回滚: <workflow-name>",
  "content": "**工作流**: ...\n**验证结果**: 失败\n**回滚操作**: 已自动执行\n**任务ID**: ...",
  "related_task_id": "<task-id>"
}
```

***

## 八、审计日志

### 8.1 日志记录

系统在工作流完成时自动记录审计日志：

| 事件    | action                           | 说明         |
| ----- | -------------------------------- | ---------- |
| 工作流完成 | `workflow_completed`             | 所有节点执行成功   |
| 工作流失败 | `workflow_failed`                | 存在节点执行失败   |
| 触发回滚  | `remediation_rollback_triggered` | 验证失败触发自动回滚 |

### 8.2 日志详情

```json
{
  "action": "workflow_completed",
  "resource_type": "task",
  "resource_id": "<task-id>",
  "details": {
    "workflowName": "AI 修复工作流: CPU 使用率过高",
    "workflowId": "<workflow-id>",
    "successCount": 3,
    "failedCount": 0,
    "verificationFailed": false,
    "errorMessage": null
  }
}
```

***

## 九、WebSocket 实时事件

### 9.1 任务执行事件

| 事件                    | 数据                                   | 说明     |
| --------------------- | ------------------------------------ | ------ |
| `task:node:started`   | `{ taskId, nodeId, nodeName }`       | 节点开始执行 |
| `task:node:output`    | `{ taskId, nodeId, output }`         | 节点输出   |
| `task:node:completed` | `{ taskId, nodeId, status, output }` | 节点完成   |
| `task:completed`      | `{ taskId, status, nodeResults }`    | 任务完成   |
| `task:failed`         | `{ taskId, error }`                  | 任务失败   |

### 9.2 审批事件

| 事件                        | 数据                                  | 说明   |
| ------------------------- | ----------------------------------- | ---- |
| `task:approval:requested` | `{ taskId, approvalId, nodeLabel }` | 审批请求 |
| `task:approval:resolved`  | `{ taskId, approvalId, status }`    | 审批结果 |

***

## 十、常见问题

### Q1：Zabbix 告警未触发自动修复？

**排查步骤**：

1. 检查 Webhook 是否收到请求：查看后端日志 `docker logs backend`
2. 检查 IP 白名单：确认 `WEBHOOK_IP_WHITELIST` 包含 Zabbix 服务器 IP
3. 检查设备信息：确认 `network_devices` 或 `servers` 表中有对应 IP 的设备
4. 检查 SSH 凭证：确认设备有有效的 SSH 登录信息

### Q2：AI 分析未生成修复命令？

**可能原因**：

1. LLM API 配置错误：检查 `LLM_API_KEY` 和 `LLM_API_BASE`
2. 诊断数据不足：SSH 连接失败或 SNMP 数据不完整
3. AI 判断无需修复：告警级别较低或问题不明确

### Q3：审批通知未收到？

**排查步骤**：

1. 检查通知渠道配置：确认 `WECHAT_WEBHOOK_URL` 等环境变量正确
2. 检查网络连接：确保后端能访问通知服务 API
3. 查看后端日志：搜索 `notification` 相关错误

### Q4：验证节点判断修复失败？

**可能原因**：

1. 修复命令未生效：需要更长时间或需要重启服务
2. 验证命令不匹配：系统推断的验证命令不适用于当前场景
3. 系统状态未恢复：修复后需要等待一段时间才能验证

### Q5：回滚执行失败？

**处理方式**：

1. 查看回滚日志：在任务详情页查看回滚节点输出
2. 手动回滚：根据修复命令手动执行逆向操作
3. 检查设备连通性：确认 SSH 连接正常

***

## 十一、最佳实践

### 11.1 告警配置

- 为关键告警配置自动修复，非关键告警使用仅建议模式
- 设置合理的告警阈值，避免频繁触发
- 配置告警依赖，减少重复告警

### 11.2 审批策略

- 高风险操作设置较长审批超时（2 小时）
- 低风险操作设置较短审批超时（30 分钟）
- 定期审查审批记录，优化审批策略

### 11.3 验证策略

- 验证命令应覆盖修复操作的核心指标
- 验证超时设置合理（默认 120 秒）
- 验证失败时及时通知运维人员

### 11.4 回滚策略

- 修复前自动备份配置文件
- 回滚命令应经过测试验证
- 关键操作建议人工确认回滚

***

## 十二、API 参考

### 12.1 Webhook 接收

```http
POST /api/webhooks/zabbix
Content-Type: application/json
X-Webhook-Signature: <hmac-sha256-signature>

{
  "alertid": "12345",
  "host": "server-01",
  "ip": "192.168.1.100",
  "trigger": "CPU usage > 90%",
  "severity": "high",
  "status": "PROBLEM",
  "description": "CPU usage is above 90% for 5 minutes",
  "value": "1",
  "event_id": "67890",
  "time": "2026-06-14 10:30:00"
}
```

### 12.2 审批管理

```http
# 查询待审批列表
GET /api/approvals?status=pending

# 审批通过
POST /api/approvals/{id}/approve

# 审批拒绝
POST /api/approvals/{id}/reject
```

### 12.3 任务管理

```http
# 查询任务列表
GET /api/tasks

# 查询任务详情
GET /api/tasks/{id}

# 查询任务日志
GET /api/tasks/{id}/logs
```

***

## 十三、相关文件

| 文件                                             | 说明           |
| ---------------------------------------------- | ------------ |
| `backend/src/routes/webhookRoutes.ts`          | Webhook 接收路由 |
| `backend/src/services/alertAutoAnalyzer.ts`    | AI 自动分析服务    |
| `backend/src/services/aiRemediationService.ts` | AI 修复工作流生成   |
| `backend/src/services/workflowExecutor.ts`     | 工作流执行引擎      |
| `backend/src/services/notificationService.ts`  | 通知服务         |
| `backend/src/services/auditService.ts`         | 审计日志服务       |
| `backend/src/routes/approvalRoutes.ts`         | 审批管理路由       |

***

**文档版本**：v1.0\
**最后更新**：2026-06-14\
**维护者**：谭策
