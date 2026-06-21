# Req Analyzer 安装指南

**工具集ID**: `req-analyzer`

## 概述

本文档提供 Req Analyzer 工具集的安装与配置说明。Req Analyzer 是面向需求分析师的需求分析工具集，在需求分析阶段提供业务诉求的问题澄清、特性拆解、原型生成及文档编制能力。

## AI 引导安装

使用 AI 引导安装，请将以下提示复制到 AI 编码助手的聊天窗口中：

```shell
按照 .asdm/toolsets/req-analyzer/INSTALL.md 中的说明执行
```

## 安装步骤

### 1. 创建工作目录

Req Analyzer 需要以下工作目录来存放需求分析产物：

```bash
mkdir -p .asdm/workspace/requirements/prototypes
```

目录说明：
- `.asdm/workspace/requirements/` — 存放所有需求分析文档和产物
- `.asdm/workspace/requirements/prototypes/` — 存放交互原型 HTML 文件

### 2. 检测当前 Agentic Engine 提供商

检测当前使用的 AI 编码助手（如 Claude Code、GitHub Copilot、腾讯 CodeBuddy）：

- 如果项目根目录存在 `.claude` 目录，则使用 **Claude Code**
- 如果项目根目录存在 `.github` 目录，则使用 **GitHub Copilot**
- 如果项目根目录存在 `.codebuddy` 目录，则使用 **Tencent CodeBuddy**
- 如果以上目录均不存在，请手动选择一个提供商

### 3. 创建快捷命令

根据检测到的提供商，在对应目录中创建快捷命令。

#### Claude Code（`.claude/commands/`）

Claude Code 使用带 Frontmatter 元数据的 Markdown 文件作为斜杠命令。通过 `cat` 拼接 Claude 特定的 Frontmatter 与指令内容：

```bash
mkdir -p .claude/commands/

# req-clarify 命令
cat > .claude/commands/req-clarify.md << 'EOF'
---
description: "对业务诉求进行结构化问题澄清"
argument-hint: "[业务诉求描述]"
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-clarify.md >> .claude/commands/req-clarify.md

# req-breakdown 命令
cat > .claude/commands/req-breakdown.md << 'EOF'
---
description: "将澄清后的业务诉求拆解为功能特性列表"
argument-hint: "[需求名称或路径]"
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-breakdown.md >> .claude/commands/req-breakdown.md

# req-system-mapping 命令
cat > .claude/commands/req-system-mapping.md << 'EOF'
---
description: "将特性列表按关联系统进行聚合映射，生成各系统功能清单"
argument-hint: "[需求名称或路径]"
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-system-mapping.md >> .claude/commands/req-system-mapping.md

# req-prototype 命令
cat > .claude/commands/req-prototype.md << 'EOF'
---
description: "根据特性列表生成可交互的 HTML 页面原型"
argument-hint: "[特性 ID 或需求名称]"
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-prototype.md >> .claude/commands/req-prototype.md

# req-document 命令
cat > .claude/commands/req-document.md << 'EOF'
---
description: "将分析全流程结果编制为标准化需求分析文档"
argument-hint: "[需求名称或路径]"
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-document.md >> .claude/commands/req-document.md
```

#### GitHub Copilot（`.github/prompts/`）

GitHub Copilot 使用 `.prompt.md` 文件和 YAML Frontmatter。通过 `cat` 拼合：

```bash
mkdir -p .github/prompts/

# req-clarify 提示
cat > .github/prompts/req-clarify.prompt.md << 'EOF'
---
agent: 'agent'
description: '对业务诉求进行结构化问题澄清'
argument-hint: '[业务诉求描述]'
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-clarify.md >> .github/prompts/req-clarify.prompt.md

# req-breakdown 提示
cat > .github/prompts/req-breakdown.prompt.md << 'EOF'
---
agent: 'agent'
description: '将澄清后的业务诉求拆解为功能特性列表'
argument-hint: '[需求名称或路径]'
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-breakdown.md >> .github/prompts/req-breakdown.prompt.md

# req-system-mapping 提示
cat > .github/prompts/req-system-mapping.prompt.md << 'EOF'
---
agent: 'agent'
description: '将特性列表按关联系统进行聚合映射，生成各系统功能清单'
argument-hint: '[需求名称或路径]'
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-system-mapping.md >> .github/prompts/req-system-mapping.prompt.md

# req-prototype 提示
cat > .github/prompts/req-prototype.prompt.md << 'EOF'
---
agent: 'agent'
description: '根据特性列表生成可交互的 HTML 页面原型'
argument-hint: '[特性 ID 或需求名称]'
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-prototype.md >> .github/prompts/req-prototype.prompt.md

# req-document 提示
cat > .github/prompts/req-document.prompt.md << 'EOF'
---
agent: 'agent'
description: '将分析全流程结果编制为标准化需求分析文档'
argument-hint: '[需求名称或路径]'
---

EOF
cat .asdm/toolsets/req-analyzer/actions/req-document.md >> .github/prompts/req-document.prompt.md
```

