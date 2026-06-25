# 生产环境最佳实践

本文档提供企业IT运维多Agent自动化平台在生产环境部署的最佳实践建议。

## 🔐 安全最佳实践

### 1. 认证与授权

#### 强制修改默认密码
- 首次部署后立即修改所有默认账号密码
- 禁用或删除不需要的默认账号

#### 密码策略
- 强制使用强密码（至少12位，包含大小写、数字、特殊字符）
- 定期密码轮换（建议90天）
- 密码历史记录（防止重复使用最近5个密码）

#### 会话管理
- 设置会话超时（建议30分钟无活动自动登出）
- 启用多因素认证（MFA）- 如需开发此功能
- 限制同一账号并发登录数量

### 2. 数据加密

#### 传输加密
- 强制使用HTTPS，禁用HTTP
- 使用TLS 1.2或更高版本
- 配置强密码套件
- 启用HSTS（HTTP Strict Transport Security）

#### 静态加密
- 数据库加密密钥自动管理（服务器密码和 SSH 密钥使用 AES-256-GCM 加密存储）
- 定期轮换加密密钥
- 密钥存储在安全的密钥管理系统（KMS）中，不放在代码或配置文件里

#### 数据库加密
- 考虑使用SQLCipher加密整个数据库文件
- 敏感字段额外加密

### 3. 网络安全

#### 防火墙配置
```
入站规则：
- 允许 80/tcp (HTTP, 仅用于重定向到HTTPS)
- 允许 443/tcp (HTTPS)
- 拒绝 所有其他入站流量

出站规则：
- 允许 访问LLM API (豆包/OpenAI)
- 允许 访问通知服务 (企业微信/钉钉/邮件服务器)
- 允许 SSH访问管理的服务器
- 限制 其他不必要的出站连接
```

#### 网络隔离
- 将平台部署在专用的管理网络区域
- 与生产业务网络隔离
- 使用VPN或跳板机访问管理界面

#### API安全
- 实施API速率限制
- 添加请求签名验证
- 记录所有API访问日志

## 🏗️ 高可用性设计

### 1. 服务冗余

#### 多实例部署
```yaml
# docker-compose.yml 示例
services:
  backend:
    deploy:
      replicas: 3
    # ... 其他配置
```

#### 负载均衡
使用Nginx或云厂商负载均衡器：
```nginx
upstream backend {
    server backend1:3001;
    server backend2:3001;
    server backend3:3001;
}

server {
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 2. 数据库高可用

#### 从SQLite迁移到 PostgreSQL/MySQL
生产环境建议使用企业级数据库：

```sql
-- PostgreSQL 示例表结构
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 数据库复制
- 配置主从复制
- 定期进行全量备份
- 实现自动故障转移

### 3. 会话管理

#### 使用Redis存储会话
```javascript
// 后端配置示例
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
    store: new RedisStore({ /* Redis配置 */ }),
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false
}));
```

## 📊 监控与运维

### 1. 健康检查

#### 应用健康检查
```javascript
// 扩展现有健康检查
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: checkDatabaseConnection(),
        websocket: checkWebSocketStatus(),
        llmApi: checkLLMApiStatus()
    };
    
    const isHealthy = health.database && health.websocket;
    res.status(isHealthy ? 200 : 503).json(health);
});
```

#### 容器健康检查
```yaml
# docker-compose.yml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 2. 日志管理

#### 日志级别配置
```
- ERROR: 错误和异常
- WARN: 警告信息
- INFO: 重要业务操作
- DEBUG: 调试信息（生产环境关闭）
```

#### 日志聚合
使用ELK Stack或Loki：
```yaml
# docker-compose.yml 示例
services:
  elasticsearch:
    image: elasticsearch:8.x
  logstash:
    image: logstash:8.x
  kibana:
    image: kibana:8.x
```

#### 日志保留策略
- 应用日志：保留30天
- 审计日志：保留1年
- 告警日志：保留6个月

### 3. 指标监控

#### 关键指标
- 请求响应时间（P50/P95/P99）
- 错误率
- 并发用户数
- 任务执行成功率
- 数据库连接数
- 系统资源使用（CPU/内存/磁盘）

#### 监控工具
- Prometheus + Grafana
- 云厂商监控服务
- APM工具（如New Relic、Datadog）

## 💾 备份与恢复

### 1. 备份策略

#### 数据库备份
```bash
# 每日备份脚本
#!/bin/bash
BACKUP_DIR="/var/backups/itops"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份数据库
cp /path/to/data/app.db $BACKUP_DIR/app.db.$DATE

