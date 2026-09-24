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
| 认证方式 | 二者其一：① 外部系统用 `X-Hook-Token`（或 `X-Webhook-Secret`）与 `HOOKS_TOKEN`（回退 `WEBHOOK_SECRET`）常量时间比对；② 平台前端用管理员 `Bearer` JWT（payload 含 `role: "admin"`）。**配置了 `HOOKS_TOKEN` 不影响管理员会话访问**——否则界面读取来源列表会 401，进而触发无谓的 token 刷新 |
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

## 接入实操：Prometheus + Grafana（dt01 参考实现）

已在 dt01（10.137.154.215，ASDM 测试环境）实测打通的完整接线，可作为其它环境的模板。

```
dt01 现有监控栈                                 平台（10.137.154.239:19301）
  asdm-prometheus ──alerting──▶ itops-alertmanager ──POST /api/hooks/alert/prometheus──▶ 告警中心
  asdm-grafana    ──webhook 联系点──────────────────POST /api/hooks/alert/grafana───────▶ 告警中心
```

### 1) Alertmanager（Prometheus 侧投递器）

Prometheus 自身不能发 webhook，必须有 Alertmanager。目标机无外网时，在本机（可经镜像代理）取镜像后传入：

```bash
# 平台主机（可访问 docker.1ms.run 代理）
docker pull docker.1ms.run/prom/alertmanager:v0.27.0
docker tag  docker.1ms.run/prom/alertmanager:v0.27.0 alertmanager:0.27.0
docker save -o /tmp/alertmanager.tar alertmanager:0.27.0
(cd /tmp && python3 -m http.server 18080 --bind 0.0.0.0 &)   # 临时 HTTP 分发

# 目标机
curl -o /tmp/am.tar http://<平台主机>:18080/alertmanager.tar && docker load -i /tmp/am.tar
```

配置 `/data/itops-hooks/alertmanager.yml`（**令牌用 `authorization` 携带**，因为 `webhook_configs` 不支持自定义请求头）：

```yaml
global:
  resolve_timeout: 5m
route:
  receiver: itops-platform
  group_by: ['alertname', 'instance']
  group_wait: 5s
  group_interval: 10s
  repeat_interval: 30m
receivers:
  - name: itops-platform
    webhook_configs:
      - url: 'http://<平台主机>:19301/api/hooks/alert/prometheus'
        send_resolved: true
        http_config:
          authorization:
            type: Bearer
            credentials: '<HOOKS_TOKEN>'
```

> **权限坑**：官方镜像以 `nobody`(65534) 运行，`chmod 600` 会导致 `Loading configuration file failed: permission denied` 并无限重启。
> 正确做法：`chown -R 65534:65534 /data/itops-hooks && chmod 750 /data/itops-hooks && chmod 640 /data/itops-hooks/alertmanager.yml`。

```bash
docker run -d --name itops-alertmanager --network <监控网络> --restart unless-stopped \
  -p 19093:9093 -v /data/itops-hooks/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro \
  alertmanager:0.27.0 --config.file=/etc/alertmanager/alertmanager.yml --storage.path=/alertmanager
```

### 2) Prometheus（规则 + 指向 Alertmanager）

```yaml
# prometheus.yaml 追加
rule_files:
  - /etc/prometheus/rules/*.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['itops-alertmanager:9093']
```

规则文件（挂载目录，示例含实用规则）：

```yaml
groups:
  - name: itops-hooks
    rules:
      - alert: ITOpsScrapeTargetDown
        expr: up == 0
        for: 1m
        labels: { severity: critical, source: prometheus }
        annotations:
          summary: '监控目标不可达：{{ $labels.instance }}'
```

- 若原容器未挂载规则目录，需在编排文件里加 `- ./observability/prometheus/rules:/etc/prometheus/rules:ro` 并重建该容器；
- 已加挂载后，仅改规则文件**不必重建**：`curl -X POST http://<prometheus>:9090/-/reload`（需 `--web.enable-lifecycle`，注意子路径部署时为 `/_prometheus/-/reload`）。

### 3) Grafana（联系点 + 告警规则）

