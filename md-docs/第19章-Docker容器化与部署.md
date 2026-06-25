# 第十九章 Docker容器化与部署

## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="../../frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策

## 本章导读

ITOps Agent Platform 采用完全容器化的部署方案，前后端各自独立构建、独立运行，通过 Docker Compose 进行服务编排。本章将深入剖析项目的容器化架构，从多阶段 Dockerfile 构建到 Nginx 反向代理配置，从 Docker Compose 服务编排到生产环境最佳实践，帮助读者全面掌握项目的部署体系。

## 学习目标

- 理解多阶段构建的原理及其在项目中的应用
- 掌握前端 Nginx 配置：反向代理、WebSocket 升级、静态资源缓存策略
- 掌握 Docker Compose 服务编排：网络、卷、资源限制、健康检查
- 学会管理 Docker 环境下的环境变量与密钥
- 能够独立完成项目的构建、部署与故障排查

## 核心内容

### 19.1 前端多阶段构建：Dockerfile.frontend

前端采用 **两阶段构建**：第一阶段在 Node.js 环境中编译 React 应用，第二阶段将构建产物注入 Nginx 容器中运行。

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app
ENV npm_config_cache=/app/.npm-cache

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/app/.npm-cache \
    npm ci --prefer-offline --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# Stage 2: Production (Nginx)
FROM nginx:alpine

LABEL maintainer="ITOps Team"
LABEL org.opencontainers.image.title="ITOps Agent Platform Frontend"

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**多阶段构建的优势：**

```
┌─────────────────────────────────────────────────────────┐
│                    Stage 1: Builder                      │
│                                                         │
│  node:20-alpine (~180MB)                                │
│  + npm dependencies (~300MB)                            │
│  + TypeScript compiler                                   │
│  + Source code                                          │
│  + Vite build tools                                     │
│                                                         │
│  产出: /app/dist (静态文件 ~2MB)                        │
└────────────────────────┬────────────────────────────────┘
                         │  COPY --from=builder
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  Stage 2: Production                     │
│                                                         │
│  nginx:alpine (~40MB)                                   │
│  + nginx.conf                                           │
│  + /app/dist (仅构建产物 ~2MB)                          │
│                                                         │
│  最终镜像: ~45MB                                        │
└─────────────────────────────────────────────────────────┘
```

**关键技术点：**

| 技术点 | 说明 |
|--------|------|
| `node:20-alpine` | 使用 Alpine 基础镜像，体积仅约 180MB |
| `--mount=type=cache` | BuildKit 缓存挂载，加速依赖安装 |
| `npm ci` | 基于 lock 文件精确安装，保证可重复构建 |
| `COPY --from=builder` | 仅复制构建产物，丢弃编译工具链 |
| `HEALTHCHECK` | 容器健康检查，每 30 秒探测一次 |
| `daemon off;` | Nginx 前台运行，适配容器生命周期 |

### 19.2 后端多阶段构建：Dockerfile.backend

后端同样采用两阶段构建，但需要额外的编译工具链来构建 `better-sqlite3` 原生模块。

```dockerfile
# Stage 1: Builder
FROM node:20-slim AS builder

WORKDIR /app

# 安装编译原生模块所需的构建工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build

# Stage 2: Production
FROM node:20-slim

LABEL maintainer="ITOps Team"
LABEL org.opencontainers.image.title="ITOps Agent Platform Backend"

WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOST=0.0.0.0

# 安装运行时依赖和 gosu（用于降权运行）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    gosu \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY backend/package.json ./
COPY docker/docker-entrypoint-backend.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data

# 创建非 root 用户
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

RUN chown -R appuser:appgroup /app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/app.js"]
```

**后端构建的特殊考量：**

| 特性 | 说明 |
|------|------|
| `node:20-slim` | 使用 Slim 而非 Alpine，因为 `better-sqlite3` 需要 glibc |
| `python3 + make + g++` | 编译原生 C++ 模块的必要工具链 |
| `gosu` | 容器启动时从 root 降级到 appuser |
| `--start-period=30s` | 后端启动较慢，给予 30 秒启动宽限期 |
| 非 root 运行 | 安全最佳实践，限制容器内权限 |

