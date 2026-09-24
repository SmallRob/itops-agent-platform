---
name: alert-analysis
description: 告警分析与根因定位：查询活跃告警、触发 AI 根因分析、查看修复策略与自动修复执行结果
tags: [告警, 根因, rca, 自动修复, 降噪]
triggers: [告警, 根因, rca, 为什么报警, 自动修复, 故障分析]
---

# 告警分析技能

封装平台「告警中心 / 根因分析 / 自动修复 / 知识库」能力。

## 工作流

1. `alert.list` 拉取活跃告警，按 severity 排序
2. 高优告警调用 `alert.root-cause` 获取推理链
3. 需要处置建议时结合 `knowledge.search` 检索知识库
4. 处置动作由「自动修复策略」承接，执行结果通过 `alert.remediation.executions` 复核