#### 腾讯 CodeBuddy（`.codebuddy/commands/`）

CodeBuddy 不支持 Frontmatter，直接复制指令文件即可：

```bash
mkdir -p .codebuddy/commands/

# 直接复制指令文件（无需 Frontmatter）
cp .asdm/toolsets/req-analyzer/actions/req-clarify.md .codebuddy/commands/
cp .asdm/toolsets/req-analyzer/actions/req-breakdown.md .codebuddy/commands/
cp .asdm/toolsets/req-analyzer/actions/req-system-mapping.md .codebuddy/commands/
cp .asdm/toolsets/req-analyzer/actions/req-prototype.md .codebuddy/commands/
cp .asdm/toolsets/req-analyzer/actions/req-document.md .codebuddy/commands/
```

### 4. 其他提供商的手动使用

如果你的 AI 编码助手不在自动检测范围内（Claude Code、GitHub Copilot、腾讯 CodeBuddy），你仍然可以手动使用 Req Analyzer：

#### 直接使用指令文件

1. **进入指令文件目录**：
   ```bash
   cd .asdm/toolsets/req-analyzer/actions/
   ```

2. **复制所需指令文件的相对路径**：
   - `req-clarify.md` — 问题澄清
   - `req-breakdown.md` — 特性拆解
   - `req-system-mapping.md` — 系统功能映射
   - `req-prototype.md` — 原型生成
   - `req-document.md` — 文档编制

3. **在 AI 编码助手中输入**：
   ```
   按照 {指令文件相对路径} 中的说明执行
   ```

## 初始化使用

### 问题澄清（req-clarify）

安装完成后，从问题澄清开始：

```shell
按照 .asdm/toolsets/req-analyzer/actions/req-clarify.md 中的说明执行
```

或使用斜杠命令：
```
/req-clarify 我们需要一个内部员工培训管理系统
```

此步骤将：
- 对业务诉求进行结构化提问
- 按维度分类：业务目标、用户角色、功能边界、非功能约束
- 生成澄清问题清单、假设条件列表和待确认事项

### 特性拆解（req-breakdown）

问题澄清完成后，运行特性拆解：

```shell
按照 .asdm/toolsets/req-analyzer/actions/req-breakdown.md 中的说明执行
```

或使用斜杠命令：
```
/req-breakdown REQ-001-员工培训系统
```

此步骤将：
- 将澄清后的业务诉求拆解为功能特性列表
- 生成 Feature ID、名称、优先级、描述、预估复杂度
- 标注特性间依赖关系

### 系统功能映射（req-system-mapping）

如需求涉及多个系统的集成，在特性拆解后可运行系统映射（可选）：

```shell
按照 .asdm/toolsets/req-analyzer/actions/req-system-mapping.md 中的说明执行
```

或使用斜杠命令：
```
/req-system-mapping REQ-001-员工培训系统
```

此步骤将：
- 将特性按关联系统进行聚合分析
- 生成各系统的功能清单和系统总览
- 明确系统边界和集成方式

**注**：如需求仅涉及单一系统，可跳过此步骤

### 原型生成（req-prototype）

特性拆解完成后，生成交互原型：

```shell
按照 .asdm/toolsets/req-analyzer/actions/req-prototype.md 中的说明执行
```

或使用斜杠命令：
```
/req-prototype F-001
```

此步骤将：
- 根据特性描述生成 HTML 格式的交互原型
- 辅助业务方可视化验证需求理解

### 文档编制（req-document）

全部分析完成后，编制标准化文档：

```shell
按照 .asdm/toolsets/req-analyzer/actions/req-document.md 中的说明执行
```

或使用斜杠命令：
```
/req-document REQ-001-员工培训系统
```

此步骤将：
- 汇总澄清记录、特性列表、原型等全部产物
- 生成标准化需求分析文档（Markdown 格式）

### 可用命令

安装完成后，可以使用以下命令：

1. **`/req-clarify`** — 对业务诉求进行结构化问题澄清
2. **`/req-breakdown`** — 将澄清后的业务诉求拆解为功能特性列表
3. **`/req-system-mapping`** — 将特性列表按关联系统进行聚合映射（多系统集成场景）
4. **`/req-prototype`** — 根据特性列表生成可交互的 HTML 页面原型
5. **`/req-document`** — 将分析全流程结果编制为标准化需求分析文档

## 工具集工作空间结构

安装后，Req Analyzer 将在 `.asdm/workspace/requirements/` 中创建以下结构：

```
.asdm/workspace/requirements/
├── requirements-list.md                    # 所有需求汇总
└── REQ-001-<需求名称>/
    ├── clarification-notes.md              # 澄清记录（req-clarify 产物）
    ├── feature-list.md                     # 特性列表（req-breakdown 产物）
    ├── system-function-list.md             # 系统功能清单（req-system-mapping 产物，可选）
    ├── system-overview.md                  # 系统总览（req-system-mapping 产物，可选）
    ├── prototypes/
    │   └── <feature-id>-prototype.html    # 交互原型（req-prototype 产物）
    └── requirement-doc.md                  # 需求分析文档（req-document 产物）
```

