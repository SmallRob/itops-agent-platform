# 第13章 Agent系统详解

## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="../../frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策

## 本章导读

Agent 是 ITOps Agent Platform 的核心智能单元。系统内置 9 个预设 Agent，分别覆盖告警处理、故障诊断、日志分析、系统巡检、变更执行、文档生成、合规检查、服务器命令执行和自动巡检等运维场景。本章深入剖析 Agent 的配置存储、执行引擎、LLM 调用链路、执行追踪、多 Agent 协作模式以及 WebSocket 实时进度推送，帮助读者全面掌握 Agent 系统的设计与扩展方法。

## 学习目标

- 理解 9 个预设 Agent 的角色定位与 System Prompt 设计
- 掌握 agentExecutor.ts 的执行调度逻辑
- 熟悉 llmService.ts 中 LLM API 调用、熔断器与重试机制
- 了解 agent_executions 表的执行记录与历史追踪
- 学会创建自定义 Agent
- 理解 MultiAgentOrchestrator 的多 Agent 协作流程
- 掌握 WebSocket 实时推送 Agent 执行进度的方法

## 核心内容

### 13.1 预设 Agent 体系

系统启动时，[initAgents.ts](../../backend/src/models/presets/initAgents.ts) 会检查 `agents` 表中是否存在预设 Agent（`is_preset = 1`），若不存在则批量创建 9 个：

```
┌─────────────────────────────────────────────────────────────────┐
│                    9 个预设 Agent 总览                           │
├──────────┬──────────┬────────────┬──────────────────────────────┤
│ 头像     │ 名称     │ 角色       │ 系统能力                     │
├──────────┼──────────┼────────────┼──────────────────────────────┤
│ 🚨       │ 告警处理 │ 告警分析   │ 告警摘要 + 严重评估 + 处理   │
│ 🔍       │ 故障诊断 │ 故障诊断   │ 症状分析 + 根因 + 排查方案   │
│ 📝       │ 日志分析 │ 日志分析   │ 日志摘要 + 错误模式 + 建议   │
│ 🔎       │ 系统巡检 │ 健康检查   │ 资源使用 + 服务状态 + 优化   │
│ ⚙️       │ 变更执行 │ 变更执行   │ 操作摘要 + 结果 + 回滚方案   │
│ 📄       │ 文档生成 │ 文档生成   │ 执行摘要 + 结果 + 问题 + 建议│
│ 🛡️       │ 合规检查 │ 合规检查   │ 检查范围 + 合规 + 修复建议   │
│ 💻       │ 服务器命令│ 服务器操作 │ SSH 命令执行 + 结果分析      │
│ 🤖       │ 自动巡检 │ 自动巡检   │ 多服务器巡检 + 报告生成      │
└──────────┴──────────┴────────────┴──────────────────────────────┘
```

每个 Agent 在数据库中的记录包含以下字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| id | UUID 主键 | `abc123...` |
| name | Agent 名称 | `告警处理 Agent` |
| avatar | Emoji 头像 | `🚨` |
| role | 角色描述 | `告警分析与处理专家` |
| category | 分类 | `告警处理` |
| description | 功能描述 | `负责分析告警信息...` |
| system_prompt | 系统提示词 | `你是一个专业的...` |
| model | 绑定的 LLM 模型 | `doubao-4o` |
| temperature | 温度参数 | `0.7` |
| is_preset | 是否预设 | `1` |
| enabled | 是否启用 | `1` |

**System Prompt 设计原则：**

```typescript
// 告警处理 Agent 的 System Prompt
'你是一个专业的告警处理专家。你的任务是分析告警信息，评估严重程度，并提供具体的处理建议。' +
'你的回答应该包括：' +
'1. 告警摘要 ' +
'2. 严重程度评估 ' +
'3. 可能的原因 ' +
'4. 处理建议 ' +
'5. 后续步骤。' +
'请用中文回答，使用清晰的结构。'
```

