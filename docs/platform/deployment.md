# 生产发布流程（本服务器 runbook）

> 本页记录**本服务器**（itops.leansoftx.com）从代码到投产的完整流程与验证清单。
> 适用场景：无独立演示环境，开发完成后直接投产（开发期用 `local-dev/docker-compose.yml`，投产用根目录 `docker-compose.yml`）。
> 配置项含义见 [configuration.md](./configuration.md)，环境变量清单见 [environment-variables.md](./environment-variables.md)。

---

## 快速开始（标准发布）

```bash
cd /data/itops-agent-platform

# 1. 构建镜像（必须 BuildKit：Dockerfile 使用了 --mount=type=cache）
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker-compose build

# 2. 重建容器（docker-compose v1 在此引擎上原地重建会抛 KeyError: ContainerConfig）
docker rm -f itops-backend itops-frontend
docker-compose up -d

# 3. 验证
docker ps --format '{{.Names}}\t{{.Status}}' | grep itops-
curl -s localhost:19301/health
curl -s -o /dev/null -w '%{http_code}\n' https://itops.leansoftx.com/

# 4. 提交
git -c user.name=ops -c user.email=ops@local commit -m "..."
```

---

## 拓扑

```
浏览器 ──HTTPS──▶ tcb-front-nginx（宿主，容器 tcb-front-nginx，网络 tcb-front-nginx-network）
                        │  /            → itops-frontend:80    （Nginx 静态产物）
                        │  /api         → itops-backend:3001   （Express API）
                        │  /socket.io   → itops-backend:3001   （WebSocket）
                        ▼
              itops-agent-platform_itops-network
                        ├── itops-backend        容器内 3001，宿主 19301
                        ├── itops-frontend       容器内 80，宿主 19300
                        └── itops-agent-service  容器内 8000（仅栈内可达，不发布宿主端口）
                                                    ↑ backend 以 AGENT_SERVICE_URL=http://agent-service:8000 直连
```

- 生产容器加入 `itops-network`（栈内互访）；backend/frontend 另加入 `tcb-front-nginx-network`（供宿主 nginx 反代）。
- `itops-agent-service`（外部 Python Agent 服务）只挂 `itops-network`：不暴露宿主端口，外部只能经 backend 的 `/api/agent-service/*`（JWT 鉴权）访问。
- LLM 配置链路：平台模型池（`ai_models` 表）= 唯一事实源 → backend 启动时同步给 agent-service → agent-service 落盘 `data/llm_config.json`（卷）抗重启。
- nginx 配置：`/data/tcb-front-nginx/conf.d/itops.conf`，用 `resolver 127.0.0.11 valid=10s` + 变量上游，容器重建换 IP 不会 502。
- 配置文件备份目录：`/data/itops-prod-backups/`。

---

## 构建环境前置条件

| 依赖 | 说明 |
|------|------|
| **buildx 插件** | 项目 Dockerfile 依赖 BuildKit 的 `--mount=type=cache`；宿主 `docker-compose build` 若报 `BuildKit is enabled but the buildx component is missing`，需安装：`/usr/libexec/docker/cli-plugins/docker-buildx`（从 GitHub releases 取 `buildx-<tag>.linux-amd64`，国内直连超时可走 `https://ghfast.top/` 前缀） |
| **基础镜像可达性** | 守护进程配置的 ustc 镜像 DNS 已失效；拉取基础镜像改走 `docker.1ms.run` 并重打标签，例如：`docker pull docker.1ms.run/library/python:3.12-slim && docker tag docker.1ms.run/library/python:3.12-slim python:3.12-slim`（`node:20-slim` 同理） |
| **PyPI 可达性** | `Dockerfile.backend` 会 `pip install dbskiter`，`Dockerfile.agent-service` 安装 Python 依赖。直连 pypi.org 在国内网络下会**静默挂起数十分钟**导致构建卡死，两个 Dockerfile 均已配置 `PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/` 且限制超时/重试（与文件内 apt/npm 镜像策略一致） |
| **外部网络** | 首次部署需 `docker network create tcb-front-nginx-network`（compose 中已声明为 `external: true`） |
| **宿主 Python（本地调试用）** | 宿主自带 3.10；itops-agent-service 本地测试用 uv 装 3.12：`pip3 install uv -i https://mirrors.aliyun.com/pypi/simple/` → `UV_PYTHON_INSTALL_MIRROR=https://ghfast.top/https://github.com/astral-sh/python-build-standalone/releases/download uv python install 3.12` → `uv venv .venv --python 3.12 && uv pip install -e '.[dev]' -i https://mirrors.aliyun.com/pypi/simple/`（镜像内同样使用 3.12，两端一致） |

