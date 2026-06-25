# 工作流域 API 定义

## 工作流 API

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/workflows | - | 获取所有工作流 |
| GET | /api/workflows/:id | - | 获取单个工作流 |
| POST | /api/workflows | admin/operator | 创建工作流 |
| PUT | /api/workflows/:id | admin/operator | 更新工作流 |
| DELETE | /api/workflows/:id | admin/operator | 删除工作流 |
| POST | /api/workflows/import | admin/operator | 导入工作流 |
| GET | /api/workflows/export/:id | - | 导出工作流 |

### 请求示例

**创建工作流 POST /api/workflows**
```json
{
  "name": "服务器巡检",
  "description": "定期巡检服务器状态",
  "nodes": [
    {
      "id": "node-1",
      "type": "agent",
      "data": { "label": "检查CPU", "agentId": "agent-id" },
      "position": { "x": 100, "y": 100 }
    }
  ],
  "edges": [],
  "agent_configs": {},
  "is_template": false
}
```

**响应格式**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "服务器巡检", ... }
}
```

---

## 审批 API

| 方法 | 端点 | 权限 | 说明 |
|------|------|------|------|
| GET | /api/approvals | admin/operator | 获取审批列表 |
| GET | /api/approvals/pending/count | admin/operator | 待审批数量 |
| GET | /api/approvals/:id | admin/operator | 审批详情 |
| POST | /api/approvals/:id/approve | admin/operator | 审批通过 |
| POST | /api/approvals/:id/reject | admin/operator | 审批拒绝 |

### 查询参数

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 筛选状态 |
| limit | number | 返回数量 |

### 请求示例

**审批通过 POST /api/approvals/:id/approve**
```json
{
  "comment": "同意执行"
}
```

**审批拒绝 POST /api/approvals/:id/reject**
```json
{
  "reason": "操作风险过高"
}
```

---

## WebSocket 事件

### 任务事件

| 事件 | 方向 | 说明 |
|------|------|------|
| task:subscribe | C→S | 订阅任务 |
| task:started | S→C | 任务开始 |
| task:completed | S→C | 任务完成 |
| task:failed | S→C | 任务失败 |

### 节点事件

| 事件 | 方向 | 说明 |
|------|------|------|
| task:node:started | S→C | 节点开始 |
| task:node:thinking | S→C | 思考过程 |
| task:node:output | S→C | 节点输出 |
| task:node:completed | S→C | 节点完成 |

### 审批事件

| 事件 | 方向 | 说明 |
|------|------|------|
| task:approval:requested | S→C | 审批请求 |
| task:approval:resolved | S→C | 审批结果 |
| approval:new | S→C | 新审批通知 |
