# 平台能力文档（Agent / Skills / Hooks）

本目录是 ITOps Agent Platform **可扩展内核**的权威文档，按"能力域一页"组织，每页统一采用
**快速开始 → 原理 → 配置 → 扩展 → 排障** 结构，方便开发与运维按需查阅。

---

## 文档索引

| 文档 | 回答什么问题 | 适合谁 |
|------|--------------|--------|
| [architecture.md](./architecture.md) | 平台分几层？Agent Runtime / Skills / Hooks 如何协作？三条典型链路怎么走？ | 架构师、后端开发 |
| [skills.md](./skills.md) | 技能怎么写？工具契约字段有哪些？zip 包规范？如何新增一个能力域？ | 技能/插件开发 |
| [hooks.md](./hooks.md) | 外部告警怎么接？认证怎么做？如何新增一家监控源？ | 集成开发、运维 |
| [configuration.md](./configuration.md) | 配置分几层？什么改环境变量、什么改 settings？改动如何生效？ | 运维、实施 |
| [environment-variables.md](./environment-variables.md) | 所有环境变量的默认值与含义？ | 运维、部署 |
| [deployment.md](./deployment.md) | 本服务器如何发布投产？构建前置条件、数据迁移、域名切换、验证清单与回滚 | 运维、发布负责人 |

> 与本目录并列的系统级历史文档（部署、API、工作流等）见 [docs/README.md](../README.md)。

---

## 推荐阅读路径

| 角色 | 顺序 |
|------|------|
| **第一次接触平台** | [architecture.md](./architecture.md)（分层总览 + 三条链路） → [configuration.md](./configuration.md)（跑起来需要配什么） |
| **接入外部监控告警** | [hooks.md](./hooks.md) → [environment-variables.md](./environment-variables.md#hooks-入站自定义新接入事件源) |
| **开发新的运维能力** | [skills.md](./skills.md)（契约 + 开发指南 + zip 规范） → [architecture.md](./architecture.md#扩展点) |
| **接入自研 Agent** | [architecture.md](./architecture.md#扩展点) → [configuration.md](./configuration.md#agent-治理配置详解) |
| **线上排障** | 各文档「排障」小节 → [configuration.md](./configuration.md#排障) |

---

## 五分钟自检

**可视化**：登录后打开「AI 运维 → 能力中心」（`/platform`），三个 Tab 即为本文档集的可操作版本：
`#skills` 看技能装载与意图匹配、`#providers` 看 Provider 健康/熔断与降级链、`#hooks` 看事件接入端点。

**命令行**：

```bash
TOKEN=<管理员 JWT>; BASE=http://localhost:3001

curl -s $BASE/api/agents/providers -H "Authorization: Bearer $TOKEN" | jq '.data | {defaultProvider, fallbackChain}'
curl -s $BASE/api/skills          -H "Authorization: Bearer $TOKEN" | jq '.data.skills | length'
curl -s $BASE/api/hooks/sources   -H "Authorization: Bearer $TOKEN" | jq '.data | length'
```

三条命令分别验证：**Agent Runtime 正常注册**、**技能目录已装载**、**Hooks 来源映射可用**。

---

## 文档维护约定

1. **一能力域一页**：新能力（如 K8s 运维、工单集成）先建 `docs/platform/<domain>.md`，再在本文索引登记。
2. **结构统一**：`快速开始 / 原理 / 配置 / 扩展 / 排障` 五段式；"快速开始"必须是可直接复制执行的命令。
3. **配置不重复写**：环境变量统一登记在 [environment-variables.md](./environment-variables.md)，能力页只做引用。
4. **契约先行**：文档先写清契约（字段表 + 约束 + 示例），再写实现细节——契约是给接入方看的。
5. **变更同步**：改契约/配置/端点时，同一次提交内更新对应文档与 `docs/README.md` 索引。