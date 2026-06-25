# asdm-context-update: 更新项目上下文

## 目的

当工作区代码发生变更时，更新对应的上下文文件，保持上下文与实际代码的一致性。

## 语言检测

在更新任何内容之前，必须检测并使用当前环境的响应语言。

## 何时更新上下文

当发生以下变更时，需要更新上下文：

| 变更类型 | 需要更新的上下文层级 |
|----------|---------------------|
| 新增/删除模块 | L1 顶层索引 |
| 技术栈变化 | L1 顶层索引 |
| 新增/删除领域 | L1 + L2 |
| 领域结构变化 | L2 领域索引 |
| 实体/API/服务变更 | L3 详细内容 |
| 构建命令变化 | L1 顶层索引 |

## 更新步骤

### 步骤 1: 分析变更

分析工作区的变更：

1. **识别变更类型**
   - 新增了哪些文件/目录
   - 删除了哪些文件/目录
   - 修改了哪些文件

2. **确定影响范围**
   - 变更影响哪个层级（L1/L2/L3）
   - 变更影响哪个领域

3. **扫描变更内容**
   ```bash
   # 查看最近的变更
   git diff --name-only HEAD~5
   
   # 或手动描述变更
   ```

### 步骤 2: 确定需要更新的文件

根据变更类型，确定需要更新的上下文文件：

```markdown
## 变更分析

| 变更 | 影响范围 | 需要更新的文件 |
|------|----------|----------------|
| 新增 user-service 模块 | L1 | index.md |
| 修改 user-domain 实体 | L3 | domain-details/user-domain/entities.md |
| 新增 payment-domain 领域 | L1 + L2 | index.md + domains/payment-domain.md |
```

### 步骤 3: 执行增量更新

#### 3.1 更新 L1 顶层索引

当项目结构变化时，更新 `index.md`：

```markdown
# 更新的要点

1. **一句话描述**：如有变化，更新项目描述
2. **技术栈**：如有新增框架/库，更新此部分
3. **领域列表**：
   - 新增领域：添加新领域及入口
   - 删除领域：移除旧领域
   - 修改领域：更新领域信息
4. **构建指南**：如有命令变化，更新构建命令
```

#### 3.2 更新 L2 领域索引

当领域结构变化时，更新对应领域的 L2 索引：

- 新增子模块：在子模块表中添加
- 删除子模块：从子模块表中移除
- 职责变化：更新职责描述
- 依赖变化：更新外部依赖关系

#### 3.3 更新 L3 详细内容

当领域内具体内容变化时，更新 L3 文件：

| 变更类型 | 更新内容 |
|----------|----------|
| 实体变更 | entities.md - 更新实体定义 |
| 服务变更 | services.md - 更新服务接口 |
| API 变更 | apis.md - 更新 API 定义 |
| 流程变更 | flows.md - 更新流程图 |

### 步骤 4: 更新索引引用

更新完成后，确保索引间的引用关系正确：

1. L1 中新领域是否已添加到领域列表
2. L2 中详细内容入口是否正确
3. 链接路径是否有效

### 步骤 5: 验证更新

验证更新后的上下文：

1. 检查文件大小是否符合限制（L1<2KB, L2<1KB, L3<5KB）
2. 检查链接是否有效
3. 检查语言一致性

## 更新方式

### 方式 1: 指定变更类型

```bash
/asdm-context-update <变更类型>

# 示例
/asdm-context-update "新增 user-domain 模块"
/asdm-context-update "修改 payment-domain API"
/asdm-context-update "更新技术栈为 Spring Boot 3.0"
```

### 方式 2: 指定需要更新的文件

```bash
/asdm-context-update --file <文件路径>

# 示例
/asdm-context-update --file ".asdm/contexts/index.md"
/asdm-context-update --file ".asdm/contexts/domains/user-domain.md"
```

### 方式 3: 指定需要更新的领域

```bash
/asdm-context-update --domain <领域名>

# 示例
/asdm-context-update --domain user-domain
/asdm-context-update --domain "user-domain,payment-domain"
```

## 输出摘要

| 输出 | 说明 |
|------|------|
| 更新的上下文文件 | 按需更新的 L1/L2/L3 文件 |
| 更新报告 | 说明本次更新的内容和原因 |

## 使用示例

### 示例 1: 新增模块

```bash
用户: 项目新增了 customer-service 模块
AI:
  1. 分析 customer-service 的结构和职责
  2. 更新 L1 index.md 添加新领域
  3. 如需详细上下文，执行 /asdm-domain-index-build customer-domain
  4. 验证更新
```

### 示例 2: API 变更

```bash
用户: user-domain 的登录 API 改了参数
AI:
  1. 分析新的 API 定义
  2. 更新 L3 domain-details/user-domain/apis.md
  3. 验证更新
```

### 示例 3: 批量更新

```bash
用户: 项目进行了大的重构，多个模块都变了
AI:
  1. 分析所有变更
  2. 批量更新受影响的上下文文件
  3. 生成更新报告
```

## 注意事项

1. **增量更新**：只更新变更的部分，不要全量重建
2. **保持精简**：更新后仍需遵守大小限制
3. **保持一致性**：更新时确保语言、术语一致
4. **更新索引**：变更可能影响索引引用，及时更新
5. **用户确认**：重要变更建议用户确认后再更新
