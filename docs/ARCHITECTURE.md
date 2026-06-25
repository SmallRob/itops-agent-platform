# 架构设计

本文档详细描述企业IT运维多Agent自动化平台的系统架构和技术设计。

## 📐 系统概览

### 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                         前端层 (React)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 仪表盘   │ │ 服务器   │ │ 工作流   │ │ 告警     │      │
│  │ 页面     │ │ 管理     │ │ 编辑器   │ │ 中心     │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                      HTTP + WebSocket
                              │
┌─────────────────────────────────────────────────────────────┐
│                      后端层 (Express.js)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 API 路由层（47 个模块）                 │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │              业务逻辑服务层（50+ 个模块）               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │ Agent    │ │ 工作流   │ │ SSH      │ │ 告警    │ │  │
│  │  │ 服务     │ │ 执行     │ │ 服务     │ │ 处理    │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │              数据访问层（SQLite, WAL 模式）            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      外部服务                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  LLM API    │ │  监控系统   │ │  通知服务   │          │
│  │ (豆包/OpenAI)│ │(Zabbix等)   │ │(企业微信等) │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 🏗️ 技术栈

### 前端技术栈
- **框架**: React 18
- **语言**: TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: React Query + Context API
- **工作流编辑器**: React Flow (@xyflow/react)
- **WebSocket**: Socket.io Client
- **路由**: React Router

### 后端技术栈
- **运行时**: Node.js
- **框架**: Express.js
- **语言**: TypeScript
- **数据库**: SQLite (better-sqlite3)
- **WebSocket**: Socket.io
- **SSH**: ssh2
- **加密**: AES-256-GCM (crypto)
- **认证**: JWT (jsonwebtoken)
- **定时任务**: node-schedule

### 部署技术栈
- **容器化**: Docker
- **编排**: Docker Compose
- **反向代理**: Nginx

## 🗄️ 数据库设计

### 主要数据表

#### users - 用户表
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### servers - 服务器表
```sql
CREATE TABLE servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  password TEXT,
  private_key TEXT,
  description TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### agents - Agent表
```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  system_prompt TEXT,
  config TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### workflows - 工作流表
```sql
CREATE TABLE workflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  nodes TEXT,
  edges TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### tasks - 任务表
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id INTEGER,
  status TEXT NOT NULL,
  context TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### alerts - 告警表
```sql
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'open',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 核心模块设计

### 1. 工作流执行引擎

**文件位置**: `backend/src/services/workflowExecutor.ts`

**主要职责**:
- 解析工作流定义（节点和边）
- 控制执行流程
- 管理执行上下文
- 通过WebSocket推送进度
- 基于拓扑排序的线性执行，y坐标从上到下、x坐标从左到右

**当前实现**:
> 当前版本仅支持线性工作流执行（基于拓扑排序的顺序执行）。条件分支和并行执行为计划中的功能，尚未实现。

**执行流程**:
```
1. 初始化执行上下文
2. 找到起始节点
3. 执行当前节点（Agent节点 → 调用Agent服务）
4. 更新执行状态
5. 推送WebSocket事件
6. 找到下一个节点（按拓扑排序顺序）
7. 重复3-6直到完成
```

**计划中的功能**:
- 条件分支支持（根据执行结果选择不同的分支路径）
- 并行执行（同时执行多个独立节点）

### 2. Agent服务

**文件位置**: `backend/src/services/agentExecutor.ts`, `backend/src/services/llmService.ts`, `backend/src/services/multiAgentCollaboration.ts`

**主要职责**:
- 提供9个预设Agent的实现（告警处理、故障诊断、日志分析、系统巡检、变更执行、文档生成、合规检查、服务器命令执行、自动巡检）
- 支持自定义Agent创建
- 调用LLM API进行智能处理（支持豆包和OpenAI双API）
- 管理Agent的系统提示词
- 处理Agent的输入输出
- 多Agent协作执行

### 3. SSH服务

**文件位置**: `backend/src/services/sshService.ts`, `backend/src/services/terminalService.ts`

