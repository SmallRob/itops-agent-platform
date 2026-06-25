# 工作流域业务流程

## 工作流执行流程

```mermaid
flowchart TD
    A[开始执行工作流] --> B[解析工作流定义]
    B --> C[拓扑排序计算执行顺序]
    C --> D{存在循环依赖?}
    D -->|是| E[标记任务失败]
    D -->|否| F[更新任务状态为 running]
    F --> G[遍历执行节点]
    G --> H{节点类型}
    H -->|Agent 节点| I[执行 Agent]
    H -->|审批节点| J[创建审批请求]
    J --> K[保存执行上下文]
    K --> L[返回 paused]
    I --> O{执行成功?}
    O -->|是| P[记录节点结果]
    O -->|否| Q{允许失败?}
    Q -->|是| P
    Q -->|否| R[标记任务失败]
    P --> S{还有下一节点?}
    S -->|是| G
    S -->|否| T[完成工作流]
    T --> U[生成执行报告]
```

## 审批处理流程

### 审批通过

```mermaid
sequenceDiagram
    participant U as 用户
    participant API as Approval API
    participant DB as Database
    participant W as WorkflowExecutor
    
    U->>API: POST /approve
    API->>DB: 验证状态
    API-->>U: 返回成功
    Note over API,W: 异步执行
    API->>W: resumeWorkflow()
    W->>DB: 更新审批状态
    W->>DB: 恢复任务状态
    W->>W: 继续执行
```

### 审批拒绝

```mermaid
sequenceDiagram
    participant U as 用户
    participant API as Approval API
    participant W as WorkflowExecutor
    
    U->>API: POST /reject
    API-->>U: 返回成功
    API->>W: rejectWorkflow()
    W->>W: 终止工作流
```

## 定时任务执行流程

```mermaid
flowchart TD
    A[Cron 触发] --> B[检查任务是否运行中]
    B -->|是| C[跳过本次执行]
    B -->|否| D[获取工作流定义]
    D --> E[创建 Task 记录]
    E --> F[执行工作流]
    F --> G[更新执行状态]
    G --> H[记录审计日志]
```

## 验证失败自动回滚

```mermaid
flowchart TD
    A[工作流执行完成] --> B{验证节点失败?}
    B -->|否| C[正常完成]
    B -->|是| D{存在回滚节点?}
    D -->|否| E[标记失败]
    D -->|是| F[执行回滚节点]
    F --> G[发送回滚通知]
    G --> H[记录审计日志]
```

## WebSocket 事件流

```
Client                    Server
  │                         │
  │──task:subscribe────────▶│
  │                         │
  │◀──task:started──────────│
  │◀──task:node:started─────│
  │◀──task:node:thinking────│
  │◀──task:node:output──────│
  │◀──task:node:completed───│
  │                         │
  │◀──task:approval:requested│
  │                         │  (等待审批)
  │                         │
  │◀──task:approval:resolved│
  │◀──task:completed────────│
  │                         │
```
