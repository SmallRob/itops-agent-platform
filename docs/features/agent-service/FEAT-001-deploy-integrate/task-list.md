# FEAT-001 部署接入 itops-agent-service（模块：agent-service）

> 依据：REQ-20260925-itops-agent-service、ARCH-20260925-itops-agent-service。本模块 PRD 只列一个特性（FEAT-001），任务清单如下。

## 功能 PRD 摘要

平台 `/platform#providers` 的远端 Provider `agent-service` 从「连接被拒」变为「健康可用」，且：

1. 对话请求（含降级链后备路径）由外部 Python 服务用 DeepSeek `deepseek-v4-flash` 真实执行；
2. 平台模型池新增该模型并设为默认，配置存数据库；
3. 外部服务的 LLM 配置随模型池自动同步、重启不丢；
4. 平台注册的 Agent（名称/提示词）在外部服务中生效，会话具备上下文。

## 任务清单

| ID | 任务 | 类型 | 优先级 | 依赖 | 预估 |
|----|------|------|--------|------|------|
| T001 | `resolve_model` + `ITOpsAgent` 惰性构建重构（agents） | 后端-Python | P0 | — | 2h |
| T002 | chat 注册表优先 + 知识库注入 + 会话历史 + 503 语义（api） | 后端-Python | P0 | T001 | 2h |
| T003 | LLM 配置持久化（llm_config_manager + data 卷） | 后端-Python | P0 | — | 1h |
| T004 | pyproject 版本锁定 + pytest 全绿（python:3.11 容器内跑） | 后端-Python | P0 | T001~T003 | 1h |
| T005 | DeepSeek 模型落库 `ai_models` 并设默认 | 后端-DB | P0 | — | 0.5h |
| T006 | backend：启动同步模型配置 + sessionKey 透传 + build 通过 | 后端-TS | P0 | T001 | 1.5h |
| T007 | Dockerfile.agent-service + compose 接入 + 构建部署 | 部署 | P0 | T004 | 1.5h |
| T008 | 端到端验证（健康/直连 chat/降级链/重启恢复） | 验证 | P0 | T005~T007 | 1h |
| T009 | 代码审查与修复 | 质量 | P1 | T008 | 1h |
| T010 | 文档更新（README/ARCHITECTURE/runbook/env/CHANGELOG）+ 提交 | 文档 | P1 | T009 | 1h |
