# 自动修复策略引擎 - 技术设计方案

> 版本：v1.1  
> 日期：2026-06-14  
> 作者：AI Assistant  
> 更新：补充 AI 自动修复工作流实现细节

---

## 一、功能概述

### 1.1 核心目标

自动修复策略引擎是现有告警系统和工作流引擎的**智能桥梁**，实现：

- **告警自动触发修复**：当告警匹配预设规则时，自动执行修复流程
- **智能修复决策**：基于历史修复记录和 AI 分析，推荐最佳修复方案
- **分级执行策略**：支持自动执行、审批后执行、仅建议三种模式
- **效果验证闭环**：修复后自动验证问题是否真正解决
- **自动回滚机制**：验证失败时自动执行回滚操作，恢复系统到修复前状态

### 1.2 与现有系统的关系

```
┌─────────────┐    触发     ┌──────────────────┐    执行     ┌─────────────┐
│  告警系统    │ ─────────▶  │  自动修复策略引擎  │ ─────────▶  │  工作流引擎  │
│ (Alerts)    │  匹配规则    │ (Auto-Remediation) │  调用流程   │ (Workflows) │
└─────────────┘             └──────────────────┘             └─────────────┘
                                    │                                │
                                    ▼                                ▼
                          ┌──────────────────┐             ┌─────────────┐
                          │  修复效果验证     │ ◀────────── │  Agent 执行  │
                          │ (Verification)   │  返回结果    │ (Executor)  │
                          └──────────────────┘             └─────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │  自动回滚机制     │
                          │ (Auto-Rollback)  │
                          └──────────────────┘
```

---

## 二、数据库设计

### 2.1 remediation_policies（修复策略表）

```sql
CREATE TABLE remediation_policies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                    -- 策略名称
    description TEXT,                      -- 策略描述
    alert_source TEXT NOT NULL,            -- 告警来源：zabbix, prometheus, custom
    alert_severity TEXT,                   -- 告警级别匹配：disaster, high, average, warning, info
    alert_keywords TEXT,                   -- 告警关键词匹配（JSON数组）
    alert_tags TEXT,                       -- 告警标签匹配（JSON数组）
    
    -- 执行策略
    execution_mode TEXT NOT NULL DEFAULT 'approval', -- auto(自动执行), approval(审批后执行), suggestion(仅建议)
    workflow_id TEXT,                      -- 关联的工作流 ID
    workflow_params TEXT,                  -- 工作流参数模板（JSON）
    
    -- 触发控制
    max_executions_per_hour INTEGER DEFAULT 5,    -- 每小时最大执行次数（防止重复触发）
    cooldown_seconds INTEGER DEFAULT 300,         -- 冷却时间（秒），同一策略重复触发间隔
    require_confirmation TEXT,                    -- 需要确认的条件（JSON，如：影响服务器数>10时）
    
    -- 验证配置
    enable_verification BOOLEAN DEFAULT 1,        -- 是否启用修复后验证
    verification_workflow_id TEXT,                -- 验证工作流 ID
    verification_params TEXT,                     -- 验证参数（JSON）
    verification_timeout_seconds INTEGER DEFAULT 120, -- 验证超时时间
    
    -- 回滚配置
    enable_rollback BOOLEAN DEFAULT 1,            -- 是否启用自动回滚
    rollback_workflow_id TEXT,                    -- 回滚工作流 ID
    rollback_on_failure BOOLEAN DEFAULT 1,        -- 修复失败时自动回滚
    
    -- 状态与审计
    enabled BOOLEAN DEFAULT 1,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    FOREIGN KEY (verification_workflow_id) REFERENCES workflows(id),
    FOREIGN KEY (rollback_workflow_id) REFERENCES workflows(id)
);

CREATE INDEX idx_remediation_policies_alert_source ON remediation_policies(alert_source);
CREATE INDEX idx_remediation_policies_enabled ON remediation_policies(enabled);
```

### 2.2 remediation_executions（修复执行记录表）

