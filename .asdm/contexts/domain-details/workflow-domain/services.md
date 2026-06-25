# 工作流域服务接口

## WorkflowExecutorService

工作流执行引擎，负责按拓扑顺序执行工作流节点。

### 核心方法

#### executeWorkflow

执行工作流任务的入口函数。

```typescript
/**
 * 执行工作流任务
 * @param taskId 任务 ID
 * @param workflow 工作流定义
 * @param initialInput 初始输入
 * @param context 执行上下文变量
 */
export async function executeWorkflow(
  taskId: string,
  workflow: WorkflowParsed,
  initialInput?: string,
  context?: Record<string, unknown>
): Promise<void>
```

#### resumeWorkflow

审批通过后恢复工作流执行。

```typescript
export async function resumeWorkflow(
  taskId: string,
  approvalId: string,
  approvedBy: string,
  comment?: string
): Promise<void>
```

#### rejectWorkflow

审批拒绝，终止工作流。

```typescript
export async function rejectWorkflow(
  taskId: string,
  approvalId: string,
  rejectedBy: string,
  reason: string
): Promise<void>
```

#### timeoutApproval

处理审批超时。

```typescript
export async function timeoutApproval(approvalId: string): Promise<void>
```

### 内部方法

#### executeFromIndex

从指定索引开始执行节点。

```typescript
async function executeFromIndex(
  taskId: string,
  workflow: WorkflowParsed,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  executionOrder: string[],
  nodeResults: Record<string, NodeResult>,
  executionContext: ExecutionContext,
  startIndex: number,
  initialInput: string | undefined,
  executionDepth: number,
  MAX_EXECUTION_DEPTH: number
): Promise<'completed' | 'paused'>
```

#### topologicalSort

拓扑排序算法，计算节点执行顺序。

```typescript
function topologicalSort(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): string[]
```

---

## SchedulerService

定时调度服务，管理定时任务和自动执行。

### 方法列表

| 方法 | 说明 |
|------|------|
| init() | 初始化调度器 |
| scheduleTask(task) | 注册定时任务 |
| executeWorkflow(task) | 执行定时工作流 |
| cancelTask(taskId) | 取消定时任务 |
| updateTask(task) | 更新定时任务 |
| deleteTask(taskId) | 删除定时任务 |
| getNextExecution(taskId) | 获取下次执行时间 |
| shutdown() | 关闭调度器 |

### ScheduledTaskRecord

```typescript
interface ScheduledTaskRecord {
  id: string;
  name: string;
  description?: string;
  schedule: string;  // Cron 表达式
  workflow_id: string;
  enabled: number;
}
```

---

## 依赖服务

| 服务 | 说明 |
|------|------|
| AgentExecutorService | 执行 Agent 节点 |
| NotificationService | 发送通知 |
| ReportService | 生成执行报告 |
| AuditService | 记录审计日志 |
