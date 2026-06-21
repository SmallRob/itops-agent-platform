[English](./en/README.md) | [中文](./README.md)

---

# 文档目录

ITOps Agent Platform 所有技术文档集合。

---

## 📚 文档清单

### 📖 用户文档

- [项目总览](../README.md) — 项目介绍、功能特性、快速开始
- [部署操作手册](./DEPLOYMENT.md) — 完整部署配置、常见问题、故障排查
- [快速部署指南](./QUICK_DEPLOY.md) — 简化版部署步骤，适合快速上手
- [测试指南](./TEST_GUIDE.md) — 测试方法和操作步骤
- [变更日志](./CHANGELOG.md) — 版本更新记录和变更说明

### ⚙️ 功能文档

- [Web SSH 终端](./WEB_TERMINAL.md) — 交互式远程终端功能、技术实现、使用说明
- [主机管理增强](./SERVER_MANAGEMENT.md) — 服务器分组管理、批量导入、信息采集功能
- [网络设备巡检](./NETWORK_DEVICE_INSPECTION.md) — 网络设备巡检功能
- [QAnything 集成](./QANYTHING_INTEGRATION.md) — QAnything 知识库集成
- [工作流指南](./WORKFLOW_GUIDE.md) — 工作流编排使用指南
- [自动修复设计](./AUTO_REMEDIATION_DESIGN.md) — 告警自动修复功能设计说明

### 👩‍💻 开发文档

- [开发指南](./DEVELOPMENT.md) — 本地开发环境搭建（含 Docker 热重载）、开发流程、调试技巧
- [API 文档](./API.md) — 完整的后端 API 接口文档（含请求/响应示例）
- [技术规范](./SPEC.md) — 项目技术规范文档（路由、服务、数据库表清单）
- [架构设计](./ARCHITECTURE.md) — 系统架构和技术设计说明
- [架构图](./ARCHITECTURE_DIAGRAM.md) — 系统架构图解、模块关系
- [技术实现细节](./TECHNICAL_IMPLEMENTATION.md) — 核心功能技术实现详解
- [架构决策记录](./arch/) — 关键技术选型决策过程和原因

### 🚀 部署与运维

- [生产环境最佳实践](./PRODUCTION.md) — 生产环境配置、安全加固、性能优化
- [CI/CD 配置指南](./CICD_SETUP.md) — 持续集成和持续部署配置说明
- [Docker 镜像构建](../docker/README.md) — Docker 镜像构建和使用说明

---

## 🎯 推荐阅读路径

| 角色 | 推荐阅读顺序 |
|------|-------------|
| **新用户** | [项目总览](../README.md) → [快速部署指南](./QUICK_DEPLOY.md) → [测试指南](./TEST_GUIDE.md) |
| **部署/运维** | [部署操作手册](./DEPLOYMENT.md) → [生产环境最佳实践](./PRODUCTION.md) → [Docker 镜像构建](../docker/README.md) |
| **开发人员** | [开发指南](./DEVELOPMENT.md) → [架构设计](./ARCHITECTURE.md) → [API 文档](./API.md) |
| **架构师** | [架构设计](./ARCHITECTURE.md) → [架构决策记录](./arch/) → [技术实现细节](./TECHNICAL_IMPLEMENTATION.md) |

---

## 📁 文档结构说明

```
ai/
├── README.md                    # 项目根目录文档（入口）
├── CONTRIBUTING.md              # 贡献指南
├── CODE_OF_CONDUCT.md           # 行为准则
├── SECURITY.md                  # 安全策略
├── LICENSE                      # MPL-2.0 许可证
├── .github/
│   ├── ISSUE_TEMPLATE/          # Issue 模板
│   └── PULL_REQUEST_TEMPLATE.md # PR 模板
├── docs/                        # 详细文档目录
│   ├── README.md                # 本文档（文档索引）
│   ├── DEPLOYMENT.md            # 部署操作手册
│   ├── QUICK_DEPLOY.md          # 快速部署指南
│   ├── DEVELOPMENT.md           # 开发指南
│   ├── API.md                   # API 文档
│   ├── ARCHITECTURE.md          # 架构设计
│   ├── ARCHITECTURE_DIAGRAM.md  # 架构图
│   ├── TECHNICAL_IMPLEMENTATION.md # 技术实现
│   ├── PRODUCTION.md            # 生产环境配置
│   ├── CICD_SETUP.md            # CI/CD 配置
│   ├── SPEC.md                  # 技术规范
│   ├── TEST_GUIDE.md            # 测试指南
│   ├── CHANGELOG.md             # 变更日志
│   ├── WEB_TERMINAL.md          # Web 终端文档
│   ├── SERVER_MANAGEMENT.md     # 主机管理文档
│   ├── NETWORK_DEVICE_INSPECTION.md # 网络设备巡检
│   ├── QANYTHING_INTEGRATION.md # QAnything 集成
│   ├── WORKFLOW_GUIDE.md        # 工作流指南
│   ├── AUTO_REMEDIATION_DESIGN.md # 自动修复设计
│   ├── AI_MODEL_POOL_DEVELOPMENT.md # AI 模型池开发
│   ├── add_command_agent.sql    # Agent 数据库脚本
│   ├── 项目愿景与社区共建.md    # 项目愿景
│   └── arch/                    # 架构决策记录
│       └── README.md
├── docs-assets/                 # 文档图片资源
├── docker/                      # Docker 配置
├── frontend/                    # 前端源码
├── backend/                     # 后端源码
├── examples/                    # 示例和测试脚本
└── .github/workflows/           # GitHub Actions CI/CD
```

---

## 💡 文档贡献指南

如发现文档错误或需要补充内容：

1. 找到对应文档，提交 Pull Request
2. 保持文档风格统一：中文 + 代码使用 Markdown 格式
3. 重要配置变更需同步更新相关文档
4. 新增功能需补充功能文档和测试文档
