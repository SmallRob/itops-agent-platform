# ITOps Agent Platform 技术规范

## 项目概述

| 属性 | 值 |
|------|-----|
| 项目名称 | ITOps Agent Platform |
| 项目类型 | 企业级全栈 Web 应用 |
| 核心功能 | 可视化工作流编排多个 AI Agent，实现运维自动化 |
| 版本 | v3.0.5 |
| API 路由模块 | 47 个 |
| 业务服务 | 50+ 个 |
| 前端页面 | 45+ 个 |
| 数据库表 | 44 张 |

## 技术栈

### 前端

| 技术 | 版本 |
|------|------|
| React | 18.2+ |
| TypeScript | 5.3+ |
| Tailwind CSS | 3.4+ |
| Vite | 5.0+ |
| @xyflow/react | 12.0+ |
| Zustand | 4.4+ |
| React Query | 5.14+ |
| Socket.io Client | 4.7+ |
| Axios | 1.6+ |
| Lucide React | 0.294+ |
| date-fns | 2.30+ |
| markdown-it | 14.0+ |

### 后端

| 技术 | 版本 |
|------|------|
| Node.js | 18+ |
| Express | 4.18+ |
| TypeScript | 5.3+ |
| better-sqlite3 | 9.2+ |
| Socket.io | 4.7+ |
| SSH2 | 1.14+ |
| bcryptjs | 2.4+ |
| jsonwebtoken | 9.0+ |
| node-schedule | 2.1+ |

### 部署

| 技术 | 用途 |
|------|------|
| Docker + Docker Compose | 容器化部署 |
| Nginx (Alpine) | 反向代理 + 静态文件服务 |

## 功能模块规范

### 1. Agent 管理

- **预设 Agent**: 9 个（告警处理、故障诊断、日志分析、系统巡检、变更执行、文档生成、合规检查、服务器命令执行、自动巡检）
- **自定义 Agent**: 支持用户创建，配置名称、头像、角色、系统提示词、模型、温度
- **Agent 测试**: 支持单独测试 Agent 效果
- **执行历史**: 记录 Agent 每次调用的输入/输出/耗时/Token 用量

### 2. 工作流编排

- **可视化编辑器**: 基于 @xyflow/react 的拖拽式节点编辑器
- **预设模板**: 6 个（日常健康检查、告警处理、故障诊断、合规检查、变更执行、日志分析）
- **执行引擎**: 拓扑排序执行，y 坐标从上到下、x 坐标从左到右
- **上下文传递**: 工作流内节点间数据传递

### 3. 服务器管理

- **SSH 连接**: 密码或密钥认证，AES-256-GCM 加密存储
- **命令执行**: 在线 Shell，命令历史审计，14 项合规检查
- **Web SSH 终端**: 基于 xterm.js 的交互式终端，支持实时双向通信、窗口自适应
- **主机分组**: 多级分组树形结构，按分组筛选服务器
- **批量导入**: CSV/JSON 格式批量导入，自动验证 SSH 连通性和去重
- **主机信息采集**: 一键采集 OS/CPU/内存/磁盘/IP 信息
- **数据导出**: 支持 CSV/JSON 格式导出服务器列表

### 4. 告警系统

- **Webhook 接收**: Prometheus Alertmanager、Zabbix、通用格式
- **告警降噪**: 自动去重和抑制
- **自动触发**: 告警→工作流映射，自动执行
- **状态管理**: new / acknowledged / resolved

### 5. 知识库 + RAG

- **知识条目**: 22 条预设知识，支持分类和标签
- **增强检索**: 关键词匹配 + 相关度评分 + 使用频率权重 + 时间衰减
- **上下文注入**: 自动将相关知识注入 LLM 对话

### 6. AI Copilot

- **自然语言交互**: 对话式运维助手
- **上下文感知**: 自动注入告警、服务器、任务等系统数据
- **双模式**: LLM 深度分析 + 规则快速响应降级

### 7. 通知系统

- **渠道**: Webhook、邮件、企业微信、钉钉
- **配置管理**: 独立通知配置页面
- **系统通知**: 告警、任务完成自动推送

### 8. 定时任务

- **调度引擎**: 基于 node-schedule 的 Cron 定时
- **预设任务**: 4 个（每日健康检查、每周合规检查、日志定期分析、数据库备份）
- **状态管理**: 启用/禁用、上次/下次运行时间

### 9. 用户与权限

