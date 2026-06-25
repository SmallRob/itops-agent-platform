# Agent 域 - 业务流程

> **层级**：L3 详细内容
> **大小**：< 5KB

## Agent 执行流程

```mermaid
sequenceDiagram
    participant Client
    participant API as agentRoutes
    participant Executor as agentExecutor
    participant LLM as llmService
    participant SSH as sshService
    participant DB as database

    Client->>API: POST /api/agents/:id/test
    API->>DB: 查询 Agent 信息
    DB-->>API: Agent 配置
    
    alt 服务器/巡检 Agent
        API->>Executor: executeAgentNode()
        Executor->>SSH: executeCommand()
        SSH-->>Executor: 命令执行结果
        Executor-->>API: 执行报告
    else 数据库运维 Agent
        API->>Executor: executeAgentNode()
        Executor->>Executor: executeDatabaseAdminAgent()
        Executor->>LLM: executeAgentWithLLM()
        LLM-->>Executor: LLM 分析结果
        Executor-->>API: 分析报告
    else 其他 Agent
        API->>LLM: executeAgentWithLLM()
        LLM->>DB: 查询模型配置
        LLM->>LLM: 调用 LLM API
        LLM-->>API: LLM 响应
    end
    
    API->>DB: 记录执行历史
    API-->>Client: 执行结果
```

## LLM 调用流程

```mermaid
flowchart TD
    A[executeAgentWithLLM] --> B{检查主模型}
    B -->|可用| C[调用主模型]
    C -->|成功| D[返回结果]
    C -->|失败| E{检查备选模型}
    B -->|不可用| E
    E -->|可用| F[调用备选模型]
    F -->|成功| D
    F -->|失败| G[降级到默认模型]
    E -->|不可用| G
    G -->|成功| D
    G -->|失败| H[返回错误]
```

## 熔断器状态机

```mermaid
stateDiagram-v2
    [*] --> Closed: 初始化
    Closed --> Open: 连续失败 >= 5次
    Open --> HalfOpen: 超时 60s 后
    HalfOpen --> Closed: 测试请求成功
    HalfOpen --> Open: 测试请求失败
    HalfOpen --> Open: 半开尝试 >= 3次
    Closed --> Closed: 请求成功/失败(未达阈值)
```

## 关键决策点

### 1. Agent 类型判断

根据 Agent 名称关键词判断执行路径：

| 关键词 | 执行路径 |
|--------|----------|
| 服务器/命令 | `executeServerCommandAgent` |
| 巡检/自动 | `executeAutoInspectionAgent` |
| 数据库 | `executeDatabaseAdminAgent` |
| 其他 | `executeAgentWithLLM` (LLM 调用) |

### 2. 模型选择策略

1. 优先使用 Agent 配置的 `primary_model_id`
2. 主模型失败则尝试 `fallback_model_id`
3. 最后降级到 AI 模型池的默认模型
4. 向后兼容：使用旧的 `api_provider` 配置

### 3. 超时处理

- Agent 执行超时：5 分钟 (`AGENT_EXECUTION_TIMEOUT`)
- LLM API 调用超时：60 秒
- 重试策略：最多 3 次，指数退避

---

*生成时间：2026-06-21*