每条 Prompt 都明确了角色定位、任务目标和输出结构，确保 LLM 的回复具有高度一致性和可操作性。

### 13.2 Agent 执行引擎 agentExecutor.ts

[agentExecutor.ts](../../backend/src/services/agentExecutor.ts) 是 Agent 的调度中枢。核心函数 `executeAgentNode` 的工作流程如下：

```
executeAgentNode(agentId, input, context)
         │
         ├─ 从 agents 表查询 Agent 配置
         │
         ├─ 判断 Agent 名称
         │   │
         │   ├─ 包含"服务器命令执行"
         │   │   └─ executeServerCommandAgent()
         │   │       └─ SSH 执行命令 → 格式化报告
         │   │
         │   ├─ 包含"系统巡检" 或 "自动巡检"
         │   │   └─ executeAutoInspectionAgent()
         │   │       └─ SSH 执行合规检查 → 汇总结果
         │   │
         │   └─ 其他 Agent
         │       └─ executeAgentWithLLM()
         │           └─ 调用 LLM API
         │
         └─ 返回执行结果
```

```typescript
import db from '../models/database';
import { executeAgentWithLLM } from './llmService';
import { executeCommand, runComplianceCheck } from './sshService';

export async function executeAgentNode(
  agentId: string,
  input: string,
  context?: Record<string, unknown>
): Promise<string> {
  // 1. 从数据库获取 Agent 配置
  const agent = db.prepare(
    'SELECT id, name, system_prompt FROM agents WHERE id = ?'
  ).get(agentId) as Agent | undefined;

  const agentName = agent?.name || 'Agent';

  // 2. 判断 Agent 类型，路由到不同执行路径
  if (agentName.includes('服务器命令执行')) {
    return await executeServerCommandAgent(input, context);
  }

  if (agentName.includes('系统巡检') || agentName.includes('自动巡检')) {
    return await executeAutoInspectionAgent(input, context);
  }

  // 3. 通用 Agent：调用 LLM
  return await executeAgentWithLLM(agentId, input);
}
```

**服务器命令执行 Agent** 支持多台服务器并行操作：

```typescript
async function executeServerCommandAgent(
  input: string, context?: Record<string, unknown>
): Promise<string> {
  // 从 context 中提取目标服务器和命令
  let serverIds = context?.serverIds as string[] | undefined;
  let command = context?.command as string | undefined;

  // 根据关键词自动选择命令
  if (!command) {
    command = 'uname -a && uptime && free -h && df -h';
    if (input.toLowerCase().includes('cpu')) {
      command = 'top -bn1 | head -20';
    } else if (input.toLowerCase().includes('内存')) {
      command = 'free -h && cat /proc/meminfo | head -20';
    }
    // ... 更多命令匹配
  }

  // 逐台服务器执行并汇总
  for (const serverId of serverIds) {
    const result = await executeCommand(serverId, command);
    // 组装 Markdown 报告...
  }

  return report;
}
```

**自动巡检 Agent** 执行预定义的合规检查清单：

```typescript
async function executeAutoInspectionAgent(
  input: string, context?: Record<string, unknown>
): Promise<string> {
  // 对目标服务器执行合规检查
  for (const serverId of serverIds) {
    const results = await runComplianceCheck(serverId);
    // results 包含 CPU、内存、磁盘、网络等 13 项检查结果
    // 汇总为 Markdown 巡检报告...
  }
  return report;
}
```

### 13.3 LLM 调用链路 llmService.ts

[llmService.ts](../../backend/src/services/llmService.ts) 是 Agent 与 LLM 之间的桥梁。该文件实现了三大核心能力：

**（1）多提供商支持**

```typescript
// 支持三种 LLM 提供商
const DOUBAO_CONFIG = {
  providerName: 'Doubao',
  defaultApiBase: 'https://ark.cn-beijing.volces.com/api/v3',
  defaultModel: 'doubao-4o',
  // ...
};

const OPENAI_CONFIG = {
  providerName: 'OpenAI',
  defaultApiBase: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4o',
  // ...
};

const LOCAL_AI_CONFIG = {
  providerName: 'LocalAI',
  defaultApiBase: 'http://host.docker.internal:11434/v1',
  defaultModel: 'qwen2.5:7b',
  // ...
};
```

