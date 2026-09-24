# 配置体系

> 平台配置分三层：**环境变量（部署期）** → **settings 表（运行期，可经 API 修改）** → **代码默认值**。
> 一句原则：**部署形态相关的走环境变量，运行策略相关的走 settings 表，两者都缺时用代码默认值。**

---

## 快速开始

```bash
# 查看运行期配置落点（AI 配置、技能停用集合、降级链等都在 settings 表）
docker exec itops-dev-backend \
  node -e "console.log(require('better-sqlite3')('/app/data/app.db').prepare('SELECT key FROM settings ORDER BY key').all().map(r=>r.key).join('\n'))"

# 改一个运行期配置（示例：把降级链设为 本地优先）
curl -s -X POST http://localhost:3001/api/agents/providers/chain \
  -H "Authorization: Bearer $TOKEN" -H "X-Session-Id: $SID" -H "X-Csrf-Token: $CSRF" \
  -H 'Content-Type: application/json' -d '{"chain":["local","agent-service"]}' | jq .data

# 部署期配置：复制模板并按需修改，重启容器后生效
cp .env.example .env && ${EDITOR:-vi} .env
```

---

## 三层优先级

```
① 环境变量（.env / docker-compose environment / K8s Secret）
        │  仅在「服务启动 / 请求处理」时读取，改动需重启（少数热读取，见下表）
        ▼
② settings 表（SQLite，经管理 API 或前端设置页写入）
        │  运行期立即生效，重启后保持
        ▼
③ 代码默认值（backend/src/utils/env.ts 与各服务内的 DEFAULT_* 常量）
```

> 特例说明：AI 模型配置（`DOUBAO_*` / `OPENAI_*` / `LOCAL_AI_*`）**同时**存在于两层——env 提供部署默认，settings 表保存界面上填的值，读取时以 settings 优先，便于运维在 UI 里换模型而不用重启。

---

## 配置域总览

| 配置域 | 主要位置 | 典型项 | 生效方式 |
|--------|----------|--------|----------|
| 基础运行 | env | `NODE_ENV` `PORT` `HOST` `DATABASE_PATH` `LOG_LEVEL` | 重启 |
| 安全认证 | env | `JWT_SECRET` `JWT_EXPIRES_IN` `CREDENTIAL_MASTER_KEY` `ALLOWED_ORIGINS` `ADMIN_INITIAL_PASSWORD` | 重启 |
| AI 模型 | env + settings | `DOUBAO_*` `OPENAI_*` `LOCAL_AI_*`；前端「设置 → AI 配置」 | settings 热生效 |
| 告警通知 | env + settings | `ALERT_EMAIL_*` `ALERT_WEBHOOK_URL`；告警通知配置页 | 各自热生效 |
| Webhook 入站 | env | `WEBHOOK_VERIFY_ENABLED` `WEBHOOK_SECRET` `WEBHOOK_IP_WHITELIST` | 重启 |
| Hooks 入站 | env | `HOOKS_TOKEN` | 重启（请求时读取） |
| Skills 技能 | env + settings | `SKILLS_DIR` `SKILLS_WATCH`；停用集合 `skills_disabled` | 热生效 |
| Agent 治理 | env + settings | `AGENT_BREAKER_THRESHOLD` `AGENT_BREAKER_COOLDOWN_MS`；`agent_fallback_chain` `agent_breaker_config` | 热生效（每次调用读取） |
| Docker 资源管理 | env | `DOCKER_ENABLED` `DOCKER_SOCKET_PATH` `DOCKER_PROTECTED_CONTAINERS` | 重启 |
| 备份 | env | `BACKUP_CRON` `BACKUP_ENCRYPTION_ENABLED` | 重启 |
| 知识库 | settings | `qanything_config` | 热生效 |
| 文件管理 | settings | `FILE_MANAGER_CONFIG` | 热生效 |

完整环境变量清单见 [environment-variables.md](./environment-variables.md)。

---

## 运行期配置（settings 表）

