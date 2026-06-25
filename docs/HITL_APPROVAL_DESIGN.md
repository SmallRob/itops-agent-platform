# HITL 审批节点（Human-in-the-Loop）功能设计文档

## 1. 背景与目标

当前工作流执行器（`workflowExecutor.ts`）采用纯串行执行模式，所有 Agent 节点一旦启动便自动执行到底。在生产运维环境中，运维主管无法在关键操作前进行人工确认，导致该功能无法落地企业场景。

**目标**：在工作流中新增 `approval` 节点类型，执行到该节点时暂停工作流，等待人工审批（批准/拒绝）后继续执行，实现 Human-in-the-Loop 闭环。

## 2. 功能范围

| 能力 | 说明 |
|------|------|
| 审批节点类型 | 工作流编辑器中新增 `approval` 节点，与现有 `agent` 节点并列 |
| 工作流暂停/恢复 | 执行到审批节点时暂停，审批通过后继续执行后续节点 |
| 审批超时 | 可配置审批超时时间，超时后自动拒绝或保持等待 |
| WebSocket 实时推送 | 审批请求通过 WebSocket 实时推送到前端 |
| REST API 审批操作 | 提供审批通过/拒绝的 REST 接口 |
| 通知渠道集成 | 审批请求推送到企业微信/钉钉（复用现有通知系统） |
| 审计记录 | 审批操作记录到审计日志 |

## 3. 数据模型变更

### 3.1 WorkflowNode 类型扩展

```typescript
// backend/src/types/index.ts

// 现有 WorkflowNode.data 扩展
export interface WorkflowNode {
  id: string;
  type: string; // 'agent' | 'approval'
  data: {
    label: string;
    agentId?: string;          // agent 节点使用
    allowFailure?: boolean;
    // ---- 审批节点新增字段 ----
    approvalConfig?: {
      description: string;     // 审批说明（展示给审批人）
      timeout: number;         // 超时时间（秒），默认 3600
      timeoutAction: 'reject' | 'wait'; // 超时行为：自动拒绝 or 继续等待
      approvers: string[];     // 审批人角色列表，如 ['admin', 'operator']
      requireAll: boolean;     // 是否需要所有审批人同意（暂不实现，预留）
    };
  };
  position: { x: number; y: number };
}
```

### 3.2 新增 approval_requests 表

```sql
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_label TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | timeout
  requested_by TEXT,                        -- 触发审批的任务创建者
  approved_by TEXT,                         -- 审批操作人
  approved_at DATETIME,
  reject_reason TEXT,
  timeout_at DATETIME,
  timeout_action TEXT DEFAULT 'reject',
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_approval_task ON approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_created ON approval_requests(created_at DESC);
```

### 3.3 tasks 表状态扩展

现有 `tasks.status` 字段新增 `waiting_approval` 状态：

```
pending → running → waiting_approval → running → completed
                                      ↘ failed
```

## 4. 后端改动

### 4.1 工作流执行器改造（workflowExecutor.ts）

**核心逻辑变更**：在节点执行循环中，遇到 `approval` 类型节点时暂停循环，写入审批记录，等待恢复信号。

```
当前流程:
  for (nodeId of executionOrder) → executeAgentNode → 继续下一个

改造后流程:
  for (nodeId of executionOrder) {
    if (node.type === 'approval') {
      → 创建 approval_request 记录
      → 更新 task.status = 'waiting_approval'
      → WebSocket 推送 task:approval:requested
      → 通知渠道推送
      → 暂停循环（return / break）
    }
    if (node.type === 'agent') {
      → executeAgentNode（不变）
    }
  }
```

**恢复执行**：审批通过后，从暂停的节点继续执行后续节点。实现方式：

- 方案 A（推荐）：将 `executeWorkflow` 拆分为可恢复函数，接收 `resumeFromNodeId` 参数
- 方案 B：使用 Promise + EventEmitter 等待审批结果

**采用方案 A**：将执行循环提取为独立函数，审批通过后由 API 调用重新进入循环。

