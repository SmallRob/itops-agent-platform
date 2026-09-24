# 环境变量清单

> 环境变量用于**部署期**配置：进程启动或请求处理时读取，改动需重启容器（少数项在请求时读取，标注为「热」）。
> 运行期策略配置请优先使用 settings 表，见 [configuration.md](./configuration.md)。

复制模板开始：`cp .env.example .env`，生产环境务必逐项确认带 🚨 的变量。

---

## 基础运行

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NODE_ENV` | `development` | `production` 时启用严格校验（如必须配置 `JWT_SECRET`、最小长度 32） |
| `PORT` | `3001` | 后端监听端口 |
| `HOST` | `0.0.0.0` | 后端监听地址 |
| `DATABASE_PATH` | `./data/app.db` | SQLite 数据库文件（容器内建议 `/app/data/app.db`） |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

## 安全与认证

| 变量 | 默认值 | 说明 |
|------|--------|------|
| 🚨 `JWT_SECRET` | 开发环境随机生成 | 生产必填且 ≥32 字符；未设置时每次重启都会使全部 Token 失效 |
| `JWT_EXPIRES_IN` | `24h` | Access Token 有效期 |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh Token 有效期（最小 1 小时） |
| `CREDENTIAL_MASTER_KEY` | 空 | 凭据加密主密钥；未设置时加密密钥存于数据库（生产建议外置 KMS/Vault） |
| `ADMIN_INITIAL_PASSWORD` | `admin` | 仅首次初始化数据库时生效；首次登录会强制改密 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS 白名单（逗号分隔） |

## AI 模型

> 这些变量也可以在网页「设置 → AI 配置」中设置；settings 表的值优先于环境变量。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DOUBAO_API_KEY` | 空 | 豆包（火山引擎）密钥 |
| `DOUBAO_API_BASE` | `https://ark.cn-beijing.volces.com/api/v3` | 豆包 API 地址 |
| `DOUBAO_MODEL` | `doubao-4o` | 豆包模型名 |
| `OPENAI_API_KEY` | 空 | OpenAI（或兼容接口）密钥 |
| `OPENAI_API_BASE` | `https://api.openai.com/v1` | OpenAI API 地址 |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI 模型名 |
| `LOCAL_AI_API_KEY` | 空 | 本地模型密钥（可选） |
| `LOCAL_AI_API_BASE` | 空 | Ollama：`http://localhost:11434/v1`；LM Studio：`http://localhost:1234/v1` |
| `LOCAL_AI_MODEL` | 空 | 本地模型名（如 `qwen2.5`、`deepseek-coder`） |