```sql
CREATE TABLE remediation_executions (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,                     -- 关联策略
    alert_id TEXT NOT NULL,                      -- 触发告警
    alert_snapshot TEXT,                         -- 告警快照（JSON，记录触发时的告警状态）
    
    -- 执行状态
    status TEXT NOT NULL DEFAULT 'pending',      -- pending, checking, waiting_approval, approved, rejected, running, verifying, success, failed, rolled_back, skipped
    status_reason TEXT,                          -- 状态说明（如拒绝原因）
    
    -- 审批信息
    approval_required BOOLEAN DEFAULT 0,
    approved_by TEXT,                            -- 审批人
    approved_at DATETIME,                        -- 审批时间
    approval_comment TEXT,                       -- 审批意见
    
    -- 执行信息
    workflow_execution_id TEXT,                  -- 工作流执行 ID
    started_at DATETIME,                         -- 开始执行时间
    completed_at DATETIME,                       -- 完成时间
    execution_result TEXT,                       -- 执行结果（JSON）
    
    -- 验证信息
    verification_status TEXT,                    -- pending, success, failed, skipped
    verification_result TEXT,                    -- 验证结果（JSON）
    verification_completed_at DATETIME,
    
    -- 回滚信息
    rollback_triggered BOOLEAN DEFAULT 0,
    rollback_execution_id TEXT,                  -- 回滚执行 ID
    rollback_completed_at DATETIME,
    rollback_result TEXT,                        -- 回滚结果（JSON）
    
    -- 性能指标
    execution_duration_ms INTEGER,               -- 执行耗时（毫秒）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (policy_id) REFERENCES remediation_policies(id),
    FOREIGN KEY (alert_id) REFERENCES alerts(id)
);

CREATE INDEX idx_remediation_executions_policy ON remediation_executions(policy_id);
CREATE INDEX idx_remediation_executions_alert ON remediation_executions(alert_id);
CREATE INDEX idx_remediation_executions_status ON remediation_executions(status);
CREATE INDEX idx_remediation_executions_created ON remediation_executions(created_at);
```

### 2.3 remediation_history（修复历史统计表）

```sql
CREATE TABLE remediation_history (
    id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    alert_source TEXT,
    alert_severity TEXT,
    execution_status TEXT,                       -- success, failed, rolled_back
    root_cause TEXT,                             -- 根因分类（AI 分析得出）
    resolution TEXT,                             -- 解决方案
    duration_ms INTEGER,                         -- 总耗时
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (policy_id) REFERENCES remediation_policies(id)
);

CREATE INDEX idx_remediation_history_policy ON remediation_history(policy_id);
CREATE INDEX idx_remediation_history_status ON remediation_history(execution_status);
```

---

## 三、API 设计

### 3.1 策略管理 API

#### 3.1.1 创建修复策略

```
POST /api/remediation-policies
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
    "name": "磁盘空间不足自动清理",
    "description": "当磁盘使用率超过90%时，自动清理日志和临时文件",
    "alert_source": "zabbix",
    "alert_severity": "high",
    "alert_keywords": ["disk", "space", "full"],
    "alert_tags": ["storage", "disk"],
    "execution_mode": "approval",
    "workflow_id": "xxx-xxx-xxx",
    "workflow_params": {
        "server_id": "{{alert.host}}",
        "cleanup_path": "/var/log",
        "threshold": 90
    },
    "max_executions_per_hour": 3,
    "cooldown_seconds": 600,
    "enable_verification": true,
    "verification_workflow_id": "yyy-yyy-yyy",
    "verification_params": {
        "server_id": "{{alert.host}}",
        "check_disk_usage": true
    },
    "enable_rollback": true,
    "rollback_workflow_id": "zzz-zzz-zzz"
}

Response (201):
{
    "success": true,
    "data": {
        "id": "policy-xxx-xxx",
        "name": "磁盘空间不足自动清理",
        ...
    }
}
```

#### 3.1.2 查询修复策略列表

```
GET /api/remediation-policies?enabled=true&alert_source=zabbix&page=1&limit=20

Response (200):
{
    "success": true,
    "data": {
        "policies": [...],
        "total": 15,
        "page": 1,
        "limit": 20
    }
}
```

#### 3.1.3 更新修复策略

```
PUT /api/remediation-policies/:id
Content-Type: application/json
Authorization: Bearer <token>

Request Body: 同创建接口
```

#### 3.1.4 删除修复策略

```
DELETE /api/remediation-policies/:id
Authorization: Bearer <token>

Response (200):
{
    "success": true,
    "message": "修复策略已删除"
}
```

#### 3.1.5 启用/禁用策略

```
PATCH /api/remediation-policies/:id/toggle
Authorization: Bearer <token>

Response (200):
{
    "success": true,
    "data": {
        "id": "policy-xxx",
        "enabled": false
    }
}
```

### 3.2 执行管理 API

#### 3.2.1 查询执行记录

```
GET /api/remediation-executions?policy_id=xxx&status=running&page=1&limit=20

Response (200):
{
    "success": true,
    "data": {
        "executions": [...],
        "total": 100,
        "page": 1,
        "limit": 20
    }
}
```

#### 3.2.2 审批执行请求

```
POST /api/remediation-executions/:id/approve
Content-Type: application/json
Authorization: Bearer <token>

Request Body:
{
    "action": "approve",  // approve | reject
    "comment": "同意执行"
}

Response (200):
{
    "success": true,
    "message": "审批成功"
}
```

#### 3.2.3 手动触发修复

```
POST /api/remediation-executions/:id/retry
Authorization: Bearer <token>

Response (200):
{
    "success": true,
    "message": "修复已重新触发"
}
```

### 3.3 统计 API

#### 3.3.1 修复策略效果统计