**主要职责**:
- 管理SSH连接池
- 执行远程命令
- 处理连接认证
- 管理加密凭证
- Web SSH终端（基于xterm.js的交互式终端，支持实时双向通信、窗口自适应）
- 终端会话管理（30分钟TTL自动清理，最大100个活跃会话）

### 4. 告警处理

**文件位置**: `backend/src/routes/alertRoutes.ts`, `backend/src/routes/webhookRoutes.ts`, `backend/src/services/alertNoiseReductionService.ts`, `backend/src/services/rootCauseAnalysisService.ts`

**主要职责**:
- 接收Webhook告警（Prometheus Alertmanager、Zabbix、通用格式）
- 自动匹配工作流
- 告警降噪处理（自动去重和抑制）
- 根因分析
- 告警→工作流自动映射触发
- 状态管理：new / acknowledged / resolved

### 5. 通知服务

**文件位置**: `backend/src/services/notificationService.ts`

**主要职责**:
- 多渠道通知（WebSocket、企业微信、钉钉、邮件）
- 通知配置管理
- 消息模板渲染

### 6. 知识库与RAG

**文件位置**: `backend/src/services/enhancedRAGService.ts`

**主要职责**:
- 22条预设知识条目管理
- 增强RAG检索（关键词匹配+语义相关度评分+使用频率权重+时间衰减）
- 自动注入LLM对话上下文
- 批量导入/导出

### 7. AI Copilot

**文件位置**: `backend/src/services/copilotService.ts`

**主要职责**:
- 自然语言对话式运维助手
- 自动感知系统告警、服务器、任务状态
- 基于规则的快速响应 + LLM深度分析
- 对话历史管理（7天TTL + 1000条上限）

### 8. 定时任务调度

**文件位置**: `backend/src/services/schedulerService.ts`

**主要职责**:
- 基于node-schedule的Cron定时任务
- 4个预设定时任务（每日健康检查、每周合规检查、日志定期分析、数据库备份）
- 自动执行指定工作流
- 状态管理：启用/禁用、上次/下次运行时间

### 9. 自动修复服务

**文件位置**: `backend/src/services/remediationService.ts`, `backend/src/services/aiRemediationService.ts`

**主要职责**:
- 告警自动触发修复策略
- 支持自定义修复工作流和审批流程
- AI 分析告警后自动生成结构化修复命令
- 根据风险等级自动设置审批超时时间

### 10. 备份恢复服务

**文件位置**: `backend/src/services/backupService.ts`

**主要职责**:
- 自动/手动数据库备份，支持 gzip 压缩
- 备份完整性校验
- 恢复后自动优雅重启
- 备份历史管理和清理策略

### 11. 数据导入导出

**文件位置**: `backend/src/services/importExportService.ts`, `backend/src/services/serverImportService.ts`

**主要职责**:
- CSV/JSON 批量导入服务器列表
- 智能去重、事务保证
- 支持导出服务器、告警、审计日志、报表
- 提供标准模板下载

### 12. 网络设备管理

**文件位置**: `backend/src/services/networkDeviceService.ts`, `backend/src/services/networkInspectionService.ts`, `backend/src/services/networkCommandGenerator.ts`, `backend/src/services/networkResultParser.ts`, `backend/src/services/vendorAdapter.ts`

**主要职责**:
- 网络设备 CRUD 管理
- 多厂商命令适配（华为、华三、思科、锐捷等）
- 自动巡检执行与结果解析
- 巡检历史记录

### 13. SNMP 服务

**文件位置**: `backend/src/services/snmpService.ts`, `backend/src/services/snmpPollingService.ts`, `backend/src/services/snmpTrapService.ts`, `backend/src/services/snmpOidRegistry.ts`

**主要职责**:
- SNMP 设备轮询监控
- SNMP Trap 告警接收
- OID 注册表驱动的设备巡检
- 设备信息采集

### 14. 网络发现与拓扑

**文件位置**: `backend/src/services/networkDiscoveryService.ts`, `backend/src/services/lldpDiscoveryService.ts`, `backend/src/services/topologyService.ts`

