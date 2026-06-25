# Req Analyzer

**工具集ID**: `req-analyzer`
**版本**: `0.0.1`
**用途**: 面向需求分析师的需求分析工具集，在需求分析阶段提供业务诉求的问题澄清、特性拆解、原型生成及文档编制能力

## 工作流阶段

### 标准流程

```
Clarify  →  Breakdown (+外部服务识别)  →  Prototype  →  Document
(问题澄清)    (特性拆解 + 依赖分析)           (原型生成)      (文档编制)
```

| 阶段 | 指令 | 输出 |
|------|------|------|
| Clarify | `/req-clarify` | 结构化澄清记录（问题清单 + 回复） |
| Breakdown | `/req-breakdown` | Feature 列表 + 外部服务依赖清单 |
| System Mapping | `/req-system-mapping` | 外部服务集成检查清单(可选) |
| Prototype | `/req-prototype` | React + TypeScript + Tailwind 组件原型 |
| Document | `/req-document` | 标准化需求分析文档 |

**优化说明**:
- `system-mapping` 从独立流程降级为可选步骤,主要用于复杂外部服务集成场景
- 外部服务依赖识别(Gemini AI/Capacitor/Three.js)已整合到 `breakdown` 阶段
- 原型生成从 HTML 升级为 React + TypeScript + Tailwind CSS v4 组件

### 快速模式（新增）

对于需求已明确的场景，可跳过澄清和拆解阶段：

#### 直接生成原型

```
/req-prototype 需求:实现用户登录功能,包括账号密码登录和手机验证码登录
```

- 自动从需求描述提取特性
- 在内存中生成临时特性列表
- 快速产出可交互原型

#### 直接生成文档

```
/req-document 需求:实现用户登录功能,包括账号密码登录和手机验证码登录
```

- 自动生成最小化澄清记录和特性列表
- 快速产出需求分析文档
- 适合需求已明确的简单场景

## 工具集定位

Req Analyzer 主要服务于**需求分析阶段**，帮助需求分析师将模糊的业务诉求转化为清晰、结构化的需求产物。与 PRD Builder（聚焦 Feature → Task 分解）不同，Req Analyzer 聚焦于需求分析的**上游阶段**——从原始业务诉求到结构化特性定义的完整过程。

## 功能特性

### 通用特性

- 支持中文业务诉求输入，适配国内需求分析场景
- 渐进式上下文加载，按需获取项目背景信息
- 结构化输出，确保需求分析产物规范统一
- 每个阶段产物可作为下一阶段的输入，形成完整分析链路

### 问题澄清 (req-clarify)

对业务诉求进行结构化提问，消除需求歧义，明确关键约束和假设条件。

**输入**：业务诉求文本（自然语言描述）
**输出**：
- 澄清问题清单（按维度分类：业务目标、用户角色、功能边界、非功能约束）
- 假设条件列表
- 待确认事项

**使用场景**：收到新的业务诉求后，在深入分析前进行问题澄清

### 特性拆解 (req-breakdown)

将澄清后的业务诉求拆解为可管理的功能特性列表,明确特性边界、优先级和外部服务依赖。

**输入**：澄清记录（req-clarify 产物）
**输出**：
- Feature 列表（ID、名称、优先级、简要描述、预估复杂度）
- 特性间依赖关系说明
- **外部服务依赖清单**（Gemini AI/Capacitor/Three.js等）

**使用场景**：问题澄清完成后,将业务诉求拆解为具体可交付的功能特性

### 系统功能映射 (req-system-mapping) [可选]

检查特性列表中的外部服务依赖,生成集成检查清单和风险提示。

**输入**：特性列表（req-breakdown 产物）
**输出**：
- 外部服务集成清单（Gemini AI/Capacitor/Three.js）
- API 调用风险评估
- 权限申请清单（Capacitor 插件）
- 性能注意事项（Three.js）

**使用场景**：
- 需求涉及 Gemini AI 集成（数字分身对话、智能分析）
- 需要使用 Capacitor 原生能力（相机、定位、存储）
- 包含 Three.js 3D 渲染（虚拟展示、能量树）
- 需要评估外部服务集成风险时

### 原型生成 (req-prototype)

