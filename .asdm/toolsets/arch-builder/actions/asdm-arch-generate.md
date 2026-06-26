# asdm-arch-generate - 生成架构图

> 作用：从 ASDM 上下文数据生成项目架构图
> 前置依赖：`fireworks-tech-graph` 技能已安装，`cairosvg` 已安装

## 命令

```
asdm-arch-generate
```

## 使用场景

- 项目初始化后生成首张架构图
- 重大架构变更后重新生成
- 需要不同风格的架构图

## 流程

### 1. 读取上下文数据

```bash
# 读取项目索引
cat .asdm/contexts/index.md

# 读取架构文档
cat .asdm/contexts/workspace/architecture.md

# 读取领域索引
cat .asdm/contexts/domains/*.md
```

### 2. 解析架构层次

从 `architecture.md` 中提取：
- 分层结构（接入层/API层/业务层/基础设施层/数据层）
- 各层组件列表
- 组件间依赖关系
- 外部服务连接

### 3. 生成 SVG

使用 fireworks-tech-graph 规范：
- **图表类型**: Architecture Diagram
- **布局**: 水平分层（上→下）
- **风格**: Style 1 (Flat Icon) 或用户指定
- **ViewBox**: `0 0 960 700`

### 4. SVG 生成方法 (Python List Method)

```python
python3 << 'EOF'
lines = []
lines.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 700">')
lines.append('  <defs>')
lines.append('    <style>')
lines.append('      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;')
lines.append('    </style>')
lines.append('    <marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">')
lines.append('      <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb"/>')
lines.append('    </marker>')
lines.append('  </defs>')
# ... 添加组件和箭头
lines.append('</svg>')

with open('docs/architecture/ongrid-architecture-v1.svg', 'w') as f:
    f.write('\n'.join(lines))
print("SVG generated")
EOF
```

### 5. 验证 SVG

```bash
python3 -c "import xml.etree.ElementTree as ET; ET.parse('docs/architecture/ongrid-architecture-v1.svg')" && echo "✓ Valid XML"
```

### 6. 导出 PNG

```bash
python3 -c "import cairosvg; cairosvg.svg2png(url='docs/architecture/ongrid-architecture-v1.svg', write_to='docs/architecture/ongrid-architecture-v1.png', scale=2)"
```

### 7. 报告输出

```
生成完成：
- SVG: docs/architecture/ongrid-architecture-v1.svg
- PNG: docs/architecture/ongrid-architecture-v1.png
```

## 图表风格选择

| 风格 | 适用场景 | 背景色 |
|------|----------|--------|
| Style 1 (Flat Icon) | 文档、博客、演示 | 白色 |
| Style 2 (Dark Terminal) | GitHub、技术文章 | `#0f0f1a` |
| Style 3 (Blueprint) | 架构文档 | `#0a1628` |
| Style 4 (Notion Clean) | Notion 笔记 | 白色 |
| Style 5 (Glassmorphism) | 产品网站 | 暗色渐变 |

## 错误处理

- 如果上下文数据不完整，提示先运行 `context-builder` 更新上下文
- 如果 cairosvg 未安装，使用 `pip install cairosvg` 安装
- 如果 SVG 语法错误，使用 Python List Method 重新生成
