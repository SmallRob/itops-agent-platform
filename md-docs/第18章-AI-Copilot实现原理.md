# 第18章 AI Copilot实现原理

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

AI Copilot 是 ITOps Agent Platform 的智能助手入口。与专用的 Agent（如故障诊断 Agent、巡检 Agent）不同，Copilot 是一个通用型助手，采用自然语言交互方式，能够理解用户的意图并自动从系统中获取相关数据，提供运维咨询、状态查询、操作建议等服务。

Copilot 的核心设计理念是：

- **对话式交互**：用户无需学习复杂命令或导航多个页面，用自然语言提问即可
- **上下文感知**：自动识别用户意图，从告警、服务器、任务等模块注入实时数据
- **双引擎响应**：LLM 可用时使用智能生成，不可用时降级为基于规则的精准回答
- **多会话管理**：支持用户创建多个对话，每条对话独立维护上下文历史
- **全局悬浮入口**：作为 Widget 嵌入所有页面，随时可用

本章将从前端 ChatWidget 组件到后端 CopilotService，完整剖析 Copilot 的实现原理。

## 学习目标

- 理解 Copilot 的系统架构与响应引擎（LLM + 规则降级）
- 掌握对话状态管理（创建、查询、删除、过期清理）
- 理解上下文自动注入机制（意图识别→数据查询→上下文构建）
- 掌握前端 ChatWidget 的组件设计与交互流程
- 理解基于规则的智能回答系统（告警/服务器/任务/巡检/帮助）
- 学会设计 Copilot 的安全边界与能力范围控制
- 掌握多会话管理的内存+数据库双重持久化方案

## 18.1 Copilot 整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          前端 (React)                                 │
│                                                                      │
│  ┌─────────────┐    ┌────────────────────┐    ┌──────────────────┐   │
│  │ Floating    │    │  ChatWidget        │    │  MarkdownOutput  │   │
│  │ Bot Button  │◄──►│  • 对话列表         │◄──►│  • Markdown渲染   │   │
│  │ (全局入口)   │    │  • 消息气泡         │    │  • 代码高亮      │   │
│  └─────────────┘    │  • 快捷建议         │    └──────────────────┘   │
│                     │  • 发送/加载状态    │                           │
│                     └────────┬───────────┘                             │
└──────────────────────────────┼────────────────────────────────────────┘
                               │ HTTP REST API
                               │ POST /api/copilot/chat
                               │ GET  /api/copilot/conversations
                               │ POST /api/copilot/conversations
                               │ DELETE /api/copilot/conversations/:id
                               │ GET  /api/copilot/suggestions