---

## 数据迁移（开发库 → 生产库）

开发期数据（服务器凭据、Agent、工作流、告警规则等）如需带入生产，用 SQLite backup API 生成一致性快照，**不要直接 `cp` 带 WAL 的库**：

```bash
# 1. 停掉开发栈（保留卷）
docker-compose -f local-dev/docker-compose.yml down

# 2. 停掉生产容器，避免其持有目标库
docker rm -f itops-backend itops-frontend

# 3. 快照迁移（用生产镜像自带的 better-sqlite3，避免额外依赖）
docker run --rm -v local-dev_dev-data:/dev-data \
  -v itops-agent-platform_app-data:/prod-data \
  --entrypoint node itops-agent-platform_backend:latest -e "
const D=require('better-sqlite3'); const fs=require('fs');
const db=new D('/dev-data/app.db');
console.log(db.pragma('integrity_check'), db.pragma('wal_checkpoint(TRUNCATE)'));
db.backup('/prod-data/app.db').then(()=>{ db.close();
  // 关键：清掉目标库残留 WAL/SHM，防止旧 WAL 回放覆盖新库
  for (const f of ['/prod-data/app.db-wal','/prod-data/app.db-shm']) { try{fs.unlinkSync(f)}catch(e){} }
  const v=new D('/prod-data/app.db',{readonly:true});
  console.log(v.pragma('integrity_check'), v.prepare('SELECT COUNT(*) c FROM servers').get());
  v.close();
})"

# 4. 启动生产栈
docker-compose up -d
```

**要点**

- 凭据加密密钥存放在库内 `encryption_keys` 表，因此**整库迁移后服务器密码可直接解密**，不依赖 `CREDENTIAL_MASTER_KEY`。
- 迁移后容器属主为 root，由 entrypoint 的 `chown -R appuser:appgroup /app/data` 自动修正，无需手工处理。
- 生产 `.env` 的 `JWT_SECRET` 与开发环境不同，切换后所有会话失效，需重新登录（预期行为）。

---

## 域名切换

编辑 `/data/tcb-front-nginx/conf.d/itops.conf`，把三个 location 的上游从开发容器改为生产容器：

| location | 开发 | 生产 |
|----------|------|------|
| `/` | `itops-dev-frontend:3000` | `itops-frontend:80` |
| `/api` | `itops-dev-backend:3001` | `itops-backend:3001` |
| `/socket.io` | `itops-dev-backend:3001` | `itops-backend:3001` |

```bash
docker exec tcb-front-nginx nginx -t && docker exec tcb-front-nginx nginx -s reload
```

---

## 验证清单

