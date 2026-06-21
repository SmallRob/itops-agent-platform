# 项目结构规范

## 1. 目录组织

```
backend/src/
├── routes/          # API路由定义
│   └── xxxRoutes.ts # 每个资源一个路由文件
├── services/        # 业务逻辑层
│   └── xxxService.ts
├── models/          # 数据层
│   ├── database.ts  # 数据库连接
│   ├── migrations.ts # 迁移管理
│   └── v00x_*.ts    # 迁移脚本
├── middleware/       # Express中间件
├── utils/           # 工具函数
├── types/           # TypeScript类型定义
└── websocket/       # WebSocket处理
```

## 2. 文件命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 路由 | xxxRoutes.ts | agentRoutes.ts |
| 服务 | xxxService.ts | alertService.ts |
| 中间件 | xxxMiddleware.ts | auth.ts |
| 工具 | xxxUtil.ts | logger.ts |
| 迁移 | v00x_xxx.ts | v001_initial_schema.ts |
| 测试 | xxx.test.ts | sshService.test.ts |

## 3. 模块职责边界

- **Routes**: 只负责HTTP请求/响应处理，调用Service
- **Services**: 业务逻辑实现，可调用其他Service
- **Models**: 数据访问层，SQL操作封装
- **Middleware**: 横切关注点（认证、日志、错误处理）
- **Utils**: 无状态工具函数

## 4. 新增模块清单

添加新功能时需要创建/修改的文件：
1. `routes/xxxRoutes.ts` - API路由
2. `services/xxxService.ts` - 业务逻辑（可选）
3. `models/` - 数据库表/迁移（如需要）
4. `app.ts` - 注册路由