┌──────────────────────────────┼────────────────────────────────────────┐
│                          后端 (Node.js)             │                  │
│  ┌─────────────────┐  ┌──────▼──────┐  ┌────────────────────┐         │
│  │ copilotRoutes.ts│  │copilotService│  │  llmService.ts     │         │
│  │ API路由分发      │◄►│              │◄►│  callDoubaoAPI     │         │
│  │ 请求验证        │  │              │  │  checkLLMAvailability│        │
│  └─────────────────┘  └──────┬───────┘  └────────────────────┘         │
│                              │                                         │
│  ┌───────────────────────────┼───────────────────────────────┐         │
│  │    Context Builder       │  上下文构建引擎                  │         │
│  │  ┌──────────┐ ┌──────────┐┌──────────┐ ┌──────────┐       │         │
│  │  │告警数据   │ │服务器数据 │ │任务数据   │ │巡检建议   │       │         │
│  │  │alerts表  │ │servers表 │ │tasks表   │ │硬编码     │       │         │
│  │  └──────────┘ └──────────┘└──────────┘ └──────────┘       │         │
│  └───────────────────────────┼───────────────────────────────┘         │
│                              │                                         │
│  ┌───────────────────────────┼───────────────────────────────┐         │
│  │    Response Engine        │  响应引擎                      │         │
│  │  ┌──────────────┐ ┌──────────────────┐                    │         │
│  │  │ LLM 生成路径   │ │ Rule-based 路径  │                    │         │
│  │  │ Doubao API   │ │ 告警/服务器/任务  │                    │         │
│  │  │ +上下文注入   │ │ 巡检/帮助/通用   │                    │         │
│  │  └──────────────┘ └──────────────────┘                    │         │
│  └───────────────────────────────────────────────────────────┘         │
│                              │                                         │
│  ┌───────────────────────────▼───────────────────────────────┐         │
│  │            SQLite: copilot_conversations 表                │         │
│  │  (id, user_id, messages[JSON], created_at, updated_at)     │         │
│  └───────────────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────────────┘
```

## 18.2 系统 Prompt 设计

Copilot 的 System Prompt 定义了其角色定位、能力边界和回答风格：

```typescript
const COPILOT_SYSTEM_PROMPT = `你是一个专业的 IT 运维助手（ITOps Copilot），帮助运维人员监控系统、处理告警、执行任务。

你的能力范围：
1. **告警管理**：查看告警状态、告警统计、告警处理建议
2. **服务器管理**：服务器状态查询、健康检查、服务器信息
3. **任务管理**：任务执行状态、任务进度、任务历史
4. **系统巡检**：巡检建议、巡检模板使用指导
5. **报告生成**：运维报告生成、报告模板使用
6. **工作流编排**：自动化任务编排、定时任务设置

回答要求：
- 使用中文回答
- 回答要简洁明了，重点突出
- 使用 Markdown 格式组织内容
- 如果用户的问题超出你的能力范围，引导用户前往相应页面操作
- 在回答中可以适当提供相关的运维建议`;
```

System Prompt 的关键设计原则：

| 设计要素 | 实现方式 | 作用 |
|----------|----------|------|
| 角色定义 | "IT运维助手" | 明确身份定位 |
| 能力列举 | 6大能力范围 | 限定回答边界 |
| 格式要求 | "Markdown格式" | 确保输出结构清晰 |
| 越界处理 | "引导用户前往相应页面" | 避免幻觉回答 |
| 语言要求 | "中文回答" | 统一语言风格 |

## 18.3 对话状态管理

### 18.3.1 数据结构

```typescript
interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  user_id: string;
  messages: CopilotMessage[];
  created_at: Date;
  updated_at: Date;
}
```

### 18.3.2 双重存储（内存 + SQLite）

Copilot 使用 Map 缓存活跃对话，同时持久化到 SQLite：

```
┌─────────────────────────────────────────┐
│         Map<string, Conversation>       │  ← 内存（快速读写）
│                                         │
│  "uuid-1" ─► { id, user_id, messages[] }│
│  "uuid-2" ─► { id, user_id, messages[] }│
│  ...                                    │
└────────────────────┬────────────────────┘
                     │ 每次修改同步
                     ▼
┌─────────────────────────────────────────┐
│  copilot_conversations (SQLite)          │  ← 磁盘（持久化）
│                                         │
│  id       │ user_id │ messages │ ...    │
│  uuid-1   │ admin   │ [...]    │        │
│  uuid-2   │ user1   │ [...]    │        │
└─────────────────────────────────────────┘
```

```typescript
// 启动时从数据库加载
private loadConversations() {
  const saved = db.prepare('SELECT * FROM copilot_conversations').all();
  saved.forEach(c => {
    this.conversations.set(c.id, {
      id: c.id,
      user_id: c.user_id,
      messages: JSON.parse(c.messages || '[]'),
      created_at: new Date(c.created_at),
      updated_at: new Date(c.updated_at)
    });
  });
}

