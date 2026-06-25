# Web SSH 终端

基于 xterm.js + WebSocket + SSH2 的交互式远程终端，支持在浏览器中直接操作远程 Linux 服务器。

## 技术架构

```
浏览器 ──xterm.js──> Socket.io ──terminal:data──> Node.js
                                                     │
                                            terminalService
                                                 │
                                               SSH2 Shell
                                                 │
                                          目标 Linux 服务器
```

## 功能特性

### 交互式终端
- 完整的 xterm.js 终端体验（光标闪烁、滚动、颜色）
- 窗口大小自适应，自动 fit 到容器
- VS Code 暗色主题配色方案

### 实时通信
- WebSocket 双向低延迟传输
- 连接中/已连接/错误/断开 四种状态显示
- 自动重连支持

### 服务器选择
- 按名称、IP、用户名、标签快速筛选
- 支持密码和 SSH 密钥两种认证方式
- 连接状态实时反馈

### 内存管理
- 终端会话 30 分钟 TTL 自动清理
- 最大 100 个活跃会话上限
- 5 分钟定时清理过期会话
- 组件卸载时自动断开 SSH 连接

## 使用指南

### 1. 打开终端
点击左侧菜单 **"Web 终端"** 进入终端页面。

### 2. 选择服务器
从列表中选择一个已添加的服务器，系统会自动建立 SSH 连接。

### 3. 交互操作
- 输入命令并按 Enter 执行
- 支持 Ctrl+C、Ctrl+Z 等终端快捷键
- 支持命令历史（↑↓ 键）
- 窗口大小自动同步到远程 Shell

### 4. 切换/关闭
- 点击 "断开连接" 关闭当前终端
- 切换服务器会自动断开旧连接
- 离开页面时自动清理会话

## WebSocket 事件

### 客户端 → 服务端

| 事件 | 说明 |
|------|------|
| `terminal:open` | 打开终端，携带 `serverId` |
| `terminal:data` | 发送键盘输入数据 |
| `terminal:resize` | 同步窗口大小（cols/rows） |
| `terminal:close` | 关闭终端会话 |

### 服务端 → 客户端

| 事件 | 说明 |
|------|------|
| `terminal:session` | 返回 `sessionId`（连接成功） |
| `terminal:data` | 推送 Shell 输出数据 |
| `terminal:error` | 推送错误信息 |
| `terminal:closed` | 通知会话已关闭 |

## API 接口

### POST /api/terminal/open
打开新的终端会话

```json
{
  "serverId": "uuid"
}
```

### POST /api/terminal/data
发送终端输入数据

```json
{
  "sessionId": "uuid",
  "data": "ls -la\n"
}
```

### POST /api/terminal/resize
同步窗口大小

```json
{
  "sessionId": "uuid",
  "cols": 80,
  "rows": 24
}
```

### DELETE /api/terminal/:sessionId
关闭终端会话

## 安全考虑

- 所有连接均需 JWT 认证
- SSH 密码和密钥 AES-256-GCM 加密存储
- 会话自动超时清理，防止资源泄漏
- 组件卸载时主动断开 SSH 连接

## 常见问题

### 终端无响应
- 检查 SSH 连接状态
- 确认服务器可达
- 尝试断开后重新连接

### 窗口显示异常
- 刷新页面重置终端状态
- 检查浏览器控制台是否有 JS 错误
- 清除浏览器缓存后重试
