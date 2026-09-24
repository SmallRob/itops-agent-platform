# Skills（技能插件）

> 技能是平台的**能力声明单元**：一个技能 = 一个目录，目录里的清单声明"这个技能能做什么、能用哪些平台工具"。
> Agent 通过技能注册表按意图装载技能，工作流、Hook、前端共用同一份技能清单——新增能力无需改动 Agent 代码。

---

## 快速开始

> **可视化操作**：登录后进入左侧导航「AI 运维 → 能力中心 → 技能插件」（`/platform#skills`），可查看技能卡片与工具契约、启用/停用、重载目录、上传 zip 安装、卸载，并用内置「意图匹配测试」验证触发词。命令行操作见下。

**写一个最小技能**（3 个文件，2 分钟）

```bash
mkdir -p skills/my-skill && cd skills/my-skill
cat > SKILL.md <<'MD'
---
name: my-skill
description: 用于演示的最小技能：查询业务系统健康状态
tags: [业务, 健康检查]
triggers: [业务健康, 健康状态]
---

# My Skill

当用户询问业务系统健康状态时，调用 `my.health` 工具获取指标并给出结论。
MD

cat > skill.json <<'JSON'
{
  "name": "my-skill",
  "description": "用于演示的最小技能：查询业务系统健康状态",
  "version": "1.0.0",
  "tags": ["业务", "健康检查"],
  "triggers": ["业务健康", "健康状态"],
  "enabled": true,
  "tools": [
    {
      "name": "my.health",
      "description": "查询业务系统健康指标",
      "kind": "http",
      "endpoint": "/api/dashboard/stats",
      "httpMethod": "GET"
    }
  ]
}
JSON
```

**装载并验证**

```bash
# 运行时重载（开发环境 SKILLS_WATCH 默认开启，目录变更会自动重载）
curl -s -X POST http://localhost:3001/api/skills/reload -H "Authorization: Bearer $TOKEN" | jq .data

# 确认已装载
curl -s http://localhost:3001/api/skills | jq '.data.skills[] | select(.slug=="my-skill")'

# 验证意图匹配（决定 Agent 是否会装载它）
curl -s -X POST http://localhost:3001/api/skills/match \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"帮我看下业务健康状态"}' | jq .data
```

---

## 原理

```
SKILLS_DIR/<slug>/
├── SKILL.md     ① YAML front-matter：name / description / tags / triggers（人读说明 + 匹配信号）
├── skill.json   ② 机器清单：tools[] 工具契约、version、enabled（Agent 的调用面）
└── _meta.json   ③ 可选：ownerId / slug / version / publishedAt（分发元数据）
        │
        ▼  skillLoader 解析 + 校验（slug 白名单、工具缺 name/kind 记 warning）
   SkillManifest { slug, name, description, tags, triggers, tools[], enabled, warnings }
        │
        ▼  skillRegistry
   ├ 装载/reload：扫描目录（跳过 `.` 开头目录），应用停用集合（settings.skills_disabled）
   ├ match(query)：为 Agent 挑选技能（打分见下）
   ├ listTools()：扁平工具视图（工具 + 所属技能），供 Agent/工作流编排
   └ setEnabled(slug)：运行时启停并持久化，重启后保持
```

**意图匹配打分**（`skillRegistry.match`，按得分降序取前 N，默认 3）

| 命中位置 | 权重 | 说明 |
|----------|------|------|
| `triggers` 触发词 | +5 / 个 | 精确子串匹配（大小写不敏感），最重要的信号 |
| 技能名 `name` | +3 | 用户直接点名技能 |
| `tags` 标签 | +2 / 个 | 领域归类信号 |
| `description` 分词 | +1 / 词（最多 3） | 兜底信号，中文按标点/空格切分 |

> 只有 `enabled=true` 的技能参与匹配；停用技能不会被 Agent 装载。
> `reason` 字段会返回命中原因（如 `触发词「磁盘」；标签「服务器」`），在工作流日志里可直接看到。

---

## 契约字段

**`SkillToolContract`（`skill.json → tools[]`）**

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 工具名，建议 `域.动作`（如 `docker.containers.list`） |
| `description` | — | 给 LLM 看的说明，写清用途与边界 |
| `kind` | ✅ | `ssh` / `docker` / `network` / `http` / `ai` / `builtin` |
| `endpoint` | — | 平台既有能力的入口（REST 路径模板，如 `/api/server-commands/{serverId}/exec`） |
| `httpMethod` | — | 默认 `POST` |
| `inputSchema` | — | JSON Schema 子集（`type` / `required` / `properties`），供 Agent 生成参数 |
| `requiresAdmin` | — | 需要管理员权限（默认 false） |
| `write` | — | 写操作标记：用于治理（二次确认/保护名单）与审计 |

**slug 规则**：`^[a-z0-9][a-z0-9-]{1,63}$`（小写字母/数字/短横线，2–64 位），非法会被拒绝装载并出现在 `errors` 中。

---

## zip 技能包规范

技能包用于分发（对齐 openocta 的 UPLOAD_FORMAT 习惯），`POST /api/skills/install` 与目录安装走**同一套校验**。

```
my-skill.zip
├── SKILL.md            ← 允许：技能目录在根
├── skill.json
└── _meta.json
# 或
my-skill.zip
└── my-skill/           ← 允许：唯一一级目录即技能目录（GitHub 下载包常见形态）
    ├── SKILL.md
    └── skill.json
```