// 每次对话更新后持久化
private saveConversation(conversation: Conversation) {
  db.prepare(`
    INSERT OR REPLACE INTO copilot_conversations 
    (id, user_id, messages, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    conversation.id,
    conversation.user_id,
    JSON.stringify(conversation.messages),
    conversation.created_at.toISOString(),
    conversation.updated_at.toISOString()
  );
}
```

### 18.3.3 资源保护机制

```typescript
private readonly MAX_CONVERSATIONS = 1000;           // 最大对话数
private readonly CONVERSATION_TTL = 7 * 24 * 3600000; // TTL 7天

// 创建新对话前检查数量上限
private enforceConversationLimit() {
  if (this.conversations.size > this.MAX_CONVERSATIONS) {
    // 按更新时间排序，删除最旧的对话
    const entries = Array.from(this.conversations.entries())
      .sort((a, b) => new Date(b[1].updated_at).getTime() - new Date(a[1].updated_at).getTime());
    
    const toRemove = entries.slice(this.MAX_CONVERSATIONS);
    toRemove.forEach(([id]) => {
      this.conversations.delete(id);
      db.prepare('DELETE FROM copilot_conversations WHERE id = ?').run(id);
    });
  }
}

// 定时清理过期对话
private startCleanupTimer() {
  this.cleanupInterval = setInterval(() => {
    this.cleanupExpiredConversations();
  }, 60 * 60 * 1000);  // 每小时检查一次
  this.cleanupInterval.unref();  // 不阻止进程退出
}

private cleanupExpiredConversations() {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [id, conversation] of this.conversations.entries()) {
    const updatedAt = new Date(conversation.updated_at);
    const isExpired = (now.getTime() - updatedAt.getTime()) > this.CONVERSATION_TTL;
    
    if (isExpired) {
      this.conversations.delete(id);
      db.prepare('DELETE FROM copilot_conversations WHERE id = ?').run(id);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} expired copilot conversations`);
  }
}
```

## 18.4 核心对话流程

### 18.4.1 自然语言处理入口

```typescript
async processNaturalLanguage(
  conversationId: string,
  userInput: string,
  userId: string = 'default'
): Promise<string> {
  // 1. 获取或创建对话
  let conversation = this.getConversation(conversationId);
  if (!conversation) {
    conversation = this.createConversation(userId);
  }

  // 2. 添加用户消息到历史
  conversation.messages.push({
    role: 'user', content: userInput, timestamp: new Date()
  });

  // 3. 生成 AI 响应
  const response = await this.generateResponse(userInput, conversation.messages);

  // 4. 添加助手响应到历史
  conversation.messages.push({
    role: 'assistant', content: response, timestamp: new Date()
  });
  conversation.updated_at = new Date();
  this.saveConversation(conversation);

  return response;
}
```

### 18.4.2 响应生成（双引擎）

```
┌──────────────────────────────────────┐
│        generateResponse()             │
└──────────────────┬───────────────────┘
                   │
          ┌────────▼────────┐
          │ LLM 是否可用？   │
          │ checkLLMAvailability│
          └───────┬─────────┘
                  │
        ┌─────────┼─────────┐
      可用│                   │不可用
        ▼                   ▼
