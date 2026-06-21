# 第9章 API开发实战

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

第6章我们学习了后端开发的基础知识，了解了如何创建路由、编写中间件和操作数据库。本章将**深入实战**，基于项目的实际代码模式，讲解如何编写生产级别的高质量 API。我们将分析三个核心路由模块的完整实现，涵盖 CRUD、分页、过滤、验证、安全等真实场景。

## 学习目标

阅读完本章后，你将能够：
- 遵循项目的统一模式编写完整的 CRUD API
- 使用 Zod 进行请求参数校验
- 实现分页、过滤、排序等常见 API 功能
- 设计和使用 WebSocket 事件
- 实现速率限制和安全防护
- 独立完成三个完整的 API 模块开发

---

## 9.1 项目 API 架构总览

### 9.1.1 路由注册机制

项目的路由通过 `app.ts` 统一管理。路由分为三个层次：

```
app.ts
├── 公开路由（无需认证）
│   ├── POST /api/auth/*        → authRoutes.ts
│   ├── POST /api/webhooks/*    → webhookRoutes.ts
│   └── GET  /health/*          → 内联定义
│
├── 认证中间件（全局拦截）
│   └── authenticateToken       → middleware/auth.ts
│
└── 受保护路由（需要认证 + 速率限制）
    ├── /api/servers            → serverRoutes.ts
    ├── /api/alerts             → alertRoutes.ts
    ├── /api/workflows          → workflowRoutes.ts
    ├── /api/agents             → agentRoutes.ts
    └── ...（共30+ 路由模块）
```

```
┌────────────────────────────────────────────────────────┐
│                    HTTP Request                         │
│              GET /api/servers?page=1                    │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  1. Helmet (安全头)                                     │
│     Content-Security-Policy, X-Frame-Options ...        │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  2. Trace Middleware (请求追踪)                          │
│     生成 traceId: abc-123-def                            │
│     响应头: X-Trace-Id: abc-123-def                     │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  3. CORS (跨域)                                         │
│     Access-Control-Allow-Origin: http://localhost:5173  │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  4. Body Parser (JSON解析)                               │
│     限制: 50MB                                          │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  5. Authenticate Token (认证)                            │
│     Bearer eyJhbGci... → 验证JWT → req.user = {...}    │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  6. Rate Limiter (速率限制)                              │
│     当前IP: 5/100 次请求                                 │
│     响应头: X-RateLimit-Remaining: 95                    │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  7. Route Handler (业务逻辑)                             │
│     db.prepare('SELECT * FROM servers').all()           │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  8. Response (JSON响应)                                  │
│     { "success": true, "data": [...] }                  │
└────────────────────────────────────────────────────────┘
```

### 9.1.2 项目 API 规范总结

| 规范项 | 项目约定 | 示例 |
|--------|---------|------|
| 响应格式 | `{ success, data?, message?, error? }` | `{"success":true,"data":{"id":"..."}}` |
| 错误格式 | `{ success: false, error/message }` | `{"success":false,"message":"权限不足"}` |
| ID 类型 | UUID v4 (string) | `"550e8400-e29b-41d4-a716-446655440000"` |
| 时间字段 | `created_at`, `updated_at` (TIMESTAMP) | `"2026-05-27 10:00:00"` |
| 布尔字段 | SQLite INTEGER (0/1) | `enabled: 1` |
| 参数验证 | Zod schema → `validateBody`/`validateParams` | `authSchemas.login` |
| 分页方式 | `page` + `pageSize` 查询参数 | `?page=1&pageSize=20` |
| 安全 | Helmet + rateLimiter + JWT + bcrypt | 全部启用 |

---

## 9.2 API 开发必备基础设施

### 9.2.1 Zod 参数验证系统

项目使用 Zod 进行强类型验证，定义集中在 `schemas/apiValidation.ts`：

```typescript
// backend/src/schemas/apiValidation.ts
import { z } from 'zod';

// 认证相关
export const authSchemas = {
  login: z.object({
    username: z.string().min(1, '用户名不能为空').max(64),
    password: z.string().min(1, '密码不能为空').max(128),
  }),
  register: z.object({
    username: z.string().min(2, '用户名至少2个字符').max(64),
    password: z.string().min(8, '密码至少8个字符').max(128),
    email: z.string().email('邮箱格式不正确').max(255),
    role: z.enum(['admin', 'operator', 'viewer']).default('viewer'),
  }),
};

// 服务器相关
export const serverSchemas = {
  createServer: z.object({
    name: z.string().min(1, '服务器名称不能为空').max(100),
    hostname: z.string().min(1, '主机名不能为空').max(255),
    port: z.coerce.number().int().min(1).max(65535).default(22),
    username: z.string().min(1, '用户名不能为空').max(64),
    password: z.string().max(255).optional(),
    private_key: z.string().optional(),
    use_ssh_key: z.coerce.number().int().min(0).max(1).default(0),
    description: z.string().max(500).optional(),
  }),
  serverId: z.object({
    id: z.string().uuid('无效的服务器ID'),
  }),
};
```

