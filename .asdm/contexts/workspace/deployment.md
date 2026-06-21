# 部署配置

## 1. 环境变量

主要环境变量配置（参考 `.env.example`）：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 后端服务端口 | 3001 |
| NODE_ENV | 运行环境 | development |
| JWT_SECRET | JWT密钥 | - |
| ALLOWED_ORIGINS | CORS允许来源 | * |

## 2. Docker 部署

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose down && docker-compose up -d --build
```

## 3. 本地开发

```bash
# 安装依赖
npm run install:all

# 启动开发服务器
npm run dev

# 仅启动后端
npm run dev:backend

# 仅启动前端
npm run dev:frontend
```

## 4. 生产构建

```bash
# 构建
npm run build

# 启动
cd backend && npm start
```

## 5. 数据目录

- 数据库文件: `backend/data/app.db`
- 日志文件: `backend/logs/`
- 备份文件: `backend/backups/`
- 知识库文件: `backend/data/knowledge/`
