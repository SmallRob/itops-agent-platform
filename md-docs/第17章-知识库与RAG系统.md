# 第17章 知识库与RAG系统


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

在运维场景中，LLM（大语言模型）虽然具备广泛的通用知识，但缺乏对企业特定环境、历史故障记录、内部流程规范的了解。RAG（Retrieval-Augmented Generation，检索增强生成）技术通过在生成答案之前先从知识库中检索相关文档，将企业私有知识注入到 LLM 的上下文中，从而显著提升回答的准确性和相关性。

ITOps Agent Platform 实现了两层知识检索架构：

1. **本地知识库**（EnhancedRAGService）：基于 SQLite 存储的结构化知识，使用关键词匹配 + 多维度评分进行检索
2. **QAnything 向量知识库**（QAnythingService）：对接网易有道开源的 QAnything 系统，提供基于向量语义的深度检索

本章将剖析这两层知识检索系统的实现原理，以及它们如何与 Agent 执行引擎集成。

## 学习目标

- 理解 RAG 架构的核心概念和工作流程
- 掌握本地知识库的关键词检索与多维度评分算法
- 理解 QAnything 向量知识库的集成方式与 API 调用
- 掌握知识检索结果如何注入到 LLM 的 Prompt 中
- 理解知识使用频率统计与时间衰减机制
- 学会设计文档上传、解析状态跟踪与知识管理功能
- 掌握本地规则引擎与知识库的协同推荐机制

## 17.1 RAG 系统整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户提问                                      │
│                     "服务器CPU占用过高怎么办？"                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  executeAgentWithLLM │
                    │   (llmService.ts)    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼────────┐ ┌────▼────┐ ┌────────▼─────────┐
    │ QAnythingService │ │ Enhanced│ │  localRuleEngine │
    │  (向量知识库)     │ │ RAG     │ │  (本地规则推荐)   │
    │                  │ │ Service │ │                  │
    │ • 语义向量检索    │ │ (关键词 │ │ • 规则匹配推荐    │
    │ • 文档分块存储    │ │  检索)  │ │ • 知识关联推荐    │
    │ • topK 召回       │ │ • 多维  │ │                  │
    │ • 重试机制        │ │  评分   │ │                  │
    └─────────┬────────┘ └────┬────┘ └────────┬─────────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  知识上下文融合       │
                    │                     │
                    │ 【相关知识库内容】   │
                    │ {QAnything内容}     │
                    │ {本地知识内容}       │
                    │ {规则推荐内容}       │
                    │                     │
                    │ 【用户问题】         │
                    │ "服务器CPU占用..."   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  LLM API 调用        │
                    │  (Doubao/OpenAI/...) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Agent 回答输出      │
                    └─────────────────────┘
```

### 17.1.1 RAG 核心流程

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ 1. 接收   │───►│ 2. 知识   │───►│ 3. 知识   │───►│ 4. Prompt│───►│ 5. LLM   │
│ 用户问题  │    │ 库检索    │    │ 上下文    │    │ 构建     │    │ 生成回答  │
│           │    │           │    │ 融合     │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   输入阶段        检索阶段        增强阶段        构建阶段        生成阶段
```

## 17.2 本地知识库（EnhancedRAGService）

### 17.2.1 知识存储结构

本地知识存储在 SQLite 的 `knowledge_base` 表中：