| key | 含义 | 修改入口 |
|-----|------|----------|
| `skills_disabled` | 被停用的技能 slug 数组 | `POST /api/skills/:slug/toggle`，或前端技能开关 |
| `agent_fallback_chain` | Agent 降级顺序（Provider id 数组，空数组=默认顺序） | `POST /api/agents/providers/chain` |
| `agent_breaker_config` | 熔断参数 `{"threshold":3,"cooldownMs":60000}` | 直接写 settings（暂无专用端点） |
| `DOUBAO_API_KEY` / `DOUBAO_MODEL` / `DOUBAO_API_BASE` | 豆包（火山引擎）接入 | 前端「设置 → AI 配置」，或 `PUT /api/settings/api-keys` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_API_BASE` | OpenAI 兼容接入 | 同上 |
| `LOCAL_AI_API_BASE` / `LOCAL_AI_MODEL` | 本地模型（Ollama / LM Studio / vLLM） | 同上 |
| `qanything_config` | QAnything 知识库接入 | 知识库配置页 |
| `FILE_MANAGER_CONFIG` | 文件管理器配置 | 文件管理配置页 |

> 改 `agent_breaker_config` 示例（冷却 10 秒，便于验证熔断）：
> ```sql
> INSERT OR REPLACE INTO settings (key, value) VALUES ('agent_breaker_config', '{"threshold":3,"cooldownMs":10000}');
> ```

---

## Agent 治理配置详解

```
skillRegistry.match(message)                      ① 技能：从 SKILLS_DIR 装载，按意图匹配
        │
orderProviders()                                  ② 降级链：settings.agent_fallback_chain
        │                                            （默认：默认 Provider → 其余按注册顺序）
isCircuitOpen(providerId)                         ③ 熔断：threshold / cooldownMs
        │                                            （settings.agent_breaker_config > env > 默认）
        ▼
依次尝试 → 结果携带 attempts[]（含 skipped 标记）与 degraded
```

- **阈值语义**：同一 Provider **连续**失败达到 `threshold` 次即熔断；成功一次即清零。
- **熔断期间**：该 Provider 在降级链中标记为 `skipped`（不会被调用），直接尝试下一个。
- **恢复**：冷却时间到后进入 `half-open`，放行一次探测，成功则闭合、失败则重新计时。
- **全部熔断**：兜底仍尝试链首 Provider，避免"熔断导致完全不可用"。
- **可见性**：`GET /api/agents/providers` 返回每个 Provider 的 `circuit`（state/failures/threshold/retryAt）与当前 `fallbackChain`。

---

## 配置变更后的生效方式

| 变什么 | 怎么生效 |
|--------|----------|
| env（`build` 类：端口、DB 路径、密钥） | 重启容器：`docker-compose up -d --force-recreate <svc>` |
| env（`HOOKS_TOKEN`、熔断阈值） | 请求/调用时读取，重启即可，无需重建镜像 |
| settings（技能启停、降级链、AI 配置） | 立即生效，重启不丢 |
| 技能文件（`skills/<slug>/*`） | 开发环境自动重载；生产 `POST /api/skills/reload` |
| 技能 zip 安装/卸载 | 接口内部自动 reload，立即生效 |

---

## 排障

| 现象 | 排查 |
|------|------|
| 改了 `.env` 没反应 | `.env` 是否被 compose 读取（`environment:` 段是否转发该变量）；改完是否重启容器 |
| 界面改的 AI 配置"不生效" | settings 优先于 env，但**旧进程缓存**可能仍在 → 重新触发一次调用或重启后端 |
| `JWT_SECRET` 变更后全员掉线 | 预期行为：签名密钥变化导致存量 Token 失效，重新登录即可 |
| 熔断参数改了没生效 | 参数**每次调用读取**；确认写的是 `agent_breaker_config` 且是合法 JSON |
| `SKILLS_DIR` 指向不存在的目录 | 服务仍可启动（装载 0 个技能），`GET /api/skills` 会显示空列表与目录路径 |
| 生产环境不自动重载技能 | 生产默认关闭目录监听，用 `/api/skills/reload` 或安装接口 |

---

## 相关文档

- [environment-variables.md](./environment-variables.md) —— 环境变量全量清单
- [architecture.md](./architecture.md) —— 分层架构与三条链路
- [skills.md](./skills.md) / [hooks.md](./hooks.md) —— 能力域使用与扩展
- [PRODUCTION.md](../PRODUCTION.md) —— 生产环境加固建议