```
GET /api/remediation-policies/:id/stats?days=30

Response (200):
{
    "success": true,
    "data": {
        "policy_id": "xxx",
        "total_triggers": 150,
        "success_count": 135,
        "failed_count": 10,
        "rolled_back_count": 5,
        "success_rate": 90.0,
        "avg_duration_ms": 5230,
        "top_root_causes": [
            { "cause": "日志文件过大", "count": 80 },
            { "cause": "临时文件堆积", "count": 45 }
        ],
        "daily_stats": [
            { "date": "2025-05-01", "triggers": 5, "success": 4, "failed": 1 },
            ...
        ]
    }
}
```

---

## 四、服务层设计

### 4.1 核心服务：remediationService.ts

```typescript
// 文件位置: backend/src/services/remediationService.ts

interface RemediationService {
    // 初始化
    init(): void;
    
    // 策略管理
    createPolicy(policy: CreateRemediationPolicyRequest): Promise<RemediationPolicy>;
    updatePolicy(id: string, policy: UpdateRemediationPolicyRequest): Promise<RemediationPolicy>;
    deletePolicy(id: string): Promise<void>;
    getPolicy(id: string): Promise<RemediationPolicy>;
    listPolicies(filters: PolicyFilter): Promise<PaginatedResult<RemediationPolicy>>;
    togglePolicy(id: string): Promise<RemediationPolicy>;
    
    // 告警匹配与触发
    matchAlertToPolicies(alert: Alert): Promise<RemediationPolicy[]>;
    triggerRemediation(policy: RemediationPolicy, alert: Alert): Promise<RemediationExecution>;
    
    // 审批管理
    approveExecution(executionId: string, action: 'approve' | 'reject', comment?: string): Promise<void>;
    
    // 执行管理
    executeWorkflow(executionId: string): Promise<void>;
    verifyResult(executionId: string): Promise<VerificationResult>;
    rollbackExecution(executionId: string): Promise<void>;
    
    // 统计
    getPolicyStats(policyId: string, days: number): Promise<PolicyStats>;
    
    // 清理
    cleanupOldExecutions(days: number): Promise<void>;
}
```

### 4.2 核心流程图

```
告警到达
    │
    ▼
┌─────────────────┐
│ 匹配修复策略     │ ◀── 遍历所有 enabled 策略
│ (matchPolicy)   │     检查: alert_source, severity, keywords, tags
└────────┬────────┘
         │ 匹配成功
         ▼
┌─────────────────┐
│ 检查冷却时间     │ ◀── 同一策略+同一告警源
│ (checkCooldown) │     防止短时间内重复触发
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 检查执行频率     │ ◀── 查询过去 1 小时执行次数
│ (checkRateLimit)│     超过限制 → 跳过并记录
└────────┬────────┘
         │ 通过
         ▼
┌─────────────────┐
│ 判断执行模式     │
│ (executionMode) │
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
auto              approval
│                 │
▼                 ▼
直接执行      创建待审批记录
工作流        发送通知给管理员
│                 │
│            ┌────┴────────────┐
│            │                 │
│            ▼                 ▼
│        approve           reject
│            │                 │
│            ▼                 ▼
│        执行工作流          标记已拒绝
│                            记录原因
▼                 ▼
┌─────────────────┐
│ 执行修复工作流   │ ◀── 调用 workflowExecutor
│ (execute)       │     传递 workflow_params
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 验证修复结果     │ ◀── 如果 enable_verification=true
│ (verify)        │     执行验证工作流
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
  success          failed
    │                 │
    │                 ▼
    │            enable_rollback?
    │            ┌────┴────────────┐
    │            │                 │
    │            ▼                 ▼
    │          true              false
    │            │                 │
    │            ▼                 ▼
    │        执行回滚            标记失败
    │        工作流              记录原因
    │
    ▼
┌─────────────────┐
│ 更新告警状态     │ ◀── 将告警标记为 resolved
│ (resolveAlert)  │
└────────┬────────┘
         │
         ▼
    记录到历史表
    发送通知
```

### 4.3 关键代码结构