```sql
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '未分类',
  tags TEXT NOT NULL DEFAULT '[]',     -- JSON 数组
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 17.2.2 知识检索流程

```typescript
async search(
  query: string,
  options: { category?: string; limit?: number; minScore?: number } = {}
): Promise<SearchResult[]> {
  // 1. 从数据库获取候选知识（按使用频率排序，取50条）
  let sql = 'SELECT * FROM knowledge_base WHERE 1=1';
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY usage_count DESC, created_at DESC LIMIT 50';
  
  const knowledgeItems = db.prepare(sql).all(...params);
  if (knowledgeItems.length === 0) return [];

  // 2. 对每条知识计算相关度分数
  const scoredResults = knowledgeItems.map(item => {
    const score = this.calculateRelevanceScore(query, item);
    const highlight = this.generateHighlight(query, item);
    return { item: this.transformItem(item), score, highlight };
  })
  // 3. 过滤低分结果
  .filter(result => result.score >= minScore)
  // 4. 按分数降序排序
  .sort((a, b) => b.score - a.score)
  // 5. 截取Top-N
  .slice(0, limit);

  return scoredResults;
}
```

### 17.2.3 多维度评分算法

评分由四个维度加权组成，总分上限 1.0：

```typescript
private calculateRelevanceScore(query: string, item: {
  title: string; content: string; category: string; usage_count: number;
  created_at: string;
}): number {
  let score = 0;
  const queryLower = query.toLowerCase();
  const contentLower = `${item.title} ${item.content} ${item.category}`.toLowerCase();

  // 维度1: 精确匹配（权重 0.5）
  // 整个查询字符串出现在内容中
  if (contentLower.includes(queryLower)) {
    score += 0.5;
  }

  // 维度2: 关键词匹配（权重 0.3）
  // 提取查询中的关键词，计算匹配比例
  const keywords = this.extractKeywords(query);
  let matchCount = 0;
  for (const keyword of keywords) {
    if (contentLower.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }
  if (keywords.length > 0) {
    score += (matchCount / keywords.length) * 0.3;
  }

  // 维度3: 使用频率权重（权重上限 0.15）
  // 被频繁使用的知识更有价值
  score += Math.min((item.usage_count || 0) * 0.01, 0.15);

  // 维度4: 时间衰减因子（权重上限 0.05）
  // 一年内的内容有额外加成
  const daysDiff = (Date.now() - new Date(item.created_at).getTime()) / 86400000;
  const timeDecay = Math.max(0, 1 - daysDiff / 365);
  score += timeDecay * 0.05;

  return Math.min(score, 1.0);
}
```

### 17.2.4 评分维度权重表

| 维度 | 权重 | 计算方式 | 最大分值 | 设计意图 |
|------|------|----------|----------|----------|
| 精确匹配 | 0.5 | 查询全文是否在内容中出现 | 0.5 | 确保完整匹配的结果最高 |
| 关键词匹配 | 0.3 | 匹配关键词数/总关键词数 | 0.3 | 部分匹配也能获得分数 |
| 使用频率 | 0.01/次 | min(使用次数×0.01, 0.15) | 0.15 | 常用知识更重要（15次达上限） |
| 时间衰减 | 线性衰减 | max(0, 1-天数/365)×0.05 | 0.05 | 新内容略优于旧内容 |

### 17.2.5 关键词提取与停用词过滤

```typescript
private stopWords = new Set([
  // 中文停用词
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  // 英文停用词
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did'
]);

private extractKeywords(text: string): string[] {
  return text.split(/[\s,.!?，。！？]+/)       // 按中英文标点/空格分割
    .filter(word => 
      word.length > 1 &&                        // 单字词过滤掉
      !this.stopWords.has(word.toLowerCase())   // 停用词过滤
    );
}
```

关键词提取示例：

| 输入查询 | 提取的关键词 |
|----------|-------------|
| `服务器CPU占用过高怎么办？` | `['服务器', 'CPU', '占用', '过高', '怎么办']` |
| `如何配置 nginx 负载均衡` | `['如何', '配置', 'nginx', '负载', '均衡']` |
| `The database is too slow` | `['database', 'slow']` |

### 17.2.6 高亮片段生成

为了让 LLM 快速获取关键信息，系统从知识内容中提取包含关键词的上下文片段：

```typescript
private generateHighlight(query: string, item: { content: string }): string {
  const content = item.content || '';
  const keywords = this.extractKeywords(query);
  
  if (keywords.length === 0) {
    return content.substring(0, 200) + (content.length > 200 ? '...' : '');
  }

  // 找到第一个关键词的最早出现位置
  let bestPosition = -1;
  for (const keyword of keywords) {
    const position = content.toLowerCase().indexOf(keyword.toLowerCase());
    if (position >= 0 && (bestPosition === -1 || position < bestPosition)) {
      bestPosition = position;
    }
  }

  if (bestPosition === -1) {
    return content.substring(0, 200) + (content.length > 200 ? '...' : '');
  }

  // 截取关键词前后 80~120 字符的上下文
  const start = Math.max(0, bestPosition - 80);
  const end = Math.min(content.length, bestPosition + 120);
  let highlight = content.substring(start, end);

  if (start > 0) highlight = '...' + highlight;
  if (end < content.length) highlight += '...';

  return highlight;
}
```

### 17.2.7 知识注入（Knowledge Injection）

检索到的知识被格式化为 LLM 友好的提示文本：

```typescript
async injectKnowledge(
  query: string,
  options: { category?: string; maxItems?: number; minScore?: number } = {}
): Promise<{ hasKnowledge: boolean; prompt: string }> {
  // 1. 检索相关知识
  const searchResults = await this.search(query, {
    category: options.category,
    limit: options.maxItems || 5,
    minScore: options.minScore || 0.2
  });

  // 2. 无本地知识时，尝试本地规则引擎推荐
  if (searchResults.length === 0) {
    const ruleRecommendations = localRuleEngine.recommendKnowledge('', query);
    if (ruleRecommendations.length > 0) {
      let rulePrompt = `📚 本地规则引擎推荐的相关知识：\n\n`;
      ruleRecommendations.forEach((rec, index) => {
        rulePrompt += `【推荐 ${index + 1}】${rec.title} (相关度: ${Math.round(rec.relevance * 100)}%)\n`;
        rulePrompt += `${rec.summary}\n\n`;
      });
      rulePrompt += `请注意：以上推荐基于本地规则库，建议结合实际情况进行判断。`;
      return { hasKnowledge: true, prompt: rulePrompt };
    }
    return { hasKnowledge: false, prompt: '' };
  }

  // 3. 更新使用频率计数
  for (const result of searchResults) {
    db.prepare(`
      UPDATE knowledge_base 
      SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(result.item.id);
  }

  // 4. 构建知识注入 Prompt
  let knowledgePrompt = `📚 以下是从知识库中检索到的相关信息（相关度排序）：\n\n`;
  searchResults.forEach((result, index) => {
    knowledgePrompt += `【资料 ${index + 1}】${result.item.title} (相关度: ${Math.round(result.score * 100)}%)\n`;
    knowledgePrompt += `${result.highlight}\n\n`;
  });
  knowledgePrompt += `请根据以上信息和你的专业知识回答问题。如果信息不足以回答问题，请说明。`;

  return { hasKnowledge: true, prompt: knowledgePrompt };
}
```

### 17.2.8 知识管理功能

```typescript
// 添加知识（自动提取标签）
async addKnowledge(title: string, content: string, category: string = '未分类', tags: string[] = []): Promise<string> {
  const id = randomUUID();
  const autoTags = tags.length > 0 
    ? tags 
    : this.extractKeywords(`${title} ${content}`).slice(0, 10);  // 自动提取前10个关键词作为标签

  db.prepare(`
    INSERT INTO knowledge_base (id, title, content, category, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(id, title, content, category, JSON.stringify(autoTags));

  return id;
}

// 批量导入
async batchImport(items: Array<{ title: string; content: string; category?: string; tags?: string[] }>): Promise<{ imported: number; failed: number }> {
  let imported = 0, failed = 0;
  for (const item of items) {
    try {
      await this.addKnowledge(item.title, item.content, item.category || '未分类', item.tags || []);
      imported++;
    } catch (error) {
      failed++;
    }
  }
  return { imported, failed };
}

// 相似知识推荐
async getSimilarKnowledge(knowledgeId: string, limit: number = 5): Promise<KnowledgeItem[]> {
  const sourceItem = db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(knowledgeId);
  if (!sourceItem) return [];

  const searchQuery = `${sourceItem.title} ${sourceItem.category}`;
  const results = await this.search(searchQuery, { limit: limit + 1 });
  
  return results
    .filter(r => r.item.id !== knowledgeId)  // 排除自身
    .slice(0, limit)
    .map(r => r.item);
}
```

### 17.2.9 知识统计

```typescript
getStatistics() {
  const totalItems = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get().count;

  const categoryStats = db.prepare(`
    SELECT category, COUNT(*) as count FROM knowledge_base 
    GROUP BY category ORDER BY count DESC
  `).all();

  const topItems = db.prepare(`
    SELECT * FROM knowledge_base 
    ORDER BY usage_count DESC, created_at DESC LIMIT 10
  `).all();

  return {
    totalItems,
    categoryStats,
    topItems: topItems.map(item => this.transformItem(item))
  };
}
```

## 17.3 QAnything 向量知识库

### 17.3.1 QAnything 概述

QAnything（Question and Answer based on Anything）是网易有道开源的本地化知识库问答系统。与传统的关键词匹配不同，QAnything 基于向量语义检索，能够理解问题的语义相似度，即使词汇不完全匹配也能找到相关知识。

### 17.3.2 配置结构

```typescript
interface QAnythingConfig {
  enabled: boolean;      // 是否启用
  apiBase: string;       // QAnything API 地址（如 http://localhost:8777）
  apiKey: string;        // 认证密钥
  kbId: string;          // 知识库ID
  mode: 'local' | 'cloud'; // 部署模式
  topK: number;          // 返回的最多相关片段数
}
```

配置存储在 SQLite 的 `settings` 表中：

```typescript
private loadConfig(): QAnythingConfig | null {
  const setting = db.prepare(
    "SELECT value FROM settings WHERE key = 'qanything_config'"
  ).get() as { value: string } | undefined;
  
  return setting ? JSON.parse(setting.value) : null;
}
```

### 17.3.3 知识查询（核心API调用）

```typescript
async queryKnowledge(question: string, topK?: number): Promise<string> {
  const config = this.getConfig();
  if (!config || !config.enabled) {
    throw new Error('QAnything is not enabled');
  }

  if (!this.isApiKeyValid(config.apiKey)) {
    logger.warn('⚠️ QAnything API Key is invalid or masked, falling back to local knowledge base');
    throw new Error('QAnything API Key is not properly configured');
  }

  const k = topK || config.topK || 5;
  const apiBase = this.normalizeApiBase(config.apiBase);

  // 最多重试 2 次，使用指数退避
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      if (attempt > 1) {
        const delay = Math.pow(2, attempt - 1) * 1000;  // 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await axios.post(
        `${apiBase}/api/local_doc_qa/local_doc_chat`,
        {
          user_id: 'itops_agent',
          kb_ids: [config.kbId],
          question,
          top_k: k
        },
        {
          headers: {
            'Authorization': config.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000  // 30秒超时
        }
      );

      if (response.data.code !== 200) {
        throw new Error(`QAnything API error: ${response.data.msg}`);
      }

      // 解析响应（支持多种格式）
      const data = response.data.data;
      let context = '';

      if (data && data.response) {
        if (typeof data.response === 'string') {
          context = data.response.trim();                          // 字符串响应
        } else if (Array.isArray(data.response)) {
          const chunks = data.response.map(chunk => {
            const content = chunk.content || chunk.text || '';
            return typeof content === 'string' ? content.trim() : '';
          }).filter(Boolean);
          context = chunks.join('\n\n');                           // 数组响应
        } else if (typeof data.response === 'object') {
          const textContent = data.response.content || data.response.text || '';
          context = typeof textContent === 'string' ? textContent.trim() : '';  // 对象响应
        }
      }

      if (!context) {
        logger.info('📭 No relevant knowledge found in QAnything');
        return '';
      }

      return context;

    } catch (error) {
      lastError = error;
      // 认证错误或配置错误不重试
      if (error.message.includes('API Key') || error.message.includes('not configured')) {
        throw error;
      }
    }
  }

  throw lastError || new Error('QAnything query failed after retries');
}
```

### 17.3.4 QAnything API 调用流程图

```
┌─────────────────┐
│  queryKnowledge  │
│  (question)      │
└────────┬────────┘
         │
    ┌────▼────┐
    │ 检查配置  │─── 未启用/无效Key ──► 抛异常
    └────┬────┘
         │ 配置有效
    ┌────▼────┐
    │ 重试循环  │  最多3次（1次初始+2次重试）
    └────┬────┘
         │
    ┌────▼─────────────────────┐
    │ POST /local_doc_qa/      │
    │   local_doc_chat         │
    │ {                        │
    │   user_id: 'itops_agent' │
    │   kb_ids: [config.kbId] │
    │   question: "...",       │
    │   top_k: 5               │
    │ }                        │
    └────┬─────────────────────┘
         │
    ┌────▼────┐
    │ code=200?│─── 否 ──► 记录错误，下次重试
    └────┬────┘
         │ 是
    ┌────▼────┐
    │ 解析响应  │  字符串/数组/对象 三种格式
    └────┬────┘
         │
    ┌────▼────┐
    │ context  │  返回检索到的知识文本
    │ 非空？    │
    └────┬────┘
         │
    ┌────▼────┐
    │ return   │
    │ context  │
    └─────────┘
```

### 17.3.5 API Key 有效性检测

```typescript
private isApiKeyValid(apiKey: string): boolean {
  if (!apiKey || apiKey.length === 0) return false;
  // 脱敏值（前端显示）不能作为有效Key
  if (apiKey.includes('****') || apiKey.includes('...')) return false;
  // 有效Key至少8个字符
  if (apiKey.length < 8) return false;
  return true;
}
```

### 17.3.6 API 地址规范化

```typescript
private normalizeApiBase(apiBase: string): string {
  if (!apiBase || !apiBase.trim()) {
    throw new Error('API base URL is not configured');
  }
  // 去除末尾斜杠，确保协议前缀
  const normalized = apiBase.trim().replace(/\/+$/, '');
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    throw new Error(`Invalid API base URL: "${apiBase}"`);
  }
  return normalized;
}
```

### 17.3.7 文档上传

```typescript
async uploadDocument(file: Buffer, fileName: string): Promise<{ fileId: string; status: string }> {
  const config = this.getConfig();
  const apiBase = this.normalizeApiBase(config.apiBase);
  
  const formData = new FormData();
  formData.append('file', file, {
    filename: fileName,
    contentType: this.getContentType(fileName)
  });
  formData.append('kbId', config.kbId);
  formData.append('user_id', 'itops_agent');

  const response = await axios.post(
    `${apiBase}/api/local_doc_qa/upload_files`,
    formData,
    {
      headers: { ...formData.getHeaders(), 'Authorization': config.apiKey },
      timeout: 120000  // 上传大文件需要120秒超时
    }
  );

  return {
    fileId: response.data.data?.[0]?.fileId || '',
    status: response.data.data?.[0]?.status || 'processing'
  };
}

// 根据文件扩展名确定 Content-Type
private getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'csv': 'text/csv',
    'png': 'image/png',
    'jpg': 'image/jpeg'
  };
  return types[ext || ''] || 'application/octet-stream';
}
```

### 17.3.8 文档状态查询与删除

```typescript
// 查询文档解析状态
async getDocumentStatus(fileId: string): Promise<{ status: string; fileName: string }> {
  const config = this.getConfig();
  const apiBase = this.normalizeApiBase(config.apiBase);
  
  const response = await axios.get(
    `${apiBase}/api/local_doc_qa/get_file_status`,
    {
      params: { kb_id: config.kbId, file_id: fileId, user_id: 'itops_agent' },
      headers: { 'Authorization': config.apiKey }
    }
  );

  return {
    status: response.data.data?.[0]?.status || 'unknown',
    fileName: response.data.data?.[0]?.file_name || ''
  };
}

