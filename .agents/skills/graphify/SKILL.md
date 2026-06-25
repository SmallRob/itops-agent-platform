---
name: graphify
version: 1.0.0
description: 将任意输入（代码/文档/需求/笔记）抽取为可追溯的知识图谱，输出 JSON 图数据与 Mermaid 可视化，便于检索、问答与结构化分析。触发：/graphify
---

# Graphify（知识图谱抽取）

<when_to_use>

- 用户希望把一段内容（代码仓库/文档/聊天记录/需求说明）“结构化成图谱”
- 需要抽取：实体（概念/模块/角色/功能点）与关系（依赖/包含/调用/因果/约束）
- 希望得到：可视化（Mermaid）+ 可机器读取（JSON）

</when_to_use>

<output_contract>

你必须同时输出以下两类结果：

1) **JSON 图谱数据**（建议保存为 `graphify/*.json`）
   - `nodes`: `{ id, label, type, attrs?, evidence? }[]`
   - `edges`: `{ from, to, label, type, confidence?, evidence? }[]`
   - `evidence` 必须能追溯到原文（片段/文件路径/行号范围/引用句子）

2) **Mermaid 图**（建议保存为 `graphify/*.mmd`）
   - `flowchart LR` 或 `graph TD`
   - 节点 label 保持可读（不要只用哈希）

如输入规模过大：优先输出“核心子图”（Top N 关键节点），并在 JSON 中保留全量，Mermaid 仅展示精简版。

</output_contract>

<workflow>

1. **确定范围**
   - 默认：围绕用户当前问题/目标构图
   - 若用户未指定：先做“仓库级/文档级概览图谱”（模块、目录、关键入口、核心服务）

2. **抽取实体**
   - 代码：模块/页面/组件/服务/Store/类型/常量
   - 文档：概念/角色/流程/约束/指标/里程碑

3. **抽取关系**
   - 代码：`imports`、调用、依赖、读写存储、路由跳转
   - 文档：包含、因果、约束、目标→策略→执行

4. **归一化与去重**
   - 同义合并（关键词/别名）
   - 用稳定的 `id`（如相对路径或 slug）

5. **输出**
   - JSON 全量 + Mermaid 精简（可读优先）
   - 附带简短摘要：Top 节点、关键链路、可行动建议（如“重构切入点”）

</workflow>

<notes>

- 任何“关系”都应尽量给出证据（evidence），避免无依据臆断。
- 对隐私/密钥/个人敏感信息：只保留摘要或脱敏字段。

</notes>

