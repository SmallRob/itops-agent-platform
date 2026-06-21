# 基础设施域服务接口

## 1. NotificationService（通知服务）
多渠道通知服务，支持企业微信、钉钉、邮件和Webhook。

### 核心方法
```typescript
class NotificationService {
  // 发送通知
  async sendNotification(notification: {
    type: string;
    title: string;
    content: string;
    recipient?: string;
    related_alert_id?: string;
    related_task_id?: string;
  }): Promise<{ success: boolean; id: string }>;

  // 发送告警通知
  async sendAlertNotification(alert: AlertRecord): Promise<{ success: boolean; id: string }>;

  // 发送任务状态通知
  async sendTaskNotification(task: TaskRecord, status: string): Promise<{ success: boolean; id: string }>;

  // 发送系统通知
  async sendSystemNotification(title: string, content: string): Promise<{ success: boolean; id: string }>;

  // 获取通知历史
  getNotificationHistory(limit?: number): Notification[];

  // 重新发送失败通知
  async retryFailedNotifications(): Promise<{ success: boolean; id: string }[]>;
}
```

### 通知渠道
1. **企业微信**：Markdown格式消息
2. **钉钉**：Markdown格式消息
3. **邮件**：HTML格式邮件
4. **Webhook**：Socket.IO实时推送

## 2. BackupService（备份服务）
数据库备份恢复服务，支持加密、压缩和完整性验证。

### 核心方法
```typescript
class BackupService {
  // 初始化服务
  init(): void;

  // 创建备份
  async createBackup(type: 'auto' | 'manual'): Promise<BackupInfo>;

  // 恢复备份
  async restoreBackup(backupId: string): Promise<{ 
    success: boolean; 
    requiresRestart?: boolean; 
    message?: string 
  }>;

  // 删除备份
  deleteBackup(backupId: string): boolean;

  // 上传备份文件
  async uploadBackup(filePath: string, originalName: string): Promise<BackupInfo>;

  // 获取备份历史
  getHistory(): BackupInfo[];

  // 获取服务状态
  getStatus(): {
    isRunning: boolean;
    lastBackup?: BackupInfo;
    lastBackupAgeHours: number;
    config: BackupConfig;
    totalBackups: number;
    totalSize: number;
    healthy: boolean;
  };

  // 更新配置
  updateConfig(newConfig: Partial<BackupConfig>): BackupConfig;

  // 启动/停止自动备份
  startAutoBackup(): void;
  stopAutoBackup(): void;
}
```

### 备份特性
- **加密**：AES-256-GCM加密，带认证标签
- **压缩**：Gzip压缩减少文件大小
- **验证**：备份后完整性验证
- **清理**：自动清理旧备份文件

## 3. AuditService（审计服务）
审计日志服务，记录系统关键操作。

### 核心方法
```typescript
// 创建审计日志
export const createAuditLog = (data: {
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}): string | null;
```

### 审计事件类型
- `login`：用户登录
- `logout`：用户登出
- `change_password`：修改密码
- `update_settings`：更新配置
- `create_backup`：创建备份
- `restore_backup`：恢复备份

## 4. 服务依赖关系
```
AuthRoutes → 用户认证 → JWT验证 → 审计日志
SettingsRoutes → 配置管理 → 凭证服务 → 审计日志
BackupService → 备份恢复 → 通知服务 → 审计日志
NotificationService → 多渠道推送 → Socket.IO
```

## 5. 安全机制
1. **密码加密**：bcrypt加密，强度12
2. **JWT认证**：访问token + 刷新token双机制
3. **登录保护**：失败锁定，防暴力破解
4. **敏感数据加密**：凭证服务加密存储
5. **备份加密**：AES-256-GCM加密备份文件