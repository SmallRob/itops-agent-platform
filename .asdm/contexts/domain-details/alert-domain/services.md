# 告警域服务接口
本文档定义告警域的核心服务接口。
## 1. AlertService
告警服务负责告警规则管理、告警触发和通知发送。
### 核心方法
| 方法 | 描述 | 参数 | 返回值 |
|------|------|------|--------|
| `init()` | 初始化服务 | - | void |
| `getRules()` | 获取所有告警规则 | - | AlertRule[] |
| `addRule(rule)` | 添加告警规则 | rule: AlertRule | AlertRule |
| `updateRule(ruleId, updates)` | 更新告警规则 | ruleId: string, updates: Partial<AlertRule> | AlertRule \| null |
| `deleteRule(ruleId)` | 删除告警规则 | ruleId: string | boolean |
| `checkAlerts(metrics)` | 检查告警条件 | metrics: 监控指标对象 | Promise<AlertNotification[]> |
| `processDatabaseAlert(alertId)` | 处理数据库告警（触发 RCA） | alertId: string | void |
| `getHistory(limit)` | 获取告警历史 | limit?: number | AlertNotification[] |
| `getStats()` | 获取告警统计 | - | 统计对象 |
| `clearHistory()` | 清空告警历史 | - | void |
## 2. AlertNoiseReductionService
告警降噪服务通过指纹识别、重复计数和时间窗口抑制来减少告警噪音。
### 核心方法
| 方法 | 描述 | 参数 | 返回值 |
|------|------|------|--------|
| `generateFingerprint(source, title, content?)` | 生成告警指纹 | source: string, title: string, content?: string | string |
| `processAlert(source, title, content?, severity?)` | 处理告警（检查是否重复/抑制） | source, title, content?, severity? | Promise<处理结果> |
| `getNoiseReductionStats()` | 获取降噪统计 | - | 统计对象 |
| `getSuppressedAlerts()` | 获取被抑制的告警 | - | AlertNoiseRecord[] |
| `unsuppressAlert(fingerprint)` | 取消抑制告警 | fingerprint: string | boolean |
| `manuallySuppressAlert(fingerprint, reason, duration?)` | 手动抑制告警 | fingerprint, reason, duration? | boolean |
| `cleanupOldRecords(daysToKeep?)` | 清理旧记录 | daysToKeep?: number | number |
### 降噪规则
- **重复检测**：基于指纹（来源+标题）识别重复告警
- **自动抑制**：非 critical/high 告警，出现 5 次以上自动抑制 30 分钟
- **Critical 告警**：不自动抑制，始终通知
- **记录清理**：每 6 小时自动清理 30 天前的记录
## 3. AlertCorrelationService
告警关联服务将相关告警自动归组，支持多种关联策略。
### 核心方法
| 方法 | 描述 | 参数 | 返回值 |
|------|------|------|--------|
| `start()` | 启动自动关联服务 | - | void |
| `stop()` | 停止自动关联服务 | - | void |
| `autoCorrelate()` | 执行自动关联 | - | Promise<number> |
| `getGroups(options)` | 获取所有关联组 | options: {status?, limit?, offset?} | {groups, total} |
| `getGroupDetail(groupId)` | 获取关联组详情 | groupId: string | {group, members} \| null |
| `createManualGroup(alertIds, title?)` | 手动创建关联组 | alertIds: string[], title?: string | CorrelationGroup |
| `addAlertToGroup(groupId, alertId)` | 将告警添加到组 | groupId: string, alertId: string | void |
| `removeAlertFromGroup(groupId, alertId)` | 从组中移除告警 | groupId: string, alertId: string | void |
| `resolveGroup(groupId, rootCause?)` | 解决关联组 | groupId: string, rootCause?: string | void |
| `deleteGroup(groupId)` | 删除关联组 | groupId: string | void |
| `getAlertGroup(alertId)` | 获取告警所在的关联组 | alertId: string | CorrelationGroup \| null |
| `getStats()` | 获取关联统计 | - | 统计对象 |
### 关联规则
| 规则 | 权重 | 描述 |
|------|------|------|
| 同一设备 | +5 | 最高权重，同设备告警强关联 |
| 时间窗口 | +3 | 30 分钟内发生的告警 |
| 5 分钟内 | +2 | 时间更近，额外加分 |
| 关键词匹配 | +2×N | 共同关键词数量×2 |
| 同一来源 | +1 | 来源相同加分 |
| 同一严重级别 | +1 | 严重程度相同加分 |
**最小关联分数**：8（强关联阈值）
## 4. AlertAutoAnalyzer
告警自动分析器通过 SSH/SNMP 诊断设备，结合 AI 分析根因并生成修复建议。
### 核心方法
| 方法 | 描述 | 参数 | 返回值 |
|------|------|------|--------|
| `start()` | 启动自动分析服务 | - | void |
| `stop()` | 停止自动分析服务 | - | void |
| `analyzeAlert(alertId)` | 分析单个告警 | alertId: string | Promise<AutoAnalysisResult \| null> |
| `getAnalysisHistory(limit)` | 获取分析历史 | limit?: number | AutoAnalysisResult[] |
| `getByAlertId(alertId)` | 根据告警 ID 获取分析记录 | alertId: string | AutoAnalysisResult \| undefined |
### 诊断命令
#### 网络设备（按厂商）
| 厂商 | 诊断命令 |
|------|----------|
| 华为 | display version, display device, display interface brief, display cpu-usage |
| 思科 | show version, show inventory, show ip interface brief, show processes cpu sorted |
| H3C | display version, display device, display interface brief, display cpu-usage |
| 锐捷 | show version, show interface brief, show cpu, show memory |
| 中兴 | show version, show interface brief, show logging, show cpu |
#### 服务器
```
hostnamectl, uptime, top, free -m, df -h, dmesg, journalctl, ss -tlnp, systemctl list-units --failed
```
### AI 分析流程
1. 查询知识库获取历史方案
2. 构建分析提示词（告警信息+诊断输出）
3. 调用 LLM 生成诊断报告
4. 提取修复命令（JSON 格式）
5. 创建修复工作流（可选）
## 5. 服务单例
```typescript
export const alertService = new AlertService();
export const alertNoiseReductionService = new AlertNoiseReductionService();
export const alertCorrelationService = new AlertCorrelationService();
export const alertAutoAnalyzer = new AlertAutoAnalyzer();
```