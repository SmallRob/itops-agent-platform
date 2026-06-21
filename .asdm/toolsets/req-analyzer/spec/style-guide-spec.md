# 样式规范标准

**版本**: v1.0
**来源**: 标准特性条目字典设计稿
**日期**: 2026-04-03

---

## 1. 配色方案

### 1.1 主色调

| 颜色名称 | 颜色值 | 用途 |
|----------|--------|------|
| 主色 | `#D70010` | 主要按钮、高亮元素、重要操作 |
| 文字主色 | `#222E44` | 主要文字、标题 |
| 文字辅色 | `#888E95` | 次要文字、说明文字 |

### 1.2 功能色

| 颜色名称 | 颜色值 | 用途 |
|----------|--------|------|
| 成功色 | `#07C160` | 成功状态、成功提示 |
| 警示色 | `#FD9420` | 警告提示、待处理状态 |
| 超链接色 | `#3772FF` | 超链接、可点击文字 |

### 1.3 中性色

| 颜色名称 | 颜色值 | 用途 |
|----------|--------|------|
| 边框色 | `#DDE0E6` | 分割线、边框、表单边框 |
| 禁用色 | `#FAFAFC` | 禁用状态背景、不可操作区域 |
| 背景色 | `#FFFFFF` | 主要背景色 |
| 卡片背景 | `#F8F9FA` | 卡片、面板背景 |

---

## 2. 字体规范

### 2.1 字体族

```
字体族: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB",
         "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif
```

### 2.2 字号规范

| 用途 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 大标题 | 24px | 600 (Semi-Bold) | 32px |
| 中标题 | 20px | 600 (Semi-Bold) | 28px |
| 小标题 | 16px | 600 (Semi-Bold) | 24px |
| 正文 | 14px | 400 (Regular) | 22px |
| 辅助文字 | 12px | 400 (Regular) | 18px |

### 2.3 字重

| 字重 | 数值 | 用途 |
|------|------|------|
| Regular | 400 | 正文、辅助文字 |
| Medium | 500 | 次要标题 |
| Semi-Bold | 600 | 主要标题、重要文字 |
| Bold | 700 | 强调文字 |

---

## 3. 间距规范

### 3.1 基础间距单位

| 间距名称 | 数值 | 用途 |
|----------|------|------|
| 超小间距 | 4px | 图标与文字间距、紧凑布局 |
| 小间距 | 8px | 表单元素间距 |
| 中间距 | 16px | 卡片内边距、段落间距 |
| 大间距 | 24px | 区块间距 |
| 超大间距 | 32px | 页面主要区块间距 |

### 3.2 间距使用场景

- 页面顶部边距：24px
- 页面底部边距：24px
- 卡片内边距：16px
- 表单元素间距：8px
- 按钮内边距：上下 8px，左右 16px

---

## 4. 圆角规范

| 元素类型 | 圆角值 | 说明 |
|----------|--------|------|
| 按钮 | 4px | 主要按钮、次要按钮 |
| 输入框 | 4px | 文本输入框、下拉框 |
| 卡片 | 8px | 卡片容器、面板 |
| 标签 | 12px | 状态标签、分类标签（圆形） |
| 头像 | 50% | 圆形头像 |

---

## 5. 阴影规范

| 阴影类型 | CSS 值 | 用途 |
|----------|--------|------|
| 浅阴影 | `box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05)` | 悬停效果、轻微分层 |
| 中阴影 | `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)` | 卡片、弹窗 |
| 深阴影 | `box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12)` | 模态框、下拉菜单 |

---

## 6. 按钮规范

### 6.1 主要按钮

```
背景色: #D70010
文字色: #FFFFFF
圆角: 4px
内边距: 8px 16px
字重: 600
悬停: 背景色 #B8010E (变深 10%)
禁用: 背景色 #FAFAFC, 文字色 #DDE0E6
```

### 6.2 次要按钮

```
背景色: transparent
边框: 1px solid #DDE0E6
文字色: #222E44
圆角: 4px
内边距: 8px 16px
字重: 400
悬停: 背景色 #F8F9FA
禁用: 文字色 #DDE0E6
```

### 6.3 文字按钮

```
背景色: transparent
文字色: #3772FF
圆角: 0
内边距: 8px
悬停: 文字色 #2A5FD9 (变深 10%)
禁用: 文字色 #DDE0E6
```

---

## 7. 表单规范

### 7.1 输入框

```
边框: 1px solid #DDE0E6
圆角: 4px
内边距: 8px 12px
字号: 14px
行高: 22px
文字色: #222E44
占位文字色: #DDE0E6
聚焦: 边框色 #D70010
禁用: 背景色 #FAFAFC, 文字色 #DDE0E6
错误: 边框色 #D70010
```

