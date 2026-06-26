# arch-builder - 架构图构建工具集

> 作用：结合 ASDM 上下文数据和 fireworks-tech-graph 技能，自动生成和更新项目架构图。
> 依赖：`yizhiyanhua-ai/fireworks-tech-graph` 技能

## 核心功能

1. **架构图生成** - 从 `.asdm/contexts/` 读取项目架构数据，生成 SVG+PNG 架构图
2. **架构图更新** - 当上下文变化时，重新生成架构图
3. **多图表支持** - 支持系统架构图、数据流图、部署图、组件图等
4. **风格定制** - 支持 8 种预设风格（Flat Icon / Dark Terminal / Blueprint 等）

## 使用流程

1. 读取 `.asdm/contexts/` 上下文数据
2. 解析架构层次、组件、依赖关系
3. 按照 fireworks-tech-graph 规范生成 SVG
4. 导出 PNG (通过 cairosvg)
5. 输出到 `docs/architecture/` 目录

## 包含内容

- [actions/](actions/) - 核心动作脚本
  - `asdm-arch-generate.md` - 生成架构图
  - `asdm-arch-update.md` - 更新架构图
- [specs/](specs/) - 规范定义
  - `diagram-spec.md` - 图表规范
- [templates/](templates/) - 模板文件
  - `architecture.json` - 架构图数据模板

## 目录结构

```
.asdm/toolsets/arch-builder/
├── README.md
├── INSTALL.md
├── actions/
│   ├── asdm-arch-generate.md
│   └── asdm-arch-update.md
├── specs/
│   └── diagram-spec.md
└── templates/
    └── architecture.json
```

## 相关工具

- **fireworks-tech-graph** - SVG 图表生成引擎
- **context-builder** - 上下文构建工具集
