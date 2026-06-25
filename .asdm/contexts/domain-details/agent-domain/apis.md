# Agent 域 - API 定义

> **层级**：L3 详细内容
> **大小**：< 5KB

## API 概览

| Method | Path | 描述 | 认证 |
|--------|------|------|------|
| GET | `/api/agents` | 获取 Agent 列表 | JWT |
| GET | `/api/agents/stats/summary` | 获取统计信息 | JWT |
| GET | `/api/agents/:id` | 获取单个 Agent | JWT |
| GET | `/api/agents/:id/executions` | 获取执行历史 | JWT |
| GET | `/api/agents/:id/test-input` | 获取推荐测试输入 | JWT |
| POST | `/api/agents` | 创建 Agent | JWT (admin/operator) |
| POST | `/api/agents/:id/test` | 测试 Agent | JWT |
| POST | `/api/agents/import` | 导入 Agent | JWT |
| PUT | `/api/agents/:id` | 更新 Agent | JWT (admin/operator) |
| DELETE | `/api/agents/:id` | 删除 Agent | JWT (admin/operator) |
| GET | `/api/agents/export/:id` | 导出 Agent | JWT |

## API 详情

### GET /api/agents

获取 Agent 列表，支持筛选和搜索。

**查询参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| category | string | 否 | 按分类筛选 |
| enabled | boolean | 否 | 按启用状态筛选 |
| search | string | 否 | 搜索关键词 |

**响应示例**：

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "告警处理Agent",
      "role": "告警分析师",
      "category": "alert",
      "enabled": 1,
      "usage_count": 100,
      "tags": ["告警", "分析"],
      "primary_model_name": "doubao-4o",
      "fallback_model_name": "gpt-4o"
    }
  ]
}
```

### POST /api/agents/:id/test

测试 Agent 执行。

**请求体**：

```json
{
  "input": "服务器CPU使用率异常",
  "serverId": "server-uuid",        // 可选
  "serverIds": ["uuid1", "uuid2"],  // 可选，批量
  "databaseId": "db-uuid",          // 可选，数据库运维
  "context": {}                     // 可选，额外上下文
}
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "executionId": "uuid",
    "output": "## 分析报告\n\n...",
    "status": "success",
    "executionTime": 2500,
    "metadata": {
      "serverId": "server-uuid",
      "databaseId": null
    }
  }
}
```

### POST /api/agents

创建新 Agent。

**请求体**：

```json
{
  "name": "自定义Agent",
  "role": "运维助手",
  "system_prompt": "你是一个专业的IT运维助手...",
  "model": "doubao-4o",
  "temperature": 0.7,
  "enabled": true,
  "category": "custom",
  "tags": ["自定义"],
  "description": "自定义运维助手",
  "api_provider": "volcengine",
  "primary_model_id": "model-uuid",
  "fallback_model_id": "fallback-uuid"
}
```

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 权限不足 |
| 404 | Agent 不存在 |
| 500 | 服务器内部错误 |

---

*生成时间：2026-06-21*
