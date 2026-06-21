# 知识库域API定义

## 1. 知识条目管理API

### GET /api/knowledge
获取知识库条目列表。

**查询参数：**
- `category`：分类过滤
- `search`：搜索关键词

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "标题",
      "content": "内容",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "solutions": ["解决方案1"],
      "related_alerts": ["告警ID1"],
      "usage_count": 10,
      "created_at": "2024-01-01 10:00:00",
      "updated_at": "2024-01-01 10:00:00"
    }
  ]
}
```

### POST /api/knowledge
创建新知识条目。

**请求体：**
```json
{
  "title": "标题",
  "category": "分类",
  "tags": ["标签1", "标签2"],
  "content": "内容",
  "solutions": ["解决方案1"],
  "related_alerts": ["告警ID1"]
}
```

**响应：**
```json
{
  "success": true,
  "data": { "id": "uuid", "..." : "..." }
}
```

### PUT /api/knowledge/:id
更新知识条目。

**路径参数：**
- `id`：知识条目ID

**请求体：** 同POST请求体

**响应：**
```json
{
  "success": true,
  "data": { "id": "uuid", "..." : "..." }
}
```

### DELETE /api/knowledge/:id
删除知识条目。

**路径参数：**
- `id`：知识条目ID

**响应：**
```json
{
  "success": true,
  "message": "Knowledge entry deleted"
}
```

## 2. 知识检索API

### GET /api/knowledge/search
搜索知识条目。

**查询参数：**
- `q`：搜索查询（必需）

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "标题",
      "content": "内容",
      "category": "分类",
      "tags": ["标签1", "标签2"],
      "usage_count": 10,
      "created_at": "2024-01-01 10:00:00",
      "updated_at": "2024-01-01 10:00:00"
    }
  ]
}
```

## 3. 认证要求
所有API都需要认证token，通过`Authorization`头传递。

**认证中间件：**
```typescript
router.use(authenticateToken);
```

## 4. 错误响应
所有API在错误时返回：
```json
{
  "success": false,
  "error": "错误信息"
}
```

**常见HTTP状态码：**
- 200：成功
- 201：创建成功
- 400：请求参数错误
- 401：未认证
- 500：服务器内部错误

## 5. 数据格式
- JSON格式请求和响应
- 日期格式：`YYYY-MM-DD HH:mm:ss`
- 数组字段使用JSON字符串存储，返回时解析为数组

## 6. 查询优化
- 按使用次数排序：`ORDER BY usage_count DESC`
- 按创建时间排序：`ORDER BY created_at DESC`
- 搜索支持标题和内容的模糊匹配：`LIKE %keyword%`