Zod 的核心验证方法：

| 方法 | 说明 | 示例 |
|------|------|------|
| `z.string()` | 字符串验证 | `z.string().min(1).max(64)` |
| `z.number()` | 数字验证 | `z.number().int().min(1).max(65535)` |
| `z.coerce.number()` | 自动转换字符串为数字 | `z.coerce.number().int()` |
| `z.enum([...])` | 枚举验证 | `z.enum(['admin', 'operator'])` |
| `z.object({...})` | 对象验证 | `z.object({ name: z.string() })` |
| `.optional()` | 可选字段 | `z.string().optional()` |
| `.default(val)` | 默认值 | `z.number().default(22)` |
| `z.string().uuid()` | UUID 格式验证 | `z.string().uuid('无效ID')` |

### 9.2.2 验证中间件

项目提供了三个验证中间件，分别处理 body、params、query：

```typescript
// backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return res.status(400).json({
        success: false,
        message: `请求参数验证失败: ${errors}`
      });
    }
    req.body = result.data;  // 经过验证和转换后的数据
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const errors = result.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return res.status(400).json({
        success: false,
        message: `路径参数验证失败: ${errors}`
      });
    }
    req.params = result.data as typeof req.params;
    next();
  };
}
```

**验证流程图解**：

```
POST /api/servers
{ "name": "", "hostname": "192.168.1.1", "port": "99999" }
  ↓
validateBody(serverSchemas.createServer)
  ↓
z.safeParse({ name: "", hostname: "192.168.1.1", port: "99999" })
  ↓
验证失败:
  name: "服务器名称不能为空" (min(1) 失败)
  port: 超过 max(65535)
  ↓
400 Bad Request
{ "success": false, "message": "请求参数验证失败: name: 服务器名称不能为空" }
```

### 9.2.3 速率限制

项目的速率限制使用内存 Map 实现，针对不同路径有不同策略：

```typescript
// backend/src/middleware/rateLimiter.ts
interface RateLimitConfig {
  [key: string]: { windowMs: number; max: number };
}

const rateLimitConfig: RateLimitConfig = {
  '/api/auth/login':       { windowMs: 15*60*1000, max: 5  },   // 15分钟5次
  '/api/auth':             { windowMs: 60*1000,    max: 20 },   // 1分钟20次
  '/api/copilot':          { windowMs: 60*1000,    max: 30 },   // 1分钟30次
  '/api/settings/api-keys':{ windowMs: 60*1000,    max: 10 },   // 1分钟10次
  '/api/webhooks':         { windowMs: 1000,       max: 10 },   // 1秒10次
};

const DEFAULT_CONFIG = { windowMs: 60*1000, max: 100 };         // 默认1分钟100次
```

速率限制中间件自动设置响应头：

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1716800000
```

当超出限制时返回 429：

```json
{
  "success": false,
  "message": "请求过于频繁，请稍后再试",
  "retryAfter": 45
}
```

### 9.2.4 角色权限控制

```typescript
// 使用方式
router.delete('/:id', requireRole('admin', 'operator'), handler);

// 内部实现
export function requireRole(...allowedRoles: string[]) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未认证' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    next();
  };
}
```

项目三种角色：

| 角色 | 权限范围 | 典型操作 |
|------|---------|---------|
| `admin` | 全部权限 | 删除服务器、管理用户、系统配置 |
| `operator` | 运维操作 | 创建/更新服务器、执行任务、处理告警 |
| `viewer` | 只读 | 查看仪表盘、查看告警、查看报告 |

---

## 9.3 完整 API 实现示例一：服务器管理 CRUD

服务器管理 API 是项目中最典型的完整 CRUD 实现。让我们逐段分析。

### 9.3.1 GET 列表查询（含关联数据）

```typescript
// backend/src/routes/serverRoutes.ts
import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { encrypt } from '../services/encryptionService';
import { validateBody, validateParams } from '../middleware/validation';
import { serverSchemas } from '../schemas/apiValidation';
import { requireRole } from '../middleware/auth';

const router = Router();

