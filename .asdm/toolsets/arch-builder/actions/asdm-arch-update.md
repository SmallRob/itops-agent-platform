# asdm-arch-update - 更新架构图

> 作用：当上下文变化时，重新生成架构图
> 前置依赖：已有架构图，上下文数据已更新

## 命令

```
asdm-arch-update
```

## 使用场景

- 新增/删除了领域模块
- 架构分层调整
- 组件依赖关系变化
- 部署拓扑变化

## 流程

### 1. 检测变化

```bash
# 检查上下文文件修改时间
find .asdm/contexts/ -name "*.md" -newer docs/architecture/ongrid-architecture-v1.svg
```

### 2. 对比变化

读取当前架构图数据和新上下文数据，识别：
- 新增组件
- 删除组件
- 关系变化
- 分层调整

### 3. 更新 SVG

基于变化重新生成 SVG，保持：
- 版本号递增 (v1 → v2)
- 风格一致性
- 布局优化

### 4. 验证和导出

```bash
# 验证
python3 -c "import xml.etree.ElementTree as ET; ET.parse('docs/architecture/ongrid-architecture-v2.svg')"

# 导出 PNG
python3 -c "import cairosvg; cairosvg.svg2png(url='docs/architecture/ongrid-architecture-v2.svg', write_to='docs/architecture/ongrid-architecture-v2.png', scale=2)"
```

### 5. 版本管理

保留旧版本用于对比：
```
docs/architecture/
├── ongrid-architecture-v1.svg
├── ongrid-architecture-v1.png
├── ongrid-architecture-v2.svg
└── ongrid-architecture-v2.png
```

## 更新策略

| 变化类型 | 更新方式 |
|----------|----------|
| 新增组件 | 添加节点，调整布局 |
| 删除组件 | 移除节点，重新连线 |
| 关系变化 | 更新箭头 |
| 分层调整 | 重新布局 |
| 风格变化 | 全量重新生成 |

## 自动化触发

可在以下场景自动触发更新：
- `git commit` 后检查 `.asdm/contexts/` 变化
- `context-builder` 更新上下文后
- CI/CD 流水线中定期检查