**容器启动流程：**

```
┌─────────────────────────────────────────────────────┐
│               容器启动流程                            │
│                                                     │
│  1. Docker 启动容器 (root)                           │
│         │                                           │
│         ▼                                           │
│  2. ENTRYPOINT: docker-entrypoint.sh                │
│     - 修复 /app/data 目录权限                        │
│     - 使用 gosu 降权到 appuser                       │
│         │                                           │
│         ▼                                           │
│  3. CMD: node dist/app.js                           │
│     - Express 服务启动 (端口 3001)                   │
│     - 初始化数据库                                    │
│     - 启动 WebSocket 服务                            │
│         │                                           │
│         ▼                                           │
│  4. HEALTHCHECK 开始探测                             │
│     - GET /health → 200 OK                          │
└─────────────────────────────────────────────────────┘
```

### 19.3 Nginx 反向代理配置

Nginx 在前端容器中扮演三个角色：静态文件服务器、API 反向代理、WebSocket 代理。

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # ─── 安全头 ───
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; ..." always;
    server_tokens off;

    # ─── SPA 路由：不缓存 HTML ───
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    # ─── 静态资源：激进缓存 ───
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable" always;
    }

    location ~* \.(png|jpg|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable" always;
    }

    # ─── API 反向代理 ───
    location /api {
        proxy_pass http://backend:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_read_timeout 300s;   # LLM 流式响应需要较长超时
    }

    # ─── WebSocket 代理 ───
    location /socket.io {
        proxy_pass http://backend:3001/socket.io;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;

        proxy_connect_timeout 60s;
        proxy_read_timeout 3600s;   # 长连接保持 1 小时
    }
}
```

**请求路由示意图：**

```
                    浏览器请求
                       │
                       ▼
                  ┌─────────┐
                  │ Nginx   │
                  │ :80     │
                  └────┬────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
     location /    location /api  location /socket.io
          │            │            │
          ▼            ▼            ▼
   /usr/share/   proxy_pass      proxy_pass
   nginx/html/   http://backend  http://backend
   index.html    :3001/api       :3001/socket.io
   (SPA)         (REST API)      (WebSocket)
```

**缓存策略对比表：**

| 资源类型 | Cache-Control | 过期时间 | 原因 |
|----------|--------------|----------|------|
| index.html | no-store, no-cache | 0 | SPA 入口文件，需获取最新版本 |
| JS/CSS 包 | public, immutable | 1 年 | 文件名含 hash，内容不变则文件名不变 |
| 图片/字体 | public, immutable | 1 年 | 静态资源，几乎不变 |
| API 响应 | 由后端控制 | - | 不走 Nginx 缓存 |

### 19.4 Docker Compose 服务编排

`docker-compose.yml` 定义了完整的生产部署配置：

```yaml
services:
  backend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
    container_name: itops-backend
    networks:
      - itops-network
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET:?JWT_SECRET must be set}
      - DOUBAO_API_KEY=${DOUBAO_API_KEY:-}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:80}
    volumes:
      - app-data:/app/data
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  frontend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
    container_name: itops-frontend
    networks:
      - itops-network
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "3"

networks:
  itops-network:
    driver: bridge

volumes:
  app-data:
    driver: local
```

**服务架构拓扑：**

```
┌──────────────────────────────────────────────────────────────┐
│                     Docker Host                               │
│                                                              │
│   ┌─────────────────────┐              ┌──────────────────┐  │
│   │   itops-frontend    │              │   itops-backend  │  │
│   │   port: 8080→80     │              │   port: 3001     │  │
│   │                     │   HTTP API   │                  │  │
│   │   nginx:alpine      │─────────────▶│  node:20-slim    │  │
│   │   (static + proxy)  │  WebSocket   │  (Express + WS)  │  │
│   │                     │◀─────────────│                  │  │
│   └─────────────────────┘              └────────┬─────────┘  │
│                                                  │            │
│                                          ┌───────▼───────┐   │
│                                          │  SQLite DB    │   │
│                                          │  /app/data/   │   │
│                                          │  app.db       │   │
│                                          └───────┬───────┘   │
│                                                  │            │
└──────────────────────────────────────────────────┼────────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Named Volume   │
                                          │  app-data       │
                                          │  (持久化存储)     │
                                          └─────────────────┘
