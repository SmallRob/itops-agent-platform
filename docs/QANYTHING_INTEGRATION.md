# 知识库对接 QAnything 开发文档

## 📋 文档信息

| 项目 | 详情 |
|------|------|
| **文档版本** | v1.0 |
| **创建日期** | 2026-05-26 |
| **最后更新** | 2026-05-26 |
| **状态** | 待实施 |
| **优先级** | P1（重要功能） |

---

## 📚 目录

- [概述](#概述)
- [QAnything 简介](#qanything-简介)
- [对接可行性分析](#对接可行性分析)
- [对接方案](#对接方案)
- [技术实现](#技术实现)
- [API 接口说明](#api-接口说明)
- [实施计划](#实施计划)
- [安全注意事项](#安全注意事项)
- [FAQ](#faq)

---

## 概述

### 背景

当前项目的运维知识库仅支持手动添加文本条目（22 条预设），存在以下痛点：

| 痛点 | 说明 |
|------|------|
| **格式单一** | 仅支持纯文本，不支持 PDF/Word/Excel 等常见格式 |
| **维护成本高** | 需要手动一条条添加和更新 |
| **检索能力有限** | 仅基于关键词 + 简单语义相似度 |
| **数据量受限** | 预设 22 条，扩展性差 |

### 目标

通过对接 QAnything，实现：
- ✅ 支持任意格式文档上传（PDF/Word/Excel/Markdown 等）
- ✅ 自动解析和索引，无需手动维护
- ✅ 两阶段检索（Embedding + Rerank），更精准
- ✅ 知识库无上限，数据越多效果越好

---

## QAnything 简介

### 什么是 QAnything？

QAnything（Question and Answer based on Anything）是由网易有道开源的企业级本地知识库问答系统，基于 RAG（Retrieval-Augmented Generation）技术构建。

### 核心特性

| 特性 | 说明 |
|------|------|
| **多格式支持** | PDF/Word/Excel/PPT/Markdown/TXT/图片/网页链接 |
| **两阶段检索** | Embedding 粗排 + Rerank 精排，准确率更高 |
| **数据越多越准** | 随着数据量增加，检索准确率不降反升 |
| **纯本地部署** | 数据完全不出服务器，符合企业安全要求 |
| **API 完善** | 提供完整的 REST API，支持知识库管理、文档上传、问答 |
| **跨语种问答** | 支持中英文混合问答 |

### 技术架构

```
┌─────────────────────────────────────────┐
│           QAnything 架构                 │
├─────────────────────────────────────────
│  应用层：Web UI / API / Agent 接入       │
─────────────────────────────────────────┤
│  RAG 层：两阶段检索（Embedding + Rerank）│
─────────────────────────────────────────┤
│  存储层：向量数据库 + 关系数据库          │
├─────────────────────────────────────────┤
│  模型层：BCEmbedding + BGE-Reranker      │
└─────────────────────────────────────────
```

---

## 对接可行性分析

### 对比现有知识库 vs QAnything

| 功能维度 | 现有知识库 | QAnything | 提升 |
|---------|-----------|-----------|------|
| **数据格式** | 纯文本 | PDF/Word/Excel/Markdown 等 | ⭐⭐⭐⭐⭐ |
| **检索方式** | 关键词 + 简单语义 | 两阶段检索（Embedding + Rerank） | ⭐⭐⭐⭐ |
| **数据量** | 22 条预设 | 无上限 | ⭐⭐⭐⭐⭐ |
| **维护方式** | 手动逐条添加 | 上传文档，自动解析 | ⭐⭐⭐⭐ |
| **部署方式** | 内置 SQLite | 云端 API 或本地 Docker | ⭐⭐⭐⭐ |
| **准确率** | 一般 | 数据越多越准 | ⭐⭐⭐⭐ |

### 优势总结

1. **解决现有痛点**：运维人员可以直接上传运维手册、故障处理流程等文档，无需手动维护
2. **技术成熟稳定**：QAnything 已开源且社区活跃，API 完善
3. **部署灵活**：支持云端 API 和本地 Docker 两种模式
4. **数据安全可控**：本地部署版本数据 100% 不出服务器

---

## 对接方案

### 方案一：云端 QAnything API（简单）

```
┌─────────────────┐         ┌─────────────────┐
│  ITOps 运维平台  │ ────→ │ QAnything 云端  │
│                 │  API    │                 │
│  Agent 执行     │ ────→ │ 知识库检索       │
└─────────────────┘         └─────────────────┘
```

**特点**：
- ✅ 零运维成本
- ✅ 快速接入
- ⚠️ 数据需要传到第三方服务器

**API 端点**：
- 知识库管理：`https://openapi.youdao.com/q_anything/api/*`
- 问答接口：`https://openapi.youdao.com/q_anything/api/agent_qa`

---

### 方案二：本地部署 QAnything（推荐）

```
┌───────────────────────────────────────────┐
│             服务器本地环境                  │
├───────────────────────────────────────────┤
│  ──────────────┐      ┌──────────────┐   │
│  │ ITOps 运维平台│ ←──→│ QAnything    │   │
│  │              │ API  │ (Docker)     │   │
│  │ Agent 执行   │ ───→ │ 知识库检索   │   │
│  └──────────────      └──────────────┘   │
└───────────────────────────────────────────┘
```

**特点**：
- ✅ 数据 100% 不出服务器
- ✅ 符合企业安全要求
- ✅ 无需外网环境
- ⚠️ 需要额外服务器资源

**部署命令**：
```bash
docker run -d \
  --name qanything \
  -p 8777:8777 \
  -p 5052:5052 \
  -v /opt/qanything/config:/app/config \
  neteaseyoudao/qanything:latest
```

**API 端点**：`http://localhost:8777/api/*`

---

### 方案三：混合模式（最佳）

```
                    ┌─────────────────┐
运维知识库 Agent ───┤   检索策略选择   │
                    └───────┬─────────
                             │
              ┌────────────────────────────┐
              ↓              ↓              ↓
         SQLite 内置    QAnything 本地    QAnything 云端
        (快速简单)     (安全私有)       (不限容量)
```

**特点**：
- ✅ 灵活切换检索源
- ✅ 降级兜底
- ✅ 适应不同场景

---

## 技术实现

### 1. 新增 QAnything 配置入口

在 **设置 → AI 配置** 页面增加以下配置项：

```json
{
  "qanything_config": {
    "enabled": false,
    "api_base": "http://localhost:8777",
    "api_key": "管理秘钥",
    "kb_id": "KB248e8e079642491383596f63c2ab069a_240430",
    "mode": "local",
    "top_k": 5
  }
}
```

| 字段 | 说明 | 必填 |
|------|------|------|
| `enabled` | 是否启用 QAnything | 是 |
| `api_base` | API 地址 | 是 |
| `api_key` | 管理秘钥 | 是 |
| `kb_id` | 知识库 ID | 是 |
| `mode` | 部署模式：`local` 或 `cloud` | 是 |
| `top_k` | 检索返回的最多相关片段数 | 否（默认 5） |

---

### 2. 新增 `qanythingService.ts` 服务层

```typescript
// backend/src/services/qanythingService.ts

import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import db from '../models/database';

interface QAnythingConfig {
  enabled: boolean;
  apiBase: string;
  apiKey: string;
  kbId: string;
  mode: 'local' | 'cloud';
  topK: number;
}

class QAnythingService {
  private config: QAnythingConfig | null = null;

  /**
   * 加载配置
   */
  private loadConfig(): QAnythingConfig | null {
    try {
      const setting = db.prepare(
        "SELECT value FROM settings WHERE key = 'qanything_config'"
      ).get() as { value: string } | undefined;
      
      if (!setting) return null;
      
      return JSON.parse(setting.value) as QAnythingConfig;
    } catch (error) {
      logger.error('Failed to load QAnything config:', error);
      return null;
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config?.enabled || false;
  }

  /**
   * 查询知识库
   * @param question 用户问题
   * @param topK 返回的最多相关片段数
   * @returns 检索到的相关知识内容
   */
  async queryKnowledge(question: string, topK?: number): Promise<string> {
    const config = this.loadConfig();
    if (!config || !config.enabled) {
      throw new Error('QAnything is not enabled');
    }

    const k = topK || config.topK || 5;

    try {
      logger.info(`🔍 Querying QAnything knowledge base: ${question}`);
      
      const response = await axios.post(
        `${config.apiBase}/api/local_doc_qa/local_doc_chat`,
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
          timeout: 30000
        }
      );

      if (response.data.code !== 200) {
        throw new Error(`QAnything API error: ${response.data.msg}`);
      }

      // 提取检索结果
      const chunks = response.data.data?.response || [];
      if (chunks.length === 0) {
        logger.info('📭 No relevant knowledge found in QAnything');
        return '';
      }

      // 合并相关片段
      const context = chunks.map((chunk: any) => chunk.content).join('\n\n');
      logger.info(`📚 Found ${chunks.length} relevant chunks from QAnything`);
      
      return context;

    } catch (error: any) {
      logger.error('❌ QAnything query failed:', error.message);
      throw error;
    }
  }

  /**
   * 上传文档到知识库
   * @param file 文件 Buffer
   * @param fileName 文件名
   * @returns 上传结果
   */
  async uploadDocument(file: Buffer, fileName: string): Promise<{ fileId: string; status: string }> {
    const config = this.loadConfig();
    if (!config || !config.enabled) {
      throw new Error('QAnything is not enabled');
    }

    try {
      logger.info(`📤 Uploading document to QAnything: ${fileName}`);
      
      const formData = new FormData();
      formData.append('file', file, {
        filename: fileName,
        contentType: this.getContentType(fileName)
      });
      formData.append('kbId', config.kbId);
      formData.append('user_id', 'itops_agent');

      const response = await axios.post(
        `${config.apiBase}/api/local_doc_qa/upload_files`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': config.apiKey
          },
          timeout: 60000 // 上传大文件可能需要更长时间
        }
      );

      if (response.data.code !== 200) {
        throw new Error(`Upload failed: ${response.data.msg}`);
      }

      const result = response.data.data?.[0];
      logger.info(`✅ Document uploaded successfully: ${result?.fileId}`);
      
      return {
        fileId: result?.fileId || '',
        status: result?.status || 'unknown'
      };

    } catch (error: any) {
      logger.error('❌ Document upload failed:', error.message);
      throw error;
    }
  }

  /**
   * 查询文档解析状态
   * @param fileId 文件 ID
   */
  async getDocumentStatus(fileId: string): Promise<{ status: string; fileName: string }> {
    const config = this.loadConfig();
    if (!config || !config.enabled) {
      throw new Error('QAnything is not enabled');
    }

    try {
      const response = await axios.get(
        `${config.apiBase}/api/local_doc_qa/get_file_status`,
        {
          params: {
            kb_id: config.kbId,
            file_id: fileId,
            user_id: 'itops_agent'
          },
          headers: {
            'Authorization': config.apiKey
          }
        }
      );

      const result = response.data.data?.[0];
      return {
        status: result?.status || 'unknown',
        fileName: result?.file_name || ''
      };

    } catch (error: any) {
      logger.error('❌ Failed to get document status:', error.message);
      throw error;
    }
  }

  /**
   * 删除文档
   * @param fileId 文件 ID
   */
  async deleteDocument(fileId: string): Promise<void> {
    const config = this.loadConfig();
    if (!config || !config.enabled) {
      throw new Error('QAnything is not enabled');
    }

    try {
      await axios.post(
        `${config.apiBase}/api/local_doc_qa/delete_files`,
        {
          kb_id: config.kbId,
          file_ids: [fileId],
          user_id: 'itops_agent'
        },
        {
          headers: {
            'Authorization': config.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`️ Document deleted: ${fileId}`);

    } catch (error: any) {
      logger.error('❌ Failed to delete document:', error.message);
      throw error;
    }
  }

  /**
   * 根据文件名获取 Content-Type
   */
  private getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png'
    };
    return types[ext || ''] || 'application/octet-stream';
  }
}

export const qanythingService = new QAnythingService();
export default qanythingService;
```

---

### 3. 在 Agent 执行时集成 QAnything

修改 `agentExecutor.ts`，在构建 Prompt 时优先使用 QAnything 检索结果：

```typescript
// backend/src/services/agentExecutor.ts

import { qanythingService } from './qanythingService';
import { enhancedRAGService } from './enhancedRAGService';

/**
 * 执行 Agent（带 RAG 检索增强）
 */
export async function executeAgentWithRAG(
  agentId: string,
  userInput: string,
  context?: Record<string, unknown>
): Promise<string> {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // 1. 优先使用 QAnything 检索
  let knowledgeContext = '';
  try {
    if (qanythingService.isEnabled()) {
      logger.info('🔍 Using QAnything for knowledge retrieval...');
      knowledgeContext = await qanythingService.queryKnowledge(userInput, 5);
    }
  } catch (error) {
    logger.warn('⚠️ QAnything query failed, falling back to local RAG:', error);
  }

  // 2. 如果 QAnything 无结果，回退到 SQLite 内置知识库
  if (!knowledgeContext) {
    logger.info('📚 Falling back to local RAG service...');
    knowledgeContext = await enhancedRAGService.query(userInput);
  }

  // 3. 构建增强 Prompt
  let enhancedPrompt = agent.system_prompt || '';
  
  if (knowledgeContext) {
    enhancedPrompt += `\n\n【相关知识库内容】\n${knowledgeContext}\n\n`;
    enhancedPrompt += '请基于以上知识库内容回答用户问题。如果知识库内容不足以回答问题，请结合你的专业知识进行补充。\n\n';
  }

  enhancedPrompt += `【用户问题】\n${userInput}`;

  // 4. 调用 LLM
  logger.info(` Executing agent: ${agent.name}`);
  const result = await llmService.callAPI(
    enhancedPrompt,
    agent.name,
    agent.temperature || 0.7
  );

  return result;
}
```

---

### 4. 新增知识库管理 API 路由

```typescript
// backend/src/routes/knowledgeQAnythingRoutes.ts

import express from 'express';
import { qanythingService } from '../services/qanythingService';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// 所有路由需要认证
router.use(authenticate);

/**
 * 上传文档到 QAnything 知识库
 */
router.post('/upload', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await qanythingService.uploadDocument(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      data: {
        fileId: result.fileId,
        status: result.status
      }
    });

  } catch (error: any) {
    logger.error('Failed to upload document:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 查询文档解析状态
 */
router.get('/status/:fileId', async (req, res) => {
  try {
    const result = await qanythingService.getDocumentStatus(req.params.fileId);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Failed to get document status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 删除文档
 */
router.delete('/document/:fileId', async (req, res) => {
  try {
    await qanythingService.deleteDocument(req.params.fileId);
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
    logger.error('Failed to delete document:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### 5. 注册路由

```typescript
// backend/src/app.ts

import knowledgeQAnythingRoutes from './routes/knowledgeQAnythingRoutes';

// ... 其他路由注册

app.use('/api/knowledge/qanything', knowledgeQAnythingRoutes);
```

---

## API 接口说明

### QAnything 核心 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/local_doc_qa/new_knowledge_base` | POST | 创建知识库 |
| `/api/local_doc_qa/upload_files` | POST | 上传文档 |
| `/api/local_doc_qa/delete_files` | POST | 删除文档 |
| `/api/local_doc_qa/get_file_status` | GET | 查询文档状态 |
| `/api/local_doc_qa/local_doc_chat` | POST | 知识库问答 |

### 详细 API 文档

请参考 [QAnything API 文档](https://ai.youdao.com/qanything/docs/intro/api-intro)

---

## 实施计划

### 阶段一：验证对接可行性（1-2 天）

| 任务 | 说明 | 预计时间 |
|------|------|---------|
| 本地部署 QAnything | Docker 部署并验证 | 半天 |
| API 连通性测试 | 调用各接口验证 | 半天 |
| 文档上传测试 | 上传运维文档测试解析效果 | 1 天 |

### 阶段二：开发集成（1-2 周）

| 任务 | 说明 | 预计时间 |
|------|------|---------|
| 创建 `qanythingService.ts` | 服务层封装 | 2 天 |
| 设置页面配置入口 | 新增配置项 UI | 1 天 |
| Agent 执行集成 | 修改 `agentExecutor.ts` | 2 天 |
| 知识库管理 API | 新增路由 | 2 天 |
| 前端上传界面 | 文档上传 UI | 2 天 |
| 联调测试 | 端到端测试 | 1 天 |

### 阶段三：用户体验优化（1 周）

| 任务 | 说明 | 预计时间 |
|------|------|---------|
| 文档状态展示 | 显示解析进度 | 1 天 |
| 批量上传 | 支持多文件上传 | 1 天 |
| 检索结果优化 | 优化展示效果 | 1 天 |
| 文档和测试 | 补全文档 | 1 天 |

---

## 安全注意事项

### 数据安全

| 风险 | 缓解措施 |
|------|---------|
| **API 密钥泄露** | 使用 AES-256-GCM 加密存储 |
| **文档越权访问** | 严格的用户权限校验 |
| **敏感内容检索** | 支持文档级别权限控制 |

### 部署安全

| 场景 | 建议 |
|------|------|
| **本地部署** | 数据 100% 不出服务器，最安全 |
| **云端部署** | 评估数据敏感性，建议使用本地 |
| **网络隔离** | 确保 QAnything 服务器在内网 |

---

## FAQ

### Q1：QAnything 需要多少服务器资源？

**A**：建议配置：
- CPU：4 核及以上
- 内存：8GB 及以上
- 磁盘：20GB 及以上（取决于文档量）

### Q2：QAnything 和本地 SQLite 知识库可以同时使用吗？

**A**：可以！系统设计了降级机制：
1. 优先使用 QAnything 检索
2. 如果 QAnything 无结果或失败，回退到 SQLite 本地知识库
3. 两者互补，不冲突

### Q3：QAnything 的检索效果如何？

**A**：根据官方文档和社区反馈：
- 数据量越大，检索准确率越高
- 两阶段检索（Embedding + Rerank）比单一检索更精准
- 支持跨语种检索（中英文混合）

### Q4：运维文档格式有哪些限制？

**A**：QAnything 支持以下格式：
- PDF/Word/Excel/PPT
- Markdown/TXT/CSV
- 图片（JPG/PNG）
- 网页链接

---

## 附录

### A. 快速启动 QAnything

```bash
# 1. 拉取镜像
docker pull neteaseyoudao/qanything:latest

# 2. 启动容器
docker run -d \
  --name qanything \
  -p 8777:8777 \
  -p 5052:5052 \
  -v /opt/qanything/config:/app/config \
  neteaseyoudao/qanything:latest

# 3. 访问 Web UI
# http://localhost:5052

# 4. 测试 API
curl http://localhost:8777/api/health
```

### B. 相关资源

- [QAnything GitHub 仓库](https://github.com/netease-youdao/QAnything)
- [QAnything API 文档](https://ai.youdao.com/qanything/docs/intro/api-intro)
- [QAnything 部署指南](https://github.com/netease-youdao/QAnything/blob/master/README.md)

---

**文档版本**：v1.0
**最后更新**：2026-05-26