```typescript
// backend/src/services/remediationService.ts

import { v4 as uuidv4 } from 'uuid';
import db from '../models/database';
import { workflowExecutor } from './workflowExecutor';
import { notificationService } from './notificationService';
import { logger } from '../utils/logger';

interface CooldownCache {
    [key: string]: number; // "policyId:alertSource:alertKey" => timestamp
}

class RemediationService {
    private cooldownCache: CooldownCache = {};
    private initialized = false;
    
    init(): void {
        if (this.initialized) return;
        this.loadCooldownCache();
        this.initialized = true;
        logger.info('Auto-remediation engine initialized');
    }
    
    /**
     * 匹配告警到修复策略
     */
    async matchAlertToPolicies(alert: Alert): Promise<RemediationPolicy[]> {
        // 查询所有启用的策略
        const policies = db.prepare(`
            SELECT * FROM remediation_policies 
            WHERE enabled = 1 AND alert_source = ?
        `).all(alert.source) as RemediationPolicy[];
        
        // 过滤匹配的策略
        return policies.filter(policy => {
            // 检查严重程度
            if (policy.alert_severity && policy.alert_severity !== alert.severity) {
                return false;
            }
            
            // 检查关键词
            if (policy.alert_keywords) {
                const keywords = JSON.parse(policy.alert_keywords) as string[];
                const alertMessage = (alert.message || '').toLowerCase();
                if (!keywords.some(kw => alertMessage.includes(kw.toLowerCase()))) {
                    return false;
                }
            }
            
            // 检查标签
            if (policy.alert_tags) {
                const tags = JSON.parse(policy.alert_tags) as string[];
                const alertTags = alert.tags || [];
                if (!tags.some(t => alertTags.includes(t))) {
                    return false;
                }
            }
            
            return true;
        });
    }
    
    /**
     * 触发修复流程
     */
    async triggerRemediation(policy: RemediationPolicy, alert: Alert): Promise<RemediationExecution> {
        // 1. 检查冷却时间
        if (this.isInCooldown(policy, alert)) {
            logger.info(`Policy ${policy.id} in cooldown for alert ${alert.id}`);
            return this.createSkippedExecution(policy, alert, 'cooldown');
        }
        
        // 2. 检查执行频率
        if (this.isRateLimited(policy)) {
            logger.warn(`Policy ${policy.id} rate limited`);
            return this.createSkippedExecution(policy, alert, 'rate_limited');
        }
        
        // 3. 创建执行记录
        const execution = await this.createExecution(policy, alert);
        
        // 4. 根据执行模式处理
        switch (policy.execution_mode) {
            case 'auto':
                await this.executeWorkflow(execution.id);
                break;
            case 'approval':
                await this.requestApproval(execution);
                break;
            case 'suggestion':
                await this.sendSuggestion(execution);
                break;
        }
        
        return execution;
    }
    
    /**
     * 执行修复工作流
     */
    async executeWorkflow(executionId: string): Promise<void> {
        const execution = this.getExecution(executionId);
        const policy = this.getPolicy(execution.policy_id);
        const alert = this.getAlert(execution.alert_id);
        
        // 更新状态
        this.updateExecutionStatus(executionId, 'running');
        
        try {
            // 解析工作流参数（替换模板变量）
            const params = this.resolveParams(policy.workflow_params, alert);
            
            // 执行工作流
            const result = await workflowExecutor.executeWorkflow(
                policy.workflow_id,
                params
            );
            
            // 更新执行记录
            this.updateExecution(executionId, {
                workflow_execution_id: result.execution_id,
                execution_result: JSON.stringify(result)
            });
            
            // 验证修复结果
            if (policy.enable_verification && policy.verification_workflow_id) {
                await this.verifyResult(executionId);
            } else {
                this.updateExecutionStatus(executionId, 'success');
                this.resolveAlert(execution.alert_id);
            }
            
            // 记录到历史
            this.recordHistory(execution, 'success');
            
        } catch (error) {
            logger.error(`Remediation execution ${executionId} failed:`, error);
            this.updateExecutionStatus(executionId, 'failed', error.message);
            
            // 自动回滚
            if (policy.enable_rollback && policy.rollback_on_failure && policy.rollback_workflow_id) {
                await this.rollbackExecution(executionId);
            }
            
            this.recordHistory(execution, 'failed');
        }
    }
    
    /**
     * 验证修复结果
     */
    async verifyResult(executionId: string): Promise<VerificationResult> {
        const execution = this.getExecution(executionId);
        const policy = this.getPolicy(execution.policy_id);
        const alert = this.getAlert(execution.alert_id);
        
        this.updateExecution(executionId, { verification_status: 'pending' });
        
        try {
            const params = this.resolveParams(policy.verification_params, alert);
            const result = await workflowExecutor.executeWorkflowWithTimeout(
                policy.verification_workflow_id,
                params,
                policy.verification_timeout_seconds * 1000
            );
            
            const isSuccess = result.success;
            
            this.updateExecution(executionId, {
                verification_status: isSuccess ? 'success' : 'failed',
                verification_result: JSON.stringify(result),
                status: isSuccess ? 'success' : 'failed'
            });
            
            if (isSuccess) {
                this.resolveAlert(execution.alert_id);
                this.updateCooldown(policy, alert);
            } else {
                // 验证失败，考虑回滚
                if (policy.enable_rollback && policy.rollback_workflow_id) {
                    await this.rollbackExecution(executionId);
                }
            }
            
            return { success: isSuccess, result };
            
        } catch (error) {
            logger.error(`Verification failed for execution ${executionId}:`, error);
            this.updateExecution(executionId, {
                verification_status: 'failed',
                verification_result: JSON.stringify({ error: error.message })
            });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 回滚执行
     */
    async rollbackExecution(executionId: string): Promise<void> {
        const execution = this.getExecution(executionId);
        const policy = this.getPolicy(execution.policy_id);
        const alert = this.getAlert(execution.alert_id);
        
        logger.warn(`Rolling back execution ${executionId}`);
        
        try {
            const result = await workflowExecutor.executeWorkflow(
                policy.rollback_workflow_id,
                { execution_id: executionId }
            );
            
            this.updateExecution(executionId, {
                rollback_triggered: true,
                rollback_execution_id: result.execution_id,
                rollback_result: JSON.stringify(result),
                status: 'rolled_back'
            });
            
        } catch (error) {
            logger.error(`Rollback failed for execution ${executionId}:`, error);
            this.updateExecution(executionId, {
                rollback_triggered: true,
                rollback_result: JSON.stringify({ error: error.message }),
                status: 'failed'
            });
        }
    }
    
    // ... 其他辅助方法
}

export const remediationService = new RemediationService();
```

