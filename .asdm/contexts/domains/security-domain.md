# 安全域

> **重要**：本文件是进入安全域时的入口索引。
> **大小限制**：< 1KB（必须保持精简）

## 1. 领域概述

**一句话描述**：命令安全策略引擎，对Agent执行的命令进行分级管控，防止危险操作。

**边界说明**：
- **负责**：命令分级分类、读写分离检测、管道分割检测、路径白名单沙箱、网络主机白名单
- **不负责**：用户认证（基础设施域）、工作流审批（工作流域）

## 2. 子模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 命令安全策略 | 5级命令分类（READ_FS/READ_SYSTEM/MIXED/NETWORK/DENIED）、72条预定义规则 | `backend/src/services/security/commandPolicy.ts` |

## 3. 外部依赖

| 依赖领域 | 依赖内容 | 入口 |
|----------|----------|------|
| Agent域 | Agent执行命令时调用安全检查 | [agent-domain.md](agent-domain.md) |

## 4. 详细上下文入口

> 当需要详细信息时，读取以下文件：

- `backend/src/services/security/commandPolicy.ts` - 命令安全策略实现
- `backend/src/services/security/__tests__/` - 183个测试用例

---

*本文件由 Context Builder v0.3 生成，保持精简以确保 AI 高效加载*
