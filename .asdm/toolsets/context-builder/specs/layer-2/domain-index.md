# [领域名] 域

> **重要**：本文件是进入某领域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：[这个领域做什么，核心职责]

**边界说明**：
- **负责**：[列出本领域负责的职责]
- **不负责**：[列出本领域不负责、需要其他领域支持的职责]

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| [模块A] | [简述] | [`com.xxx.A`](link) |
| [模块B] | [简述] | [`com.xxx.B`](link) |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| [领域X] | [接口/数据] | [domains/xxx-domain.md] |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- [domain-details/xxx-domain/index.md](./domain-details/xxx-domain/index.md) - 完整索引
- [domain-details/xxx-domain/entities.md](./domain-details/xxx-domain/entities.md) - 实体定义
- [domain-details/xxx-domain/apis.md](./domain-details/xxx-domain/apis.md) - API 定义

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
