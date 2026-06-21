# 知识库域实体定义

## 1. KnowledgeItem（知识条目）
核心实体，存储知识库中的单个条目。

```typescript
interface KnowledgeItem {
  id: string;           // UUID主键
  title: string;        // 标题
  content: string;      // 内容
  category: string;     // 分类
  tags: string[];       // 标签数组
  usageCount: number;   // 使用次数
  createdAt: string;    // 创建时间
  updatedAt: string;    // 更新时间
}
```

## 2. SearchResult（搜索结果）
搜索结果实体，包含相关性评分和高亮片段。

```typescript
interface SearchResult {
  item: KnowledgeItem;  // 知识条目
  score: number;        // 相关性评分（0-1）
  highlight: string;    // 高亮片段
}
```

## 3. QAnythingConfig（QAnything配置）
外部知识库集成配置。

```typescript
interface QAnythingConfig {
  enabled: boolean;     // 是否启用
  apiBase: string;      // API基础URL
  apiKey: string;       // API密钥
  kbId: string;         // 知识库ID
  mode: 'local' | 'cloud'; // 部署模式
  topK: number;         // 返回结果数量
}
```

## 4. KnowledgeBaseRecord（数据库记录）
SQLite数据库中的原始记录格式。

```typescript
interface KnowledgeBaseRecord {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string;         // JSON字符串格式
  usage_count: number;
  created_at: string;
  updated_at: string;
  solutions?: string;   // JSON字符串格式
  related_alerts?: string; // JSON字符串格式
}
```

## 5. KnowledgeStats（知识统计）
知识库统计信息。

```typescript
interface KnowledgeStats {
  totalItems: number;
  categoryStats: Array<{
    category: string;
    count: number;
  }>;
  topItems: KnowledgeItem[];
}
```

## 6. BatchImportResult（批量导入结果）
批量导入操作的结果。

```typescript
interface BatchImportResult {
  imported: number;     // 成功导入数量
  failed: number;       // 失败数量
}
```

## 7. ConnectionTestResult（连接测试结果）
QAnything连接测试结果。

```typescript
interface ConnectionTestResult {
  success: boolean;
  message: string;
}
```

## 8. DocumentUploadResult（文档上传结果）
QAnything文档上传结果。

```typescript
interface DocumentUploadResult {
  fileId: string;
  status: string;
}
```

## 数据库表结构
```sql
CREATE TABLE knowledge_base (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT '未分类',
  tags TEXT DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime')),
  solutions TEXT DEFAULT '[]',
  related_alerts TEXT DEFAULT '[]'
);
```