┌────────────────┐  ┌──────────────────┐
│ LLM 智能生成路径 │  │ Rule-based 路径  │
│                │  │ getRuleBasedResponse│
│ 1. 构建上下文   │  │                  │
│ 2. 拼接Prompt  │  │ 意图识别          │
│ 3. 调用Doubao  │  │ 规则匹配回答      │
│ 4. 截断过长响应 │  │                  │
└────────────────┘  └──────────────────┘
```

```typescript
private async generateResponse(input: string, conversationHistory: CopilotMessage[]): Promise<string> {
  const llmAvailable = await checkLLMAvailability();
  
  if (llmAvailable.available) {
    try {
      // LLM 路径
      const recentMessages = conversationHistory.slice(-10);  // 最近10条历史
      const historyText = recentMessages
        .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n');

      const context = this.buildContextForLLM(input);  // 自动注入相关数据

      const enrichedPrompt = context
        ? `当前系统数据：\n${context}\n用户输入：${input}\n对话历史：\n${historyText}`
        : `用户输入：${input}\n对话历史：\n${historyText}`;

      const llmResponse = await callDoubaoAPI(
        COPILOT_SYSTEM_PROMPT,
        enrichedPrompt,
        'ITOps Copilot',
        0.7
      );
      
      // 截断超长响应
      return llmResponse.length > 4000
        ? llmResponse.substring(0, 4000) + '...\n\n（回复过长，已截断）'
        : llmResponse;
        
    } catch (error) {
      logger.warn('LLM call failed, falling back to rule-based response');
      return this.getRuleBasedResponse(input);
    }
  }

  // LLM 不可用路径
  return this.getRuleBasedResponse(input);
}
```

### 18.4.3 上下文自动注入

根据用户输入中的关键词，自动从数据库查询相关数据注入到上下文：

```typescript
private buildContextForLLM(input: string): string {
  const lowerInput = input.toLowerCase();
  let context = '';

  // 告警相关关键词
  if (lowerInput.includes('告警') || lowerInput.includes('alert')) {
    const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10').all();
    const severityCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    alerts.forEach((a) => {
      severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
    });
    context += `当前告警数据：共 ${alerts.length} 条告警，严重程度分布：${JSON.stringify(severityCounts)}，状态分布：${JSON.stringify(statusCounts)}。\n`;
    if (alerts.length > 0) {
      context += `最近告警：${alerts.slice(0, 5).map((a) => `[${a.severity}] ${a.title}`).join('；')}。\n`;
    }
  }

  // 服务器相关关键词
  if (lowerInput.includes('服务器') || lowerInput.includes('server')) {
    const servers = db.prepare('SELECT * FROM servers LIMIT 20').all();
    const enabledCount = servers.filter((s) => s.enabled).length;
    context += `服务器数据：共 ${servers.length} 台服务器，${enabledCount} 台已启用。\n`;
    if (servers.length > 0) {
      context += `服务器列表：${servers.slice(0, 8).map((s) => `${s.name} (${s.hostname}:${s.port})[${s.enabled ? '已启用' : '已禁用'}]`).join('；')}。\n`;
    }
  }

  // 任务相关关键词
  if (lowerInput.includes('任务') || lowerInput.includes('task')) {
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 15').all();
    const statusCounts: Record<string, number> = {};
    tasks.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
    context += `任务数据：共 ${tasks.length} 条任务记录，状态分布：${JSON.stringify(statusCounts)}。\n`;
    if (tasks.length > 0) {
      context += `最近任务：${tasks.slice(0, 5).map((t) => `${t.name} (${t.status})`).join('；')}。\n`;
    }
  }

  // 巡检相关关键词
  if (lowerInput.includes('巡检') || lowerInput.includes('检查')) {
    context += `系统支持以下巡检：服务器健康检查、磁盘空间检查、服务状态检查、安全合规检查。用户可以使用"工作流"模块创建和执行巡检任务。\n`;
  }

  return context;
}
```

### 18.4.4 关键词→数据源映射表

| 用户输入关键词 | 注入数据源 | 查询SQL | 数据量限制 |
|---------------|-----------|---------|-----------|
| 告警 / alert | alerts 表 | ORDER BY created_at DESC LIMIT 10 | 10条 |
| 服务器 / server | servers 表 | LIMIT 20 | 20条 |
| 任务 / task | tasks 表 | ORDER BY created_at DESC LIMIT 15 | 15条 |
| 巡检 / 检查 | 硬编码建议 | 无 | 固定文本 |

### 18.4.5 增强 Prompt 构建示例

当用户问："当前告警情况如何？"

```
当前系统数据：
当前告警数据：共 10 条告警，严重程度分布：{"critical":3,"high":2,"medium":5}，状态分布：{"new":4,"resolved":6}。
最近告警：[critical] CPU usage exceeds 95%；[critical] Memory usage critical；[high] Disk space low；...

用户输入：当前告警情况如何？
对话历史：
用户: 你好
助手: 您好！我是 ITOps Copilot，请问有什么可以帮您的？
```

## 18.5 基于规则的智能回答系统

当 LLM 不可用时，Copilot 使用基于规则的回答引擎，仍然能够提供有价值的回答。

### 18.5.1 规则路由

```typescript
private getRuleBasedResponse(input: string): string {
  const lowerInput = input.toLowerCase();

  if (lowerInput.includes('告警') || lowerInput.includes('alert')) return this.handleAlertQuery();
  if (lowerInput.includes('服务器') || lowerInput.includes('server')) return this.handleServerQuery();
  if (lowerInput.includes('任务') || lowerInput.includes('task')) return this.handleTaskQuery();
  if (lowerInput.includes('巡检') || lowerInput.includes('检查')) return this.handleCheckQuery();
  if (lowerInput.includes('帮助') || lowerInput.includes('help')) return this.handleHelpQuery();
  return this.handleGeneralQuery(input);
}
```

### 18.5.2 告警查询回答

```typescript
private handleAlertQuery(): string {
  const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 10').all();
  const severityCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  alerts.forEach((a) => {
    severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });

  const criticalCount = severityCounts['critical'] || 0;
  const highCount = severityCounts['high'] || 0;
  const newCount = statusCounts['new'] || 0;

  let response = `📊 **当前告警状态概览**\n\n`;
  response += `当前共有 **${alerts.length}** 条告警记录\n`;
  response += `- 🔴 严重告警: **${criticalCount}** 条\n`;
  response += `- 🟠 高级告警: **${highCount}** 条\n`;
  response += `- 📌 待处理告警: **${newCount}** 条\n\n`;

  if (alerts.length > 0) {
    response += `**最近告警**:\n`;
    alerts.slice(0, 5).forEach((a, i) => {
      const emoji = a.severity === 'critical' ? '🔴' : a.severity === 'high' ? '🟠' : '🟡';
      response += `${i + 1}. ${emoji} [${a.severity?.toUpperCase()}] ${a.title}\n`;
    });
    response += `\n👉 建议：前往"告警中心"查看详细信息并处理待解决告警`;
  }

  return response;
}
```

规则回答示例输出：

```
📊 **当前告警状态概览**