**主要职责**:
- LLDP 自动发现网络设备及连接关系
- 拓扑图可视化数据
- 服务/服务器依赖关系管理

### 15. AI 模型管理

**文件位置**: `backend/src/services/aiModelService.ts`

**主要职责**:
- AI 模型池统一管理（豆包、DeepSeek、通义千问、OpenAI、智谱、本地模型等）
- 主备模型降级链
- 每个提供商独立熔断器
- 拖拽排序优先级、连通性测试

### 16. 审批中心（HITL）

**文件位置**: `backend/src/services/workflowExecutor.ts` (审批节点逻辑)

**主要职责**:
- 工作流审批节点，暂停执行等待人工确认
- 超时自动拒绝/等待
- 审批请求自动推送通知
- WebSocket 实时推送审批状态

### 17. 告警自动分析

**文件位置**: `backend/src/services/alertAutoAnalyzer.ts`

**主要职责**:
- AI 驱动的告警智能诊断
- 自动分析告警原因并生成诊断报告
- 定时轮询待处理告警

### 18. 告警关联分析

**文件位置**: `backend/src/services/alertCorrelationService.ts`

**主要职责**:
- 将多条相关告警聚合为告警组
- 时间窗口内关联分析
- 减少告警碎片化

### 19. 自监控服务

**文件位置**: `backend/src/services/selfMonitorService.ts`

**主要职责**:
- 定期自检系统健康状态
- 监控报告生成
- 告警历史记录

### 20. 凭证管理

**文件位置**: `backend/src/services/credentialService.ts`

**主要职责**:
- 加密存储 API 密钥等敏感凭证
- 从旧版明文配置迁移到加密存储
- 密钥生命周期管理

### 21. 队列服务

**文件位置**: `backend/src/services/queueService.ts`, `backend/src/services/queueBullAdapter.ts`

**主要职责**:
- 异步任务执行队列
- 任务优先级调度
- 失败重试机制

### 22. VNC 代理

**文件位置**: `backend/src/services/vncProxyService.ts`

**主要职责**:
- WebSocket 代理转发 VNC 连接
- 浏览器端远程桌面访问

### 23. 变更管理

**文件位置**: `backend/src/services/changeService.ts`

**主要职责**:
- 记录系统变更操作
- 变更影响追踪
- 变更审计

## 🔐 安全设计

### 认证机制
- JWT Token认证
- 密码bcrypt加密
- Token过期机制

### 数据加密
- 服务器密码和SSH私钥使用AES-256-GCM加密
- 加密密钥存储在环境变量中
- 数据库文件权限保护

### API安全
- CORS配置
- 请求验证
- SQL注入防护（使用参数化查询）
- 审计日志记录

## 📡 WebSocket设计

### 连接管理
```javascript
// 后端
io.on('connection', (socket) => {
  socket.on('task:subscribe', (taskId) => {
    socket.join(`task:${taskId}`);
  });
});

// 推送事件
io.to(`task:${taskId}`).emit('task:node:output', data);
```

### 事件类型
- 任务生命周期事件
- 节点执行事件
- 告警通知事件
- 系统通知事件

## 🚀 性能优化

### 数据库优化
- 使用better-sqlite3同步API，性能更好
- 合理的索引设计
- 连接池管理

### 前端优化
- React Query缓存
- 组件懒加载
- 虚拟列表（大数据量时）

### 后端优化
- SSH连接复用
- 异步任务处理
- 内存管理

## 📦 部署架构

### Docker Compose
```yaml
services:
  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    ports:
      - "3001:3001"
    volumes:
      - app-data:/app/backend/data

  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  app-data:
```

## 🔄 扩展建议

### 水平扩展
- 使用Redis替代SQLite（多实例场景）
- 任务队列（BullMQ）
- 微服务架构拆分

### 高可用
- 数据库主从复制
- 负载均衡
- 健康检查和自动重启

### 监控
- 应用性能监控（APM）
- 日志聚合
- 指标采集和可视化