// GET /api/servers - 获取所有服务器
router.get('/', (_req: Request, res: Response) => {
  try {
    const servers = db.prepare(
      'SELECT * FROM servers ORDER BY created_at DESC'
    ).all();

    const processedServers = (servers as Array<{
      id: string;
      tags?: string;
      [key: string]: unknown;
    }>).map(server => {
      // 查询服务器所属的分组（关联查询）
      const groups = db.prepare(`
        SELECT sg.id, sg.name FROM server_groups sg
        JOIN server_group_mapping sgm ON sg.id = sgm.group_id
        WHERE sgm.server_id = ?
      `).all(server.id);

      return {
        ...server,
        tags: server.tags ? JSON.parse(server.tags) : [],
        groups
      };
    });

    res.json({ success: true, data: processedServers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get servers' });
  }
});
```

**关键点分析**：

1. **关联查询**：每条服务器记录额外查询其分组信息，通过 `server_group_mapping` 关联表实现多对多关系
2. **JSON 字段解析**：`tags` 字段在数据库中存储为 JSON 字符串，返回时解析为数组
3. **类型安全**：使用 TypeScript 类型断言确保类型正确

```
GET /api/servers
  ↓
SELECT * FROM servers ORDER BY created_at DESC
  ↓
  服务器列表
  ├── server-1: { name: "prod-web-01", tags: '["web","prod"]', ... }
  ├── server-2: { name: "prod-db-01", tags: '["db","prod"]', ... }
  └── server-3: { name: "dev-app-01", tags: null, ... }
  ↓
对每条服务器:
  SELECT sg.id, sg.name FROM server_groups sg
  JOIN server_group_mapping sgm ON sg.id = sgm.group_id
  WHERE sgm.server_id = ?
  ↓
返回:
{
  "success": true,
  "data": [
    {
      "id": "server-1",
      "name": "prod-web-01",
      "tags": ["web", "prod"],
      "groups": [{ "id": "g1", "name": "生产环境" }]
    },
    ...
  ]
}
```

### 9.3.2 POST 创建（含加密）

```typescript
// POST /api/servers - 创建服务器
router.post('/', validateBody(serverSchemas.createServer), (req: Request, res: Response) => {
  try {
    const { name, hostname, port, username, password, private_key, use_ssh_key, description } = req.body;
    const tags = (req.body as Record<string, unknown>).tags;
    const tagsJson = tags ? JSON.stringify(tags) : null;

    // 敏感信息加密存储
    const encryptedPassword = password ? encrypt(password) : null;
    const encryptedPrivateKey = private_key ? encrypt(private_key) : null;

    const id = randomUUID();
    db.prepare(`
      INSERT INTO servers (id, name, hostname, port, username, password, private_key, 
                           use_ssh_key, description, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, hostname, port || 22, username, 
           encryptedPassword, encryptedPrivateKey, use_ssh_key ? 1 : 0, 
           description || null, tagsJson);

    res.json({ success: true, data: { id } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create server' });
  }
});
```

**安全要点**：

```
请求体:
{
  "name": "prod-web-01",
  "hostname": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "my-secret-pass",    ← 明文密码
  "private_key": "-----BEGIN..."    ← 私钥
}
  ↓
encrypt() → AES-256-GCM 加密
  ↓
数据库存储:
{
  "password": "aes256gcm:iv:ciphertext:authTag",  ← 加密后
  "private_key": "aes256gcm:iv:ciphertext:authTag" ← 加密后
}
```

### 9.3.3 PUT 更新（COALESCE 模式）

PUT 更新使用 SQLite 的 `COALESCE` 函数实现部分更新：

```typescript
// PUT /api/servers/:id - 更新服务器
router.put('/:id',
  validateParams(serverSchemas.serverId),
  validateBody(serverSchemas.updateServer),
  (req: Request, res: Response) => {
    try {
      const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
      if (!server) {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }

      const { name, hostname, port, username, password, private_key, use_ssh_key, description, enabled } =
        req.body as Record<string, unknown>;
      const tags = (req.body as Record<string, unknown>).tags;
      const tagsJson = tags ? JSON.stringify(tags) : undefined;

      // 条件加密：仅当提供了新密码/私钥时才加密
      let encryptedPassword: string | null | undefined;
      let encryptedPrivateKey: string | null | undefined;

      if (password !== undefined && typeof password === 'string') {
        encryptedPassword = password ? encrypt(password) : null;
      }
      if (private_key !== undefined && typeof private_key === 'string') {
        encryptedPrivateKey = private_key ? encrypt(private_key) : null;
      }

      db.prepare(`
        UPDATE servers
        SET name = COALESCE(?, name),
            hostname = COALESCE(?, hostname),
            port = COALESCE(?, port),
            username = COALESCE(?, username),
            password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
            private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
            use_ssh_key = COALESCE(?, use_ssh_key),
            description = COALESCE(?, description),
            tags = COALESCE(?, tags),
            enabled = COALESCE(?, enabled),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name, hostname, port, username,
        password !== undefined ? encryptedPassword : undefined,
        password !== undefined ? encryptedPassword : undefined,
        private_key !== undefined ? encryptedPrivateKey : undefined,
        private_key !== undefined ? encryptedPrivateKey : undefined,
        use_ssh_key !== undefined ? (use_ssh_key ? 1 : 0) : undefined,
        description, tagsJson, enabled, req.params.id
      );

      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to update server' });
    }
  }
);
```

**COALESCE 工作原理**：

```sql
-- COALESCE(新值, 旧值)：如果新值为 NULL，使用旧值
SET name = COALESCE(?, name)

-- CASE WHEN: 仅当提供了新密码才更新
SET password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END
```

| 请求体 | 结果 |
|--------|------|
| `{ "name": "new-name" }` | 只更新 name，其他字段不变 |
| `{ "password": "new-pass" }` | 加密后只更新 password |
| `{}` | 所有字段保持原值（无变化） |

### 9.3.4 DELETE 删除（权限控制）

```typescript
// DELETE /api/servers/:id - 删除服务器
router.delete('/:id',
  validateParams(serverSchemas.serverId),
  requireRole('admin', 'operator'),  // 仅管理员和运维员可删除
  (req: Request, res: Response) => {
    try {
      db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to delete server' });
    }
  }
);
```

### 9.3.5 导出功能

```typescript
// GET /api/servers/:id/command-history/export - 导出命令历史
router.get('/:id/command-history/export',
  validateParams(serverSchemas.serverId),
  (req: Request, res: Response) => {
    try {
      const serverId = req.params.id;
      const server = db.prepare('SELECT * FROM servers WHERE id = ?')
        .get(serverId) as { id: string; name: string; hostname: string } | undefined;

      if (!server) {
        return res.status(404).json({ success: false, error: 'Server not found' });
      }

      const history = db.prepare(
        `SELECT * FROM server_command_history 
         WHERE server_id = ? ORDER BY executed_at DESC`
      ).all(serverId);

      const exportData = {
        server: {
          id: server.id,
          name: server.name,
          hostname: server.hostname,
          exportTime: new Date().toISOString()
        },
        commandHistory: history
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition',
        `attachment; filename="command-history-${serverId}-${Date.now()}.json"`);
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to export command history' });
    }
  }
);
```

---

## 9.4 完整 API 实现示例二：告警管理（含异步处理）

告警管理 API 比服务器管理更复杂，涉及异步服务调用、WebSocket 推送、降噪去重等功能。

### 9.4.1 GET 列表（条件过滤）

```typescript
// backend/src/routes/alertRoutes.ts
const validSeverities = ['critical', 'high', 'medium', 'low'];
const validStatuses = ['new', 'acknowledged', 'resolved'];

router.get('/', (req: Request, res: Response) => {
  try {
    const { status, severity, limit } = req.query;
    let query = 'SELECT * FROM alerts';
    const params: unknown[] = [];

    // 动态构建 WHERE 条件
    const conditions = [];
    if (status && validStatuses.includes(status as string)) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (severity && validSeverities.includes(severity as string)) {
      conditions.push('severity = ?');
      params.push(severity);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    // 限制返回数量（最多100条）
    if (limit) {
      const limitNum = parseInt(limit as string);
      if (!isNaN(limitNum) && limitNum > 0) {
        query += ' LIMIT ?';
        params.push(Math.min(limitNum, 100));
      }
    }

    const alerts = db.prepare(query).all(...params) as Array<{
      id: string;
      metadata?: string;
      [key: string]: unknown;
    }>;

    // 解析 JSON 字段
    alerts.forEach((a) => {
      if (a.metadata) {
        try {
          a.metadata = JSON.parse(a.metadata);
        } catch {
          a.metadata = '{}';
        }
      }
    });

    res.json({ success: true, data: alerts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});
```

**动态查询构建图解**：

```
GET /api/alerts?status=new&severity=critical&limit=50
  ↓
conditions = ['status = ?', 'severity = ?']
params = ['new', 'critical']
  ↓
query = "SELECT * FROM alerts 
         WHERE status = ? AND severity = ? 
         ORDER BY created_at DESC 
         LIMIT ?"
params = ['new', 'critical', 50]
  ↓
返回最多50条 critical 级别且状态为 new 的告警
```

### 9.4.2 POST 创建（含异步服务链）

告警创建是最复杂的 API，包含降噪检查、指纹去重、异步处理链：

```typescript
router.post('/', async (req: Request, res: Response) => {
  try {
    const { source, severity, title, content, metadata, related_task_id } = req.body;

    // 1. 基础验证
    if (!title || title.length === 0) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    if (severity && !validSeverities.includes(severity)) {
      return res.status(400).json({ success: false, error: 'Invalid severity value' });
    }

    // 2. 告警降噪检查
    const noiseCheck = await alertNoiseReductionService.processAlert(
      source || 'unknown', title, content, severity
    );

    // 3. 生成唯一 ID 和指纹（用于去重）
    const id = randomUUID();
    const normalizedTitle = title.toLowerCase().replace(/[\d\s_-]+/g, ' ').trim();
    const normalizedSource = (source || 'unknown').toLowerCase();
    const fingerprint = createHash('md5')
      .update(`${normalizedSource}:${normalizedTitle}`)
      .digest('hex');

    // 4. 插入数据库
    try {
      db.prepare(`
        INSERT INTO alerts (id, source, severity, title, content, metadata, 
                            related_task_id, alert_fingerprint)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, source || 'unknown', severity || 'medium', title,
             content || '', JSON.stringify(metadata || {}),
             related_task_id, fingerprint);
    } catch (err) {
      const error = err as { code?: string };
      // 指纹唯一约束冲突 → 重复告警
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(200).json({
          success: true,
          data: { alert: null, noiseReduction: { ...noiseCheck, suppressedByDB: true } }
        });
      }
      throw err;
    }

    // 5. 获取插入的告警
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as {
      id: string; metadata?: string; title: string; severity: string;
      content: string; source: string; [key: string]: unknown;
    } | undefined;

    // 6. 发送通知（如果需要）
    if (noiseCheck.shouldNotify) {
      notificationService.sendAlertNotification(alert!).catch((err) => {
        logger.error('Failed to send alert notification:', err);
      });
    }

    // 7. 异步处理链（不阻塞响应）
    setImmediate(async () => {
      const io = getIOInstance();
      try {
        // 7a. WebSocket 推送：告警已接收
        emitToAlerts(io!, 'remediation:started', {
          alertId: id, title: title, timestamp: new Date().toISOString()
        });

        // 7b. 自动根因分析（如果启用）
        const autoRCAEnabled = db.prepare(
          "SELECT value FROM settings WHERE key = 'auto_root_cause_enabled'"
        ).get() as { value: string } | undefined;
        if (autoRCAEnabled?.value === 'true') {
          rootCauseAnalysisService.analyzeByAlert(id, title, content || '')
            .catch((err) => logger.error('Failed to auto-trigger RCA:', err));
        }

        // 7c. 匹配修复策略并执行
        const policies = await remediationService.matchAlertToPolicies(alertForMatching);
        for (const policy of policies) {
          const result = await remediationService.triggerRemediation(policy, alertForMatching);
          emitToAlerts(io!, 'remediation:result', {
            alertId: id, policyId: policy.id, policyName: policy.name,
            executionId: result.id, status: result.status,
            timestamp: new Date().toISOString()
          });
        }

        emitToAlerts(io!, 'remediation:completed', {
          alertId: id, totalPolicies: policies.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        emitToAlerts(io!, 'remediation:error', {
          alertId: id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    });

    // 8. 立即返回响应（不等待异步处理完成）
    res.status(201).json({
      success: true,
      data: { alert, noiseReduction: noiseCheck }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});
```

**异步处理流程图**：

```
POST /api/alerts
  ↓
1. 参数验证
  ↓
2. 告警降噪检查 ← async
  ↓
3. 生成指纹
  ↓
4. 插入数据库
  ├─ 指纹冲突 → 返回 "重复告警已抑制"
  └─ 成功 → 继续
  ↓
5. 获取告警记录
  ↓
6. 发送通知 ← async (后台)
  ↓
7. setImmediate() → 异步处理链
  ├─ WebSocket 推送 'remediation:started'
  ├─ 根因分析 ← async (后台)
  ├─ 匹配修复策略 ← async
  ├─ 执行修复 ← async
  └─ WebSocket 推送 'remediation:result/completed/error'
  ↓
8. 立即返回 201 ← 客户端收到响应，不等7完成
```

**为什么用 `setImmediate`？**

`setImmediate` 将回调放入 Node.js 事件循环的下一阶段，确保：
1. HTTP 响应立即发送（不阻塞）
2. 异步处理在后台继续执行
3. 即使处理失败，客户端已收到 201 成功响应

### 9.4.3 确认与解决（状态变更）

```typescript
// PUT /api/alerts/:id/acknowledge - 确认告警
router.put('/:id/acknowledge', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as {
      id: string; title: string; [key: string]: unknown;
    } | undefined;
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    db.prepare(
      'UPDATE alerts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('acknowledged', id);

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);

    // 发送确认通知
    notificationService.sendSystemNotification(
      '告警已确认',
      `告警 "${alert.title}" 已确认处理`
    ).catch((err) => logger.error('Failed to send ack notification:', err));

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

// PUT /api/alerts/:id/resolve - 解决告警
router.put('/:id/resolve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as {
      id: string; title: string; [key: string]: unknown;
    } | undefined;
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    db.prepare(
      'UPDATE alerts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('resolved', id);

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);

    notificationService.sendSystemNotification(
      '告警已解决',
      `告警 "${alert.title}" 已解决`
    ).catch((err) => logger.error('Failed to send resolve notification:', err));

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});
```

### 9.4.4 统计 API

```typescript
// GET /api/alerts/stats/summary - 告警统计
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM alerts GROUP BY status
    `).all();

    const severityStats = db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM alerts GROUP BY severity
    `).all();

    res.json({
      success: true,
      data: {
        byStatus: stats,
        bySeverity: severityStats,
        total: (stats as Array<{ count: number }>)
          .reduce((sum: number, s) => sum + s.count, 0)
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get alert stats' });
  }
});
```

---

## 9.5 完整 API 实现示例三：认证 API（含 Token 管理）

认证 API 涉及 JWT、Token 黑名单、密码安全等核心安全机制。

### 9.5.1 登录 API

```typescript
// backend/src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../utils/env';
import { tokenBlacklist } from '../services/tokenBlacklist';
import { validateBody } from '../middleware/validation';
import { authSchemas } from '../schemas/apiValidation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/login - 用户登录
router.post('/login', validateBody(authSchemas.login), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    // 1. 查询用户
    const user = db.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).get(username) as {
      id: string; username: string; password: string;
      role: string; email: string; enabled: number;
      password_must_change?: number;
      [key: string]: unknown;
    } | undefined;

    if (!user) {
      return res.status(401).json({
        success: false, message: '用户名或密码错误'
      });
    }

    if (!user.enabled) {
      return res.status(403).json({
        success: false, message: '账户已被禁用'
      });
    }

    // 2. 验证密码（bcrypt 比对）
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false, message: '用户名或密码错误'
      });
    }

    // 3. 生成 Access Token
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
    );

    // 4. 生成 Refresh Token
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: '7d' } as SignOptions
    );

    // 5. 更新登录时间
    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    // 6. 记录审计日志
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, 
                              details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(randomUUID(), user.id, 'login', 'auth', 'login',
           JSON.stringify({ username }), req.ip);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id, username: user.username, email: user.email,
          role: user.role,
          passwordMustChange: Boolean(user.password_must_change)
        }
      }
    });
  } catch (error) {
    logger.error('登录失败', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});
```

**双 Token 机制**：

```
┌────────────────────────────────────────────────────────────┐
│                    双 Token 机制                            │
├───────────────────────┬────────────────────────────────────┤
│    Access Token       │      Refresh Token                  │
├───────────────────────┼────────────────────────────────────┤
│  有效期: 24小时        │  有效期: 7天                         │
│  载荷: id,username,   │  载荷: id, type:'refresh'           │
│       role,email      │                                    │
│  用途: API 请求认证    │  用途: 获取新的 Access Token        │
│  携带: Authorization  │  携带: 请求体中的 refreshToken 字段  │
│       Header          │                                    │
│  安全: 可加入黑名单    │  安全: 可加入黑名单                  │
└───────────────────────┴────────────────────────────────────┘

登录成功后:
  前端存储: { token, refreshToken }
  每次请求: Authorization: Bearer {token}
  Token过期: POST /api/auth/refresh { refreshToken } → 新 token + 新 refreshToken
```

### 9.5.2 Token 刷新 API

```typescript
// POST /api/auth/refresh - 刷新 Token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false, message: '请提供refresh token'
      });
    }

    // 检查黑名单
    if (tokenBlacklist.isBlacklisted(refreshToken)) {
      return res.status(401).json({
        success: false, message: 'Token已失效'
      });
    }

    // 验证 Token
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET,
      { algorithms: ['HS256'] }
    ) as jwt.JwtPayload & { id: string; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false, message: '无效的refresh token'
      });
    }

    // 检查用户状态
    const user = db.prepare(
      'SELECT id, username, email, role, enabled FROM users WHERE id = ?'
    ).get(decoded.id) as {
      id: string; username: string; email: string;
      role: string; enabled: number;
    } | undefined;

    if (!user || !user.enabled) {
      return res.status(401).json({
        success: false, message: '用户不存在或已被禁用'
      });
    }

    // 生成新 Token 对
    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
    );

    const newRefreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: '7d' } as SignOptions
    );

    // 旧 Refresh Token 加入黑名单
    tokenBlacklist.addToBlacklist(refreshToken, 'token-refresh', decoded.id);

    res.json({
      success: true,
      data: { token: newAccessToken, refreshToken: newRefreshToken }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false, message: 'Refresh token已过期或无效'
      });
    }
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});
```

### 9.5.3 修改密码 API

```typescript
// POST /api/auth/change-password - 修改密码
router.post('/change-password', authenticateToken,
  async (req: Request & { user?: { id: string } }, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false, message: '请提供当前密码和新密码'
        });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?')
        .get(req.user!.id) as {
          id: string; username: string; password: string;
          password_must_change: number;
        } | undefined;

      if (!user) {
        return res.status(401).json({ success: false, message: '用户不存在' });
      }

      // 验证当前密码
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ success: false, message: '当前密码错误' });
      }

      // 密码强度检查
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false, message: '密码长度至少8位'
        });
      }

      // 加密新密码
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // 更新密码
      db.prepare(
        'UPDATE users SET password = ?, password_must_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(hashedNewPassword, user.id);

      // 审计日志
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, resource_type, 
                                resource_id, details, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(randomUUID(), user.id, 'change_password', 'auth', 'password',
             JSON.stringify({ username: user.username }), req.ip);

      res.json({ success: true, message: '密码修改成功' });
    } catch (error) {
      logger.error('修改密码失败', error);
      res.status(500).json({ success: false, message: '服务器错误' });
    }
  }
);
```

---

## 9.6 WebSocket 事件设计

### 9.6.1 事件分类

项目的 WebSocket 事件按功能域分为以下几类：

| 事件域 | 事件名 | 方向 | 数据格式 |
|--------|--------|------|---------|
| **连接管理** | `ping` / `pong` | 双向 | 空 |
| **任务订阅** | `task:subscribe` | C→S | `taskId: string` |
| **任务订阅** | `task:unsubscribe` | C→S | `taskId: string` |
| **告警订阅** | `alert:subscribe` | C→S | 空 |
| **终端** | `terminal:open` | C→S | `{ serverId, cols, rows }` |
| **终端** | `terminal:data` | 双向 | `{ sessionId, data: string }` |
| **终端** | `terminal:resize` | C→S | `{ sessionId, cols, rows }` |
| **终端** | `terminal:close` | C→S | `{ sessionId }` |
| **修复** | `remediation:started` | S→C | `{ alertId, title, timestamp }` |
| **修复** | `remediation:result` | S→C | `{ alertId, policyId, status, ... }` |
| **修复** | `remediation:completed` | S→C | `{ alertId, totalPolicies, timestamp }` |
| **修复** | `remediation:error` | S→C | `{ alertId, error, timestamp }` |

### 9.6.2 服务端辅助函数

```typescript
// backend/src/websocket/handler.ts

// 向指定任务房间发送事件
export function emitToTask(
  io: SocketIOServer, taskId: string, event: string, data: Record<string, unknown>
) {
  io.to(`task:${taskId}`).emit(event, { taskId, ...data });
}

// 向告警房间发送事件
export function emitToAlerts(
  io: SocketIOServer, event: string, data: Record<string, unknown>
) {
  io.to('alerts').emit(event, data);
}

// 广播给所有连接
export function broadcast(
  io: SocketIOServer, event: string, data: Record<string, unknown>
) {
  io.emit(event, data);
}
```

### 9.6.3 房间模型

```
Socket.IO 房间结构:

┌─────────────────────────────────────────────────────┐
│                    Socket Rooms                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  task:uuid-1    ◄── 订阅了任务1的客户端 Socket      │
│  task:uuid-2    ◄── 订阅了任务2的客户端 Socket      │
│  alerts         ◄── 订阅了告警的客户端 Socket       │
│  terminal:sid-1 ◄── 终端会话1的客户端 Socket        │
│  terminal:sid-2 ◄── 终端会话2的客户端 Socket        │
│                                                     │
│  一个客户端可以同时加入多个房间                       │
└─────────────────────────────────────────────────────┘
```

### 9.6.4 WebSocket 认证

```typescript
function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  // 从握手信息中提取 token
  const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('未提供认证token'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    const user = db.prepare(
      'SELECT id, username, email, role, enabled FROM users WHERE id = ?'
    ).get(decoded.id) as User | undefined;

    if (!user || !user.enabled) {
      return next(new Error('用户不存在或已禁用'));
    }

    (socket as SocketWithUser).user = user;
    next();
  } catch (error) {
    return next(new Error('无效的token'));
  }
}
```

### 9.6.5 心跳检测

```typescript
const HEARTBEAT_INTERVAL = 30000;   // 30秒
const HEARTBEAT_TIMEOUT = 5000;     // 5秒超时

// 服务端定时 ping
const heartbeatInterval = setInterval(() => {
  io.sockets.sockets.forEach((socket) => {
    const s = socket as SocketWithUser;
    if (s.isAlive === false) {
      socket.disconnect();  // 上次未响应 pong
      return;
    }
    s.isAlive = false;
    socket.emit('ping');
  });
}, HEARTBEAT_INTERVAL);

// 客户端响应 pong
socket.on('pong', () => {
  (socket as SocketWithUser).isAlive = true;
});
```

```
心跳检测流程:

时间轴:  t=0s        t=30s       t=35s       t=60s
        ─────────────────────────────────────────────

Server:  emit('ping')             emit('ping')
           │                        │
Client:  emit('pong') ◄──5s内────  emit('pong') ◄──5s内
           │                        │
状态:     isAlive=true           isAlive=true
                    超时未响应 → isAlive=false → disconnect
```

---

## 9.7 速率限制与安全实践

### 9.7.1 安全中间件栈

```
app.ts 安全中间件顺序:

1. helmet()          → 安全 HTTP 头 (X-Frame-Options, CSP 等)
2. traceMiddleware   → 请求追踪 ID
3. morgan('combined')→ 访问日志
4. cors({ origin, credentials }) → 跨域控制
5. bodyParser.json({ limit: '50mb' }) → 请求体大小限制
6. authenticateToken → JWT 认证
7. rateLimiter       → 速率限制
```

### 9.7.2 速率限制配置表

| 路径 | 时间窗口 | 最大请求数 | 场景 |
|------|---------|-----------|------|
| `/api/auth/login` | 15 分钟 | 5 | 防暴力破解 |
| `/api/auth` | 1 分钟 | 20 | 认证接口保护 |
| `/api/copilot` | 1 分钟 | 30 | AI 接口防滥用 |
| `/api/settings/api-keys` | 1 分钟 | 10 | 敏感配置保护 |
| `/api/webhooks` | 1 秒 | 10 | 高并发告警接收 |
| 其他接口 | 1 分钟 | 100 | 默认保护 |

### 9.7.3 敏感数据处理

```typescript
// 服务器列表不返回密码和私钥
router.get('/:id', (req: Request, res: Response) => {
  const { password: _password, private_key: _private_key, ...safeServer } = server;
  res.json({ success: true, data: { ...safeServer, tags: ... } });
});
```

---

## 9.8 错误处理最佳实践

### 9.8.1 全局错误处理

```typescript
// backend/src/middleware/errorHandler.ts
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`${req.method} ${req.originalUrl}`, {
    error: message, stack: err.stack, traceId: (req as any).traceId
  });

  res.status(statusCode).json({ success: false, error: message });
};
```

### 9.8.2 自定义错误类

```typescript
// backend/src/types/errors.ts
export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

// 使用
throw new AppError('服务器不存在', 404);
throw new AppError('权限不足', 403);
```

### 9.8.3 路由中错误处理模式

```typescript
// 模式一：try-catch 包裹
router.get('/', (req, res) => {
  try {
    // 业务逻辑
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to ...' });
  }
});

// 模式二：提前返回 + 最终 catch
router.post('/', async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ ... });  // 提前返回
    }
    // 正常逻辑
    res.json({ ... });
  } catch {
    res.status(500).json({ ... });
  }
});
```

---

## 本章小结

本章通过三个完整的 API 实现示例，系统讲解了项目的 API 开发模式：

1. **服务器管理 CRUD**：展示了完整的增删改查、关联查询、加密存储、COALESCE 部分更新、导出功能
2. **告警管理**：展示了动态条件过滤、异步处理链、WebSocket 推送、指纹去重、降噪检查
3. **认证 API**：展示了 JWT 双 Token 机制、Token 黑名单、密码安全、审计日志

同时涵盖了：
- Zod 参数验证系统的使用
- 速率限制和安全防护
- WebSocket 事件设计和房间模型
- 全局错误处理和自定义错误类

**核心原则**：验证先行、错误兜底、安全优先、异步解耦。

---

## 本章练习

### 基础练习

1. **创建脚本管理 CRUD**：仿照 `serverRoutes.ts` 的模式，创建 `scriptRoutes.ts`，实现脚本的增删改查 API。要求包含 Zod 验证、分页查询、按标签过滤

2. **添加审计日志**：在服务器创建、更新、删除操作中，向 `audit_logs` 表插入审计记录。参考 `authRoutes.ts` 中的审计日志写法

3. **实现分页功能**：为 `GET /api/alerts` 添加 `page` 和 `pageSize` 参数，使用 `LIMIT` 和 `OFFSET` 实现分页。同时返回 `total` 总数

### 进阶练习

1. **批量操作 API**：为服务器管理添加批量创建和批量删除 API。使用事务确保原子性

2. **WebSocket 事件扩展**：为任务执行添加 WebSocket 实时推送，当任务状态变化时向 `task:${taskId}` 房间发送事件

3. **速率限制扩展**：添加基于用户 ID 的速率限制（而非仅基于 IP）。不同角色有不同的速率限制

### 思考题

1. 告警 API 中使用了 `setImmediate` 来执行异步处理链。这种方式有什么优缺点？如果异步处理链中发生未捕获异常，会产生什么后果？

2. 项目中的速率限制使用内存 Map 实现。在 Docker 容器化部署中（可能有多个副本），这种实现有什么问题？有什么替代方案？

3. `COALESCE` 模式的部分更新和 `PATCH` 语义有什么区别？为什么不使用 HTTP PATCH 方法？

---

## 延伸阅读

- [Zod 官方文档](https://zod.dev/)
- [Express 路由与中间件](https://expressjs.com/en/guide/routing.html)
- [JWT.io 文档](https://jwt.io/introduction)
- [Socket.IO 房间与命名空间](https://socket.io/docs/v4/rooms/)
- [OWASP API 安全 Top 10](https://owasp.org/www-project-api-security/)
- [bcrypt 密码哈希原理](https://www.npmjs.com/package/bcrypt)