### 4.4 告警系统集成点

在 `alertRoutes.ts` 中增加告警到达时的自动匹配逻辑：

```typescript
// backend/src/routes/alertRoutes.ts

// 在创建/接收告警时触发修复匹配
app.post('/api/alerts', async (req, res) => {
    const alert = await createAlert(req.body);
    
    // 异步触发修复策略匹配（不阻塞告警创建）
    setImmediate(async () => {
        try {
            const policies = await remediationService.matchAlertToPolicies(alert);
            for (const policy of policies) {
                await remediationService.triggerRemediation(policy, alert);
            }
        } catch (error) {
            logger.error('Failed to match remediation policies:', error);
        }
    });
    
    res.json({ success: true, data: alert });
});
```

---

## 五、路由设计

### 5.1 新建文件：remediationPolicyRoutes.ts

```typescript
// backend/src/routes/remediationPolicyRoutes.ts

import { Router } from 'express';
import { remediationService } from '../services/remediationService';

const router = Router();

// 策略管理
router.post('/', createPolicy);
router.get('/', listPolicies);
router.get('/:id', getPolicy);
router.put('/:id', updatePolicy);
router.delete('/:id', deletePolicy);
router.patch('/:id/toggle', togglePolicy);
router.get('/:id/stats', getPolicyStats);

// 执行管理
router.get('/executions', listExecutions);
router.get('/executions/:id', getExecution);
router.post('/executions/:id/approve', approveExecution);
router.post('/executions/:id/retry', retryExecution);

export default router;
```

### 5.2 注册路由

在 `app.ts` 中添加：

```typescript
import remediationPolicyRoutes from './routes/remediationPolicyRoutes';

app.use('/api/remediation-policies', rateLimiter, remediationPolicyRoutes);
app.use('/api/remediation-executions', rateLimiter, remediationExecutionRoutes);
```

---

## 六、前端页面设计

### 6.1 页面结构

```
frontend/src/pages/
├── RemediationPolicies.tsx          # 修复策略列表页
├── RemediationPolicyEditor.tsx      # 修复策略编辑页
├── RemediationExecutions.tsx        # 修复执行记录页
└── RemediationDashboard.tsx         # 修复效果仪表盘
```

### 6.2 修复策略列表页

```
┌─────────────────────────────────────────────────────────┐
│  自动修复策略                              [+ 新建策略]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 策略名称          │ 触发条件      │ 执行模式 │ 状态 │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 磁盘空间不足自动清理 │ Zabbix, High  │ 审批执行 │ ● 启用│  │
│  │ 磁盘使用率>90%     │ 关键词:disk    │          │      │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 服务自动重启       │ Zabbix, Disaster│ 自动执行│ ● 启用│  │
│  │ 服务宕机           │ 标签:service   │          │      │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 内存泄漏处理       │ Zabbix, High  │ 仅建议  │ ○ 禁用│  │
│  │ 内存使用率持续增长  │              │          │      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  共 15 条策略                          < 1 2 3 >        │
└─────────────────────────────────────────────────────────┘
```

### 6.3 修复策略编辑页