通过 `getProviderForModel()` 函数，根据模型名称自动识别提供商：

```typescript
function getProviderForModel(modelId: string): 'local' | 'doubao' | 'openai' {
  // 本地模型关键词
  const localKeywords = ['qwen', 'llama', 'mistral', 'deepseek', ...];
  for (const keyword of localKeywords) {
    if (modelId.toLowerCase().includes(keyword)) return 'local';
  }
  // 豆包、OpenAI 同理...
  return 'local';
}
```

**（2）熔断器 Circuit Breaker**

熔断器按提供商拆分实例，防止某个 API 故障影响其他提供商：

```
┌─────────────────────────────────────┐
│         Circuit Breaker 状态机       │
│                                     │
│   CLOSED ──(5次失败)──► OPEN        │
│     ▲                    │          │
│     │              (60秒后)          │
│     │                    ▼          │
│     │              HALF-OPEN        │
│     │                    │          │
│     │         ┌──成功───►├──成功    │
│     │         │          │          │
│     └─────────┘     失败时回 OPEN   │
└─────────────────────────────────────┘
```

```typescript
class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    halfOpenAttempts: 0,
    maxHalfOpenAttempts: 3
  };

  canCall(): boolean {
    if (this.state.isOpen) {
      // 超过重置时间后进入半开状态
      if (Date.now() - this.state.lastFailureTime > this.resetTimeout) {
        if (this.state.halfOpenAttempts >= this.state.maxHalfOpenAttempts) {
          return false;
        }
        this.state.halfOpenAttempts++;
        return true; // 允许一次测试请求
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
    this.state.halfOpenAttempts = 0;
  }

  recordFailure(): void {
    this.state.failures++;
    if (this.state.failures >= this.maxFailures) {
      this.state.isOpen = true;
    }
  }
}
```