# 保留最近30天
find $BACKUP_DIR -name "app.db.*" -mtime +30 -delete

# 上传到对象存储
aws s3 cp $BACKUP_DIR/app.db.$DATE s3://your-bucket/backups/
```

#### 定时备份
```bash
# crontab 配置
0 2 * * * /path/to/backup.sh  # 每天凌晨2点备份
```

### 2. 恢复演练

#### 定期演练
- 每月进行一次恢复演练
- 验证备份完整性
- 记录恢复时间目标（RTO）和恢复点目标（RPO）

#### 恢复流程文档
维护详细的恢复步骤文档：
1. 停止服务
2. 恢复数据
3. 验证数据完整性
4. 重启服务
5. 功能验证测试

## 🚀 性能优化

### 1. 数据库优化

#### 索引优化
```sql
-- 为常用查询字段添加索引
CREATE INDEX idx_alerts_source ON alerts(source);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
```

#### 查询优化
- 使用EXPLAIN分析慢查询
- 避免N+1查询问题
- 分页查询大数据集

### 2. 应用优化

#### 缓存策略
```javascript
// 使用Redis缓存热点数据
const cacheResult = await redis.get(`workflow:${workflowId}`);
if (cacheResult) {
    return JSON.parse(cacheResult);
}
// ... 查询数据库
await redis.setex(`workflow:${workflowId}`, 3600, JSON.stringify(result));
```

#### 异步处理
- 长时间运行的任务使用队列
- 使用BullMQ或RabbitMQ
- 实现任务重试机制

### 3. 前端优化

#### 资源优化
- 启用Gzip/Brotli压缩
- 使用CDN加速静态资源
- 代码分割和懒加载

#### 性能监控
- 使用Performance API监控页面性能
- 记录Core Web Vitals
- 设置性能预算

## 🔄 变更管理

### 1. 发布流程

#### 灰度发布
```
1. 部署到10%服务器
2. 监控24小时
3. 如无问题扩展到50%
4. 再监控24小时
5. 最后全量发布
```

#### 回滚计划
- 每个发布都要有回滚计划
- 保留最近3个版本的镜像
- 测试回滚流程

### 2. 配置管理

#### 环境分离
- dev（开发）
- staging（预发布）
- production（生产）

#### 配置安全
- 敏感配置使用环境变量
- 不提交配置文件到Git
- 使用机密管理工具

## 📝 合规与审计

### 1. 审计日志

#### 记录范围
- 用户登录/登出
- 数据修改操作
- 权限变更
- 敏感操作

#### 日志内容
```json
{
    "timestamp": "2024-01-01T00:00:00Z",
    "userId": 1,
    "username": "admin",
    "action": "create_server",
    "resourceType": "server",
    "resourceId": 10,
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0...",
    "result": "success"
}
```

### 2. 合规要求

#### 数据留存
- 符合行业数据留存规定
- 定期清理过期数据
- 提供数据导出功能

#### 隐私保护
- 最小化收集数据
- 数据脱敏显示
- 用户数据删除机制

## 🚨 应急响应

### 1. 事件响应流程

```
1. 检测到事件（告警触发）
2. 评估影响范围和严重程度
3. 启动应急响应团队
4. 遏制和隔离问题
5. 根因分析
6. 修复和恢复
7. 经验总结和改进
```

### 2. 联系人清单

维护应急联系人信息：
- 技术负责人
- DevOps工程师
- 安全工程师
- 业务负责人

## 📚 文档维护

### 1. 运维文档

维护以下文档并及时更新：
- 部署架构图
- 运维手册
- 故障排查指南
- 变更记录

### 2. 知识转移

- 定期进行团队培训
- 文档知识共享
- 师徒制传承

## ✅ 检查清单

部署前检查：
- [ ] 所有默认密码已修改
- [ ] HTTPS已配置并强制启用
- [ ] 备份策略已设置并测试
- [ ] 监控告警已配置
- [ ] 日志聚合已设置
- [ ] 安全扫描已通过
- [ ] 性能测试已完成
- [ ] 容灾演练已进行

定期检查：
- [ ] 备份验证（每月）
- [ ] 安全补丁更新（每周）
- [ ] 日志审查（每周）
- [ ] 权限审计（每月）
- [ ] 性能优化（每季）
