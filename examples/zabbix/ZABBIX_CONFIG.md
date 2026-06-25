# Zabbix 告警集成配置指南

## 📋 目录
- [概述](#概述)
- [Webhook 端点](#webhook-端点)
- [Zabbix 配置步骤](#zabbix-配置步骤)
- [告警数据格式](#告警数据格式)
- [告警工作流自动触发](#告警工作流自动触发)
- [测试验证](#测试验证)
- [故障排除](#故障排除)
- [示例配置](#示例配置)

---

## 概述

本平台支持通过 Webhook 接收 Zabbix 告警，并可以自动触发相应的运维工作流进行处理。

**核心特性：**
- ✅ 实时接收 Zabbix 告警
- ✅ 自动解析告警内容
- ✅ 支持告警严重程度分级
- ✅ 可配置自动触发工作流
- ✅ WebSocket 实时推送告警
- ✅ 完整的审计日志记录

---

## Webhook 端点

### 接口信息
```
POST http://your-server:3001/api/webhooks/zabbix
Content-Type: application/json
```

### 响应格式
```json
{
  "success": true,
  "message": "Zabbix alert processed",
  "data": {
    "alertId": "uuid-string",
    "taskId": "uuid-string-or-null"
  }
}
```

---

## Zabbix 配置步骤

### 步骤 1：创建媒介类型

1. 登录 Zabbix Web 界面
2. 进入 **管理 → 媒介类型**
3. 点击右上角 **创建媒介类型**
4. 选择类型为 **Webhook**
5. 填写以下配置：

#### 基本配置
```
名称: IT运维自动化平台
类型: Webhook
```

#### 参数配置
点击 **添加** 按钮，添加以下参数：

| 名称 | 值 | 说明 |
|------|-----|------|
| `trigger` | `{TRIGGER.NAME}` | 触发器名称（必填）|
| `host` | `{HOST.NAME}` | 主机名 |
| `item` | `{ITEM.NAME}` | 监控项名称 |
| `value` | `{ITEM.LASTVALUE}` | 当前值 |
| `severity` | `{TRIGGER.SEVERITY}` | 严重程度 |

#### Webhook 设置
```
URL: http://your-server:3001/api/webhooks/zabbix
请求方式: POST
请求类型: application/json
```

#### 脚本（可选）
如果需要额外处理，可以添加脚本。简单配置可留空。

#### 其他设置
- **超时**: 10s
- **尝试次数**: 3
- **重试间隔**: 5s

点击 **添加** 保存媒介类型。

---

### 步骤 2：配置用户媒介

1. 进入 **管理 → 用户**
2. 选择要接收告警的用户（或创建新用户）
3. 点击用户名称进入编辑
4. 切换到 **媒介** 标签页
5. 点击 **添加**：
   - 类型：选择刚才创建的「IT运维自动化平台」
   - 收件人：任意值（Webhook不需要真实收件人）
   - 启用：勾选
6. 点击 **添加** 保存

---

### 步骤 3：配置动作

#### 创建动作
1. 进入 **配置 → 动作**
2. 选择事件源：**触发器**
3. 点击右上角 **创建动作**

#### 动作选项卡
```
名称: 发送告警到IT运维平台
事件源: 触发器
启用: 勾选
```

#### 条件选项卡
添加触发条件（根据需要配置）：
```
条件类型: 触发器严重程度 >= 警告
```

#### 操作选项卡
1. 点击 **新的** 添加操作
2. 操作类型：**发送消息**
3. 发送到用户：选择刚才配置的用户
4. 仅送到：选择「IT运维自动化平台」
5. 点击 **添加** 保存操作
6. 点击 **添加** 保存动作

---

## 告警数据格式

### 完整示例
```json
{
  "trigger": "内存使用率过高",
  "host": "数据库服务器",
  "item": "系统内存使用率",
  "value": "92%",
  "severity": "high"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `trigger` | string | ✅ | 触发器名称，告警标题 |
| `host` | string | ❌ | 产生告警的主机名 |
| `item` | string | ❌ | 监控项名称 |
| `value` | string | ❌ | 当前监控值 |
| `severity` | string | ❌ | 严重程度 |

### 严重程度映射

Zabbix 严重程度 → 平台严重程度：

| Zabbix | 平台 | Emoji |
|--------|------|-------|
| `灾难` | `critical` | 🔴 |
| `严重` | `high` | 🟠 |
| `一般严重` | `medium` | 🟡 |
| `警告` | `low` | 🟢 |
| `信息` | `info` | 🔵 |

**注意**：Zabbix 发送的是中文或英文的严重程度名称，平台会自动识别。也可以直接发送平台支持的级别名称（`critical`/`high`/`medium`/`low`/`info`）。

---

## 告警工作流自动触发

### 配置映射规则

1. 访问前端界面：`http://localhost:8080`
2. 进入告警相关页面
3. 创建告警工作流映射：

#### 映射配置项

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **告警来源** | 告警来源类型 | `zabbix` |
| **严重程度** | 匹配的严重程度（留空匹配所有） | `high` |
| **标题模式** | 告警标题关键词匹配（留空匹配所有） | `CPU` |
| **工作流** | 要触发的工作流 | 服务器告警自动排查 |
| **启用** | 是否启用此映射 | ✅ |

### 映射优先级

多个映射同时匹配时，按以下优先级选择：
1. 来源和严重程度都匹配
2. 仅来源匹配
3. 仅严重程度匹配

### 预置映射

项目预置了 8 个告警映射规则，包括：
- CPU 使用率告警
- 内存使用率告警
- 磁盘使用率告警
- Nginx 服务异常
- MySQL 服务异常
- Redis 服务异常
- 系统负载过高
- Java OOM 错误

---

## 测试验证

### 方式一：使用测试脚本

项目提供了完整的测试脚本：

#### Windows PowerShell
```powershell
cd examples
.\test-alerts.ps1
```

#### Linux/Mac Shell
```bash
cd examples
chmod +x test-alerts.sh
./test-alerts.sh
```

### 方式二：手动测试

#### PowerShell
```powershell
$zabbixPayload = @{
    trigger = "内存使用率过高"
    host = "数据库服务器"
    item = "系统内存使用率"
    value = "92%"
    severity = "high"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/webhooks/zabbix" `
    -Method Post `
    -ContentType "application/json" `
    -Body $zabbixPayload
```

#### curl
```bash
curl -X POST http://localhost:3001/api/webhooks/zabbix \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": "内存使用率过高",
    "host": "数据库服务器",
    "item": "系统内存使用率",
    "value": "92%",
    "severity": "high"
  }'
```

### 方式三：在 Zabbix 中测试

1. 进入 Zabbix **监控 → 仪表板**
2. 手动触发一个告警（或等待真实告警）
3. 检查平台是否接收到告警
4. 访问 `http://localhost:8080/alerts` 验证

---

## 告警处理流程

### 完整处理链路

```
Zabbix 告警
    ↓
POST /api/webhooks/zabbix
    ↓
验证 trigger 字段
    ↓
存储到 alerts 表 (source="zabbix")
    ↓
查询 alert_workflow_mappings
    ↓
找到匹配映射？
    ├─ 是 → 创建任务，执行工作流
    └─ 否 → 仅存储告警
    ↓
创建通知
    ↓
记录审计日志
    ↓
WebSocket 推送到前端
```

### 查看告警

告警接收后可以在以下位置查看：

1. **前端告警页面**
   - 地址：`http://localhost:8080/alerts`
   - 可以确认、解决、查看告警详情

2. **数据库**
   - 表名：`alerts`
   - 筛选：`source = 'zabbix'`

3. **任务页面**
   - 如果触发了工作流，可以在任务页面查看执行情况

---

## 故障排除

### 问题1：Zabbix 无法连接到 Webhook

**检查清单：**
- ✅ 确认平台后端正在运行
- ✅ 检查网络连通性：`ping your-server`
- ✅ 检查防火墙设置
- ✅ 验证 URL 是否正确
- ✅ 查看 Zabbix 日志：`/var/log/zabbix/zabbix_server.log`

**测试命令：**
```bash
curl -X POST http://your-server:3001/health
```

---

### 问题2：告警收到但没有触发工作流

**检查清单：**
- ✅ 确认告警工作流映射已启用
- ✅ 检查映射配置是否匹配
- ✅ 查看后端日志确认映射查找过程
- ✅ 确认工作流存在且已启用

**后端日志位置：**
```bash
# Docker
docker logs itops-backend

# 本地开发
# 查看后端终端输出
```

---

### 问题3：告警数据格式不正确

**验证方法：**
1. 检查 Zabbix 媒介类型参数配置
2. 查看后端接收到的原始数据
3. 确保 Content-Type 是 `application/json`

---

### 问题4：WebSocket 不推送告警

**检查清单：**
- ✅ 确认前端已连接 WebSocket
- ✅ 检查浏览器控制台是否有错误
- ✅ 验证后端 WebSocket 服务正常

---

## 示例配置

### 示例1：CPU 告警触发排查工作流

**Zabbix 触发器：**
```
名称: CPU使用率过高
表达式: avg(/host/system.cpu.util[,idle],5m) < 20%
严重程度: 严重
```

**告警映射配置：**
```
告警来源: zabbix
严重程度: high
标题模式: CPU
工作流: 服务器告警自动排查
启用: ✅
```

**预期结果：**
Zabbix 触发 CPU 告警 → 平台接收 → 自动执行「服务器告警自动排查」工作流

---

### 示例2：所有 Zabbix 告警都记录

**告警映射配置：**
```
告警来源: zabbix
严重程度: (留空)
标题模式: (留空)
工作流: (可选)
启用: ✅
```

**预期结果：**
所有 Zabbix 告警都会被记录，不自动触发工作流。

---

### 示例3：特定主机的告警

**告警映射配置：**
```
告警来源: zabbix
严重程度: (留空)
标题模式: 数据库服务器
工作流: 数据库故障排查
启用: ✅
```

---

## 高级配置

### 自定义告警字段

可以在 Zabbix 媒介类型中添加更多参数，平台会将所有字段存储在 `metadata` 中。

**添加更多参数：**
```
trigger_id: {TRIGGER.ID}
event_id: {EVENT.ID}
host_ip: {HOST.IP}
item_key: {ITEM.KEY}
```

### 告警降噪

平台内置告警降噪功能：
- 重复告警抑制
- 告警聚合
- 可配置的静默时间

在系统设置中可以配置告警降噪策略。

---

## 🔒 Webhook 安全配置

> ⚠️ **重要**：生产环境必须启用 Webhook 签名验证，否则任何人都可以向系统发送伪造告警。

### 安全风险

如果不启用签名验证，攻击者可以：
- 向系统发送恶意告警，触发错误的自动工作流
- 伪造告警恢复消息，掩盖真实故障
- 发送大量伪造告警，造成拒绝服务攻击

### 启用签名验证

#### 1. 后端配置

在 `.env` 文件中添加以下配置：

```env
WEBHOOK_VERIFY_ENABLED=true
WEBHOOK_SECRET=your-random-secret-at-least-32-bytes-long
```

> **注意**：`WEBHOOK_SECRET` 必须是强随机字符串，建议至少 32 字节。可以使用以下命令生成：
> ```bash
> openssl rand -hex 32
> ```

#### 2. Zabbix 配置

在 Zabbix 的 Webhook 脚本中，需要计算 HMAC-SHA256 签名并添加到请求 Header：

```javascript
// Zabbix Webhook 脚本示例
var payload = JSON.stringify({
    trigger: params.trigger,
    host: params.host,
    item: params.item,
    value: params.value,
    severity: params.severity
});

var secret = params.secret; // 在 Zabbix 媒介类型参数中添加 secret 参数

// 计算 HMAC-SHA256 签名
var signature = CryptoJS.HmacSHA256(payload, secret).toString();

var request = new HttpRequest();
request.addHeader('Content-Type: application/json');
request.addHeader('X-Webhook-Signature-zabbix: ' + signature);

var response = request.post('https://your-server:3001/api/webhooks/zabbix', payload);
```

#### 3. 签名验证机制

| 配置项 | 值 |
|--------|-----|
| 算法 | HMAC-SHA256 |
| 签名内容 | 请求 Body 的 JSON 字符串 |
| Header 名称 | `X-Webhook-Signature-zabbix` |
| 比较方式 | timingSafeEqual（防时序攻击） |

### HTTPS 要求

生产环境必须通过 HTTPS 发送 Webhook 请求，否则签名和告警数据可能被中间人截获：

```
# 错误（开发环境）
http://your-server:3001/api/webhooks/zabbix

# 正确（生产环境）
https://your-domain.com/api/webhooks/zabbix
```

### 测试签名验证

启用签名验证后，可以使用以下方式测试：

```bash
# 生成签名（Linux/Mac）
PAYLOAD='{"trigger":"测试告警","host":"测试主机"}'
SECRET='your-secret-here'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

# 发送带签名的请求
curl -X POST https://your-server:3001/api/webhooks/zabbix \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature-zabbix: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

## 相关文档

- [API 文档](./API.md) — 完整 API 接口文档，包含 Webhook 告警接收接口
- [工作流管理](./API.md#工作流管理) — 工作流配置和管理 API
- [告警管理](./API.md#告警管理) — 告警处理和降噪 API

---

## 技术支持

如遇问题：
1. 查看后端日志
2. 检查网络连接
3. 验证 Zabbix 配置
4. 使用测试脚本验证

---

**最后更新**: 2026-05-25
