# AI 模型池管理功能 - 开发文档

## 1. 概述

### 1.1 目标
实现统一的 AI 模型池管理系统，支持用户添加、管理多个 AI 模型，并为 Agent 提供灵活的模型选择能力。

### 1.2 核心改进
- 从"固定3个提供商"升级为"可添加任意数量模型"
- 支持 API Key 继承机制，减少重复配置
- 模型连通性测试验证
- 拖拽排序定义优先级
- Agent 支持主备模型降级链

---

## 2. 数据库设计

### 2.1 新增表：`ai_models`

```sql
CREATE TABLE ai_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                 -- 显示名称，如 "豆包-DeepSeek-V4-Pro"
  provider_type TEXT NOT NULL,        -- 'doubao' | 'openai' | 'local'
  api_key TEXT,                       -- 独立 API Key（可为空，为空则使用 settings 表全局配置）
  api_base TEXT,                      -- 独立 API Base URL（可为空）
  model_id TEXT NOT NULL,             -- 实际模型标识，如 "deepseek-v4-pro-260425"
  enabled INTEGER DEFAULT 1,          -- 启用状态：1=启用，0=禁用
  sort_order INTEGER DEFAULT 0,       -- 排序优先级，数字越小越优先（用于拖拽排序）
  is_default INTEGER DEFAULT 0,       -- 是否为默认模型：1=默认，0=非默认
  tags TEXT,                          -- JSON 数组，如 ["高性价比","代码生成"]
  last_test_status TEXT,              -- 最后测试状态：'success' | 'failed' | null
  last_test_time DATETIME,            -- 最后测试时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_models_enabled ON ai_models(enabled);
CREATE INDEX idx_ai_models_provider ON ai_models(provider_type);
CREATE INDEX idx_ai_models_sort ON ai_models(sort_order);
CREATE INDEX idx_ai_models_default ON ai_models(is_default);
```

### 2.2 修改表：`agents`

```sql
-- 移除 api_provider 字段（不再需要）
-- 修改 model 字段含义：从模型ID改为引用 ai_models.id

ALTER TABLE agents ADD COLUMN primary_model_id TEXT;
ALTER TABLE agents ADD COLUMN fallback_model_id TEXT;

CREATE INDEX idx_agents_primary_model ON agents(primary_model_id);
CREATE INDEX idx_agents_fallback_model ON agents(fallback_model_id);
```

---

## 3. API 接口设计

### 3.1 AI 模型管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai-models` | 获取所有模型列表（按 sort_order 排序） |
| GET | `/api/ai-models/:id` | 获取单个模型详情 |
| POST | `/api/ai-models` | 添加新模型 |
| PUT | `/api/ai-models/:id` | 更新模型配置 |
| DELETE | `/api/ai-models/:id` | 删除模型 |
| POST | `/api/ai-models/:id/test` | 测试模型连通性 |
| PUT | `/api/ai-models/reorder` | 批量更新排序 |

### 3.2 请求/响应示例

**添加模型**
```json
POST /api/ai-models
{
  "name": "豆包-DeepSeek-V4-Pro",
  "provider_type": "doubao",
  "model_id": "deepseek-v4-pro-260425",
  "use_global_config": true,          // 是否使用全局配置（settings表）
  "api_key": "",                      // 仅当 use_global_config=false 时必填
  "api_base": "",
  "tags": ["代码生成", "高性价比"]
}
```

**测试连通性**
```json
POST /api/ai-models/:id/test
// 响应
{
  "success": true,
  "data": {
    "status": "success",
    "latency_ms": 1234,
    "message": "模型连接正常"
  }
}
```

---

## 4. 业务逻辑

### 4.1 API Key 继承逻辑

```typescript
function getEffectiveApiKey(model: AIModel): string {
  // 1. 如果模型配置了独立 API Key，优先使用
  if (model.api_key && model.api_key.trim() !== '') {
    return model.api_key;
  }
  
  // 2. 否则使用 settings 表的全局配置
  return getGlobalApiKey(model.provider_type);
}

function getEffectiveApiBase(model: AIModel): string {
  if (model.api_base && model.api_base.trim() !== '') {
    return model.api_base;
  }
  return getGlobalApiBase(model.provider_type);
}
```

### 4.2 默认模型选择逻辑

```typescript
function getDefaultModel(): AIModel | null {
  // 1. 优先返回标记为 is_default=1 的启用模型
  let defaultModel = db.prepare(`
    SELECT * FROM ai_models 
    WHERE enabled = 1 AND is_default = 1 
    ORDER BY sort_order ASC 
    LIMIT 1
  `).get() as AIModel | undefined;
  
  if (defaultModel) return defaultModel;
  
  // 2. 如果没有默认模型，返回排序最靠前的启用模型
  return db.prepare(`
    SELECT * FROM ai_models 
    WHERE enabled = 1 
    ORDER BY sort_order ASC 
    LIMIT 1
  `).get() as AIModel | undefined;
}
```

### 4.3 Agent 执行时的模型选择

