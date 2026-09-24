# 特性列表（REQ-20260925-itops-agent-service）

- **F1 [P0] itops-agent-service 集成缺口修复** — chat 走动态注册表优先；Agent 惰性构建 + 运行时解析 LLM 配置；LLM 配置持久化（`data/llm_config.json`，0600，原子写）；知识库注入 AgentDeps；sessionKey 会话历史注入；LLM 未配置返回结构化 503。
- **F2 [P0] 容器化与生产栈接入** — 新增 `docker/Dockerfile.agent-service`（python:3.11-slim + 阿里云镜像 + 非 root + healthcheck）；根 `docker-compose.yml` 新增 `agent-service` 服务与 `AGENT_SERVICE_URL` 注入；不暴露宿主端口。
- **F3 [P0] DeepSeek 默认模型落库** — 平台模型池新增 `deepseek/deepseek-v4-flash`（含 api_key）并置为默认；原 volcengine 行取消默认。
- **F4 [P0] 平台启动同步与透传** — `registerExistingAgents` 扩展：Agent 注册后同步模型池默认模型到外部服务；`remoteAgentProvider` 透传 `sessionKey`。
- **F5 [P0] 验证与文档** — 端到端验证（健康/直连 chat/降级链/真实 LLM 回复/重启恢复）；更新 README、ARCHITECTURE、deployment runbook、environment-variables、CHANGELOG。
