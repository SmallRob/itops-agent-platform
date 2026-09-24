# ADR（ARCH-20260925-itops-agent-service）

## ADR-1：Agent 惰性构建，而不是「构建时绑定模型 + 失效缓存」

- **决策**：`ITOpsAgent` 构造只保存配置；每次 `run/run_stream` 现场创建 PydanticAI Agent 并从 LLM 配置管理器解析模型实例。
- **理由**：配置变更生效问题（G2）本质是「模型实例在构造时快照」。惰性构建让缓存与失效策略整体消失，`_agents` 缓存退化为无状态对象池，同时天然支持「注册早于配置同步」的启动时序。构造成本为纯内存对象创建，可忽略。

## ADR-2：LLM 凭据一律来自配置管理器，不用 PydanticAI 的 provider 注册表字符串

- **决策**：`resolve_model()` 显式构造 `OpenAIModel(name, provider=OpenAIProvider(base_url, api_key))`；入参中的 `provider:model` 前缀串只用于提取模型名。
- **理由**：`Agent("deepseek:model")` 之类字符串会从进程环境变量取 key（`DEEPSEEK_API_KEY`），与「平台模型池 = 唯一配置源」冲突；显式构造让凭据来源单一、可测试。

## ADR-3：配置持久化用 JSON 文件而不是 SQLite

- **决策**：外部服务把 LLM 配置持久化为 `data/llm_config.json`（原子写 + 0600）。
- **理由**：单对象、低频写、需要人工可查；引入 SQLite 仅为一个键值不划算。平台侧「把配置存在数据库」由 `ai_models` 表承担（用户诉求的落库点），外部服务的文件只是抗重启副本，两端以启动同步收敛。

## ADR-4：agent-service 不发布宿主端口

- **决策**：仅加入 `itops-network`，宿主不暴露 8000。
- **理由**：调用方是 backend 容器（服务名直连），宿主暴露只会扩大攻击面（该栈历史上有 50 项安全整改）；调试走 `docker exec` 或 backend 代理路由。

## ADR-5：pydantic-ai 锁定 0.x

- **决策**：`pydantic-ai>=0.4.0,<1.0.0`，代码按 0.x API（`result.data`、`run_stream`）并带 0.x/1.x 兼容取值（`getattr(result,"output",…)` 兜底）。
- **理由**：1.x 移除 `result.data`、更名 `OpenAIChatModel`；锁版本保证镜像可重现，兼容取值降低未来升级成本。

## ADR-6：会话历史在 API 层用「上下文注入」而不是 PydanticAI message_history

- **决策**：每 sessionKey 维护环形缓冲，把最近 N 轮文本拼进提示词上下文。
- **理由**：0.x 的 `message_history` 需要构造 `ModelMessage` 对象，跨小版本兼容风险高；文本注入实现 30 行、可观测、对本场景（运维问答）效果等价。