根据需求描述生成 React 组件原型,辅助需求可视化验证。支持按特性过滤生成原型,并标注外部服务依赖。

**支持两种模式**：

#### 标准模式
- 输入：Feature 列表（req-breakdown 产物）、澄清记录（推荐）
- 输出：React + TypeScript + Tailwind CSS v4 组件原型（.tsx 文件）
- 适合：经过完整澄清和拆解的复杂需求

#### 快速模式（新增）
- 输入：需求描述（自然语言）
- 自动从需求描述提取特性,生成临时特性列表
- 输出：React + TypeScript + Tailwind CSS v4 组件原型
- 适合：需求已明确,快速验证需求理解

**使用场景**：
- 特性拆解完成后,生成可视化原型与业务方确认需求理解是否一致
- 涉及外部服务集成的需求,需要标注依赖和降级方案
- 需要符合现有代码风格的原型（React 19 + TypeScript + Tailwind v4 + Framer Motion）
- **需求已明确,快速生成原型**（快速模式）

### 文档编制 (req-document)

将分析全流程结果编制为标准化的需求分析文档。

**支持两种模式**：

#### 标准模式
- 输入：澄清记录、Feature 列表、系统功能清单（可选）、原型（可选）
- 输出：标准化需求分析文档（Markdown 格式，含系统集成说明章节）
- 适合：经过完整澄清和拆解的复杂需求，需要严格追溯性

#### 快速模式（新增）
- 输入：需求描述（自然语言）
- 自动生成最小化澄清记录和特性列表
- 输出：简化版需求分析文档
- 适合：需求已明确,快速产出文档用于沟通确认

**使用场景**：
- 需求分析完成后，归档标准化文档供下游开发团队使用
- **需求已明确，快速生成文档**（快速模式）

## 文档存放位置

```
.asdm/workspace/requirements/
├── requirements-list.md                    # 所有需求汇总
└── REQ-001-<需求名称>/
    ├── clarification-notes.md              # 澄清记录（req-clarify 产物）
    ├── feature-list.md                     # 特性列表（req-breakdown 产物）
    ├── system-function-list.md             # 系统功能清单（req-system-mapping 产物）
    ├── system-overview.md                  # 系统总览（req-system-mapping 产物）
    ├── prototypes/
    │   └── <feature-id>-prototype.html    # 交互原型（req-prototype 产物）
    └── requirement-doc.md                  # 需求分析文档（req-document 产物）
```

## Spec 文档模板

本工具集包含 4 个 Spec 模板，用于规范各阶段的输出文档结构：

| Spec 模板 | 对应指令 | 说明 |
|-----------|---------|------|
| [clarification-notes-spec.md](spec/clarification-notes-spec.md) | `/req-clarify` | 澄清记录模板：定义问题清单、回复记录、假设条件、待确认事项的结构 |
| [feature-list-spec.md](spec/feature-list-spec.md) | `/req-breakdown` | 特性列表模板：定义 Feature ID、名称、优先级、描述、复杂度、依赖关系的结构 |
| [system-function-list-spec.md](spec/system-function-list-spec.md) | `/req-system-mapping` | 系统功能清单模板：定义按系统聚合的功能归属、接口规范、数据交换的结构 |
| [requirement-doc-spec.md](spec/requirement-doc-spec.md) | `/req-document` | 需求文档模板：定义需求分析文档的完整章节结构和内容规范 |

## 工具集目录结构

```
.asdm/
└── toolsets/
    └── req-analyzer/
        ├── INSTALL.md
        ├── README.md
        ├── actions/
        │   ├── req-clarify.md
        │   ├── req-breakdown.md
        │   ├── req-system-mapping.md
        │   ├── req-prototype.md
        │   └── req-document.md
        └── spec/
            ├── clarification-notes-spec.md
            ├── feature-list-spec.md
            ├── system-function-list-spec.md
            ├── requirement-doc-spec.md
            └── style-guide-spec.md
```

## Copyright & License

Copyright (c) 2026 LeansoftX.com & iSoftStone. All rights reserved.

Licensed under the PROPRIETARY SOFTWARE LICENSE. See [LICENSE](LICENSE) in the project root for license information.