- **角色**: admin、operator、viewer
- **认证**: JWT + Token 黑名单
- **审计**: 完整操作日志记录

### 10. 报告系统

- **自动生成**: 工作流执行完成自动生成 Markdown 报告
- **模板管理**: 预设报告模板（工作流执行报告、系统巡检报告）
- **导出**: Markdown 格式下载

### 11. 数据导入导出

- **导入**: CSV/JSON 格式批量导入服务器列表（提供标准模板下载）
- **智能去重**: hostname+name 联合去重，自动跳过重复服务器
- **详细错误报告**: 每行错误信息单独返回，便于定位问题
- **事务保证**: 要么全部成功要么全部失败，不会部分导入
- **导出**: 支持导出服务器列表、告警数据、审计日志、报表
- **导出格式**: CSV（Excel 可直接打开）和 JSON

### 12. 备份恢复

- **自动/手动备份**: 数据库备份，支持 gzip 压缩
- **完整性校验**: 备份文件大小验证
- **恢复后自动重启**: 恢复备份后自动优雅重启，确保数据一致性
- **备份历史管理**: 备份清理策略
- **定时自动备份**: 支持定时任务自动备份

### 13. 仪表盘

- **系统概览**: 展示服务器、告警、任务等核心指标
- **大屏模式**: 全屏可视化仪表盘
- **实时数据**: WebSocket 推送实时状态更新

### 14. 网络设备管理

- **设备管理**: 添加/编辑/删除网络设备（路由器、交换机、防火墙等）
- **厂商适配**: 支持多厂商命令适配（华为、华三、思科、锐捷等）
- **巡检功能**: 自动执行巡检命令并解析结果
- **巡检历史**: 记录巡检结果，支持 Markdown 格式查看和下载

### 15. VNC 远程桌面

- **VNC 代理**: WebSocket 代理转发 VNC 连接
- **Web 端访问**: 浏览器直接访问远程桌面

### 16. 网络拓扑

- **拓扑可视化**: 服务拓扑图展示
- **节点关系**: 展示服务/服务器之间的依赖关系

### 17. 变更管理

- **变更记录**: 记录系统变更
- **变更追溯**: 跟踪变更对系统的影响

### 18. AI 模型管理

- **模型池**: 管理和切换多个 AI 模型
- **多源支持**: 豆包、OpenAI、本地部署模型（Ollama/LM Studio/vLLM）
- **配置管理**: 在线配置 API Key、API Base、模型名称

## API 路由概览

| 路由前缀 | 说明 | 认证 |
|----------|------|------|
| `/health` | 健康检查（Liveness/Readiness） | 否 |
| `/api/auth` | 登录/登出/用户信息/密码修改 | 否 |
| `/api/webhooks` | 外部告警 Webhook（Prometheus/Zabbix/通用） | 否 |
| `/api/copilot` | AI Copilot 对话 | 是 |
| `/api/agents` | Agent 管理 | 是 |
| `/api/workflows` | 工作流管理 | 是 |
| `/api/tasks` | 任务执行 | 是 |
| `/api/alerts` | 告警管理 | 是 |
| `/api/knowledge` | 知识库 | 是 |
| `/api/knowledge/qanything` | QAnything 知识库集成 | 是 |
| `/api/reports` | 报告管理 | 是 |
| `/api/settings` | 系统设置 | 是 |
| `/api/servers` | 服务器管理 | 是 |
| `/api/server-commands` | 命令执行 | 是 |
| `/api/server-groups` | 服务器分组管理 | 是 |
| `/api/server-management` | 服务器管理增强（分组筛选/信息采集/批量导入） | 是 |
| `/api/scripts` | 脚本管理 | 是 |
| `/api/audit` | 审计日志 | 是 |
| `/api/notifications` | 通知管理 | 是 |
| `/api/users` | 用户管理 (admin/operator) | 是 |
| `/api/scheduled-tasks` | 定时任务 | 是 |
| `/api/alert-mappings` | 告警映射 | 是 |
| `/api/notification-config` | 通知配置 | 是 |
| `/api/alert-noise` | 告警降噪 | 是 |
| `/api/root-cause-analysis` | 根因分析 | 是 |
| `/api/multi-agent` | 多 Agent 协作 | 是 |
| `/api/dashboard` | 仪表盘数据 | 是 |
| `/api/remediation-policies` | 自动修复策略 | 是 |
| `/api/remediation-executions` | 修复执行记录 | 是 |
| `/api/remediation-audits` | 修复审计日志 | 是 |
| `/api/backups` | 数据库备份/恢复 | 是 |
| `/api/database` | 数据库管理 | 是 |
| `/api/import-export` | 数据导入导出 | 是 |
| `/api/vnc` | VNC 远程桌面代理 | 是 |
| `/api/network-devices` | 网络设备管理 | 是 |
| `/api/ssh-keys` | SSH 密钥管理 | 是 |
| `/api/topology` | 网络拓扑 | 是 |
| `/api/changes` | 变更管理 | 是 |
| `/api/ai-models` | AI 模型管理 | 是 |
| `/api/health/summary` | 健康状态摘要（已认证） | 是 |
| `/api/health/history` | 健康状态历史（已认证） | 是 |
| `/api/health/monitor` | 自监控报告（已认证） | 是 |
| `/api/health/monitor/alerts` | 自监控告警历史（已认证） | 是 |
| `/api/ai-remediations` | AI 智能修复 | 是 |
| `/api/approvals` | 审批中心（HITL） | 是 |
| `/api/db-connections` | 数据库连接管理 | 是 |
| `/api/network-advanced` | 网络高级功能 | 是 |
| `/api/network-discovery` | 网络设备发现 | 是 |
| `/api/alert-auto` | 告警自动分析 | 是 |
| `/api/alert-correlation` | 告警关联分析 | 是 |
| `/api/linkage` | 联动规则 | 是 |

