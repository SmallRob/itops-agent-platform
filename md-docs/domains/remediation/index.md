# 自动修复域 - 领域概述

## 1. 域定位

自动修复域是 ITOps Agent Platform 的核心运维域，负责告警触发后自动执行修复，连接告警监控、根因分析和工作流执行三大子系统。

## 2. 子领域

| 子领域 | 核心职责 | 主要服务 |
|--------|----------|----------|
| 策略管理 | 定义告警匹配规则与修复方案 | `RemediationService` |
| 自动执行 | 按策略触发修复工作流 | `RemediationService` |
| AI 修复 | AI 分析结果转为可执行工作流 | `AiRemediationService` |
| 根因分析 | 诊断告警根因并生成修复建议 | `RootCauseAnalysisService` |
| 审计管理 | 修复审批、验证与回滚 | `RemediationService` |

## 3. 核心能力

- **告警匹配**：按告警源、严重级别、关键词、标签匹配策略
- **执行模式**：auto（自动）、approval（审批）、suggestion（建议）
- **验证与回滚**：修复后自动验证，失败自动回滚
- **安全控制**：命令白名单、危险模式检测、冷却时间、频率限制
- **AI 增强**：根因分析 → 生成修复命令 → 工作流执行 → 验证回滚

## 4. 服务架构

```
告警触发
  ├── 策略匹配 → RemediationService.matchAlertToPolicies()
  │     ├── auto → 直接执行工作流
  │     ├── approval → 等待审批 → 执行工作流
  │     └── suggestion → 发送通知
  └── AI 分析 → RootCauseAnalysisService.analyze()
        └── AiRemediationService.createAndExecute()
              → 生成工作流 → 审批 → 执行 → 验证 → 回滚
```

## 5. 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `remediationService.ts` | 服务 | 核心修复引擎 |
| `aiRemediationService.ts` | 服务 | AI 修复服务 |
| `rootCauseAnalysisService.ts` | 服务 | 根因分析服务 |
| `remediationExecutionRoutes.ts` | 路由 | 执行记录 API |
| `remediationAuditRoutes.ts` | 路由 | 审计管理 API |
