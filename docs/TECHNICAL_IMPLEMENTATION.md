# ITOps Agent Platform - 技术实现详解

## 目录

- [LLM 集成优化](#llm-集成优化)
- [多Agent协作框架](#多agent协作框架)
- [增强RAG知识库](#增强rag知识库)
- [新增API端点](#新增api端点)

---

## LLM 集成优化

### 问题分析

原有LLM集成存在以下问题：
1. 简单API调用，缺乏错误处理和降级方案
2. 没有重试机制和熔断保护
3. 预设Agent的System Prompt过于简单
4. 缺少调用历史和统计功能

### 解决方案

#### 1. 增强的LLM服务 (llmService.ts)

**核心功能：**

```typescript
// 熔断器 - 防止API故障导致雪崩
class CircuitBreaker {
  failures: number = 0;
  isOpen: boolean = false;
  
  canCall(): boolean;  // 检查是否允许调用
  recordSuccess(): void;  // 记录成功
  recordFailure(): void;  // 记录失败
}

// 带重试的API调用
callWithRetry(fn, maxRetries = 3, baseDelay = 1000);

// Agent执行历史记录
recordAgentExecution(agentId, input, output, status, error);
```

**降级响应机制：**
当LLM不可用时，提供智能的模板化响应，支持：
- 告警处理Agent提供标准化处理流程
- 故障诊断Agent提供检查清单
- 系统巡检Agent提供检查项目
- 所有响应都包含时间戳和下一步建议

#### 2. 优化的预设Agent Prompt

所有预设Agent的System Prompt都进行了深度优化，包含：

| Agent | 优化内容 |
|------|---------|
| 告警处理 | 10年+专家人设、业务影响分析框架、标准化输出格式 |
| 故障诊断 | 5层诊断模型、可执行的排查步骤、优先级评估 |
| 日志分析 | 时间线分析、模式匹配、多维度关联 |
| 系统巡检 | 4层检查模型、历史对比、趋势分析 |
| 变更执行 | 安全原则、执行前中后验证、回滚方案 |
| 文档生成 | 专业报告结构、数据可视化建议、行动项提炼 |
| 合规检查 | 等保2.0参考、行业标准对照、整改优先级 |

---

## 多Agent协作框架

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                   协作编排层                              │
│              MultiAgentOrchestrator                      │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ 智能路由    │→ │ Agent对话   │→ │ 结果总结      │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│              Agent消息总线 (MessageBus)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Agent1      │  │ Agent2      │  │ Agent3        │  │
│  └─────────────┘  └─────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│              RAG知识注入层                                │
└─────────────────────────────────────────────────────────┘
```

### 核心功能

#### 1. 智能路由

```typescript
routeToBestAgent(query, availableAgents): Promise<agentId>
```

基于Agent的专业领域和任务内容，智能选择最适合的主导Agent。

#### 2. 协作对话

```typescript
collaborate(query, agentIds, options): Promise<ConversationHistory>
```

多Agent之间可以：
- 自动传递上下文
- 互相咨询专业问题
- 委托其他Agent执行特定任务
- 协作完成后生成总结报告

#### 3. 协作流程

1. **初始化阶段** - 检索相关知识注入上下文
2. **路由阶段** - 智能选择主导Agent
3. **协作阶段** - Agent之间交流、咨询、委托
4. **总结阶段** - 生成协作总结报告
5. **归档阶段** - 可选保存到知识库

### 预设协作模板

| 模板ID | 名称 | 适用场景 |
|--------|------|---------|
| troubleshooting | 故障诊断协作 | 复杂系统故障定位 |
| system_check | 系统健康检查 | 定期巡检和审计 |
| incident_response | 事件响应流程 | IT事件标准化处理 |
| knowledge_enhanced | 知识增强分析 | 结合历史案例分析 |

---

## 增强RAG知识库

### 智能检索算法

```typescript
calculateRelevanceScore(query, item): number
```

**评分维度：**

| 维度 | 权重 | 说明 |
|------|------|------|
| 精确匹配 | 50% | 完整查询出现在内容中 |
| 关键词匹配 | 30% | 提取关键词进行匹配 |
| 使用频率 | 15% | 高频使用的知识更重要 |
| 时间衰减 | 5% | 一年内的内容有加权 |

### 知识注入

```typescript
injectKnowledge(query, options): Promise<{ hasKnowledge, prompt }>
```

自动将相关知识格式化为LLM友好的提示词，包含：
- 相关度百分比显示
- 内容高亮片段
- 使用计数自动更新
- 专业的格式编排

### 批量导入和自动标签

支持批量知识导入，自动从内容中提取关键词作为标签。

---

## 新增API端点

### 多Agent协作 API (`/api/multi-agent`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/collaborate` | 启动多Agent协作 |
| POST | `/collaborate/from-template` | 从模板快速启动协作 |
| GET | `/templates` | 获取所有协作模板 |
| GET | `/history` | 获取协作历史记录 |

### 增强知识管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/knowledge/search` | 智能搜索知识库 |
| POST | `/knowledge/inject` | 获取知识注入提示词 |
| POST | `/knowledge` | 添加新知识 |
| POST | `/knowledge/batch` | 批量导入知识 |
| GET | `/knowledge/:id/similar` | 获取相似知识 |
| GET | `/knowledge/statistics` | 获取知识库统计 |

### API使用示例

#### 启动多Agent协作

```bash
curl -X POST http://localhost:3001/api/multi-agent/collaborate \
  -H "Content-Type: application/json" \
  -d '{
    "query": "生产服务器CPU使用率突然飙升，请分析原因",
    "agentIds": ["uuid1", "uuid2", "uuid3"],
    "options": {
      "enableRAG": true,
      "maxRounds": 5,
      "saveToKnowledge": true
    }
  }'
```

#### 智能知识库搜索

```bash
curl -X GET "http://localhost:3001/api/multi-agent/knowledge/search?q=CPU高&limit=5"
```

---

## 数据库新增功能

### Agent执行记录表

```sql
CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  agent_name TEXT,
  input_text TEXT,
  output_text TEXT,
  status TEXT,  -- success, failure, degraded, mock
  error_message TEXT,
  execution_time_ms INTEGER,
  metadata TEXT,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 知识库增强字段

```sql
-- 已存在表结构增强
ALTER TABLE knowledge_base 
ADD COLUMN usage_count INTEGER DEFAULT 0;

ALTER TABLE knowledge_base
ADD COLUMN tags TEXT;  -- JSON
```

---

## 技术亮点

1. **企业级可靠性** - 熔断器、重试机制、降级方案
2. **智能协作** - Agent之间自主协商和委托
3. **高质量Prompt** - 深度优化的专家级提示词
4. **智能检索** - 多维度相关度评分
5. **可观测性** - 完整的调用历史和统计
6. **模块化设计** - 清晰的服务分层，易于扩展

---

## 下一步优化建议

1. **向量数据库集成** - 替换当前的关键词匹配
2. **Agent记忆模块** - 实现长期和短期记忆
3. **工具调用框架** - 让Agent能够直接执行SSH等操作
4. **协作可视化** - 在前端展示Agent对话过程
5. **工作流与协作融合** - 可视化工作流 + 智能协作
