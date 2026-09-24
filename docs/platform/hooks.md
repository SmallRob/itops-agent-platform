# Hooks（事件入站标准化）

> Hooks 是平台的**机器入口**：把异构事件（监控告警、外部系统消息、脚本唤醒）标准化为平台事件，再分发到既有处置流水线。
> 设计目标与 openocta 的 `/hooks/*` 一致——外部集成只写"声明"，厂商差异收敛在适配器里，调用方零 if/else。

---

## 快速开始

> **可视化入口**：登录后进入左侧导航「AI 运维 → 能力中心 → Hooks 接入」（`/platform#hooks`），可查看支持来源、四个端点的 curl 示例（一键复制）与认证说明。

```bash
# 1. 查询可用来源（接入前自检）
curl -s http://localhost:3001/api/hooks/sources -H "X-Hook-Token: $HOOKS_TOKEN" | jq .data

# 2. 投递 Prometheus Alertmanager 告警
curl -s -X POST http://localhost:3001/api/hooks/alert/prometheus \
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"alerts":[{"labels":{"alertname":"DiskFull","instance":"10.0.0.9:9100","severity":"critical"},
                  "annotations":{"summary":"磁盘使用率 95%"},"status":"firing"}]}' | jq .data

# 3. 通用来源（自动识别厂商格式，识别不出按通用结构解析）
curl -s -X POST http://localhost:3001/api/hooks/alert/generic \
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"订单服务响应超时","severity":"high","host":"10.0.0.20","status":"firing"}' | jq .data

# 4. 让 Agent 执行一次隔离回合（可指定会话/模型/Provider）
curl -s -X POST http://localhost:3001/api/hooks/agent \
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"message":"分析刚才那条磁盘告警的影响面","sessionKey":"disk-2026-09-24"}' | jq .data

# 5. 事件唤醒（落通知 + 审计，可选触发 Agent 摘要）
curl -s -X POST http://localhost:3001/api/hooks/wake \
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"text":"发布窗口开始","triggerAgent":true}' | jq .data
```

---

## 原理

```
外部系统 ──HTTP──▶ /api/hooks/*
                      │
                 authorizeHook           ① 认证（令牌 / 管理员 JWT）+ 审计失败
                      │
                 hookMappings            ② 声明式映射：来源 → 适配器
                      │
                 alertSourceAdapters     ③ 厂商字段差异收敛于此，产出标准告警
                      │
        ┌─────────────┼─────────────────────────┐
        ▼             ▼                         ▼
   alert 动作      agent 动作                wake 动作
   alertIngest     agentRegistry.chat       通知 + 审计
   （落库→降噪→     （降级链 + 熔断 +         （可选：触发
     RCA→修复→通知）  技能匹配）                Agent 摘要）
```

**关键点**

- `alert` 动作复用 `alertIngest.processNormalizedAlert`，与既有 `/api/webhooks/*` 入口**共用同一条流水线**，不存在两套逻辑。
- `agent` 动作走 Agent Provider 注册表，因此天然具备技能匹配、降级链、熔断与尝试记录（`attempts`）。
- 新增一家监控源 = 在 `hookMappings.ts` 追加一条 + 提供适配器，其余代码不动。

---