```

### 19.5 Docker 最佳实践总结

本项目采用的 Docker 最佳实践：

**1. 多阶段构建减小镜像体积**

```
传统构建:    node:20-slim + src + deps + build tools = ~600MB
多阶段构建:  nginx:alpine + dist only              = ~45MB (前端)
多阶段构建:  node:20-slim + dist + prod deps       = ~250MB (后端)
```

**2. 非 root 用户运行**

```dockerfile
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
# 配合 gosu 在 entrypoint 中降权
```

**3. 健康检查确保服务可用性**

```yaml
healthcheck:
  test: ["CMD", ...]
  interval: 30s     # 每 30 秒检查一次
  timeout: 10s      # 超时时间
  retries: 3        # 连续 3 次失败标记为 unhealthy
  start_period: 30s # 启动宽限期
```

**4. 资源限制防止单容器耗尽宿主机资源**

```yaml
deploy:
  resources:
    limits:          # 硬限制
      cpus: '2.0'
      memory: 2G
    reservations:    # 保证最低资源
      cpus: '0.5'
      memory: 512M
```

**5. 日志轮转防止磁盘占满**

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"   # 单个日志文件最大 10MB
    max-file: "5"     # 最多保留 5 个文件
    # 总计最大: 50MB
```

### 19.6 环境变量管理

**生产环境变量清单：**

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET` | 是 | - | JWT 签名密钥，生产环境必须设置 |
| `DOUBAO_API_KEY` | 否 | - | 豆包 API 密钥 |
| `DOUBAO_API_BASE` | 否 | `https://ark.cn-beijing.volces.com/api/v3` | 豆包 API 地址 |
| `DOUBAO_MODEL` | 否 | `doubao-4o` | 豆包模型名称 |
| `OPENAI_API_KEY` | 否 | - | OpenAI API 密钥 |
| `OPENAI_API_BASE` | 否 | `https://api.openai.com/v1` | OpenAI API 地址 |
| `OPENAI_MODEL` | 否 | `gpt-4o` | OpenAI 模型名称 |
| `ALLOWED_ORIGINS` | 否 | `http://localhost:80,...` | CORS 允许来源，逗号分隔 |
| `DATABASE_PATH` | 否 | `/app/data/app.db` | SQLite 数据库路径 |

**环境变量传递方式：**

```bash
# 方式一：.env 文件
cat > .env << EOF
JWT_SECRET=$(openssl rand -hex 32)
DOUBAO_API_KEY=your-key-here
ALLOWED_ORIGINS=https://your-domain.com
EOF

docker compose --env-file .env up -d

# 方式二：直接导出环境变量
export JWT_SECRET=$(openssl rand -hex 32)
export DOUBAO_API_KEY=your-key-here
docker compose up -d

# 方式三：docker compose 内联
JWT_SECRET=my-secret docker compose up -d
```

**安全注意事项：**

```
❌ 错误做法：将 JWT_SECRET 硬编码在 docker-compose.yml 中
✅ 正确做法：使用 .env 文件 + .gitignore 排除，或通过 CI/CD Secrets 注入

.gitignore 内容：
.env
.env.*
!env.example
```

### 19.7 部署命令与故障排查

**完整部署流程：**

```bash
# 1. 克隆代码
git clone https://github.com/qinshihu/itops-agent-platform.git
cd itops-agent-platform

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 JWT_SECRET 和 API Key

# 3. 启动服务
docker compose up -d

# 4. 检查服务状态
docker compose ps

# 5. 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 6. 健康检查
docker inspect --format='{{.State.Health.Status}}' itops-backend
docker inspect --format='{{.State.Health.Status}}' itops-frontend
```