当前共有 **10** 条告警记录
- 🔴 严重告警: **3** 条
- 🟠 高级告警: **2** 条
- 📌 待处理告警: **4** 条

**最近告警**:
1. 🔴 [CRITICAL] CPU usage exceeds 95%
2. 🔴 [CRITICAL] Memory usage critical
3. 🟠 [HIGH] Disk space low on server-01
4. 🟡 [MEDIUM] Network latency high
5. 🟡 [MEDIUM] Service restart detected

👉 建议：前往"告警中心"查看详细信息并处理待解决告警
```

### 18.5.3 服务器查询回答

```typescript
private handleServerQuery(): string {
  const servers = db.prepare('SELECT * FROM servers LIMIT 20').all();
  const enabledCount = servers.filter((s) => s.enabled).length;

  let response = `🖥️ **服务器管理概览**\n\n`;
  response += `当前共有 **${servers.length}** 台服务器配置\n`;
  response += `- ✅ 已启用: **${enabledCount}** 台\n`;
  response += `- ❌ 已禁用: **${servers.length - enabledCount}** 台\n\n`;

  if (servers.length > 0) {
    response += `**服务器列表**:\n`;
    servers.slice(0, 8).forEach((s, i) => {
      const status = s.enabled ? '✅' : '❌';
      response += `${i + 1}. ${status} ${s.name} (${s.hostname}:${s.port})\n`;
    });
    response += `\n👉 如需对服务器执行操作，请前往"服务器管理"页面`;
  }

  return response;
}
```

### 18.5.4 任务查询回答

```typescript
private handleTaskQuery(): string {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 15').all();
  const statusCounts: Record<string, number> = {};
  tasks.forEach((t) => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });

  let response = `📋 **任务执行概览**\n\n`;
  response += `当前共有 **${tasks.length}** 个任务记录\n`;
  response += `- ▶️ 运行中: **${statusCounts['running'] || 0}** 个\n`;
  response += `- ✅ 已完成: **${statusCounts['completed'] || 0}** 个\n`;
  response += `- ❌ 失败: **${statusCounts['failed'] || 0}** 个\n`;
  response += `- ⏳ 待执行: **${statusCounts['pending'] || 0}** 个\n\n`;

  if (tasks.length > 0) {
    response += `**最近任务**:\n`;
    tasks.slice(0, 5).forEach((t, i) => {
      const emoji = t.status === 'completed' ? '✅' : t.status === 'failed' ? '❌' : '⏳';
      response += `${i + 1}. ${emoji} ${t.name} - ${t.status}\n`;
    });
  }

  return response;
}
```

### 18.5.5 帮助与通用回答

```typescript
private handleHelpQuery(): string {
  return `👋 **欢迎使用 ITOps Copilot！**\n\n` +
    `我是您的智能运维助手，可以帮您：\n\n` +
    `**查询类：**\n` +
    `- "查看当前告警状态"\n` +
    `- "服务器状态怎么样？"\n` +
    `- "最近执行了哪些任务？"\n\n` +
    `**操作类：**\n` +
    `- "帮我执行系统巡检"\n` +
    `- "检查一下磁盘空间"\n` +
    `- "生成一份运维报告"\n\n` +
    `**系统功能：**\n` +
    `- 告警中心：告警查看与处理\n` +
    `- 工作流：编排自动化任务\n` +
    `- 服务器管理：远程操作服务器\n` +
    `- 报告系统：生成运维报告\n\n` +
    `有什么我可以帮您的吗？`;
}

