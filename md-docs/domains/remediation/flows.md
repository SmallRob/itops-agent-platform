# 自动修复域 - 业务流程

## 1. 策略驱动修复流程

### 匹配规则
1. **告警源**：精确匹配或 `*` 通配
2. **严重级别**：归一化为 5 级（disaster=5, critical=4, high=3, warning/medium=2, info=1）
3. **关键词**：告警标题+内容包含任一关键词
4. **标签**：告警标签包含任一策略标签

### 执行流程
```
告警 → matchAlertToPolicies()
  ├── 精确匹配 → 有策略 → 执行
  └── 降级匹配（source='*'）→ 有策略 → 执行
      └── 无策略 → 告警保留

triggerRemediation()
  ├── 冷却检查 → 冷却中 → 跳过
  ├── 频率限制 → 超限 → 跳过
  └── 根据 execution_mode 分发：
      ├── auto → executeWorkflowAsync()
      ├── approval → 等待审批 → 执行
      └── suggestion → 发送通知
```

### 工作流执行
```
executeWorkflow()
  ├── 解析工作流节点/边
  ├── 创建任务记录
  ├── workflowExecutor 执行
  ├── enable_verification? → verifyResult()
  │     ├── 通过 → 成功 + 解决告警
  │     └── 失败 → rollbackExecution()
  └── 执行失败 → rollbackExecution()
```

---

## 2. AI 修复流程

```
告警 → RootCauseAnalysisService.autoAnalyze()
  ├── 收集上下文（拓扑/变更/关联告警/知识库）
  ├── LLM 分析（失败→规则引擎→回退）
  └── 输出根因+建议

→ AiRemediationService.createAndExecute()
  ├── 保存修复记录
  ├── 生成工作流：
  │   [审批] → [执行] → [验证]
  │                └─ 失败 → [回滚]
  ├── 保存工作流
  └── 异步执行（审批节点暂停）
      ├── 审批通过 → 执行修复命令 → 验证
      └── 审批拒绝/超时 → 终止
```

### 智能 Prompt 生成
- **验证**：服务重启→检查状态，磁盘清理→检查空间，Docker→检查容器
- **回滚**：启→停，停→启，cp备份→恢复，Docker run→stop+rm

---

## 3. 根因分析流程

```
analyze(id)
  ├── 更新状态为 analyzing
  ├── LLM 分析（优先）
  │     ├── 成功 → 解析 JSON
  │     └── 失败 → 规则引擎
  │               ├── 成功 → 输出
  │               └── 失败 → 通用回退
  └── 更新 RCA 记录
```

上下文收集：拓扑/变更记录/关联告警/服务器状态/知识库匹配

---

## 4. 审计执行流程

```
创建审计（pending）
  ├── 批准 → 执行
  │     ├── 解析 RCA 建议中的命令
  │     ├── 命令安全检查（白名单+危险模式）
  │     ├── SSH 执行
  │     ├── 验证（负载/内存/磁盘）
  │     └── 成功 → 持久化到知识库
  └── 拒绝 → 终止

回滚：解析 rollback_command → 安全检查 → SSH 执行
```

---

## 5. 安全控制

### 命令验证
```
validateCommand(command)
  ├── 空命令 → 拒绝
  ├── 不在白名单 → 拒绝
  ├── 匹配危险模式（|, ;, `, $(), &&, ||, >, <, ..）→ 拒绝
  ├── 匹配危险命令（rm -rf / 等）→ 拒绝
  └── 通过 → 允许执行
```

### 降噪通知
修复成功后标记 `self_healed:{source}:{title}`，降噪系统降低同类告警优先级。
