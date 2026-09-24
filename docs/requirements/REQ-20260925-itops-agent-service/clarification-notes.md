# 澄清记录（REQ-20260925-itops-agent-service）

## 用户输入

1. 首条需求：在当前项目开发 `itops-agent-service` 服务并部署接入，规划设计并合理实现，确保 agent 调用正常。
2. 补充（开发中途）：使用 DeepSeek `deepseek-v4-flash`（提供 API key），接入并作为默认使用模型，把配置存在数据库。

## 澄清结论（基于代码与环境的自答）

| 维度 | 结论 |
|------|------|
| 业务目标 | 让 `/platform#providers` 的远端 Agent Provider 真实可用，补齐外部 Python Agent 执行通道 |
| 用户角色 | 平台运维管理员（通过能力中心/Providers 页与 Agent 对话 API 使用） |
| 功能边界 | 见 requirement-doc §3；不改默认 Provider 顺序，不生产化 MCP/CLI |
| 非功能约束 | 容器安全基线（非 root/限额/healthcheck）、国内构建镜像策略、key 脱敏 |
| 技术约束 | 复用既有 AgentProvider 契约与 `AgentServiceClient`；生产栈为 docker-compose v1（重建容器需先 `docker rm -f`）；宿主 Python 3.10 → 容器内 3.11 |
| 数据流向 | 平台模型池（SQLite `ai_models`）= LLM 配置源；启动时单向同步到外部服务；外部服务自身持久化一份以抗重启 |
| 「配置存数据库」 | 指平台模型池 `ai_models` 表（平台既有惯例），而非外部服务自建配置库 |

## 特性拆解与依赖

| ID | 特性 | 优先级 | 复杂度 | 依赖 |
|----|------|--------|--------|------|
| F1 | itops-agent-service 集成缺口修复（G1~G6） | P0 | 中 | 无 |
| F2 | Dockerfile + 生产 compose 接入 | P0 | 低 | F1 |
| F3 | DeepSeek 模型落库为平台默认 | P0 | 低 | 无 |
| F4 | 平台启动同步（模型配置 + Agent 注册 + sessionKey 透传） | P0 | 中 | F1, F3 |
| F5 | 端到端验证与文档 | P0 | 中 | F2, F4 |