private handleGeneralQuery(input: string): string {
  return `🤔 我理解您想了解：**"${input}"**\n\n` +
    `让我给您一些建议：\n\n` +
    `**您可以尝试：**\n` +
    `1. 查看"告警中心" - 了解当前系统状态\n` +
    `2. 检查"工作流" - 运行自动化任务\n` +
    `3. 使用"服务器管理" - 对服务器执行操作\n` +
    `4. 生成"报告" - 查看运维统计\n\n` +
    `需要更具体的帮助吗？可以问我"帮助"！`;
}
```

### 18.5.6 快捷建议

```typescript
getQuickSuggestions(): string[] {
  return [
    '查看当前告警状态',
    '服务器状态怎么样',
    '最近执行了哪些任务',
    '帮我生成运维报告',
    '检查系统健康状态',
    '有哪些服务器需要巡检'
  ];
}
```

## 18.6 前端 ChatWidget 组件

### 18.6.1 组件状态管理

```typescript
const [isOpen, setIsOpen] = useState(false);                // 是否打开
const [isMinimized, setIsMinimized] = useState(false);      // 是否最小化
const [inputValue, setInputValue] = useState('');            // 输入框内容
const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
```

### 18.6.2 三种展示模式

```
模式1: 隐藏状态 (isOpen=false)
┌──────────────────┐
│                  │
│      [🤖]        │  ← 悬浮 Bot 按钮
│                  │
└──────────────────┘

模式2: 最小化状态 (isOpen=true, isMinimized=true)
┌──────────────────┐
│  [💬]  [✕]       │  ← 消息气泡图标 + 关闭按钮
└──────────────────┘

模式3: 完整对话状态 (isOpen=true, isMinimized=false)
┌──────────────────────────────────┐
│ 🤖 IT运维助手        [-] [✕]     │  ← 头部
├──────────┬───────────────────────┤
│ [+新对话]│                       │
│          │   🤖 您好！           │
│  对话1   │   👤 告警情况？       │  ← 消息区域
│  对话2   │   🤖 当前共有...      │
│          │                       │
├──────────┴───────────────────────┤
│ [输入框...]           [📤]       │  ← 输入区域
└──────────────────────────────────┘
```

### 18.6.3 消息发送流程

```typescript
const handleSend = async (msg?: string) => {
  const message = msg || inputValue;
  if (!message.trim()) return;

  if (!currentConversationId) {
    // 没有对话时：先创建对话，再发送消息
    await createConversationMutation.mutateAsync().then((data) => {
      if (data && data.success) {
        sendMessageMutation.mutate({ conversationId: data.data.id, message });
      }
    });
  } else {
    // 有对话时：直接发送
    sendMessageMutation.mutate({ conversationId: currentConversationId, message });
  }
};
```

### 18.6.4 React Query 数据获取

```typescript
// 获取快捷建议
const { data: suggestions } = useQuery({
  queryKey: ['copilot-suggestions'],
  queryFn: async () => {
    const res = await api.get('/api/copilot/suggestions');
    return res.data.data || [];
  }
});

// 获取对话列表
const { data: conversations } = useQuery({
  queryKey: ['copilot-conversations'],
  queryFn: async () => {
    const res = await api.get('/api/copilot/conversations');
    return res.data.data || [];
  }
});