```typescript
// 伪代码
export async function executeWorkflow(taskId, workflow, initialInput?, context?) {
  // ... 现有初始化逻辑 ...
  await executeFromNode(taskId, workflow, nodes, executionOrder, nodeResults, startIdx, context);
}

async function executeFromNode(taskId, workflow, nodes, executionOrder, nodeResults, startIdx, context) {
  for (let i = startIdx; i < executionOrder.length; i++) {
    const nodeId = executionOrder[i];
    const node = nodes.find(n => n.id === nodeId);

    if (node.type === 'approval') {
      // 创建审批请求，暂停执行
      const approvalId = createApprovalRequest(taskId, node);
      // 更新任务状态
      updateTaskStatus(taskId, 'waiting_approval', nodeId);
      // 推送 WebSocket
      emitApprovalRequested(taskId, node, approvalId);
      // 保存执行上下文到 tasks 表（用于恢复）
      saveExecutionContext(taskId, { executionIndex: i, nodeResults, context });
      return; // 暂停
    }

    // agent 节点执行（现有逻辑不变）
    await executeAgentNode(...);
  }
  // 所有节点执行完成
}

export async function resumeWorkflow(taskId: string, approved: boolean, approverId: string, reason?: string) {
  // 读取保存的执行上下文
  const ctx = loadExecutionContext(taskId);
  if (approved) {
    // 记录审批结果，继续执行下一个节点
    await executeFromNode(taskId, workflow, nodes, executionOrder, nodeResults, ctx.executionIndex + 1, context);
  } else {
    // 拒绝，标记任务失败
    updateTaskStatus(taskId, 'failed');
  }
}
```

### 4.2 新增审批 API 路由（approvalRoutes.ts）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/approvals` | 查询审批列表（支持 status 过滤） | admin, operator |
| GET | `/api/approvals/:id` | 查询审批详情 | admin, operator |
| POST | `/api/approvals/:id/approve` | 审批通过 | admin, operator |
| POST | `/api/approvals/:id/reject` | 审批拒绝 | admin, operator |
| GET | `/api/approvals/pending/count` | 待审批数量（用于前端角标） | admin, operator |

**审批通过请求体**：
```json
POST /api/approvals/:id/approve
{
  "comment": "确认可以执行"  // 可选
}
```

**审批拒绝请求体**：
```json
POST /api/approvals/:id/reject
{
  "reason": "当前时间段不允许变更"  // 必填
}
```

### 4.3 WebSocket 事件

| 事件 | 方向 | 数据 | 说明 |
|------|------|------|------|
| `task:approval:requested` | Server → Client | `{ taskId, approvalId, nodeId, nodeLabel, description, timeout }` | 审批请求 |
| `task:approval:resolved` | Server → Client | `{ taskId, approvalId, status, approvedBy, comment }` | 审批结果 |
| `approval:new` | Server → Client | `{ approvalId, taskId, nodeLabel, description }` | 全局广播新审批（用于导航栏角标） |

### 4.4 审批超时处理

在 `app.ts` 启动时注册定时检查任务：

```typescript
// 每 30 秒检查一次超时的审批请求
setInterval(() => {
  const expired = db.prepare(`
    SELECT * FROM approval_requests
    WHERE status = 'pending' AND timeout_at IS NOT NULL AND timeout_at < datetime('now','localtime')
  `).all();

  for (const req of expired) {
    if (req.timeout_action === 'reject') {
      rejectApproval(req.id, null, '审批超时自动拒绝');
    }
    // timeout_action === 'wait' 则不做处理，继续等待
  }
}, 30000);
```

### 4.5 通知集成

审批请求创建后，复用现有 `notificationService.ts` 发送通知：

```typescript
await notificationService.send({
  type: 'approval_request',
  title: `工作流审批: ${nodeLabel}`,
  content: description,
  metadata: { approvalId, taskId }
});
```

## 5. 前端改动

### 5.1 工作流编辑器（WorkflowEditor.tsx）

在节点面板中新增「审批节点」类型：

- 节点样式：盾牌图标 + 黄色/橙色背景，与 Agent 节点（蓝色）区分
- 配置面板：
  - 审批说明（textarea）
  - 超时时间（数字输入，单位：分钟，默认 60）
  - 超时行为（下拉：自动拒绝 / 继续等待）
  - 审批人角色（多选：admin / operator）

### 5.2 审批管理页面（新增 ApprovalCenter.tsx）

独立页面，展示所有审批请求：

- 待审批列表（卡片式）
  - 显示：工作流名称、节点名称、审批说明、发起时间、倒计时
  - 操作：通过（绿色按钮）/ 拒绝（红色按钮，弹窗填写原因）
