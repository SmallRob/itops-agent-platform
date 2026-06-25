# 基础设施域实体定义

## 1. User（用户）
系统用户实体，支持角色和权限管理。

```typescript
interface User {
  id: string;           // UUID主键
  username: string;     // 用户名
  password: string;     // 加密密码
  role: string;         // 角色（admin/user）
  email: string;        // 邮箱
  enabled: number;      // 启用状态（0/1）
  password_must_change: number; // 是否需要修改密码
  created_at: string;   // 创建时间
  updated_at: string;   // 更新时间
}
```

## 2. AuditLog（审计日志）
系统操作审计记录。

```typescript
interface AuditLog {
  id: string;           // UUID主键
  user_id: string;      // 操作用户ID
  action: string;       // 操作类型（login/logout/change_password等）
  resource_type: string; // 资源类型（auth/user/settings等）
  resource_id: string;  // 资源ID
  details: string;      // 详细信息（JSON格式）
  ip_address: string;   // 客户端IP
  created_at: string;   // 创建时间
}
```

## 3. Notification（通知）
系统通知记录。

```typescript
interface Notification {
  id: string;           // UUID主键
  type: string;         // 通知类型（alert/task/system）
  title: string;        // 通知标题
  content: string;      // 通知内容
  recipient: string;    // 接收者
  status: string;       // 状态（pending/sent/failed）
  related_alert_id: string; // 关联告警ID
  related_task_id: string;  // 关联任务ID
  error_message: string;    // 错误信息
  sent_at: string;          // 发送时间
  created_at: string;       // 创建时间
}
```

## 4. BackupInfo（备份信息）
数据库备份记录。

```typescript
interface BackupInfo {
  id: string;           // 备份ID
  filename: string;     // 文件名
  filePath: string;     // 文件路径
  size: number;         // 文件大小（字节）
  createdAt: string;    // 创建时间
  type: 'auto' | 'manual'; // 备份类型
  status: 'completed' | 'failed' | 'in_progress'; // 状态
  error?: string;       // 错误信息
  verified: boolean;    // 是否验证通过
  checksum?: string;    // 校验和
}
```

## 5. BackupConfig（备份配置）
备份服务配置。

```typescript
interface BackupConfig {
  enabled: boolean;     // 是否启用自动备份
  intervalHours: number; // 备份间隔（小时）
  keepLast: number;     // 保留最近备份数量
  backupDir: string;    // 备份目录
  compression: boolean; // 是否压缩
  verifyAfterBackup: boolean; // 备份后是否验证
}
```

## 6. NotificationConfig（通知配置）
多渠道通知配置。

```typescript
interface NotificationConfig {
  wechat_enabled?: boolean;
  wechat_config?: { webhook_url?: string };
  dingtalk_enabled?: boolean;
  dingtalk_config?: { webhook_url?: string };
  email_enabled?: boolean;
  email_config?: { 
    smtp_host?: string; 
    smtp_port?: number; 
    user?: string; 
    password?: string 
  };
  webhook_enabled?: boolean;
}
```

## 7. APIKeyConfig（API密钥配置）
外部API服务配置。

```typescript
interface APIKeyConfig {
  doubao?: {
    apiKey: string;
    model: string;
    apiBase: string;
  };
  openai?: {
    apiKey: string;
    model: string;
    apiBase: string;
  };
  localAi?: {
    model: string;
    apiBase: string;
  };
}
```

## 8. LoginAttempt（登录尝试）
登录失败记录，用于防暴力破解。

```typescript
interface LoginAttempt {
  username: string;
  attempts: number;
  lastAttempt: Date;
  lockoutUntil?: Date;
}
```

## 数据库表结构
```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  email TEXT,
  enabled INTEGER DEFAULT 1,
  password_must_change INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
);

-- 审计日志表
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT (datetime('now','localtime'))
);

-- 通知表
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  recipient TEXT DEFAULT 'default',
  status TEXT DEFAULT 'pending',
  related_alert_id TEXT,
  related_task_id TEXT,
  error_message TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT (datetime('now','localtime'))
);

-- 设置表
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
);
```