### 7.2 下拉框

```
边框: 1px solid #DDE0E6
圆角: 4px
内边距: 8px 12px
字号: 14px
行高: 22px
文字色: #222E44
聚焦: 边框色 #D70010
下拉面板背景: #FFFFFF
下拉选项悬停: 背景色 #F8F9FA
```

---

## 8. 表格规范

### 8.1 表格容器

```
背景色: #FFFFFF
边框: 1px solid #DDE0E6
圆角: 4px
```

### 8.2 表头

```
背景色: #F8F9FA
文字色: #222E44
字号: 12px
字重: 600
内边距: 12px 16px
下边框: 1px solid #DDE0E6
```

### 8.3 表格行

```
文字色: #222E44
字号: 14px
内边距: 12px 16px
下边框: 1px solid #DDE0E6
悬停: 背景色 #F8F9FA
```

---

## 9. 标签规范

### 9.1 状态标签

| 状态 | 背景色 | 文字色 | 边框色 |
|------|--------|--------|--------|
| 成功 | #E6F9F0 | #07C160 | #07C160 |
| 警告 | #FFF4E6 | #FD9420 | #FD9420 |
| 错误 | #FDE6E6 | #D70010 | #D70010 |
| 信息 | #E6F0FF | #3772FF | #3772FF |
| 默认 | #F8F9FA | #888E95 | #DDE0E6 |

```
圆角: 4px
内边距: 4px 8px
字号: 12px
字重: 500
```

---

## 10. 卡片规范

```
背景色: #FFFFFF
边框: 1px solid #DDE0E6
圆角: 8px
内边距: 16px
阴影: 0 2px 8px rgba(0, 0, 0, 0.08)
标题字号: 16px
标题字重: 600
标题下边距: 12px
```

---

## 11. 图标规范

| 图标类型 | 尺寸 | 说明 |
|----------|------|------|
| 箭头图标 | 16px × 16px | 展开/收起、导航 |
| 数字图标 | 14px × 14px | 序号、计数 |
| 关闭图标 | 18.29px × 16px | 关闭、取消 |
| 操作图标 | 16px × 16px | 其他操作 |

---

## 12. 响应式断点

| 断点名称 | 屏幕宽度 | 适用设备 |
|----------|----------|----------|
| Mobile | < 768px | 手机 |
| Tablet | 768px - 1024px | 平板 |
| Desktop | 1024px - 1440px | 桌面 |
| Large | > 1440px | 大屏幕 |

---

## 13. CSS 变量定义

```css
:root {
  /* 主色调 */
  --color-primary: #D70010;
  --color-text-primary: #222E44;
  --color-text-secondary: #888E95;

  /* 功能色 */
  --color-success: #07C160;
  --color-warning: #FD9420;
  --color-link: #3772FF;

  /* 中性色 */
  --color-border: #DDE0E6;
  --color-disabled: #FAFAFC;
  --color-bg-white: #FFFFFF;
  --color-bg-gray: #F8F9FA;

  /* 字体 */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
                   "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue",
                   Helvetica, Arial, sans-serif;

  /* 字号 */
  --font-size-h1: 24px;
  --font-size-h2: 20px;
  --font-size-h3: 16px;
  --font-size-body: 14px;
  --font-size-caption: 12px;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 50%;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

---

## 14. 使用示例

### 14.1 按钮示例

```html
<!-- 主要按钮 -->
<button class="btn btn-primary">确认</button>

<!-- 次要按钮 -->
<button class="btn btn-secondary">取消</button>

<!-- 文字按钮 -->
<button class="btn btn-text">查看详情</button>
```

```css
.btn {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: var(--color-primary);
  color: #FFFFFF;
  font-weight: 600;
}

.btn-primary:hover {
  background-color: #B8010E;
}

.btn-secondary {
  background-color: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.btn-secondary:hover {
  background-color: var(--color-bg-gray);
}

.btn-text {
  background-color: transparent;
  color: var(--color-link);
  padding: 8px;
}

.btn-text:hover {
  color: #2A5FD9;
}
```

### 14.2 表单示例

```html
<div class="form-group">
  <label class="form-label">需求标题</label>
  <input type="text" class="form-input" placeholder="请输入需求标题">
  <span class="form-hint">最多 100 字符</span>
</div>
```

```css
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 22px;
}

