# 自动修复域 - 服务接口

## 1. RemediationService

核心修复引擎，提供策略管理、执行调度、审计和回滚。

**文件**：`backend/src/services/remediationService.ts`

### 策略管理
- `createPolicy(policy)` → 创建策略
- `updatePolicy(id, updates)` → 更新策略
- `deletePolicy(id)` → 删除策略
- `getPolicy(id)` → 获取策略详情
- `listPolicies(filters)` → 分页查询
- `togglePolicy(id)` → 切换启用状态

### 告警匹配
- `matchAlertToPolicies(alert)` → 匹配告警到适用策略
  - 先精确匹配告警源，无匹配降级到 `source='*'`
  - 严重级别归一化为 5 级数字等级
  - 关键词/标签匹配，支持 `__catch_all__`
- `getCatchAllPolicies(source)` → 获取通配策略

### 执行管理
- `triggerRemediation(policy, alert)` → 触发修复
  - 检查冷却和频率限制
  - auto: 异步执行工作流
  - approval: 发送审批通知
  - suggestion: 发送建议通知
- `executeWorkflow(executionId)` → 执行修复工作流
- `verifyResult(executionId)` → 验证结果（带超时）
- `rollbackExecution(executionId)` → 回滚
- `approveExecution(id, action, userId, comment)` → 审批
- `retryExecution(id)` → 重试

### 审计管理
- `createAudit(input)` → 创建审计
- `approveAudit(id, userId, action, comment)` → 审批审计
- `executeAudit(id)` → 执行审计（SSH 命令）
- `verifyAudit(id)` → 验证（负载/内存/磁盘检查）
- `rollbackAudit(id)` → 回滚审计
- `persistToKnowledge(auditId)` → 持久化到知识库

### 查询
- `getExecution(id)` / `listExecutions(filters)`
- `getAudit(id)` / `listAudits(filters)`
- `getPolicyStats(policyId, days)` → 策略统计

### 安全机制
- **白名单**：systemctl, service, docker, rm, mv 等
- **危险模式**：管道、分号、反引号、`$(`、`&&` 等
- **危险命令**：`rm -rf /`、`chmod 777 /` 等
- **冷却/频率限制**

---

## 2. AiRemediationService

AI 修复服务，将分析结果转化为可执行工作流。

**文件**：`backend/src/services/aiRemediationService.ts`

### 核心方法
- `createAndExecute(input)` → 核心入口
  1. 保存修复记录
  2. 生成四节点工作流（审批→执行→验证→回滚）
  3. 创建任务并异步执行

### 工作流生成
- 审批节点：按风险等级设超时（高=2h，中=1h，低=30min）
- 执行节点：server-command-agent 执行修复命令
- 验证节点：智能推断验证命令（服务→状态检查，磁盘→空间检查，Docker→容器检查）
- 回滚节点：智能推断回滚操作（启→停，停→启，cp备份→恢复）

### 查询方法
- `getRecord(id)` / `getByAlertId(alertId)` / `listRecords(limit)`
- `updateStatus(id, status, result?)`

---

## 3. RootCauseAnalysisService

根因分析服务，LLM + 规则引擎双模式。

**文件**：`backend/src/services/rootCauseAnalysisService.ts`

### CRUD
- `create(input)` / `update(id, input)` / `get(id)` / `getByAlert(alertId)` / `list()` / `delete(id)`

### 分析能力
- `analyze(id)` → 三级降级：LLM → 规则引擎 → 通用回退
- `analyzeByAlert(alertId, title, content)` → 按告警分析
- `autoAnalyze(alertId)` → 全自动：收集上下文 → LLM → 保存

### 上下文收集
- `collectContext(alert)` → 拓扑/变更/关联告警/服务器状态/知识匹配

### 分析方法
- `performLLMAnalysis(rca)` → LLM 分析
- `performRuleEngineAnalysis(rca)` → 规则引擎
- `generateFallbackAnalysis(rca)` → 通用回退

### 统计
- `getStats()` → 今日分析数/自动修复数/误报数/总完成数