// 发送消息（Mutation）
const sendMessageMutation = useMutation({
  mutationFn: async ({ conversationId, message }) => {
    const res = await api.post('/api/copilot/chat', { conversationId, message });
    return res.data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['copilot-conversations'] });
    setInputValue('');
  }
});
```

### 18.6.5 消息气泡渲染

```typescript
{currentConversation?.messages?.map((msg: Message, index: number) => (
  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
    <div className="flex items-start gap-2 max-w-[85%]">
      {msg.role === 'assistant' && (
        <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`p-3 rounded-lg ${
        msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'
      }`}>
        {msg.role === 'assistant' ? (
          <MarkdownOutput content={msg.content} />  {/* Markdown 渲染 */}
        ) : (
          <p className="text-sm">{msg.content}</p>
        )}
      </div>
      {msg.role === 'user' && (
        <div className="w-7 h-7 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  </div>
))}
```

### 18.6.6 加载状态

```typescript
{sendMessageMutation.isPending && (
  <div className="flex justify-start">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-white animate-spin" />  {/* 旋转加载图标 */}
      </div>
      <div className="p-3 bg-slate-800 rounded-lg text-slate-300">
        思考中...
      </div>
    </div>
  </div>
)}
```

## 18.7 API 路由层

### 18.7.1 路由定义

```typescript
// GET /api/copilot/suggestions           → 获取快捷建议
// GET  /api/copilot/conversations         → 获取用户对话列表
// POST /api/copilot/conversations         → 创建新对话
// GET  /api/copilot/conversations/:id     → 获取单个对话详情
// DELETE /api/copilot/conversations/:id   → 删除对话
// POST /api/copilot/chat                 → 发送消息并获取回答
```

### 18.7.2 核心聊天 API

```typescript
router.post('/chat', async (req: Request, res: Response) => {
  const { conversationId, message } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, error: '消息不能为空' });
  }

  const userId = (req as { user?: { id: string } }).user?.id || 'default';
  const response = await copilotService.processNaturalLanguage(
    conversationId, message, userId
  );

  res.json({ success: true, data: { response } });
});
```

## 18.8 LLM 降级策略详解

Copilot 的响应引擎采用三级降级策略，确保在各种环境下都能响应用户：

```
┌────────────────────────────────────────────────────────┐
│                  响应降级策略                            │
├────────────────────────────────────────────────────────┤
│                                                        │
│  第一级: LLM 智能生成 (Doubao API)                      │
│  ├── 前提: LLM 服务可用 (checkLLMAvailability)          │
│  ├── 流程: 构建上下文 → 注入Prompt → 调用API            │
│  ├── 优点: 灵活、理解力强、自然语言生成                  │
│  └── 缺点: 依赖外部服务、有延迟、有费用                  │
│                                                        │
│  第二级: LLM 调用失败 → Rule-based 降级                 │
│  ├── 触发: catch LLM 调用异常                           │
│  ├── 流程: 关键词匹配 → 数据库查询 → 格式化回答          │
│  ├── 优点: 即时响应、无外部依赖                         │
│  └── 缺点: 回答模式固定、无法处理复杂问题                │
│                                                        │
│  第三级: LLM 服务不可用 → 纯 Rule-based                 │
│  ├── 触发: checkLLMAvailability 返回 false              │
│  ├── 流程: 同第二级                                     │
│  └── 特点: 保证基本功能始终可用                          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 18.8.1 各模式回答对比

以用户提问 "服务器状态怎么样？" 为例：

| 模式 | 回答特点 | 示例片段 |
|------|----------|----------|
| LLM 模式 | 自然语言，可能包含分析建议 | "根据系统数据，当前共有5台服务器..." |
| Rule-based 模式 | 结构化模板，数据精确 | "🖥️ **服务器管理概览**\n当前共有 **5** 台..." |

## 18.9 数据库表结构

```sql
CREATE TABLE copilot_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  messages TEXT NOT NULL DEFAULT '[]',    -- JSON 格式存储消息数组
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

消息 JSON 格式：

```json
[
  {
    "role": "user",
    "content": "查看当前告警状态",
    "timestamp": "2026-05-27T10:30:00.000Z"
  },
  {
    "role": "assistant",
    "content": "📊 **当前告警状态概览**\n\n当前共有 **10** 条告警记录...",
    "timestamp": "2026-05-27T10:30:02.000Z"
  }
]
```

## 18.10 完整交互链路

```
1. 用户点击页面右下角 🤖 按钮 → isOpen = true

2. 前端加载：
   ├── GET /api/copilot/suggestions → ["查看当前告警状态", "服务器状态怎么样", ...]
   └── GET /api/copilot/conversations → [] (无历史对话)

3. 用户点击快捷建议 "查看当前告警状态"

4. handleSend("查看当前告警状态")：
   ├── currentConversationId = null
   ├── POST /api/copilot/conversations → { id: "uuid-1" }
   └── POST /api/copilot/chat { conversationId: "uuid-1", message: "查看当前告警状态" }

5. 后端 processNaturalLanguage：
   ├── 获取/创建对话
   ├── 添加用户消息: { role: "user", content: "查看当前告警状态" }
   ├── generateResponse：
   │   ├── checkLLMAvailability() → true (假设LLM可用)
   │   ├── buildContextForLLM("查看当前告警状态")：
   │   │   ├── 检测到"告警"关键词
   │   │   ├── 查询 alerts 表 (最近10条)
   │   │   ├── 计算 severityCounts 和 statusCounts
   │   │   └── 返回上下文文本
   │   ├── 构建 enrichedPrompt：
   │   │   "当前系统数据：\n当前告警数据：共 10 条告警...\n用户输入：查看当前告警状态"
   │   ├── callDoubaoAPI(COPILOT_SYSTEM_PROMPT, enrichedPrompt, ...)
   │   └── 返回 LLM 回答
   ├── 添加助手消息: { role: "assistant", content: "..." }
   ├── 保存到 SQLite
   └── 返回 response

