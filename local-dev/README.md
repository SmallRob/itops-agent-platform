# ITOps Agent Platform - Local Development Environment

## 🚀 快速开始

### 1. 环境要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (已安装并运行)
- Windows 10/11

### 2. 启动开发环境

**方法一：双击批处理文件（推荐）**

```bash
# 双击 start-dev.bat 或运行：
.\start-dev.bat
```

**方法二：使用 docker-compose 命令**

```bash
# 进入开发目录
cd local-dev

# 复制环境配置
copy .env.example .env

# 启动开发环境
docker-compose up --build
```

### 3. 访问服务

| 服务         | 地址                             | 说明                |
| ---------- | ------------------------------ | ----------------- |
| 前端         | <http://localhost:5173>        | Vite 开发服务器（支持热重载） |
| 后端 API     | <http://localhost:3001>        | Express 后端服务      |
| 健康检查       | <http://localhost:3001/health> | 后端健康状态            |
| Node.js 调试 | localhost:9229                 | 调试端口              |

## 🛠️ 常用命令

### 启动/停止

```bash
# 启动开发环境
.\start-dev.bat

# 强制重新构建镜像
.\start-dev.bat --build

# 停止开发环境
.\stop-dev.bat

# 停止并清理所有数据
.\stop-dev.bat --clean
```

### Docker Compose 命令

<br />

```bash
# 查看服务状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 仅查看后端日志
docker-compose logs -f backend

# 仅查看前端日志
docker-compose logs -f frontend

# 重启服务
docker-compose restart

# 重启单个服务
docker-compose restart backend

# 重新构建并启动
docker-compose up --build -d
```

### 进入容器调试

```bash
# 进入后端容器
docker exec -it itops-dev-backend sh

# 进入前端容器
docker exec -it itops-dev-frontend sh

# 查看后端环境变量
docker exec itops-dev-backend env

# 在容器中运行测试
docker exec itops-dev-backend npm test
```

## 📁 目录结构

```
local-dev/
├── docker-compose.yml    # Docker Compose 配置
├── .env.example          # 环境变量示例
├── start-dev.bat         # 启动脚本
├── stop-dev.bat          # 停止脚本
└── README.md             # 本文件
```

## 🔧 开发说明

### 热重载

开发环境配置支持代码热重载：

- **前端**: 修改 `../frontend/src/` 下的文件后，Vite 会自动刷新浏览器
- **后端**: 修改 `../backend/src/` 下的文件后，需要手动重启后端服务：
  ```bash
  docker-compose restart backend
  ```

### 数据持久化

- 数据库文件存储在 Docker volume `dev-data` 中
- 停止容器不会丢失数据
- 使用 `stop-dev.bat --clean` 会清除所有数据

### 环境变量

复制 `.env.example` 为 `.env` 并修改：

```bash
JWT_SECRET=your-secret-key
DOUBAO_API_KEY=your-key
OPENAI_API_KEY=your-key
```

### 调试后端

1. 启动开发环境
2. 在 Chrome 中打开 `chrome://inspect`
3. 添加网络目标：`localhost:9229`
4. 在 DevTools 中调试

## ❓ 常见问题

### Q: Docker 构建失败

A: 确保 Docker Desktop 正在运行，且有足够的磁盘空间。

### Q: 端口被占用

A: 修改 `docker-compose.yml` 中的端口映射，如 `3001:3001` 改为 `3002:3001`。

### Q: 前端无法连接后端

A: 检查 `ALLOWED_ORIGINS` 环境变量是否正确配置。

### Q: 数据库初始化失败

A: 尝试清理数据卷重新启动：

```bash
.\stop-dev.bat --clean
.\start-dev.bat --build
```

## 📝 默认账号

- 用户名: `admin`
- 初始密码: `ITOps@2024!Secure` (首次登录后需修改)

## 🔗 相关链接

- [项目文档](../docs/)
- [API 文档](../docs/API.md)
- [部署指南](../DEPLOYMENT.md)

## 测试验证

Vite 开发服务器会自动热重载，你可以直接在 <http://localhost:5173> 测试：

- Web 终端是否能正常连接
- 输入命令是否正常（不再有重复字符）
- 服务器管理的导入导出功能是否正常

## 生产环境部署

测试没问题后，需要重新构建前端 Docker 镜像。先停止本地开发环境：

Thought

本地开发环境已停止。现在可以部署到生产环境了。

## 需要执行的命令

在项目根目录执行：

如果使用 docker-compose.simple.yml ：

```
docker compose -f docker-compose.
simple.yml up -d --build frontend
```

## 修复总结

共修复了 3 个 bug ：

问题 文件 修复内容 Web 终端 WebSocket 连接失败 WebTerminal.tsx Socket.IO 连接改为相对路径 服务器管理导入导出功能失败 ImportExport.tsx API 路径添加 /api 前缀 Web 终端输入字符重复 WebTerminal.tsx 移除重复的 terminal:data 事件注册

是否要我帮你提交这些修改并生成 commit message？
