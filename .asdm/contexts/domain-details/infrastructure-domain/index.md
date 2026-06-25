# 基础设施域索引

## 概述
基础设施域提供系统运行所需的基础服务，包括认证授权、备份恢复、通知服务、审计日志和系统配置管理。

## 核心文件
1. `entities.md` - 实体定义
2. `services.md` - 服务接口
3. `apis.md` - API定义
4. `flows.md` - 业务流程

## 领域职责
- 用户认证与授权管理
- 系统备份与恢复
- 多渠道通知服务
- 审计日志记录
- 系统配置管理

## 技术组件
- **NotificationService**：多渠道通知服务（企业微信、钉钉、邮件、Webhook）
- **BackupService**：数据库备份恢复服务
- **AuditService**：审计日志服务
- **AuthRoutes**：认证授权API
- **SettingsRoutes**：系统配置API

## 数据存储
- SQLite数据库表：`users`, `audit_logs`, `notifications`, `settings`
- 加密存储：敏感配置和凭证
- 文件系统：备份文件存储

## 业务规则
1. 用户认证采用JWT双token机制（访问token + 刷新token）
2. 登录失败达到阈值自动锁定账户
3. 密码必须满足复杂度要求
4. 备份支持加密、压缩和完整性验证
5. 通知服务支持多渠道并行发送
6. 所有敏感操作记录审计日志