| 检查项 | 命令 / 方式 | 期望 |
|--------|-------------|------|
| 容器健康 | `docker ps \| grep itops-` | backend / frontend / agent-service 三者 `(healthy)` |
| 后端探活 | `curl -s localhost:19301/health` | `"status":"healthy"` |
| 外部 Agent 服务 | 登录后 `GET /api/agents/providers` | `agent-service` `healthy:true`，消息含「已注册 Agent 类型 N 个」；backend 启动日志含 `Agent service LLM config synced: deepseek/deepseek-v4-flash` |
| Agent 对话（远端链路） | 登录后 `POST /api/agents/providers/chat` 带 `"provider":"agent-service"` | 返回真实 LLM 回复，`attempts` 里 `agent-service` 成功 |
| 域名可达 | `curl -so /dev/null -w '%{http_code}' https://itops.leansoftx.com/` | `200` |
| 鉴权链路 | `curl -so /dev/null -w '%{http_code}' https://itops.leansoftx.com/api/skills` | `401`（非 502） |
| 服务的是生产产物 | `docker exec itops-frontend ls /usr/share/nginx/html/assets/ \| grep index-`，与域名 `index.html` 引用的 hash 对比 | 一致 |
| WebSocket | 浏览器实测 `wss://itops.leansoftx.com/socket.io/?EIO=4&transport=websocket` | `WS_OPEN` |
| 数据完整 | 驾驶舱 / 服务器管理页 | 迁移的服务器、Agent、工作流数量正确 |
| 技能装载 | 启动日志 / `GET /api/skills` | `[skills] 已装载 4 个技能`，`errors: 0` |
| Docker 资源 | `GET /api/docker/hosts` 后逐个 probe | `local` + 各 Linux 主机 `available=true` |
| nginx 无上游错误 | `docker exec tcb-front-nginx tail /var/log/nginx/error.log` | 无 `502` / `no live upstreams` |

---

## 回滚

```bash
# 1. 上游切回开发容器（仅当开发栈仍在）
cp /data/itops-prod-backups/itops.conf.dev-upstream-*.bak /data/tcb-front-nginx/conf.d/itops.conf
docker exec tcb-front-nginx nginx -t && docker exec tcb-front-nginx nginx -s reload

# 2. 生产库回滚到迁移前
docker rm -f itops-backend
docker run --rm -v itops-agent-platform_app-data:/data -v /data/itops-prod-backups:/backup alpine:3.20 \
  sh -c "cp /backup/prod-empty-pre-migration-*.db /data/app.db && rm -f /data/app.db-wal /data/app.db-shm"
docker-compose up -d
```

> 换库前务必删除 `app.db-wal` / `app.db-shm`，否则残留 WAL 会被回放到新库上。

---

## 常见问题

| 现象 | 原因与处理 |
|------|-----------|
| `docker-compose build` 报 `buildx component is missing` | 未安装 buildx CLI 插件，见上文「构建环境前置条件」 |
| 后端构建卡在某一步几十分钟无输出 | `pip install` 直连 PyPI 挂起；确认 `Dockerfile.backend` 的 `PIP_INDEX_URL` 指向阿里云镜像 |
| 容器重建后域名 502 | nginx 未用变量上游 + Docker resolver，缓存了旧容器 IP |
| 域名返回 200 但页面是旧版本 | 上游仍指向开发容器；确认 `itops.conf` 已切到 `itops-frontend:80` |
| 外网能开页面但接口 4xx | 检查 `.env` 的 `ALLOWED_ORIGINS` 是否包含实际访问域名 |
| `git push` 长时间无响应 | 本机 DNS 把 github.com 解析到被阻断的 IP；可临时 `echo "<可用IP> github.com" >> /etc/hosts` 后推送并还原 |
| `/platform#providers` 显示外部 Agent 服务不可用 | ① 容器未起：`docker ps \| grep agent-service`，缺则 `docker-compose up -d agent-service`；② 刚重启完 30s 内属健康缓存未刷新；③ 看 `docker logs itops-agent-service` 与 backend 启动日志 |
| agent-service 重启后对话退化为通用回答 | 注册表在内存（平台 Agent 需 backend 启动时注册），重启后到下次 backend 重启前注册丢失；LLM 配置不受影响（已落盘）。手动补注册：重启 `itops-backend` 即可（启动流程自动注册全部平台 Agent 并同步模型配置） |