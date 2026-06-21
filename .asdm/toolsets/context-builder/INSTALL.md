# Context Builder Toolset 安装指南 (v0.3)

**Toolset ID:** `context-builder`  
**版本:** 0.3.0 (适配大型代码库)

## 概述

Context Builder v0.3 是一套适配大型代码库（200万行+）的上下文构建工具，采用三明治架构和渐进式披露机制。

## AI 引导安装

复制以下提示到 AI Coding 工具的聊天窗口：

```shell
Follow instructions in .asdm/toolsets/context-builder/INSTALL.md
```

## 安装步骤

### 1. 创建 `.asdm/contexts` 目录

```bash
mkdir -p .asdm/contexts
```

### 2. 检测 AI 助手类型

检测当前 AI 助手提供商：

| 目录存在 | AI 助手 |
|----------|---------|
| `.claude` | Claude Code |
| `.github` | GitHub Copilot |
| `.codebuddy` | Tencent CodeBuddy |

### 3. 创建快捷命令

#### Claude Code (`.claude/commands/`)

```bash
mkdir -p .claude/commands/

# L1: 初始化项目顶层索引
cat > .claude/commands/asdm-context-init.md << 'EOF'
---
description: "Initialize project top-level index (L1)"
argument-hint: "[optional: project description]"
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-context-init.md >> .claude/commands/asdm-context-init.md

# L2: 构建领域索引
cat > .claude/commands/asdm-domain-index-build.md << 'EOF'
---
description: "Build domain index (L2) for specified domain"
argument-hint: "<domain-name>"
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-domain-index-build.md >> .claude/commands/asdm-domain-index-build.md

# L3: 构建领域详细内容
cat > .claude/commands/asdm-domain-context-build.md << 'EOF'
---
description: "Build domain detail context (L3) for specified domain"
argument-hint: "<domain-name> [entities|services|apis|flows|all]"
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-domain-context-build.md >> .claude/commands/asdm-domain-context-build.md

# Context Update
cat > .claude/commands/asdm-context-update.md << 'EOF'
---
description: "Update existing context when workspace changes"
argument-hint: "<change-type>"
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-context-update.md >> .claude/commands/asdm-context-update.md
```

#### GitHub Copilot (`.github/prompts/`)

```bash
mkdir -p .github/prompts/

# L1: 初始化项目顶层索引
cat > .github/prompts/asdm-context-init.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Initialize project top-level index (L1)'
argument-hint: '[optional: project description]'
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-context-init.md >> .github/prompts/asdm-context-init.prompt.md

# L2: 构建领域索引
cat > .github/prompts/asdm-domain-index-build.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Build domain index (L2) for specified domain'
argument-hint: '<domain-name>'
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-domain-index-build.md >> .github/prompts/asdm-domain-index-build.prompt.md

# L3: 构建领域详细内容
cat > .github/prompts/asdm-domain-context-build.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Build domain detail context (L3) for specified domain'
argument-hint: '<domain-name> [entities|services|apis|flows|all]'
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-domain-context-build.md >> .github/prompts/asdm-domain-context-build.prompt.md

# Context Update
cat > .github/prompts/asdm-context-update.prompt.md << 'EOF'
---
agent: 'agent'
description: 'Update existing context when workspace changes'
argument-hint: '<change-type>'
---
EOF
cat .asdm/toolsets/context-builder/actions/asdm-context-update.md >> .github/prompts/asdm-context-update.prompt.md
```

#### Tencent CodeBuddy (`.codebuddy/commands/`)

```bash
mkdir -p .codebuddy/commands/

cp .asdm/toolsets/context-builder/actions/asdm-context-init.md .codebuddy/commands/
cp .asdm/toolsets/context-builder/actions/asdm-domain-index-build.md .codebuddy/commands/
cp .asdm/toolsets/context-builder/actions/asdm-domain-context-build.md .codebuddy/commands/
cp .asdm/toolsets/context-builder/actions/asdm-context-update.md .codebuddy/commands/
```

### 4. 其他 AI 助手的通用安装

复制以下提示到聊天窗口：

```shell
# 复制 action 文件的相对路径，然后输入：
Follow the instructions in .asdm/toolsets/context-builder/actions/asdm-context-init.md
```

## 初始化 Context Builder

### 推荐的初始化流程

```bash
# 1. 初始化项目顶层索引 (L1)
/asdm-context-init

# 2. 构建领域索引 (L2) - 按需
/asdm-domain-index-build <领域名>

# 3. 构建领域详细内容 (L3) - 执行任务时按需
/asdm-domain-context-build <领域名>
```

### 可用命令

| 命令 | 描述 | 适用场景 |
|------|------|----------|
| `/asdm-context-init` | 初始化项目顶层索引 | 首次使用或项目结构大幅变化 |
| `/asdm-domain-index-build` | 构建领域索引 | 首次访问某领域 |
| `/asdm-domain-context-build` | 构建领域详细内容 | 执行具体任务需要详细上下文 |
| `/asdm-context-update` | 更新上下文 | 代码变更后的增量更新 |

## 三明治架构说明

```
L1 (顶层索引, <2KB)
├── 项目一句话描述
├── 技术栈 (5-7项)
├── 领域列表 + 入口
└── 构建命令

L2 (领域索引, <1KB/领域)
├── 领域一句话描述
├── 子模块列表
├── 外部依赖
└── 详细内容入口

L3 (详细内容, <5KB/文件) - 按需
├── entities.md      (实体定义)
├── services.md     (服务接口)
├── apis.md        (API 定义)
└── flows.md       (业务流程)
```

## 上下文文件结构

```
.asdm/contexts/
├── index.md                    # L1 项目顶层索引
├── domains/                    # L2 领域索引
│   ├── user-domain.md
│   ├── order-domain.md
│   └── payment-domain.md
├── domain-details/            # L3 详细内容
│   ├── user-domain/
│   │   ├── index.md
│   │   ├── entities.md
│   │   └── ...
│   └── ...
└── workspace/                 # 工作区汇总
```

## 使用示例

### 场景 1: 新项目首次使用

```bash
# 安装后初始化
/asdm-context-init

# 查看输出
# 项目顶层索引已生成: .asdm/contexts/index.md
```

### 场景 2: 开发时按需构建

```bash
# 需要修改用户模块
/asdm-domain-index-build user-domain      # 生成领域索引
/asdm-domain-context-build user-domain    # 按需生成详细内容

# 需要修改支付模块
/asdm-domain-index-build payment-domain
/asdm-domain-context-build payment-domain
```

### 场景 3: 更新上下文

```bash
# 用户模块代码变更后
/asdm-context-update user-domain
```

## 验证安装

安装后确认：

1. `.asdm/contexts` 目录已创建
2. 快捷命令已创建在对应目录
3. Toolset 文件位于 `.asdm/toolsets/context-builder`

## 与其他工具集的集成

Context Builder 可通过**上下文注入**为其他工具集提供上下文：
- PRD Builder
- Project Context Analysis
- 其他需要理解项目的工具集

## 文档

- 工具集说明: `.asdm/toolsets/context-builder/README.md`
- 设计原理: `.asdm/toolsets/context-builder/docs/CONTEXT_GRANULARITY_DESIGN.md`

## License

Copyright (c) 2026 LeansoftX.com & iSoftStone. All rights reserved.

Licensed under the PROPRIETARY SOFTWARE LICENSE.

---

*本安装文档是 Context Builder toolset 的一部分。*