```bash
G=http://127.0.0.1:19330; AUTH='admin:<密码>'

# 联系点：Grafana 的 webhook 也只能配 authorization，不能自定义请求头
curl -u "$AUTH" -X POST "$G/api/v1/provisioning/contact-points" \
  -H 'Content-Type: application/json' -H 'X-Disable-Provenance: true' -d '{
  "name": "ITOps-Platform-Hooks", "type": "webhook",
  "settings": {
    "url": "http://<平台主机>:19301/api/hooks/alert/grafana",
    "httpMethod": "POST",
    "authorization_scheme": "Bearer",
    "authorization_credentials": "<HOOKS_TOKEN>"
  },
  "disableResolveMessage": false }'
```

告警规则（关键点：**用规则级 `notification_settings.receiver` 指定联系点**，避免改动全局通知策略）：

```json
{ "title": "…", "ruleGroup": "itops-hooks", "folderUID": "itops-platform", "condition": "C",
  "for": "1m", "orgID": 1,
  "labels": { "severity": "critical", "source": "grafana" },
  "annotations": { "summary": "…", "description": "…" },
  "notification_settings": { "receiver": "ITOps-Platform-Hooks",
    "group_wait": "30s", "group_interval": "5m", "repeat_interval": "4h" },
  "data": [
    { "refId": "A", "datasourceUid": "asdm-prometheus", "relativeTimeRange": { "from": 300, "to": 0 },
      "model": { "datasource": { "type": "prometheus", "uid": "asdm-prometheus" }, "expr": "up == 0",
                 "instant": true, "range": false, "refId": "A", "intervalMs": 1000, "maxDataPoints": 100 } },
    { "refId": "C", "datasourceUid": "__expr__",
      "model": { "datasource": { "type": "__expr__", "uid": "__expr__" }, "type": "threshold",
                 "expression": "A", "refId": "C",
                 "conditions": [ { "type": "query", "evaluator": { "type": "gt", "params": [0] },
                   "operator": { "type": "and" }, "query": { "params": ["C"] },
                   "reducer": { "type": "last", "params": [] } } ] } }
  ] }
```

> 提交到 `POST/PUT /api/v1/provisioning/alert-rules` 时，注解里**不要写 Go 模板**（`{{ $labels.x }}`）——转义稍有偏差就会 400 被拒。

### 4) 按需验证投递链路（无需留下常驻自检告警）

```bash
# a) 直接从目标机投一条 Prometheus 报文到平台（只验网络+令牌+适配器）
curl -X POST http://<平台主机>:19301/api/hooks/alert/prometheus \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $HOOKS_TOKEN" \
  -d '{"alerts":[{"status":"firing","labels":{"alertname":"HookSelfCheck","instance":"probe","severity":"warning"},
       "annotations":{"summary":"链路自检"}}]}'

# b) 走完整链路（Alertmanager 注入，验证 Alertmanager→平台）
curl -X POST http://<dt01>:19093/api/v2/alerts -H 'Content-Type: application/json' -d '[{
  "labels":{"alertname":"HookSelfCheck","instance":"probe","severity":"warning"},
  "annotations":{"summary":"链路自检"},"startsAt":"2026-01-01T00:00:00Z"}]'
```

两条命令后，平台告警中心应出现 `HookSelfCheck`（来源分别为 `prometheus` / `grafana`）。

### 5) 实测踩到的坑

| 现象 | 原因与处理 |
|------|-----------|
| 界面读来源列表 401，进而被踢回登录页 | 平台曾要求「配置 HOOKS_TOKEN 后只认令牌」；**已修复**：管理员 Bearer JWT 与令牌二者其一即可（见「安全」） |
| Alertmanager/Grafana 无法带 `X-Hook-Token` | 二者的 webhook 只能配 `authorization`；平台已支持 `Authorization: Bearer <HOOKS_TOKEN>` 这一携带方式 |
| Grafana 改了配置却迟迟不投递 | Grafana 通知失败**不重试**，要等 `repeat_interval`（默认 4h）或告警状态变化；调短 `group_interval`/`repeat_interval` 可加速验证 |
| 平台告警标题显示成 `Grafana Alert` | Grafana 报文的规则名在 `labels.alertname`（每条 alert 无 `title`/`ruleName`）；**适配器已修**为逐级回退 |
| Alertmanager 反复重启报 `permission denied` | 见上文「权限坑」 |
| 投递成功但平台无记录 | 用 `docker logs itops-backend \| grep hooks` 看该请求的状态码；401/403 属认证，400 属来源/报文 |

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