```
┌─────────────────────────────────────────────────────────┐
│  ← 返回        编辑修复策略                [保存] [取消] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  基本信息                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 策略名称: [磁盘空间不足自动清理____________]      │  │
│  │ 描述:     [当磁盘使用率超过90%时自动清理_____]    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  触发条件                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 告警来源:   [Zabbix ▼]                           │  │
│  │ 告警级别:   [High ▼]                             │  │
│  │ 关键词匹配: [disk, space, full     ] [+ 添加]    │  │
│  │ 标签匹配:   [storage, disk         ] [+ 添加]    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  执行策略                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 执行模式:   [审批后执行 ▼]                        │  │
│  │ 关联工作流: [磁盘清理工作流          ] [选择]     │  │
│  │ 工作流参数: {                                     │  │
│  │   "server_id": "{{alert.host}}",                 │  │
│  │   "cleanup_path": "/var/log"                     │  │
│  │ }                                                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  触发控制                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 每小时最大执行次数: [3]                           │  │
│  │ 冷却时间（秒）:      [600]                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  验证配置                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ☑ 启用修复后验证                                 │  │
│  │ 验证工作流: [磁盘空间验证工作流      ] [选择]     │  │
│  │ 验证超时（秒）: [120]                             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  回滚配置                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ☑ 启用自动回滚                                   │  │
│  │ ☑ 修复失败时自动回滚                             │  │
│  │ 回滚工作流: [回滚磁盘清理工作流    ] [选择]       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 6.4 修复执行记录页

```
┌─────────────────────────────────────────────────────────┐
│  修复执行记录                                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  筛选: [全部策略 ▼] [全部状态 ▼] [最近 7 天 ▼]          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 时间                │ 策略           │ 状态      │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 2025-05-25 14:30:20 │ 磁盘清理       │ ● 成功   │  │
│  │                     │ 告警: 磁盘满    │ 耗时: 5s │  │
│  │                     │ 验证: 通过      │          │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 2025-05-25 13:15:10 │ 服务重启       │ ◐ 待审批 │  │
│  │                     │ 告警: Nginx宕机 │          │  │
│  │                     │                 │ [审批]   │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 2025-05-25 12:00:00 │ 磁盘清理       │ ✕ 已回滚 │  │
│  │                     │ 告警: 磁盘满    │ 原因:    │  │
│  │                     │                 │ 清理失败 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  共 245 条记录                         < 1 2 3 ... >    │
└─────────────────────────────────────────────────────────┘
```

### 6.5 修复效果仪表盘

```
┌─────────────────────────────────────────────────────────┐
│  修复效果仪表盘                          [最近 30 天 ▼] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 总触发   │ │ 成功率   │ │ 平均耗时 │ │ 节省人力 │  │
│  │   1,250  │ │  92.5%   │ │   8.3s   │ │  42 小时 │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  修复成功率趋势                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ████████████████████████████████████████████    │  │
│  │  █ 95%  ████████████████████████████████████     │  │
│  │  █ 90%  ████████████████████████████████         │  │
│  │  █ 85%  ██████████████████████████               │  │
│  │  └────────────────────────────────────────────  │  │
│  │    5/1  5/5  5/10  5/15  5/20  5/25             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  策略效果排行                                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 策略名称          │ 触发次数 │ 成功率 │ 平均耗时 │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 1. 磁盘清理       │   450    │  98%   │   5.2s  │  │
│  │ 2. 服务重启       │   320    │  95%   │   8.1s  │  │
│  │ 3. 日志轮转       │   280    │  89%   │  12.5s  │  │
│  │ 4. 内存释放       │   200    │  85%   │  10.3s  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  根因分析                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 日志文件过大        ████████████████████ 45%      │  │
│  │ 服务配置错误        ████████████ 28%              │  │
│  │ 资源不足            ████████ 18%                  │  │
│  │ 其他                ████ 9%                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 七、数据库迁移脚本

### 7.1 迁移文件：migrations.ts 更新