## WebSocket 事件

### 客户端 → 服务端

| 事件 | 说明 |
|------|------|
| `task:subscribe` | 订阅任务执行进度 |
| `task:unsubscribe` | 取消订阅 |
| `alert:subscribe` | 订阅告警通知 |

### 服务端 → 客户端

| 事件 | 说明 |
|------|------|
| `task:started` | 任务开始 |
| `task:node:started` | 节点开始执行 |
| `task:node:thinking` | Agent 思考过程 |
| `task:node:output` | Agent 输出结果 |
| `task:node:completed` | 节点执行完成 |
| `task:completed` | 任务完成 |
| `task:failed` | 任务失败 |
| `alert:new` | 新告警 |
| `alert:updated` | 告警状态更新 |

## 数据库表

| 表名 | 说明 |
|------|------|
| schema_migrations | 数据库迁移版本追踪 |
| token_blacklist | Token 黑名单 |
| users | 用户账户 |
| servers | 服务器配置 |
| ssh_keys | SSH 密钥管理 |
| server_groups | 服务器分组 |
| server_group_mapping | 服务器-分组映射 |
| server_command_history | 命令执行历史 |
| compliance_checks | 合规检查记录 |
| encryption_keys | 加密密钥 |
| agents | Agent 配置 |
| agent_executions | Agent 执行记录 |
| workflows | 工作流定义 |
| tasks | 任务执行记录 |
| alerts | 告警记录 |
| alert_webhook_logs | Webhook 告警接收日志 |
| alert_noise_reduction | 告警降噪记录 |
| alert_workflow_mappings | 告警→工作流映射 |
| alert_configs | 告警配置 |
| alert_notifications | 告警通知记录 |
| knowledge_base | 知识库条目 |
| scripts | 运维脚本 |
| reports | 报告记录 |
| report_schedules | 定时报告 |
| scheduled_tasks | 定时任务 |
| settings | 系统设置 |
| audit_logs | 审计日志 |
| notifications | 通知记录 |
| notification_configs | 通知渠道配置 |
| root_cause_analyses | 根因分析记录 |
| copilot_conversations | Copilot 对话历史 |
| service_topologies | 服务拓扑 |
| change_records | 变更记录 |
| remediation_policies | 自动修复策略 |
| remediation_executions | 修复执行记录 |
| remediation_history | 修复历史记录 |
| remediation_audits | 修复审计日志 |
| remediation_cooldowns | 修复冷却期 |
| server_metrics | 服务器指标 |
| network_devices | 网络设备 |
| network_inspection_history | 网络巡检历史 |
| ai_models | AI 模型池 |

## 安全规范

- 服务器密码和 SSH 密钥使用 AES-256-GCM 加密存储
- 用户密码使用 bcrypt (salt rounds = 12) 哈希
- JWT 认证，Token 过期和黑名单机制
- API 速率限制（15 分钟内最多 100 次请求）
- 敏感信息日志自动脱敏
- Helmet 安全头
- CORS 白名单控制