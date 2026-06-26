# 安装说明

## 1. 安装依赖

### fireworks-tech-graph 技能
```bash
npx skills add yizhiyanhua-ai/fireworks-tech-graph --yes
```

### cairosvg (PNG 导出)
```bash
pip install cairosvg --break-system-packages
```

## 2. 验证安装

```bash
# 检查技能文件
ls .agents/skills/fireworks-tech-graph/

# 检查 cairosvg
python3 -c "import cairosvg; print('cairosvg OK')"
```

## 3. 使用方式

### 生成架构图
```bash
# 通过 ASDM 上下文生成
python3 .asdm/toolsets/arch-builder/templates/architecture.json
```

### 更新架构图
当 `.asdm/contexts/` 中的架构数据变化时，重新生成图表。

## 4. 输出位置

生成的图表保存在：
- SVG: `docs/architecture/*.svg`
- PNG: `docs/architecture/*.png`