6. 前端收到 response：
   ├── sendMessageMutation onSuccess → invalidateQueries → 刷新对话列表
   ├── 消息列表渲染：用户气泡(右) + 助手气泡(左)
   └── 自动滚动到底部 (scrollIntoView)
```

## 本章小结

本章深入讲解了 ITOps Agent Platform 的 AI Copilot 实现原理：

- **系统 Prompt 设计**：定义角色定位、6大能力范围、回答风格要求、越界处理策略
- **对话状态管理**：Map 内存缓存 + SQLite 持久化的双重存储方案，支持最大1000个对话、7天TTL自动清理、创建/查询/删除的完整 CRUD
- **上下文自动注入**：根据用户输入中的关键词（告警/服务器/任务/巡检），自动从数据库查询相关数据并注入到 LLM 上下文中
- **双引擎响应**：LLM 可用时调用 Doubao API 智能生成，不可用时降级为基于规则的精准回答（6种规则处理器）
- **前端 ChatWidget**：三种展示模式（隐藏/最小化/完整）、React Query 数据管理、Markdown 消息渲染、加载状态动画、快捷建议按钮
- **API 设计**：6个 RESTful 端点，涵盖对话 CRUD、消息发送、建议获取
- **降级策略**：三级响应降级（LLM 智能生成 → LLM 失败降级 → LLM 不可用纯规则），保证服务高可用

## 本章练习

### 基础练习

1. **对话标题生成**：为每条对话自动生成一个标题（从用户第一条消息中提取前20个字符作为标题）。修改 `createConversation` 方法，添加 `title` 字段，在侧边栏中显示标题而非首条消息内容。

2. **输入防抖与取消**：当用户快速连续输入多条消息时，实现防抖机制（debounce），300ms 内的多次输入合并为一次发送。同时实现"取消当前请求"功能，用户在等待 LLM 响应时可以取消。

3. **对话搜索功能**：在前端对话列表侧边栏添加搜索框，实现按对话标题/首条消息内容搜索历史对话。后端添加 `GET /api/copilot/conversations?search=关键词` 接口。

### 进阶练习

4. **工具调用（Tool Calling）**：扩展 Copilot 的能力，使其能够执行实际的操作（如查询服务器实时状态、执行简单命令、创建工单等）。设计一个工具注册系统，让 Copilot 可以根据用户意图选择合适的工具执行。参考 OpenAI Function Calling 的实现模式。

5. **流式响应（Streaming）**：将 Copilot 的 LLM 响应改为流式输出（Server-Sent Events 或 WebSocket Streaming），实现逐字/逐段显示效果，提升用户体验。设计前端打字机效果的渲染组件。

6. **多轮意图消歧**：当用户输入模糊时（如"检查一下"），Copilot 主动追问澄清（"您想检查什么？服务器状态、磁盘空间还是服务运行状态？"）。实现一个意图置信度评分系统，低于阈值时触发追问流程。

### 思考题

7. **Copilot 的安全边界**：Copilot 能够访问数据库中的告警、服务器、任务等敏感数据。讨论如何在 Copilot 层实现数据访问控制（如不同角色看到的告警数量和内容不同），防止低权限用户通过自然语言查询获取超出其权限的数据。是否需要实现查询审计日志？

8. **从 ChatBot 到 Agentic Copilot 的演进**：当前的 Copilot 主要是"问答式"助手，能查数据、给建议但不能执行操作。讨论如何将其演进为"Agentic"模式，使 Copilot 能够主动调用 Agent、执行工作流、操作服务器。这种演进会带来哪些安全风险？如何设计"人在回路"（Human-in-the-loop）机制，确保关键操作需要人工确认？

## 延伸阅读

- **System Prompt 设计最佳实践**: Anthropic Claude Prompt Engineering Guide - 如何编写有效的系统提示
- **React Query 官方文档**: <https://tanstack.com/query/latest> - 前端数据获取、缓存、同步的最佳实践
- **流式 LLM 响应**: OpenAI Chat Completion Streaming API 文档
- **Tool Calling / Function Calling**: OpenAI Function Calling 指南 - 让 LLM 能够调用外部工具
- **对话式 AI 设计原则**: Google Conversational Design Guidelines - 对话式交互的设计模式与最佳实践
- **RAG vs Copilot vs Agent**: 三种 AI 助手模式的对比分析与应用场景
