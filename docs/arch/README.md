# 架构决策记录（ADR）

本目录记录了ITOps Agent Platform项目的重要架构决策，帮助新加入的开发者理解项目的设计思路和技术选型背后的思考。

## 什么是ADR？

ADR（Architecture Decision Record，架构决策记录）是一种记录架构决策的文档格式，包含：

- 决策背景
- 可选方案
- 最终决策
- 决策理由
- 后果（正面和负面）
- 未来计划

## ADR 列表

| 编号 | 标题 | 状态 | 日期 |
|------|------|------|------|
| 001 | [为什么选择SQLite作为数据库](./001-为什么选择SQLite作为数据库.md) | 已接受 | 2024-05-18 |
| 002 | [为什么选择React+Node.js技术栈](./002-为什么选择React+Node.js技术栈.md) | 已接受 | 2024-05-18 |
| 003 | [工作流引擎设计决策](./003-工作流引擎设计决策.md) | 已接受 | 2024-05-18 |

## 贡献ADR

如果你想提出新的架构决策，请按照以下格式创建新的ADR文档：

```markdown
# 序号-简短描述

| 属性 | 说明 |
|-------|------|
| **状态** | 提议/已接受/已拒绝/已废弃 |
| **创建日期** | YYYY-MM-DD |
| **作者** | 你的名字 |

## 背景

描述决策的背景和问题。

## 选项

列出评估过的选项及其优缺点。

## 决策

说明最终选择了什么。

## 理由

解释为什么这样选择。

## 后果

描述正面和负面的后果。

## 未来计划（可选）

描述相关的未来工作计划。
```

## 参考资料

- [Documenting architecture decisions - Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html)
- [GitHub - adr/madr: ADRs using Markdown Any Decision Records](https://github.com/adr/madr)