**（3）指数退避重试**

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 10000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < maxRetries) {
        // 指数退避 + 随机抖动
        const delayMs = Math.min(
          baseDelay * Math.pow(2, attempt - 1), maxDelay
        );
        await delay(delayMs + Math.random() * baseDelay);
      }
    }
  }
  throw lastError;
}
```

**（4）Agent 执行入口 executeAgentWithLLM**

```typescript
export async function executeAgentWithLLM(
  agentId: string,
  userInput: string
): Promise<string> {
  // 1. 查询 Agent 配置
  const agent = db.prepare(
    'SELECT id, name, system_prompt, temperature, model FROM agents WHERE id = ?'
  ).get(agentId);

  // 2. 更新使用统计
  updateAgentStats(agentId);

  // 3. 优先使用 QAnything 检索知识库
  let knowledgeContext = '';
  if (qanythingService.isEnabled()) {
    knowledgeContext = await qanythingService.queryKnowledge(
      userInput, qanythingService.getTopK()
    );
  }

  // 4. 构建增强 Prompt
  let enhancedPrompt = agent.system_prompt;
  if (knowledgeContext) {
    enhancedPrompt += `\n\n【相关知识库内容】\n${knowledgeContext}\n\n`;
  }
  enhancedPrompt += `\n【用户问题】\n${userInput}`;

  // 5. 根据模型选择提供商并调用
  const provider = getProviderForModel(agent.model);
  if (provider === 'openai') {
    return await callOpenAIAPI(enhancedPrompt, enhancedPrompt, agent.name, temperature);
  } else if (provider === 'local') {
    return await callLocalAIAPI(enhancedPrompt, enhancedPrompt, agent.name, temperature);
  } else {
    return await callDoubaoAPI(enhancedPrompt, enhancedPrompt, agent.name, temperature);
  }
}
```

### 13.4 Agent 执行追踪与历史

每次 Agent 调用后，系统会在 `agent_executions` 表中记录执行历史：

```sql
CREATE TABLE agent_executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  agent_name TEXT,
  input_text TEXT,
  output_text TEXT,
  status TEXT CHECK(status IN ('success', 'failure')),
  error_message TEXT,
  execution_time_ms INTEGER,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```typescript
function recordAgentExecution(
  agentId: string, agentName: string,
  inputText: string, outputText: string,
  status: 'success' | 'failure',
  errorMessage?: string, executionTimeMs?: number,
  metadata?: Record<string, unknown>
): void {
  db.prepare(`
    INSERT INTO agent_executions (
      id, agent_id, agent_name, input_text, output_text,
      status, error_message, execution_time_ms, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(), agentId, agentName,
    inputText, outputText, status,
    errorMessage || null, executionTimeMs || null,
    metadata ? JSON.stringify(metadata) : null
  );
}
```

同时更新 Agent 的使用统计：

```typescript
function updateAgentStats(agentId: string): void {
  db.prepare(`
    UPDATE agents
    SET usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(agentId);
}
```

`agents` 表的统计字段：

| 字段 | 说明 |
|------|------|
| usage_count | 累计使用次数 |
| last_used_at | 最后使用时间 |

### 13.5 创建自定义 Agent

创建自定义 Agent 通过 REST API 完成：

```typescript
// agentRoutes.ts
router.post('/', (req: Request, res: Response) => {
  const { name, role, system_prompt, model, temperature, category, description } = req.body;

  const id = randomUUID();
  db.prepare(`
    INSERT INTO agents (id, name, avatar, role, system_prompt, model, temperature, enabled, is_preset, category, tags, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, '🔧', role, system_prompt, model || null,
    temperature || 0.7, 1, 0, category,
    JSON.stringify(tags || []), description
  );

  res.status(201).json({ success: true, data: { id, name } });
});
```

**创建步骤：**

1. 确定 Agent 的角色和职责
2. 编写结构化的 System Prompt（明确角色、任务、输出格式）
3. 选择合适的 LLM 模型和 temperature 值
4. 通过 API 创建 Agent
5. 在工作流中使用该 Agent

**自定义 Agent 示例 —— SQL 审计 Agent：**

```json
{
  "name": "SQL 审计 Agent",
  "role": "数据库审计专家",
  "category": "数据库运维",
  "description": "分析 SQL 慢查询日志，提供优化建议",
  "system_prompt": "你是一个专业的数据库审计专家。你的任务是分析 SQL 慢查询日志，识别性能瓶颈，并提供优化建议。回答应包含：1. 查询分析 2. 性能瓶颈 3. 索引建议 4. SQL 改写方案。请用中文回答。",
  "model": "doubao-4o",
  "temperature": 0.5
}
```

### 13.6 多 Agent 协作模式

[multiAgentCollaboration.ts](../../backend/src/services/multiAgentCollaboration.ts) 实现了多 Agent 协作解决复杂问题的框架。

**协作架构：**

```
┌─────────────────────────────────────────────────────────┐
│              MultiAgentOrchestrator                      │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ 智能路由    │→ │ Agent对话   │→ │ 结果总结      │  │
│  │ (LLM+规则)  │  │ (多轮委托)  │  │ (LLM生成)     │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────┐
│              Agent消息总线 (MessageBus)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Agent1      │  │ Agent2      │  │ Agent3        │  │
│  │ 消息队列    │  │ 消息队列    │  │ 消息队列      │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**智能路由：** 优先使用 LLM 决策，失败时降级为规则匹配：

```typescript
async routeToBestAgent(userQuery: string, availableAgents: AgentDB[]): Promise<string> {
  // 1. LLM 路由
  const routingPrompt = `你是一个智能任务分发器...