- 历史审批记录（表格）
  - 状态筛选：待审批 / 已通过 / 已拒绝 / 已超时

### 5.3 任务执行页面改造

- 任务详情中，审批节点显示为橙色「等待审批」状态
- 审批倒计时实时显示
- 可直接在任务详情页操作审批

### 5.4 导航栏审批角标

- 定时轮询 `/api/approvals/pending/count`
- 有待审批时显示红色数字角标

## 6. 数据库迁移

新增迁移文件 `v017_approval_requests.ts`：

```typescript
// backend/src/models/migrations/v017_approval_requests.ts
import { Migration } from './migrationFramework';

const v017ApprovalRequests: Migration = {
  id: '20260614000017',
  version: 17,
  name: 'approval_requests',
  description: 'Add approval_requests table for HITL workflow',
  up: async (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_label TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by TEXT,
        approved_by TEXT,
        approved_at DATETIME,
        reject_reason TEXT,
        timeout_at DATETIME,
        timeout_action TEXT DEFAULT 'reject',
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_approval_task ON approval_requests(task_id);
      CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
      CREATE INDEX IF NOT EXISTS idx_approval_created ON approval_requests(created_at DESC);
    `);
  },
  down: async (db) => {
    db.exec(`DROP TABLE IF EXISTS approval_requests`);
  }
};
export default v017ApprovalRequests;
```

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `backend/src/types/index.ts` | 修改 | WorkflowNode 增加 approvalConfig 字段，新增 ApprovalRequest 类型 |
| `backend/src/models/migrations/v017_approval_requests.ts` | 新增 | 数据库迁移 |
| `backend/src/models/migrations/index.ts` | 修改 | 注册新迁移 |
| `backend/src/services/workflowExecutor.ts` | 修改 | 支持审批节点暂停/恢复 |
| `backend/src/routes/approvalRoutes.ts` | 新增 | 审批 CRUD + 操作 API |
| `backend/src/app.ts` | 修改 | 注册审批路由 + 超时检查定时器 |
| `backend/src/websocket/handler.ts` | 修改 | 新增审批相关 WebSocket 事件 |
| `backend/src/services/notificationService.ts` | 修改 | 支持审批通知类型 |
| `frontend/src/pages/ApprovalCenter.tsx` | 新增 | 审批中心页面 |
| `frontend/src/pages/WorkflowEditor.tsx` | 修改 | 新增审批节点类型和配置面板 |
| `frontend/src/pages/TaskDetail.tsx` | 修改 | 审批节点状态展示和操作 |
| `frontend/src/components/ApprovalNode.tsx` | 新增 | 审批节点可视化组件 |
| `frontend/src/App.tsx` | 修改 | 新增审批中心路由 |

## 8. 执行流程图

```
用户创建工作流（含审批节点）
        │
        ▼
  POST /api/tasks（启动任务）
        │
        ▼
  executeWorkflow() 开始执行
        │
        ▼
  ┌─ 遍历执行顺序 ─────────────────────┐
  │                                      │
  │  agent 节点 → executeAgentNode()     │
  │       │                              │
  │       ▼                              │
  │  approval 节点?                      │
  │    ├─ 是 → 创建审批记录              │
  │    │      task.status =              │
  │    │        'waiting_approval'       │
  │    │      WebSocket 推送审批请求      │
  │    │      发送通知                   │
  │    │      return（暂停执行）          │
  │    │                                 │
  │    └─ 否 → 继续下一个节点            │
  │                                      │
  └──────────────────────────────────────┘
                    │
        ┌───────────┘（等待审批）
        ▼
  POST /api/approvals/:id/approve
        │
        ▼
  resumeWorkflow(taskId)
        │
        ▼
  从暂停位置继续执行后续节点
        │
        ▼
  所有节点完成 → task.status = 'completed'
```

## 9. 安全考量

- 审批操作需要 JWT 认证，仅 `admin` 和 `operator` 角色可操作
- `viewer` 角色只能查看审批列表，不能操作
- 审批操作记录到 `audit_logs` 表
- 审批超时默认行为为自动拒绝，防止任务无限挂起
- 审批接口做幂等处理，同一审批请求不可重复操作

## 10. 后续扩展（本期不实现）

- 多级审批链（串行/并行审批人）
- 移动端审批（企业微信/钉钉卡片交互）
- 审批条件表达式（根据上下文自动判断是否需要审批）
- 审批统计报表