## Spec 文档模板

本工具集使用以下 Spec 文档作为输出模板：

1. **`clarification-notes-spec.md`** — 澄清记录模板：定义问题清单、回复记录、假设条件、待确认事项的结构
2. **`feature-list-spec.md`** — 特性列表模板：定义 Feature ID、名称、优先级、描述、复杂度、依赖关系的结构
3. **`system-function-list-spec.md`** — 系统功能清单模板：定义按系统聚合的功能归属、接口规范、数据交换的结构
4. **`style-guide-spec.md`** — 样式规范模板：定义配色方案、字体规范、间距规范、组件样式的结构
5. **`requirement-doc-spec.md`** — 需求文档模板：定义需求分析文档的完整章节结构和内容规范

## 验证

安装完成后，请验证以下内容：

1. `.asdm/workspace/requirements/` 目录已创建
2. Req Analyzer 的快捷命令已创建在对应的提供商目录中（如使用 Claude Code、GitHub Copilot 或腾讯 CodeBuddy）
3. Req Analyzer 工具集文件位于 `.asdm/toolsets/req-analyzer`

**其他提供商**：验证可以访问以下指令文件：
- `.asdm/toolsets/req-analyzer/actions/req-clarify.md`
- `.asdm/toolsets/req-analyzer/actions/req-breakdown.md`
- `.asdm/toolsets/req-analyzer/actions/req-system-mapping.md`
- `.asdm/toolsets/req-analyzer/actions/req-prototype.md`
- `.asdm/toolsets/req-analyzer/actions/req-document.md`

## 使用示例

### 示例 1：完整需求分析流程

```shell
# 首先安装工具集
按照 .asdm/toolsets/req-analyzer/INSTALL.md 中的说明执行

# 步骤 1：问题澄清
/req-clarify 我们需要一个内部员工培训管理系统，支持课程管理、学习进度跟踪和考试功能

# 步骤 2：特性拆解（澄清完成后）
/req-breakdown REQ-001-员工培训系统

# 步骤 3：系统功能映射（如涉及多系统集成，可选）
/req-system-mapping REQ-001-员工培训系统

# 步骤 4：生成原型（特性拆解完成后）
/req-prototype F-001

# 步骤 5：编制文档（全部完成后）
/req-document REQ-001-员工培训系统
```

### 示例 2：仅使用问题澄清

```shell
# 对单个业务诉求进行问题澄清
/req-clarify 客户希望增加一个数据导出功能，支持 Excel 和 PDF 格式
```

## 使用说明

### 支持的提供商（Claude Code、GitHub Copilot、腾讯 CodeBuddy）

安装后，可以使用以下斜杠命令：

- `/req-clarify`: 对业务诉求进行结构化问题澄清
- `/req-breakdown`: 将澄清后的业务诉求拆解为功能特性列表
- `/req-system-mapping`: 将特性列表按关联系统进行聚合映射（多系统集成场景）
- `/req-prototype`: 根据特性列表生成可交互的 HTML 页面原型
- `/req-document`: 将分析全流程结果编制为标准化需求分析文档

### 其他提供商（手动使用）

如果提供商未被自动检测，请参照「其他提供商的手动使用」章节手动使用指令文件。

## 注意事项

- 安装过程假定你拥有创建目录和文件的必要权限
- 命令的实际执行由 AI 模型使用 Req Analyzer 提供的模板和指令完成
- 请根据实际使用的 AI 编码助手定制提供商相关的设置
- 工具集 ID `req-analyzer` 在命令和文档中应保持一致使用
- **对于不在检测逻辑中的提供商**：用户可以手动使用指令文件，复制相对路径并输入提示如「按照 .asdm/toolsets/req-analyzer/actions/req-clarify.md 中的说明执行」
- Req Analyzer 的各阶段产物按顺序流转：澄清记录 → 特性列表 → 系统功能清单（可选） → 原型 → 需求文档，建议按工作流顺序使用

## 与其他工具集的集成

Req Analyzer 可以与其他 ASDM 工具集和上下文文件协同使用。Context Builder 生成的上下文文件可用于为需求分析文档提供项目背景信息，PRD Builder 可在需求分析完成后接续进行 Feature → Task 的分解工作。

### 获取帮助

如遇到 Req Analyzer 工具集相关问题，请参考：
- [ASDM 文档](https://asdm.ai/docs)
- 工具集 README：`.asdm/toolsets/req-analyzer/README.md`
- Spec 文档：`.asdm/toolsets/req-analyzer/spec/`

## License

Copyright (c) 2026 LeansoftX.com & iSoftStone. All rights reserved.

Licensed under the PROPRIETARY SOFTWARE LICENSE. See [LICENSE](LICENSE) in the project root for license information.

---

*本安装文档是 Req Analyzer 工具集的一部分。*