可用的Agent列表:
${agentDescriptions}
用户请求: ${userQuery}
请选择最适合处理此请求的Agent，只返回Agent的ID`;

  const result = await callDoubaoAPI(routingPrompt, 'Agent Router...', 'Agent Router', 0.3);

  const matchedAgent = availableAgents.find(agent =>
    result.includes(agent.id) || result.includes(agent.name)
  );
  if (matchedAgent) return matchedAgent.id;

  // 2. LLM 失败时，降级为规则路由
  return this.ruleBasedRouting(userQuery, availableAgents);
}

// 规则路由降级方案
private ruleBasedRouting(userQuery: string, availableAgents: AgentDB[]): string {
  const ruleMappings = [
    { keywords: ['告警', 'alert'], agentRole: '告警' },
    { keywords: ['诊断', '排查', '根因'], agentRole: '诊断' },
    { keywords: ['日志', 'log'], agentRole: '日志' },
    { keywords: ['巡检', '检查'], agentRole: '巡检' },
    // ...
  ];

  for (const rule of ruleMappings) {
    if (rule.keywords.some(k => userQuery.includes(k))) {
      return findAgentByRole(availableAgents, rule.agentRole);
    }
  }
  return availableAgents[0].id;
}
```

**协作流程：**

```typescript
async collaborate(
  initialQuery: string,
  agentIds: string[],
  options: { enableRAG?: boolean; maxRounds?: number } = {}
): Promise<CollaborationMessage[]> {
  // 1. RAG 知识检索（可选）
  if (enableRAG) {
    const knowledge = await this.retrieveRelevantKnowledge(initialQuery);
    // 注入到对话历史
  }

  // 2. 智能选择主 Agent
  const primaryAgentId = await this.routeToBestAgent(initialQuery, agents);

  // 3. 多轮协作对话
  while (currentRound < this.maxRounds) {
    const result = await this.processAgentTurn(agents);

    if (result.type === 'final') {
      break; // 任务完成
    } else if (result.type === 'delegate') {
      // 委托给其他 Agent
      if (this.detectDelegationCycle(delegateToAgent)) {
        break; // 防止无限循环
      }
      this.context.currentAgentId = delegateToAgent;
    }
  }

  // 4. 生成最终总结
  await this.generateFinalSummary();

  return this.context.conversationHistory;
}
```

**委托循环检测：** 防止 Agent 之间互相委托导致无限循环：

```typescript
private detectDelegationCycle(targetAgentId: string): boolean {
  if (this.context.delegationChain.includes(targetAgentId)) {
    return true; // 检测到循环
  }
  this.context.delegationChain.push(targetAgentId);
  return false;
}
```

**Agent 消息总线：** 支持 Agent 之间的异步消息传递，自带 TTL 过期清理：

```typescript
class AgentMessageBus {
  private messageTTL = 30 * 60 * 1000; // 30 分钟

  sendMessage(fromAgent: string, toAgent: string, content: string) {
    const key = `${fromAgent}:${toAgent}`;
    this.messages.get(key)!.push({
      role: 'assistant', name: fromAgent,
      content, timestamp: Date.now()
    });
  }

  private cleanup() {
    const cutoff = Date.now() - this.messageTTL;
    for (const [key, msgs] of this.messages.entries()) {
      const validMessages = msgs.filter(msg => msg.timestamp > cutoff);
      if (validMessages.length === 0) {
        this.messages.delete(key);
      } else {
        this.messages.set(key, validMessages);
      }
    }
  }
}
```

### 13.7 WebSocket 实时执行进度

Agent 执行过程中的进度通过 WebSocket 实时推送到前端。以工作流中 Agent 节点执行为例：

```
前端 (task:node:thinking)        后端 workflowExecutor
      │                              │
      │◄──── task:node:thinking ─────│  "正在解析告警内容..."
      │◄──── task:node:thinking ─────│  "识别到告警关键信息..."
      │◄──── task:node:thinking ─────│  "评估告警严重程度..."
      │◄──── task:node:thinking ─────│  "准备告警摘要..."
      │                              │
      │◄──── task:node:output ──────│  Agent 输出结果
      │                              │
      │◄──── task:node:completed ───│  节点完成
```