**常用故障排查命令：**

```bash
# 查看容器日志（最近 100 行）
docker logs --tail 100 itops-backend

# 进入容器内部调试
docker exec -it itops-backend sh

# 检查容器资源使用
docker stats itops-backend itops-frontend

# 检查网络连通性
docker exec itops-frontend wget -qO- http://backend:3001/health

# 重新构建并启动
docker compose build --no-cache
docker compose up -d --force-recreate

# 停止并清理（保留数据卷）
docker compose down

# 停止并清理（包括数据卷，会丢失数据！）
docker compose down -v
```

**常见问题排查表：**

| 现象 | 可能原因 | 排查命令 |
|------|----------|----------|
| 容器不断重启 | 健康检查失败、环境变量缺失 | `docker logs <container>` |
| 前端无法访问后端 | 网络不通、后端未启动 | `docker exec frontend wget backend:3001/health` |
| 数据库持久化失效 | 卷未正确挂载 | `docker volume inspect app-data` |
| 端口冲突 | 宿主机端口被占用 | `netstat -tlnp \| grep 3001` |
| 镜像拉取失败 | 网络问题、认证失效 | `docker pull <image>` 手动测试 |

## 本章小结

本章系统讲解了 ITOps Agent Platform 的容器化部署方案。前端通过 `Dockerfile.frontend` 在 Node.js 中构建、Nginx 中运行，最终镜像仅约 45MB；后端通过 `Dockerfile.backend` 在 Slim 镜像中编译并运行，支持非 root 用户和安全降权。`nginx.conf` 实现了 SPA 路由、API 反向代理、WebSocket 升级和分级缓存策略。`docker-compose.yml` 则完成了服务编排、资源限制、健康检查和日志管理。掌握了这些知识，你将能够独立部署、维护和排查项目的容器化环境。

## 本章练习

### 基础练习

1. **手动构建镜像**：不使用 docker-compose，分别使用 `docker build` 命令构建前端和后端镜像，并使用 `docker run` 启动容器，使前端能够正常访问后端 API。

2. **修改健康检查**：将后端的健康检查改为使用 `curl` 而不是 `node -e`，编写对应的 HEALTHCHECK 指令，并解释两者的优劣。

3. **环境变量验证**：编写一个 `.env.example` 文件，列出所有需要的环境变量及其说明，并修改 `.gitignore` 确保敏感文件不被提交。

### 进阶练习

4. **添加 HTTPS 支持**：使用 Nginx 配置 HTTPS，通过 Let's Encrypt 或自签名证书，使前端通过 HTTPS 提供服务，并将 HTTP 请求重定向到 HTTPS。

5. **实现蓝绿部署**：编写脚本实现蓝绿部署策略，确保部署新版本时服务不中断，包含流量切换和回滚功能。

6. **多架构镜像构建**：修改 Dockerfile 和 CI/CD 配置，支持 `linux/amd64` 和 `linux/arm64` 双架构构建，使用 Docker Buildx 完成交叉编译。

### 思考题

7. 本项目后端使用 SQLite 作为数据库，在容器化环境中部署 SQLite 有哪些潜在风险？如果未来需要迁移到 PostgreSQL 或 MySQL，Docker Compose 配置需要做哪些调整？

8. 多阶段构建虽然减小了镜像体积，但也增加了构建时间。在 CI/CD 流水线中，如何利用 Docker 层缓存和 BuildKit 特性来优化构建速度？请结合项目实际分析。

## 延伸阅读

- Docker 官方文档：[Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- Nginx 官方文档：[Using nginx as a reverse proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
- Docker Compose 参考：[Compose file version 3 reference](https://docs.docker.com/compose/compose-file/)
- OWASP Docker 安全指南：[Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- 书籍推荐：《Docker 实践》第 4 版，容器化部署的系统性参考