```typescript
// 在 backend/src/models/migrations.ts 中添加

private createRemediationTables(): void {
    this.db.exec(`
        -- 修复策略表
        CREATE TABLE IF NOT EXISTS remediation_policies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            alert_source TEXT NOT NULL,
            alert_severity TEXT,
            alert_keywords TEXT,
            alert_tags TEXT,
            execution_mode TEXT NOT NULL DEFAULT 'approval',
            workflow_id TEXT,
            workflow_params TEXT,
            max_executions_per_hour INTEGER DEFAULT 5,
            cooldown_seconds INTEGER DEFAULT 300,
            require_confirmation TEXT,
            enable_verification BOOLEAN DEFAULT 1,
            verification_workflow_id TEXT,
            verification_params TEXT,
            verification_timeout_seconds INTEGER DEFAULT 120,
            enable_rollback BOOLEAN DEFAULT 1,
            rollback_workflow_id TEXT,
            rollback_on_failure BOOLEAN DEFAULT 1,
            enabled BOOLEAN DEFAULT 1,
            created_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 修复执行记录表
        CREATE TABLE IF NOT EXISTS remediation_executions (
            id TEXT PRIMARY KEY,
            policy_id TEXT NOT NULL,
            alert_id TEXT NOT NULL,
            alert_snapshot TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            status_reason TEXT,
            approval_required BOOLEAN DEFAULT 0,
            approved_by TEXT,
            approved_at DATETIME,
            approval_comment TEXT,
            workflow_execution_id TEXT,
            started_at DATETIME,
            completed_at DATETIME,
            execution_result TEXT,
            verification_status TEXT,
            verification_result TEXT,
            verification_completed_at DATETIME,
            rollback_triggered BOOLEAN DEFAULT 0,
            rollback_execution_id TEXT,
            rollback_completed_at DATETIME,
            rollback_result TEXT,
            execution_duration_ms INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 修复历史统计表
        CREATE TABLE IF NOT EXISTS remediation_history (
            id TEXT PRIMARY KEY,
            policy_id TEXT NOT NULL,
            alert_source TEXT,
            alert_severity TEXT,
            execution_status TEXT,
            root_cause TEXT,
            resolution TEXT,
            duration_ms INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_remediation_policies_alert_source 
            ON remediation_policies(alert_source);
        CREATE INDEX IF NOT EXISTS idx_remediation_policies_enabled 
            ON remediation_policies(enabled);
        CREATE INDEX IF NOT EXISTS idx_remediation_executions_policy 
            ON remediation_executions(policy_id);
        CREATE INDEX IF NOT EXISTS idx_remediation_executions_alert 
            ON remediation_executions(alert_id);
        CREATE INDEX IF NOT EXISTS idx_remediation_executions_status 
            ON remediation_executions(status);
        CREATE INDEX IF NOT EXISTS idx_remediation_history_policy 
            ON remediation_history(policy_id);
    `);
}
```

---

## 八、预置策略模板

### 8.1 内置策略初始化

```typescript
// backend/src/models/presets/initRemediationPolicies.ts

import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

export async function initRemediationPolicies(): Promise<void> {
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies').get() as { count: number };
    
    if (existingCount.count > 0) {
        return; // 已有策略，不重复创建
    }
    
    logger.info('Initializing default remediation policies...');
    
    const policies = [
        {
            id: uuidv4(),
            name: '磁盘空间不足自动清理',
            description: '当磁盘使用率超过阈值时，自动清理日志和临时文件',
            alert_source: 'zabbix',
            alert_severity: 'high',
            alert_keywords: JSON.stringify(['disk', 'space', 'full']),
            alert_tags: JSON.stringify(['storage', 'disk']),
            execution_mode: 'approval',
            workflow_id: null, // 需要用户后续关联
            workflow_params: JSON.stringify({
                server_id: '{{alert.host}}',
                cleanup_paths: ['/var/log', '/tmp'],
                threshold: 90
            }),
            max_executions_per_hour: 3,
            cooldown_seconds: 600,
            enable_verification: true,
            verification_params: JSON.stringify({
                server_id: '{{alert.host}}',
                check_disk_usage: true
            }),
            verification_timeout_seconds: 120,
            enable_rollback: false
        },
        {
            id: uuidv4(),
            name: '服务宕机自动重启',
            description: '当检测到服务宕机时，自动尝试重启服务',
            alert_source: 'zabbix',
            alert_severity: 'disaster',
            alert_keywords: JSON.stringify(['down', 'stopped', 'unreachable']),
            alert_tags: JSON.stringify(['service', 'process']),
            execution_mode: 'auto',
            workflow_id: null,
            workflow_params: JSON.stringify({
                server_id: '{{alert.host}}',
                service_name: '{{alert.service}}'
            }),
            max_executions_per_hour: 5,
            cooldown_seconds: 300,
            enable_verification: true,
            verification_params: JSON.stringify({
                server_id: '{{alert.host}}',
                check_service_status: '{{alert.service}}'
            }),
            verification_timeout_seconds: 60,
            enable_rollback: true,
            rollback_on_failure: false
        },
        {
            id: uuidv4(),
            name: '高 CPU 使用率处理',
            description: '当 CPU 使用率持续过高时，分析原因并提供建议',
            alert_source: 'zabbix',
            alert_severity: 'warning',
            alert_keywords: JSON.stringify(['cpu', 'high', 'load']),
            alert_tags: JSON.stringify(['performance', 'cpu']),
            execution_mode: 'suggestion',
            workflow_id: null,
            workflow_params: JSON.stringify({
                server_id: '{{alert.host}}',
                collect_top_processes: true
            }),
            max_executions_per_hour: 2,
            cooldown_seconds: 1800,
            enable_verification: false,
            enable_rollback: false
        }
    ];
    
    const insertStmt = db.prepare(`
        INSERT INTO remediation_policies (
            id, name, description, alert_source, alert_severity,
            alert_keywords, alert_tags, execution_mode, workflow_id,
            workflow_params, max_executions_per_hour, cooldown_seconds,
            enable_verification, verification_params, verification_timeout_seconds,
            enable_rollback, rollback_on_failure
        ) VALUES (
            @id, @name, @description, @alert_source, @alert_severity,
            @alert_keywords, @alert_tags, @execution_mode, @workflow_id,
            @workflow_params, @max_executions_per_hour, @cooldown_seconds,
            @enable_verification, @verification_params, @verification_timeout_seconds,
            @enable_rollback, @rollback_on_failure
        )
    `);
    
    const insertMany = db.transaction((policies: any[]) => {
        for (const policy of policies) {
            insertStmt.run(policy);
        }
    });
    
    insertMany(policies);
    
    logger.info(`Created ${policies.length} default remediation policies`);
}
```

---

## 九、通知集成

### 9.1 通知场景

在 `notificationService.ts` 中新增通知类型：

```typescript
export type RemediationNotificationType = 
    | 'remediation_triggered'     // 修复已触发
    | 'remediation_approval'      // 需要审批
    | 'remediation_success'       // 修复成功
    | 'remediation_failed'        // 修复失败
    | 'remediation_rolled_back'   // 修复已回滚
    | 'remediation_suggestion'    // 修复建议
```

### 9.2 通知模板

```typescript
const remediationNotificationTemplates = {
    remediation_triggered: {
        title: '🔧 自动修复已触发',
        body: (policy, alert) => `
策略：${policy.name}
告警：${alert.message}
执行模式：${policy.execution_mode}
状态：执行中...
        `.trim()
    },
    remediation_approval: {
        title: '⏳ 修复审批请求',
        body: (policy, alert, execution) => `
策略：${policy.name}
告警：${alert.message}
执行模式：审批后执行
请点击链接进行审批：${APP_URL}/remediation/executions/${execution.id}
        `.trim()
    },
    remediation_success: {
        title: '✅ 自动修复成功',
        body: (policy, alert, duration) => `
策略：${policy.name}
告警：${alert.message}
执行耗时：${duration}ms
结果：问题已解决
        `.trim()
    },
    remediation_failed: {
        title: '❌ 自动修复失败',
        body: (policy, alert, error) => `
策略：${policy.name}
告警：${alert.message}
错误：${error}
${policy.enable_rollback ? '已触发回滚' : '请手动处理'}
        `.trim()
    }
};
```

---

## 十、开发计划

### Phase 1：核心功能（2周）

| 任务 | 预计时间 | 负责人 |
|------|---------|--------|
| 数据库表设计和迁移 | 1天 | 后端 |
| 策略 CRUD API | 2天 | 后端 |
| 告警匹配逻辑 | 2天 | 后端 |
| 冷却和频率控制 | 1天 | 后端 |
| 执行记录和状态管理 | 2天 | 后端 |

### Phase 2：执行引擎（2周）

| 任务 | 预计时间 | 负责人 |
|------|---------|--------|
| 工作流集成 | 2天 | 后端 |
| 参数模板解析 | 1天 | 后端 |
| 验证流程 | 2天 | 后端 |
| 回滚机制 | 2天 | 后端 |
| 审批流程 | 2天 | 后端+前端 |

### Phase 3：前端界面（2周）

| 任务 | 预计时间 | 负责人 |
|------|---------|--------|
| 策略列表页 | 2天 | 前端 |
| 策略编辑器 | 3天 | 前端 |
| 执行记录页 | 2天 | 前端 |
| 审批弹窗 | 1天 | 前端 |

### Phase 4：统计和优化（1周）

| 任务 | 预计时间 | 负责人 |
|------|---------|--------|
| 效果统计 API | 2天 | 后端 |
| 效果仪表盘 | 2天 | 前端 |
| 预置策略模板 | 1天 | 后端 |
| 测试和优化 | 2天 | 全员 |

**总计：约 7 周**

---

## 十一、测试用例

### 11.1 单元测试

```typescript
// backend/src/services/__tests__/remediationService.test.ts

describe('RemediationService', () => {
    describe('matchAlertToPolicies', () => {
        it('should match alerts to policies by source', () => {
            // ...
        });
        
        it('should match alerts by severity', () => {
            // ...
        });
        
        it('should match alerts by keywords', () => {
            // ...
        });
        
        it('should not match disabled policies', () => {
            // ...
        });
    });
    
    describe('triggerRemediation', () => {
        it('should respect cooldown period', () => {
            // ...
        });
        
        it('should respect rate limits', () => {
            // ...
        });
        
        it('should trigger auto mode immediately', () => {
            // ...
        });
        
        it('should create approval request for approval mode', () => {
            // ...
        });
    });
});
```

### 11.2 集成测试场景

| 场景 | 预期结果 |
|------|---------|
| 磁盘满告警触发自动清理 | 清理工作流执行，验证通过，告警关闭 |
| 服务宕机告警触发重启 | 重启工作流执行，服务恢复，告警关闭 |
| 冷却期内重复告警 | 跳过执行，记录跳过原因 |
| 修复失败触发回滚 | 回滚工作流执行，状态标记为已回滚 |
| 审批模式等待超时 | 超时后自动取消执行 |

---

## 十二、风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 误触发导致数据丢失 | 高 | 严格的审批流程、回滚机制、操作审计 |
| 频繁触发影响系统性能 | 中 | 冷却时间、频率限制、资源监控 |
| 工作流执行失败 | 中 | 重试机制、告警升级、人工介入 |
| 参数模板注入攻击 | 高 | 参数校验、白名单、沙箱执行 |
| 冷却缓存丢失 | 低 | 持久化到数据库、定期同步 |

---

## 十三、总结

自动修复策略引擎是现有告警系统和工作流引擎的**智能连接器**，核心价值：

1. **减少人工干预**：常见故障自动处理，释放运维人力
2. **标准化修复流程**：避免人工操作失误
3. **闭环验证**：确保修复真正生效
4. **安全可控**：审批、回滚、审计三重保障

本方案充分利用了现有的工作流引擎、Agent 执行器和通知系统，**无需从零构建**，开发成本可控。