## 端点与来源

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/hooks/sources` | 列出可用来源（含 `label` 与是否自动识别） |
| POST | `/api/hooks/alert/:source` | 告警入站，`source` 见下表 |
| POST | `/api/hooks/agent` | Agent 隔离回合（`message` 必填） |
| POST | `/api/hooks/wake` | 事件唤醒（`text` 必填） |

| `source` | 上游系统 | 适配器行为 |
|----------|----------|-----------|
| `prometheus` | Prometheus Alertmanager | 解析 `alerts[].labels/annotations/status` |
| `zabbix` | Zabbix | 解析 Zabbix Webhook 字段 |
| `grafana` | Grafana | 解析 Grafana 告警结构 |
| `aliyun` | 阿里云监控 | 解析云监控消息 |
| `tencent` | 腾讯云监控 | 解析云监控消息 |
| `generic` | 任意 | **自动识别**上游格式，识别失败按通用结构解析 |

**通用结构兜底**：`{title|name|alertname, severity|level, host|instance|target, description|message, status}`；`alerts` 数组会被展开为多条。

**响应结构（`HookIngestResult`）**

```json
{
  "source": "prometheus",
  "action": "alert",
  "accepted": 1,
  "processed": [{ "alertId": "…", "taskId": null, "executionIds": [], "status": "created" }],
  "errors": [],
  "durationMs": 8,
  "agentReply": "（agent / wake 动作才有）",
  "sessionKey": "…",
  "provider": "local"
}
```

---

## 安全

| 项 | 说明 |
|----|------|
| 认证顺序 | `X-Hook-Token`（或 `X-Webhook-Secret`、`Authorization: Bearer`）与 `HOOKS_TOKEN` 比对 → 未配置则回退 `WEBHOOK_SECRET` → 两者都未配置时**只允许管理员 JWT**（payload 含 `role: "admin"`） |
| 常量时间比较 | 令牌比对使用 `crypto.timingSafeEqual`，长度不等直接拒绝 |
| 失败可观测 | 认证失败写审计（`hook_auth_failed`），响应给出明确原因文案 |
| CSRF | `/api/hooks/*` 已在全局 CSRF 中间件中豁免（机器入口不使用 Cookie 会话，无法也不应携带 CSRF Token） |
| 限流 | 与其它 API 一致走全局限流中间件 |

```bash
# 生产环境务必配置令牌
HOOKS_TOKEN=$(openssl rand -hex 32)
```

> 与 `/api/webhooks/*` 的区别：`/api/webhooks/*` 面向**内置**告警源（额外支持 IP 白名单与 `X-Webhook-Signature-{source}` 签名校验，`WEBHOOK_VERIFY_ENABLED`）；
> `/api/hooks/*` 面向**新接入/自定义**事件源，令牌更简单，且提供 agent / wake 两类非告警动作。

---

## 扩展：接入一个新的监控源

1. **写适配器**：在 `backend/src/services/alert/alertSourceAdapters.ts` 增加 `adaptXxx(payload): { alerts: NormalizedAlert[]; errors: string[] }`，把厂商字段映射为标准告警字段（`external_id / severity / title / content / host / status / metadata`）。
2. **注册映射**：在 `hookMappings.ts` 追加一行：
   ```ts
   { source: 'xxx' as HookSource, label: 'XXX 监控', adapter: adaptXxx },
   ```
3. **放开来源校验**：在 `hooksRoutes.ts` 的 `VALID_SOURCES` 中加入 `'xxx'`，并在 `services/hooks/types.ts` 的 `HookSource` 联合类型中补上。
4. **验证**：
   ```bash
   curl -X POST /api/hooks/alert/xxx -H "X-Hook-Token: $HOOKS_TOKEN" -d @sample.json | jq .data
   ```
   期望 `accepted > 0`、`errors == []`，且告警中心出现对应记录。

**不需要改**：`hookService`、`alertIngest`、Agent、通知、修复策略——分发链路与来源无关。

---

## 排障

| 现象 | 排查 |
|------|------|
| 401 `缺少凭据` | 未带 `X-Hook-Token`，且服务端未配置 `HOOKS_TOKEN`/`WEBHOOK_SECRET` → 配置 env 或暂时用管理员 JWT 调试 |
| 401 `令牌校验失败` | 令牌与 `HOOKS_TOKEN` 不一致（注意前后空格、换行、是否误用了 `WEBHOOK_SECRET`） |
| 400 `不支持的来源` | `source` 不在 `VALID_SOURCES`（先 `GET /api/hooks/sources` 确认） |
| 403 `Invalid or missing CSRF token` | 说明服务版本较旧未豁免 CSRF；升级后 `/api/hooks/*` 不再需要 CSRF 头 |
| `accepted > 0` 但 `errors` 非空 | 个别条目字段缺失（如无标题）；`errors` 会逐条说明，`processed` 中的条目已成功入库 |
| 告警入库但没有通知/自愈 | 属于下游策略问题：检查告警通知配置与修复策略匹配（非 Hooks 层） |
| 想知道谁在调用 | 审计表中筛选 `hook_auth_failed` / `hook_wake`，以及告警记录上的来源标识 |