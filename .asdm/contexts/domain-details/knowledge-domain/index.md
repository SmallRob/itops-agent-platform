# 知识库域索引

## 概述
知识库域负责管理IT运维知识条目，提供智能检索、相关推荐和知识增强功能，支持本地规则引擎和外部QAnything集成。

## 核心文件
1. `entities.md` - 实体定义
2. `services.md` - 服务接口
3. `apis.md` - API定义
4. `flows.md` - 业务流程

## 领域职责
- 知识条目的CRUD操作
- 智能检索与相关性评分
- 知识注入与增强（RAG）
- QAnything外部集成
- 知识统计与分析

## 技术组件
- **EnhancedRAGService**：本地增强检索服务
- **QAnythingService**：外部知识库集成服务
- **KnowledgeRoutes**：REST API接口

## 数据存储
- SQLite数据库表：`knowledge_base`
- 配置存储：`settings`表中的`qanything_config`

## 业务规则
1. 知识条目必须包含标题和内容
2. 智能检索支持多维度评分：TF-IDF、精确匹配、标题匹配、使用频率、时间衰减
3. QAnything集成支持重试机制和连接测试
4. 知识注入自动更新使用频率
5. 支持批量导入和自动标签提取