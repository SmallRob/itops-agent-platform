# asdm-domain-context-build: 构建领域详细内容

## 目的

为指定领域生成 L3 详细内容（< 5KB/文件），在执行具体任务时按需提供详细信息。

**前置条件**：
1. 已执行 `/asdm-context-init` 生成了 L1 顶层索引
2. 已执行 `/asdm-domain-index-build` 生成了 L2 领域索引

## 语言检测

在生成任何内容之前，必须检测并使用当前环境的响应语言。

## 上下文粒度原则

**L3 详细内容设计原则**：
- 大小限制：< 5KB/文件
- 高信息密度，聚焦关键定义
- 使用表格和代码片段
- 包含源码入口链接

## 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 领域名 | String | 是 | 要构建详细内容的领域名称 |
| 内容类型 | String | 否 | entities/services/apis/flows/all，默认 all |

## 构建步骤

### 步骤 1: 确认前置条件

1. 确认 `.asdm/contexts/index.md` 存在（L1）
2. 确认 `.asdm/contexts/domains/<领域名>-domain.md` 存在（L2）
3. 如果前置条件不满足，提示用户先执行相应命令

### 步骤 2: 分析领域代码

根据要生成的内容类型，分析对应代码：

1. **entities（实体）**
   - 核心实体类/表
   - 字段定义
   - 实体关系

2. **services（服务）**
   - 核心服务接口
   - 服务方法签名
   - 服务间调用关系

3. **apis（API）**
   - API 端点定义
   - 请求/响应格式
   - 错误码定义

4. **flows（流程）**
   - 核心业务流程
   - 状态机定义
   - 异常处理流程

### 步骤 3: 生成详细内容

根据指定的内容类型，使用对应模板生成：

**entities.md** - 使用 `specs/layer-3/entities.md`
- 核心实体定义（表格形式）
- 关键代码片段
- 实体关系图（Mermaid）

**services.md** - 使用 `specs/layer-3/services.md`
- 服务接口定义
- 核心方法签名
- 服务调用关系

**apis.md** - 使用 `specs/layer-3/apis.md`
- API 概览表
- API 详情
- 请求/响应示例

**flows.md** - 自定义
- 业务流程图（Mermaid）
- 状态机图（Mermaid）
- 关键决策点说明

### 步骤 4: 生成领域详细内容索引

生成 `domain-details/<领域名>-domain/index.md` 作为该领域详细内容的入口索引。

### 步骤 5: 更新 L2 索引

在 `.asdm/contexts/domains/<领域名>-domain.md` 中，更新"详细上下文入口"部分，添加新生成文件的链接。

## 输出摘要

| 文件 | 大小 | 说明 |
|------|------|------|
| `domain-details/<领域名>-domain/index.md` | < 5KB | 详细内容索引 |
| `domain-details/<领域名>-domain/entities.md` | < 5KB | 实体定义 |
| `domain-details/<领域名>-domain/services.md` | < 5KB | 服务接口 |
| `domain-details/<领域名>-domain/apis.md` | < 5KB | API 定义 |
| `domain-details/<领域名>-domain/flows.md` | < 5KB | 业务流程 |

## 使用方法

1. 用户执行具体任务，需要了解领域细节
2. 用户执行 `/asdm-domain-context-build <领域名>`
3. AI 分析领域代码，生成 L3 详细内容
4. 用户通过阅读详细内容执行任务

## 按需构建

如只需构建特定类型的详细内容：
```
/asdm-domain-context-build <领域名> entities   # 只生成实体
/asdm-domain-context-build <领域名> apis        # 只生成 API
/asdm-domain-context-build <领域名> services    # 只生成服务
```

## 注意事项

1. **保持精简**：单个文件 < 5KB，聚焦关键定义
2. **高信息密度**：避免大段描述，使用表格和代码片段
3. **源码链接**：包含到实际源码的入口
4. **按需构建**：不要一次性生成所有内容，根据任务需要构建