// 删除文档
async deleteDocument(fileId: string): Promise<void> {
  const config = this.getConfig();
  const apiBase = this.normalizeApiBase(config.apiBase);
  
  await axios.post(
    `${apiBase}/api/local_doc_qa/delete_files`,
    { kb_id: config.kbId, file_ids: [fileId], user_id: 'itops_agent' },
    { headers: { 'Authorization': config.apiKey, 'Content-Type': 'application/json' } }
  );
}
```

### 17.3.9 健康检查

```typescript
async testConnection(): Promise<{ success: boolean; message: string }> {
  const config = this.getConfig();
  if (!config || !config.enabled) {
    return { success: false, message: 'QAnything is not enabled' };
  }

  try {
    const apiBase = this.normalizeApiBase(config.apiBase);
    const response = await axios.get(`${apiBase}/api/health`, {
      headers: config.apiKey ? { 'Authorization': config.apiKey } : {},
      timeout: 10000
    });

    return response.status === 200
      ? { success: true, message: 'Connection successful' }
      : { success: false, message: `Unexpected response: ${response.status}` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error.message}` };
  }
}
```

## 17.4 知识检索与 LLM 集成

### 17.4.1 Agent 执行中的知识检索

在 `executeAgentWithLLM` 函数中，知识检索是增强 Prompt 的关键步骤：

```typescript
// llmService.ts - executeAgentWithLLM

// 1. 优先使用 QAnything 检索知识库
let knowledgeContext = '';
try {
  if (qanythingService.isEnabled()) {
    logger.info('🔍 Using QAnything for knowledge retrieval...');
    knowledgeContext = await qanythingService.queryKnowledge(userInput, qanythingService.getTopK());
  }
} catch (error) {
  logger.warn('⚠️ QAnything query failed, proceeding without knowledge context:', error);
  // QAnything 失败不阻塞执行，降级到无知识上下文
}

// 2. 构建增强 Prompt
let enhancedPrompt = agent.system_prompt || `你是一个专业的${agent.name || 'IT运维'}助手。`;

// 3. 注入知识上下文
if (knowledgeContext) {
  enhancedPrompt += `\n\n【相关知识库内容】\n${knowledgeContext}\n\n`;
  enhancedPrompt += '请基于以上知识库内容回答用户问题。如果知识库内容不足以回答问题，请结合你的专业知识进行补充。\n\n';
}

// 4. 附加用户问题
enhancedPrompt += `\n【用户问题】\n${userInput}`;

// 5. 调用 LLM
const temperature = agent.temperature || 0.7;
const provider = getProviderForModel(model);
// ... 根据 provider 调用对应 API
```

### 17.4.2 降级策略

```
┌──────────────────────────────────────────────┐
│           知识检索降级策略                      │
├──────────────────────────────────────────────┤
│                                              │
│  第一层: QAnything 向量检索                    │
│  └─ 成功 ──► 使用向量检索结果                   │
│  └─ 失败 ──┐                                  │
│             ▼                                 │
│  第二层: 本地规则引擎推荐                       │
│  └─ 有推荐 ──► 使用规则推荐                     │
│  └─ 无推荐 ──┐                                │
│               ▼                               │
│  第三层: 纯 LLM 回答（无知识增强）              │
│  └─ 基于 Agent 的 System Prompt 直接回答       │
│                                              │
└──────────────────────────────────────────────┘
```

### 17.4.3 增强 Prompt 示例

假设用户提问："服务器内存使用率超过90%怎么处理？"

**基础 Prompt（Agent System Prompt）**：
```
你是一个专业的IT运维助手，擅长分析系统问题并提供解决方案。
```

**知识增强后的 Prompt**：
```
你是一个专业的IT运维助手，擅长分析系统问题并提供解决方案。

【相关知识库内容】
【资料 1】内存泄漏排查指南 (相关度: 78%)
...进程内存持续增长通常表明存在内存泄漏。使用 top/htop 查看 RES 列，
定位占用最高的进程。使用 pmap 或 /proc/{pid}/smaps 分析内存映射...

【资料 2】Linux 内存管理最佳实践 (相关度: 65%)
...可以通过清理 page cache 临时释放内存：echo 3 > /proc/sys/vm/drop_caches。
但这只是临时方案，根本原因需要从应用层面排查...

请基于以上知识库内容回答用户问题。如果知识库内容不足以回答问题，请结合你的专业知识进行补充。

【用户问题】
服务器内存使用率超过90%怎么处理？
```

## 17.5 向量检索 vs 关键词检索对比

| 维度 | 关键词检索（本地） | 向量检索（QAnything） |
|------|-------------------|----------------------|
| 匹配方式 | 字符串包含 | 语义向量相似度 |
| 同义词识别 | 不支持 | 支持（"CPU高" 匹配 "处理器占用"） |
| 错别字容忍 | 不支持 | 部分支持 |
| 评分精度 | 中（基于词频） | 高（基于语义距离） |
| 部署要求 | 无（纯 SQLite） | 需要 QAnything 服务 |
| 响应速度 | 快（内存计算） | 中等（网络+向量计算） |
| 知识规模 | 适合数百~数千条 | 适合数万~数百万条 |
| 适用场景 | 结构化FAQ、操作手册 | 技术文档、故障案例 |

## 17.6 数据库表结构

### 17.6.1 知识基础表

```sql
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '未分类',
  tags TEXT NOT NULL DEFAULT '[]',
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 17.6.2 配置存储

```sql
-- settings 表中存储以下配置
-- key = 'qanything_config'
-- value = JSON 字符串:
{
  "enabled": true,
  "apiBase": "http://localhost:8777",
  "apiKey": "sk-xxx...",
  "kbId": "kb_xxx",
  "mode": "local",
  "topK": 5
}
```

## 17.7 完整调用链路

以 Agent 执行一次用户问题为例：

```
1. 用户通过 Agent 提问："如何排查 Nginx 502 错误？"

2. llmService.executeAgentWithLLM(agent, userInput) 被调用

3. 知识检索阶段：
   ├── 尝试 QAnything 向量检索
   │   ├── qanythingService.isEnabled() → true
   │   ├── queryKnowledge("如何排查 Nginx 502 错误？", topK=5)
   │   │   ├── POST /api/local_doc_qa/local_doc_chat
   │   │   │   { question: "如何排查 Nginx 502 错误？", top_k: 5 }
   │   │   ├── 响应: 3条相关知识片段
   │   │   └── 返回拼接的知识文本
   │   └── knowledgeContext = "Nginx 502 Bad Gateway 通常表示..."
   │
   └── 如果 QAnything 失败：
       ├── 本地 EnhancedRAGService.search()
       │   ├── 查询 knowledge_base 表
       │   ├── 计算评分（精确匹配+关键词+频率+时间衰减）
       │   └── 返回 Top 5 高分结果
       └── 如果本地也无结果：
           └── localRuleEngine.recommendKnowledge()

4. 构建增强 Prompt：
   enhancedPrompt = 
     "你是一个专业的IT运维助手..."           ← Agent System Prompt
     + "\n\n【相关知识库内容】\n..."         ← QAnything 检索结果
     + "\n\n【用户问题】\n如何排查 Nginx 502 错误？"

5. 调用 LLM API（Doubao/OpenAI/LocalAI）

6. 返回 LLM 的回答

7. 使用过的知识条目 usage_count +1
```

## 本章小结

本章深入讲解了 ITOps Agent Platform 的知识库与 RAG 系统实现：

- **RAG 架构**：三层降级策略（QAnything 向量检索 → 本地规则推荐 → 纯 LLM），确保知识检索的可靠性
- **本地知识库**：基于 SQLite 的关键词检索系统，包含四维度评分算法（精确匹配 0.5 + 关键词 0.3 + 使用频率 0.15 + 时间衰减 0.05）、停用词过滤、高亮片段生成、使用频率自动统计
- **QAnything 集成**：向量语义检索，支持文档上传、状态查询、删除、健康检查；指数退避重试机制；多种响应格式适配
- **知识注入**：检索结果格式化为结构化的 Prompt 片段，包含相关度百分比、标题、高亮上下文，引导 LLM 基于知识回答
- **知识管理**：添加知识（自动标签提取）、批量导入、相似知识推荐、分类统计、Top 使用排行
- **降级策略**：QAnything 失败时不阻塞执行，自动降级到本地知识库或纯 LLM 回答

## 本章练习

### 基础练习

1. **自定义评分权重**：在 `calculateRelevanceScore` 方法中，让精确匹配的权重可配置（通过选项参数传入），而不是硬编码 0.5。实现一个 `ScoringConfig` 接口，允许调用者自定义四个维度的权重。

2. **知识全文搜索增强**：在现有的关键词匹配基础上，增加 TF-IDF 评分机制。为 `knowledge_base` 表中的每个词预计算词频和逆文档频率，在 `search` 方法中结合 TF-IDF 分数与现有评分。

3. **QAnything 多知识库支持**：修改 `QAnythingConfig` 支持多个知识库（`kbIds: string[]`），在 `queryKnowledge` 方法中允许指定知识库ID列表，实现跨库检索。

### 进阶练习

4. **知识质量评估**：为知识条目添加质量评分机制。当 LLM 使用某条知识回答问题后，通过用户反馈（点赞/点踩）更新知识的质量分数。实现一个基于反馈的知识排序系统，高质量知识在搜索结果中排名更高。

5. **增量知识同步**：设计一个定时任务，从外部系统（如 Confluence、Wiki、GitLab Wiki）自动同步知识到本地 `knowledge_base` 表。实现增量同步逻辑（只同步更新过的内容）、冲突解决策略（本地修改 vs 远程更新）和同步日志记录。

6. **知识图谱关联**：在知识条目之间建立语义关联关系（如"前置知识"、"相关故障"、"解决方案"）。设计 `knowledge_relations` 表，实现自动关系发现（基于内容相似度）和手动关系维护，在检索时返回关联知识。

### 思考题

7. **向量检索的局限性**：虽然向量检索能够理解语义相似度，但在运维场景中，精确的技术术语（如错误码 "502"、配置项 "proxy_pass"、命令 "systemctl restart nginx"）的精确匹配往往比语义匹配更重要。讨论如何在向量检索的基础上增强术语精确匹配能力，是否应该采用"向量+BM25"的混合检索方案，以及各自的优缺点。

8. **知识库生命周期管理**：知识会过期（如旧版本的操作手册、已废弃的配置方法）。讨论如何设计知识库的生命周期管理机制，包括：知识有效期标注、过期知识自动归档、版本历史记录、知识失效通知、基于使用频率和时间的知识健康度评分。

## 延伸阅读

- **RAG 论文原文**: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (Lewis et al., 2020) - RAG 概念的原始论文
- **QAnything 官方文档**: <https://github.com/netease-youdao/QAnything> - QAnything 部署指南、API 文档、架构说明
- **向量数据库对比**: Milvus、Pinecone、Chroma、Weaviate 等向量数据库的特性对比
- **BM25 算法**: Okapi BM25 排名函数的原理与实现，文本检索的经典算法
- **提示工程最佳实践**: Anthropic/Claude 提示工程指南 - 如何设计有效的知识注入 Prompt
- **知识管理最佳实践**: Atlassian Confluence 知识库管理指南
