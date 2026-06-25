# 知识库域服务接口

## 1. EnhancedRAGService（增强检索服务）
本地知识库的智能检索和增强服务。

### 核心方法
```typescript
class EnhancedRAGService {
  // 智能检索
  async search(query: string, options?: {
    category?: string;
    limit?: number;
    minScore?: number;
  }): Promise<SearchResult[]>;

  // 知识注入（RAG）
  async injectKnowledge(query: string, options?: {
    category?: string;
    maxItems?: number;
    minScore?: number;
  }): Promise<{ hasKnowledge: boolean; prompt: string }>;

  // 获取相似知识
  async getSimilarKnowledge(knowledgeId: string, limit?: number): Promise<KnowledgeItem[]>;

  // 添加知识
  async addKnowledge(title: string, content: string, category?: string, tags?: string[]): Promise<string>;

  // 批量导入
  async batchImport(items: Array<{
    title: string;
    content: string;
    category?: string;
    tags?: string[];
  }>): Promise<{ imported: number; failed: number }>;

  // 获取统计信息
  getStatistics(): KnowledgeStats;
}
```

### 评分算法
1. **TF-IDF相似度**（权重0.4）：基于词频-逆文档频率的相似度计算
2. **精确匹配**（权重0.3）：查询词在文档中的完全匹配
3. **标题匹配**（权重0.2）：查询词在标题中的匹配程度
4. **使用频率**（权重0.05）：知识条目的使用次数
5. **时间衰减**（权重0.05）：基于创建时间的新鲜度

## 2. QAnythingService（外部知识库服务）
与QAnything外部知识库集成的服务。

### 核心方法
```typescript
class QAnythingService {
  // 查询知识库
  async queryKnowledge(question: string, topK?: number): Promise<string>;

  // 上传文档
  async uploadDocument(file: Buffer, fileName: string): Promise<DocumentUploadResult>;

  // 获取文档状态
  async getDocumentStatus(fileId: string): Promise<{ status: string; fileName: string }>;

  // 删除文档
  async deleteDocument(fileId: string): Promise<void>;

  // 测试连接
  async testConnection(): Promise<ConnectionTestResult>;

  // 检查是否启用
  isEnabled(): boolean;

  // 获取配置的topK值
  getTopK(): number;

  // 清除配置缓存
  clearConfigCache(): void;
}
```

### 特性
- **重试机制**：支持2次重试，指数退避延迟
- **配置缓存**：带缓存的配置加载
- **连接测试**：健康检查端点测试
- **文件类型支持**：PDF、Word、Excel、PPT、Markdown、TXT等

## 3. 服务依赖关系
```
KnowledgeRoutes → EnhancedRAGService → 本地知识库
KnowledgeRoutes → QAnythingService → 外部QAnything API
KnowledgeRoutes → LocalRuleEngine → 规则引擎
```

## 4. 配置管理
- QAnything配置存储在`settings`表中
- 配置键：`qanything_config`
- 支持运行时更新和缓存清除

## 5. 错误处理
- 网络请求超时：30秒
- 文档上传超时：120秒
- API密钥验证：检查有效性和脱敏值
- 降级策略：QAnything不可用时回退到本地知识库