```typescript
// workflowExecutor.ts
// 显示思考进度
const thinkingProcess = getThinkingSteps(node.data.label);
for (const step of thinkingProcess) {
  await delay(300); // 每步间隔 300ms
  io?.to(`task:${taskId}`).emit('task:node:thinking', {
    taskId, nodeId, content: step
  });
  addTaskLog(taskId, { type: 'thinking', content: step, nodeId });
}

// Agent 执行完成
io?.to(`task:${taskId}`).emit('task:node:output', {
  taskId, nodeId, output
});

io?.to(`task:${taskId}`).emit('task:node:completed', {
  taskId, nodeId, status: 'success', output
});
```

每个 Agent 都定义了专属的思考步骤：

```typescript
export function getThinkingSteps(agentName: string): string[] {
  const steps = {
    '告警处理': [
      '正在解析告警内容...',
      '识别到告警关键信息：主机名、告警类型、告警值',
      '评估告警严重程度和紧急程度',
      '准备告警摘要供后续处理使用'
    ],
    '故障诊断': [
      '分析告警模式和历史数据...',
      '检查相关系统日志和应用日志',
      '识别可能的故障原因',
      '生成排查步骤清单'
    ],
    // 其他 Agent 同理...
  };
  return steps[agentName] || ['正在分析...', '正在处理...', '完成'];
}
```

## 本章小结

本章系统讲解了 ITOps Agent Platform 的 Agent 体系。9 个预设 Agent 覆盖了运维的核心场景，每个 Agent 都有精心设计的 System Prompt。agentExecutor.ts 作为执行中枢，根据 Agent 名称路由到不同的执行路径：服务器命令执行和自动巡检 Agent 直接操作远程服务器，其他 Agent 则通过 llmService.ts 调用 LLM。llmService.ts 实现了多提供商支持、熔断器和指数退避重试，确保 LLM 调用的稳定性。multiAgentCollaboration.ts 提供了多 Agent 协作框架，通过智能路由和多轮委托解决复杂问题。WebSocket 实时推送机制让用户能够看到 Agent 的思考过程。

## 本章练习

### 基础练习

1. **列出 9 个预设 Agent**：写出所有预设 Agent 的名称、角色和分类。

2. **执行流程追踪**：描述当用户通过 API 执行「告警处理 Agent」时，代码的完整执行路径。

3. **熔断器状态分析**：假设 Doubao API 连续调用失败 6 次，描述 Circuit Breaker 的状态变化过程。

### 进阶练习

4. **创建自定义 Agent**：编写一个「日志分析 Agent」的 System Prompt，要求输出结构化 JSON 格式的日志分析结果。

5. **多 Agent 协作调试**：模拟一个场景——用户提出"服务器 CPU 异常告警需要诊断"，描述 MultiAgentOrchestrator 如何选择 Agent 并完成任务。

6. **执行历史分析**：编写一个 SQL 查询，统计最近 24 小时内每个 Agent 的执行次数、成功率和平均响应时间。

### 思考题

7. **熔断器 vs 重试机制**：Circuit Breaker 和 Retry 都在处理 LLM 调用失败，它们的设计目的和应用场景有何不同？何时应该增大熔断阈值？何时应该增加重试次数？

8. **多 Agent 协作 vs 工作流**：MultiAgentOrchestrator 的协作模式和 Workflow 的节点编排模式，分别适合什么场景？如果需要在协作中引入人工审批环节，应该如何设计？

## 延伸阅读

- [llmService.ts](../../backend/src/services/llmService.ts) — 完整的 LLM 服务实现
- [multiAgentCollaboration.ts](../../backend/src/services/multiAgentCollaboration.ts) — 多 Agent 协作框架
- [agentExecutor.ts](../../backend/src/services/agentExecutor.ts) — Agent 执行引擎
- [initAgents.ts](../../backend/src/models/presets/initAgents.ts) — 预设 Agent 初始化