**约束（不满足即拒绝，不会写入技能目录）**

| 约束 | 值 |
|------|-----|
| 体积 | ≤ 10 MB（`MAX_SKILL_PACKAGE_SIZE`） |
| 条目数 | ≤ 200 |
| 允许扩展名 | `.md` `.json` `.yaml` `.yml` `.txt` `.sh` `.py` `.js` |
| 路径安全 | 拒绝绝对路径、`..` 上跳（防 zip-slip）；自动忽略 `__MACOSX`、`.DS_Store` |
| 必需文件 | `SKILL.md`（根目录或唯一一级目录内） |
| 同名冲突 | 默认拒绝，传 `overwrite=1` 覆盖（覆盖失败自动回滚旧版本） |

---

## API 一览

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/skills` | 登录 | 技能清单；`?all=1` 含已停用；响应含 `skillsDir` / `loadedAt` / `errors` |
| GET | `/api/skills/tools` | 登录 | 扁平工具视图（含所属技能），供编排 |
| POST | `/api/skills/match` | 登录 | 意图匹配：`{query, limit}` → `SkillMatch[]` |
| GET | `/api/skills/:slug` | 登录 | 单个技能详情 |
| POST | `/api/skills/:slug/toggle` | admin | 启停（`{enabled:false}`），持久化 |
| POST | `/api/skills/reload` | admin | 重新扫描目录装载 |
| POST | `/api/skills/install` | admin | 上传 zip 安装（multipart 字段 `file`，`?overwrite=1` 覆盖） |
| DELETE | `/api/skills/:slug` | admin | 卸载：删除技能目录并 reload |

```bash
# 安装技能包
curl -s -X POST "http://localhost:3001/api/skills/install?overwrite=1" \
  -H "Authorization: Bearer $TOKEN" -F "file=@my-skill.zip" | jq .data

# 卸载技能
curl -s -X DELETE http://localhost:3001/api/skills/ssh-ops -H "Authorization: Bearer $TOKEN" | jq .data
```

> 管理端点需要 `admin` 角色，且请求头需带 CSRF（`X-Session-Id` + `X-Csrf-Token`，先 `GET /api/csrf-token`）。
> 安装/卸载/启停/重载都会写入审计日志（`skill_install` / `skill_uninstall` / `skill_enabled` / `skill_disabled` / `skills_reload`）。

---

## 内置技能包

| 技能 | 工具数 | 覆盖能力 |
|------|--------|----------|
| `ssh-ops` | 3 | `servers.list`、`ssh.exec`、`servers.test-connection`（主机排障、远程执行） |
| `docker-ops` | 7 | 主机/容器/镜像清单、容器日志、启停重启、镜像拉取与删除 |
| `network-device-ops` | 4 | 设备清单、设备巡检、拓扑、SNMP Trap |
| `alert-analysis` | 4 | 告警清单、根因分析、修复执行记录、知识库检索 |

合计 **18 个工具**，全部指向平台已有能力（HTTP 端点或内置处理器），技能层不重复实现业务逻辑。

---

## 开发指南：新增一个技能

1. **确定能力边界**：一个技能对应一个能力域（如 K8s 运维），不要把无关能力塞进同一技能。
2. **盘点可复用工具**：优先指向平台已有 REST 端点；确需新逻辑时，先在 `backend/src/services/` 实现，再在技能里暴露契约。
3. **写清单**：`SKILL.md` 写"何时使用 + 调用步骤 + 边界"，`skill.json` 写 `tools[]`。
4. **写好触发词**：`triggers` 用用户真实会说的词（"重启容器"、"磁盘满了"），必要时加中英文两种。
5. **验证**：
   ```bash
   curl -X POST /api/skills/reload
   curl -X POST /api/skills/match -d '{"query":"<用户原话>"}'   # 期望命中且 reason 合理
   ```
6. **验证 Agent 装载**：跑一个工作流 agent 节点，节点输入命中触发词后，任务日志会出现 `装载技能：<name>（原因）`，任务详情 `node_results.<nodeId>.metadata.skills` 可回溯。

---

## 排障

| 现象 | 原因与处理 |
|------|-----------|
| 技能没出现在列表中 | 目录名以 `.` 开头（被跳过）；或缺 `SKILL.md` → 看 `GET /api/skills` 的 `errors` |
| 报 `技能 slug 非法` | 目录名/`_meta.json.slug` 不符合 `^[a-z0-9][a-z0-9-]{1,63}$` |
| 工具没被识别 | `tools[]` 缺 `name` 或 `kind` → 该项被跳过并在 `warnings` 中提示 |
| 安装报 `技能包包含不支持的文件类型` | 包内混入二进制/图片；技能包只承载声明式清单与脚本 |
| 安装报 `技能已存在` | 需要覆盖时加 `?overwrite=1` |
| 自研页面上传报 `Multipart: Boundary not found` | 不要手动设置 `Content-Type: multipart/form-data`（浏览器不会补 boundary）。axios 实例默认是 `application/json`，上传 FormData 时需清掉该头——前端已封装为 `formDataRequestConfig`（[lib/api.ts](../../frontend/src/lib/api.ts)） |
| 卸载报 400 | slug 非法或目录不存在（内置技能被手动删除过） |
| 匹配不到技能 | 用 `/api/skills/match` 逐步调触发词：用户原话里必须**完整包含**触发词子串 |
| 改了技能不生效 | 生产环境未开启目录监听 → 手动 `POST /api/skills/reload` |