.form-input::placeholder {
  color: var(--color-border);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-hint {
  display: block;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
```

---

## 15. 注意事项

1. **主色使用**：主色 `#D70010` 是品牌色，应谨慎使用，主要用于主要操作和强调元素
2. **文字层级**：严格区分主色和辅色，确保视觉层次清晰
3. **间距一致性**：使用定义的间距单位，保持视觉节奏统一
4. **圆角规范**：不同元素使用不同的圆角值，不要混用
5. **响应式设计**：在移动端适当缩小字号和间距
6. **可访问性**：确保文字与背景的对比度符合 WCAG 2.0 AA 标准

---

## 16. 附录

### 16.1 组件库参考

> **📦 组件库源码**：本项目 UI 组件基于 React 19 + Tailwind CSS v4 + Framer Motion 实现，不使用第三方 UI 组件库。
>
> 原型生成时应直接使用 Tailwind CSS 工具类构建组件，样式遵循本规范中定义的设计令牌。动画交互使用 Framer Motion，图标使用 Lucide React。

### 16.2 设计资源

- 图标资源路径：`.asdm\contexts\assets\`
- 预览页面：`.asdm\contexts\index.html`

### 16.3 Tailwind CSS v4 工具类映射

> **重要**：Nice Today 2.0 项目使用 Tailwind CSS v4，原型生成时应使用 Tailwind 工具类而非自定义 CSS。

#### 16.3.1 颜色工具类

| 设计令牌 | 颜色值 | Tailwind 类 |
|---------|--------|------------|
| 主色 | `#D70010` | `bg-[#D70010]` / `text-[#D70010]` / `border-[#D70010]` |
| 文字主色 | `#222E44` | `text-[#222E44]` |
| 文字辅色 | `#888E95` | `text-[#888E95]` |
| 成功色 | `#07C160` | `text-[#07C160]` / `bg-[#07C160]` |
| 警示色 | `#FD9420` | `text-[#FD9420]` / `bg-[#FD9420]` |
| 超链接色 | `#3772FF` | `text-[#3772FF]` |
| 边框色 | `#DDE0E6` | `border-[#DDE0E6]` |
| 背景色 | `#FFFFFF` | `bg-white` |
| 卡片背景 | `#F8F9FA` | `bg-[#F8F9FA]` |

#### 16.3.2 间距工具类

| 设计令牌 | 数值 | Tailwind 类 |
|---------|------|------------|
| 超小间距 | 4px | `p-1` / `m-1` / `gap-1` |
| 小间距 | 8px | `p-2` / `m-2` / `gap-2` |
| 中间距 | 16px | `p-4` / `m-4` / `gap-4` |
| 大间距 | 24px | `p-6` / `m-6` / `gap-6` |
| 超大间距 | 32px | `p-8` / `m-8` / `gap-8` |

#### 16.3.3 圆角工具类

| 设计令牌 | 数值 | Tailwind 类 |
|---------|------|------------|
| 小圆角 | 4px | `rounded` |
| 中圆角 | 8px | `rounded-lg` |
| 大圆角 | 12px | `rounded-xl` |
| 圆形 | 50% | `rounded-full` |

#### 16.3.4 字体工具类

| 用途 | 字号 | Tailwind 类 |
|------|------|------------|
| 大标题 | 24px | `text-2xl` |
| 中标题 | 20px | `text-xl` |
| 小标题 | 16px | `text-base` |
| 正文 | 14px | `text-sm` |
| 辅助文字 | 12px | `text-xs` |

| 字重 | 数值 | Tailwind 类 |
|------|------|------------|
| Regular | 400 | `font-normal` |
| Medium | 500 | `font-medium` |
| Semi-Bold | 600 | `font-semibold` |
| Bold | 700 | `font-bold` |

#### 16.3.5 阴影工具类

| 阴影类型 | Tailwind 类 |
|----------|------------|
| 浅阴影 | `shadow-sm` |
| 中阴影 | `shadow-md` |
| 深阴影 | `shadow-lg` |

#### 16.3.6 React 组件示例

```tsx
// 使用 Tailwind 工具类的 React 组件示例
import React from 'react';

export const ExampleCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="text-base font-semibold text-[#222E44] mb-4">卡片标题</h3>
      <p className="text-sm text-[#888E95] mb-2">卡片内容</p>
      <button className="px-4 py-2 bg-[#D70010] text-white rounded hover:bg-[#B8010E] transition-colors">
        主要按钮
      </button>
    </div>
  );
};
```

### 16.4 更新记录

| 版本 | 日期 | 修改内容 | 修改人 |
|------|------|----------|--------|
| v1.4 | 2026-05-08 | 移除 Ant Design 引用，改为 Tailwind CSS v4 + Framer Motion 原生组件方案 | AI |
| v1.3 | 2026-05-06 | 新增 Tailwind CSS v4 工具类映射，适配 Nice Today 2.0 项目 | AI |
| v1.2 | 2026-04-07 | 新增组件库参考说明 | AI |
| v1.1 | 2026-04-07 | 同步设计资源到本地，将绝对路径更新为相对路径 | AI |
| v1.0 | 2026-04-03 | 初始版本，基于标准特性条目字典设计稿提取 | AI |