## 告警通知

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ALERT_EMAIL_HOST` | 空 | SMTP 服务器 |
| `ALERT_EMAIL_PORT` | `587` | SMTP 端口 |
| `ALERT_EMAIL_USER` | 空 | SMTP 用户名 |
| `ALERT_EMAIL_PASS` | 空 | SMTP 密码/授权码 |
| `ALERT_EMAIL_TO` | 空 | 收件人（逗号分隔） |
| `ALERT_WEBHOOK_URL` | 空 | 通知 Webhook（企业微信/钉钉/Slack 等） |

## Webhook 入站（内置告警源）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `WEBHOOK_VERIFY_ENABLED` | `false` | 是否校验 `X-Webhook-Signature-{source}` HMAC-SHA256 签名 |
| 🚨 `WEBHOOK_SECRET` | 空 | 启用签名校验时必填；同时作为 Hook 令牌的回退值 |
| `WEBHOOK_IP_WHITELIST` | 空 | IP 白名单（逗号分隔），空=不限制（生产不推荐） |

## Hooks 入站（自定义/新接入事件源）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `HOOKS_TOKEN` | 空 | 外部系统调用 `/api/hooks/*` 时的 `X-Hook-Token` 期望值；为空则回退 `WEBHOOK_SECRET`。平台前端用管理员会话（Bearer JWT）访问，不受此项影响（热读取，重启生效） |

## Skills 技能

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SKILLS_DIR` | `<工作目录>/skills`（容器内 `/app/skills`） | 技能目录；目录内增删 = 安装/卸载（热读取） |
| `SKILLS_WATCH` | 未设置（开发环境开启监听） | 设为 `false` 关闭目录热监听；`NODE_ENV=production` 默认关闭 |

> 容器部署需把宿主技能目录挂载进来：`- ../skills:/app/skills`（zip 安装会写入该目录，挂载需可写）。
> 生产镜像已内置 `skills/` 副本（`COPY skills` 到镜像），未挂载时安装的新技能会写进容器层，重建即丢失。

## Agent 治理

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_BREAKER_THRESHOLD` | `3` | 连续失败多少次后熔断（可被 settings `agent_breaker_config` 覆盖） |
| `AGENT_BREAKER_COOLDOWN_MS` | `60000` | 熔断冷却时间（毫秒），到期进入 half-open 探测 |
| `AGENT_SERVICE_URL` | 生产栈 `http://agent-service:8000`（容器内直连）；单机跑 backend 时 `http://localhost:8000` | 外部 Python Agent 服务地址（compose 已注入） |
| `AGENT_SERVICE_TIMEOUT` | `120000` | 调用外部 Agent 服务超时（毫秒）；推理模型 + 工具循环耗时较长，生产栈已放宽 |
| `AGENT_SERVICE_RETRIES` | `2` | 调用重试次数 |

降级顺序本身不在环境变量里，用 `POST /api/agents/providers/chain` 写入 settings。

## 外部 Agent 服务（itops-agent-service 容器）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AGENT_SERVICE_LOG_LEVEL` | `INFO` | 容器内 Python 服务日志级别 |
| `LLM_PROVIDER` / `LLM_MODEL` | `deepseek` / `deepseek-v4-flash` | 兜底 LLM 配置；backend 启动时会把模型池默认模型（含 key/base）同步过去并持久化到 `data/llm_config.json`，此变量仅作独立启动兜底 |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_API_BASE` | 空 / `https://api.deepseek.com/v1` | DeepSeek 兜底配置（OpenAI 兼容协议） |
| `OPENAI_API_KEY` / `OPENAI_API_BASE`、`DOUBAO_API_KEY`、`QWEN_API_KEY` | 空 | 其余 provider 兜底配置 |

> 模型配置的唯一事实源是平台模型池（`ai_models` 表，AI 模型页可配）；外部服务落盘的 `llm_config.json` 只是抗重启副本，二者以后端启动同步收敛。API key 在 `GET /api/llm/config` 响应与日志中脱敏。

## Docker 资源管理

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DOCKER_ENABLED` | `true`（`!== 'false'` 即启用） | 是否启用本机 Docker 引擎能力（容器/镜像/卷/网络） |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | Docker socket 路径 |
| `DOCKER_PROTECTED_CONTAINERS` | 内置保护名单 | 额外保护（禁止启停/删除）的容器名，逗号分隔 |

## 备份

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BACKUP_CRON` | `0 3 * * *` | 定时备份表达式 |
| `BACKUP_ENCRYPTION_ENABLED` | `true`（`!== 'false'`） | 备份是否加密 |

## 前端（构建期 / 容器）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DOCKER_MODE` | 空 | 开发容器模式标记 |
| `VITE_API_BASE_URL` | 空 | 前端访问后端的基地址（如 `http://backend:3001`） |

---

## 排障

| 现象 | 排查 |
|------|------|
| 启动报 `Cannot start in production without required environment variables` | 生产环境缺 `JWT_SECRET` 或长度不足 32 |
| 重启后需要重新登录 / 管理员门禁失效 | 未设置 `JWT_SECRET`（随机密钥）或后端重建导致内存态丢失 |
| Hook 调用 401 | `HOOKS_TOKEN` 未设置且未带管理员 JWT，见 [hooks.md](./hooks.md#排障) |
| 技能列表为空 | `SKILLS_DIR` 路径不对，或挂载缺失（`docker inspect` 看 Mounts） |
| zip 安装后重建容器技能消失 | 未挂载宿主机目录，见上文「Skills 技能」备注 |