```typescript
async function executeAgentWithLLM(agentId: string, userInput: string): Promise<string> {
  const agent = getAgent(agentId);
  
  // 1. 尝试主模型
  if (agent.primary_model_id) {
    try {
      const model = getModel(agent.primary_model_id);
      if (model && model.enabled) {
        return await callModelAPI(model, agent, userInput);
      }
    } catch (error) {
      logger.warn(`主模型执行失败，尝试备选模型: ${error.message}`);
    }
  }
  
  // 2. 尝试备选模型
  if (agent.fallback_model_id) {
    try {
      const model = getModel(agent.fallback_model_id);
      if (model && model.enabled) {
        return await callModelAPI(model, agent, userInput);
      }
    } catch (error) {
      logger.warn(`备选模型执行失败: ${error.message}`);
    }
  }
  
  // 3. 降级到默认模型
  const defaultModel = getDefaultModel();
  if (defaultModel) {
    return await callModelAPI(defaultModel, agent, userInput);
  }
  
  throw new Error('没有可用的 AI 模型，请先配置模型');
}
```

---

## 5. 前端设计

### 5.1 页面结构

```
设置
├── AI模型管理（新增）
│   ── 模型列表（表格/卡片）
│       ├── 添加模型按钮
│       ├── 每行操作：测试 | 编辑 | 启用/禁用 | 删除
│       └── 拖拽排序手柄
├── API密钥配置（保留，作为全局默认配置）
── 其他设置...

Agent管理
── Agent列表
└── 编辑Agent弹窗
    ├── 主模型下拉（从ai_models表加载）
    ├── 备选模型下拉（可选）
    └── 其他配置...
```

### 5.2 添加模型弹窗表单

```
─────────────────────────────────────────────┐
│ 添加 AI 模型                                 │
─────────────────────────────────────────────┤
│ 显示名称 *                                   │
│ [豆包-DeepSeek-V4-Pro          ]            │
│                                             │
│ 提供商类型 *                                 │
│ [▼ 豆包 (火山引擎)            ]              │
│                                             │
│ 模型 ID *                                    │
│ [deepseek-v4-pro-260425       ]              │
│                                             │
│ □ 使用独立 API 配置                          │
│   （不勾选则使用全局配置）                   │
│                                             │
│ 独立 API Key（选填）                         │
│ [sk-xxxxxxxxxxxxxxxx          ]              │
│                                             │
│ 独立 API Base URL（选填）                    │
│ [https://...                  ]              │
│                                             │
│ 标签（逗号分隔）                             │
│ [代码生成,高性价比            ]              │
│                                             │
│          [取消]        [保存并测试]           │
└─────────────────────────────────────────────
```

---

## 6. 实施计划

### 阶段 1：数据库与后端基础（优先级：高）
- [ ] 创建数据库迁移 v003：新增 `ai_models` 表
- [ ] 创建数据库迁移 v004：`agents` 表添加 `primary_model_id` / `fallback_model_id`
- [ ] 实现数据迁移脚本：将 settings 表旧配置迁移为 ai_models 记录
- [ ] 实现 AI 模型 CRUD API
- [ ] 实现模型测试 API
- [ ] 实现排序 API
- [ ] 修改 `llmService.ts`：支持从 ai_models 表加载配置

### 阶段 2：前端模型管理页面（优先级：高）
- [ ] 创建 `AIModels.tsx` 页面
- [ ] 实现模型列表展示（含状态、测试按钮）
- [ ] 实现添加/编辑模型弹窗
- [ ] 实现拖拽排序功能
- [ ] 实现启用/禁用/删除操作

### 阶段 3：Agent 模型选择（优先级：中）
- [ ] 修改 Agent 编辑弹窗：主模型/备选模型下拉
- [ ] 移除 `api_provider` 字段相关逻辑
- [ ] 修改 Agent 列表展示模型信息
- [ ] 实现 Agent 执行时的模型降级逻辑

### 阶段 4：测试与优化（优先级：中）
- [ ] 端到端测试：添加模型 → 测试连通 → 配置Agent → 执行命令
- [ ] 兼容性测试：旧 Agent 数据自动适配
- [ ] 性能优化：模型列表缓存
- [ ] 文档更新

---

## 7. 兼容性处理

### 7.1 旧数据迁移

系统启动时自动执行迁移：
```typescript
function migrateOldConfigToAIModels(): void {
  // 1. 迁移豆包配置
  const doubaoKey = getSetting('DOUBAO_API_KEY');
  const doubaoModel = getSetting('DOUBAO_MODEL');
  if (doubaoKey && doubaoKey !== 'your-doubao-api-key-here') {
    createAIModel({
      name: '豆包 (默认)',
      provider_type: 'doubao',
      model_id: doubaoModel || 'doubao-4o',
      sort_order: 0,
      is_default: 1
    });
  }
  
  // 2. 迁移 OpenAI 配置
  // 3. 迁移本地 AI 配置
}
```

### 7.2 旧 Agent 适配

```sql
-- 迁移脚本：将使用 api_provider 的 Agent 转换为使用 primary_model_id
UPDATE agents 
SET primary_model_id = (
  SELECT id FROM ai_models 
  WHERE provider_type = agents.api_provider AND is_default = 1
  LIMIT 1
)
WHERE primary_model_id IS NULL AND api_provider IS NOT NULL;
```

---

## 8. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 迁移脚本失败导致旧配置丢失 | 高 | 迁移前备份数据库，失败时回滚 |
| 模型测试API阻塞主线程 | 中 | 使用异步测试，超时控制30秒 |
| 前端拖拽排序与后端不同步 | 中 | 排序操作立即同步到后端 |
| Agent执行时模型切换延迟 | 低 | 缓存模型配置，减少数据库查询 |

---

## 9. 后续扩展

- 模型使用统计（调用次数、Token消耗）
- 模型分组/项目隔离
- API Key 轮换机制
- 模型性能监控告警
