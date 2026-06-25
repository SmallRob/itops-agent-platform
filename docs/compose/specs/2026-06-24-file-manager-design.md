# [S1] 问题陈述

IT运维平台已有Web SSH终端功能，但缺少文件管理能力。运维人员在终端操作时经常需要查看和编辑服务器上的配置文件、脚本等，目前只能通过终端命令（如vim、nano）完成，效率较低且对新手不友好。

# [S2] 解决方案概述

基于现有SSH终端架构，扩展文件管理功能：
1. **终端侧边栏**：在Web终端旁边添加文件浏览器，方便在终端操作时查看和编辑文件
2. **独立文件管理页面**：创建独立的文件管理页面，支持完整的文件操作
3. **智能编辑器**：根据文件类型自动选择编辑器（简单文本编辑器 vs Monaco代码编辑器）
4. **可配置操作**：管理员可配置允许的文件操作集

# [S3] 架构设计

## [S3.1] 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (React + TypeScript)               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ 终端侧边栏  │  │ 文件管理页面│  │ 编辑器组件          │ │
│  │ FileSidebar │  │ FileManager │  │ TextEditor/Monaco   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端 (Node.js + Express)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              fileManagerService.ts                   │   │
│  │  - 文件列表、读取、写入、删除、重命名、创建          │   │
│  │  - 基于现有SSH连接复用                               │   │
│  │  - 可配置操作权限                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              terminalService.ts (已有)               │   │
│  │  - SSH连接管理                                      │   │
│  │  - 会话生命周期                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    远程服务器 (SSH)                          │
│              SFTP子系统 / Shell命令                         │
└─────────────────────────────────────────────────────────────┘
```

## [S3.2] 技术选型

| 组件 | 技术方案 | 理由 |
|------|----------|------|
| 文件浏览器 | 自定义组件 | 与现有UI风格一致，轻量级 |
| 代码编辑器 | Monaco Editor | VS Code同款，功能强大，支持语法高亮、自动补全 |
| 简单编辑器 | textarea + 基本格式化 | 用于纯文本文件，轻量快速 |
| 文件操作 | ssh2 SFTP子系统 | 复用现有SSH连接，无需额外依赖 |
| 本地文件 | File System Access API | 浏览器原生API，安全可控 |
| WebSocket | Socket.io | 复用现有基础设施 |

## [S3.3] 数据流

### 远程服务器文件操作

```
前端组件 → WebSocket事件 → fileManagerService → ssh2 SFTP → 远程服务器
    ↓
Monaco Editor ← 文件内容 ← SFTP读取响应
```

### 本地文件操作

```
前端组件 → File System Access API → 本地文件系统
    ↓
Monaco Editor ← 文件内容 ← FileReader
```

# [S4] 功能设计

## [S4.1] 文件浏览器组件 (FileBrowser)

### 功能特性
- 树形目录结构展示
- 文件/文件夹图标区分
- 右键上下文菜单（可配置操作）
- 搜索过滤功能
- 拖拽支持（未来扩展）

### 操作配置
```typescript
interface FileOperations {
  create: boolean;      // 创建文件/文件夹
  read: boolean;        // 读取文件内容
  update: boolean;      // 编辑/保存文件
  delete: boolean;      // 删除文件/文件夹
  rename: boolean;      // 重命名
  upload: boolean;      // 上传文件
  download: boolean;    // 下载文件
  copy: boolean;        // 复制文件/文件夹
  paste: boolean;       // 粘贴文件/文件夹
  cut: boolean;         // 剪切文件/文件夹
  compress: boolean;    // 压缩文件/文件夹
  extract: boolean;     // 解压文件
  permissions: boolean; // 修改权限
  ownership: boolean;   // 修改所有者
}
```

## [S4.2] 编辑器组件

### 智能编辑器选择
```typescript
function getEditorType(filePath: string): 'monaco' | 'text' {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const codeExtensions = [
    // Web前端
    'js', 'ts', 'jsx', 'tsx', 'vue', 'svelte', 'html', 'htm', 'css', 'scss', 'sass', 'less',
    // 后端语言
    'py', 'java', 'go', 'rs', 'rb', 'php', 'c', 'cpp', 'h', 'hpp', 'cs', 'swift', 'kt',
    // Shell脚本
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
    // 数据格式
    'json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'cfg', 'conf',
    // 数据库
    'sql', 'mysql', 'pgsql', 'mongodb',
    // 文档
    'md', 'txt', 'rst', 'tex',
    // 其他
    'dockerfile', 'makefile', 'cmake', 'gradle', 'maven'
  ];
  
  if (codeExtensions.includes(ext || '')) {
    return 'monaco';
  }
  return 'text';
}
```

### Monaco Editor 配置
- 主题：VS Code Dark+（与终端风格一致）
- 语言自动检测
- 保存快捷键：Ctrl+S / Cmd+S
- 自动保存选项（可配置）

## [S4.3] 终端侧边栏

### 布局设计
```
┌─────────────────────────────────────────┐
│ 服务器选择 │ 文件浏览器 │ 终端          │
│           │           │               │
│           │  目录树    │  xterm.js     │
│           │           │               │
│           │           │               │
└─────────────────────────────────────────┘
```

### 交互逻辑
1. 选择服务器后，自动加载根目录文件列表
2. 点击文件 → 在编辑器中打开
3. 双击文件夹 → 展开子目录
4. 右键 → 显示操作菜单（基于配置）
5. 终端命令 `cd` → 同步更新文件浏览器路径

## [S4.4] 独立文件管理页面

### 功能布局
- 左侧：服务器列表 + 文件树
- 右侧：编辑器区域（支持多标签页）
- 顶部：面包屑导航 + 操作按钮
- 底部：状态栏（文件信息、编码、行号）

# [S5] 后端设计

## [S5.1] 新增服务：fileManagerService.ts

### 核心方法
```typescript
class FileManagerService {
  // 获取文件列表
  async listFiles(serverId: string, path: string): Promise<FileItem[]>;
  
  // 读取文件内容
  async readFile(serverId: string, path: string): Promise<string>;
  
  // 写入文件内容
  async writeFile(serverId: string, path: string, content: string): Promise<void>;
  
  // 删除文件/文件夹
  async delete(serverId: string, path: string): Promise<void>;
  
  // 重命名
  async rename(serverId: string, oldPath: string, newPath: string): Promise<void>;
  
  // 创建文件夹
  async createDirectory(serverId: string, path: string): Promise<void>;
  
  // 获取文件信息
  async getFileInfo(serverId: string, path: string): Promise<FileInfo>;
}
```

### SSH连接复用
- 复用terminalService的SSH连接池
- 为文件操作创建独立的SFTP子系统
- 连接生命周期与终端会话一致

## [S5.2] WebSocket事件扩展

### 新增事件
```typescript
// 客户端 → 服务端
'file:list'        // 请求文件列表
'file:read'        // 读取文件内容
'file:write'       // 写入文件内容
'file:delete'      // 删除文件
'file:rename'      // 重命名
'file:mkdir'       // 创建文件夹
'file:copy'        // 复制文件/文件夹
'file:paste'       // 粘贴文件/文件夹
'file:cut'         // 剪切文件/文件夹
'file:compress'    // 压缩文件/文件夹
'file:extract'     // 解压文件
'file:permissions' // 修改权限
'file:ownership'   // 修改所有者
'file:upload'      // 上传文件
'file:download'    // 下载文件
'file:search'      // 搜索文件

// 服务端 → 客户端
'file:list:data'   // 文件列表数据
'file:content'     // 文件内容
'file:error'       // 文件操作错误
'file:changed'     // 文件变更通知（watch功能）
'file:progress'    // 操作进度（压缩、解压、上传、下载）
'file:search:data' // 搜索结果
```

## [S5.3] API端点

### REST API（用于批量操作和本地文件）
```
GET    /api/files/:serverId/list?path=...
GET    /api/files/:serverId/read?path=...
POST   /api/files/:serverId/write
DELETE /api/files/:serverId/delete
POST   /api/files/:serverId/rename
POST   /api/files/:serverId/mkdir
POST   /api/files/upload
GET    /api/files/download
```

# [S6] 前端设计

## [S6.1] 组件结构

```
frontend/src/
├── components/
│   ├── FileManager/
│   │   ├── FileBrowser.tsx        # 文件树浏览器
│   │   ├── FileTreeItem.tsx       # 文件树节点
│   │   ├── FileContextMenu.tsx    # 右键菜单
│   │   ├── FileBreadcrumb.tsx     # 面包屑导航
│   │   └── FileSearch.tsx         # 文件搜索
│   ├── Editor/
│   │   ├── SmartEditor.tsx        # 智能编辑器容器
│   │   ├── MonacoEditor.tsx       # Monaco编辑器包装
│   │   ├── TextEditor.tsx         # 简单文本编辑器
│   │   └── EditorTabs.tsx         # 多标签页管理
│   └── WebTerminal.tsx            # 已有终端组件
├── pages/
│   ├── FileManagerPage.tsx        # 独立文件管理页面
│   └── TerminalPage.tsx           # 终端页面（扩展侧边栏）
└── hooks/
    ├── useFileManager.ts          # 文件管理Hook
    └── useFileOperations.ts       # 文件操作Hook
```

## [S6.2] 状态管理

```typescript
interface FileManagerState {
  // 当前服务器
  currentServerId: string | null;
  
  // 文件树状态
  fileTree: Map<string, FileItem[]>;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  
  // 编辑器状态
  openFiles: OpenFile[];
  activeFileId: string | null;
  
  // 剪贴板状态
  clipboard: {
    items: ClipboardItem[];
    operation: 'copy' | 'cut' | null;
  };
  
  // 搜索状态
  search: {
    query: string;
    results: SearchResult[];
    isSearching: boolean;
  };
  
  // 历史记录
  history: {
    navigation: string[];  // 路径导航历史
    recentFiles: string[]; // 最近打开的文件
    undoStack: Operation[]; // 操作撤销栈
    redoStack: Operation[]; // 操作重做栈
  };
  
  // 操作状态
  loading: boolean;
  error: string | null;
  
  // 操作日志
  operationLogs: OperationLog[];
  
  // 配置
  operations: FileOperations;
}

interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  modified: boolean;
  editorType: 'monaco' | 'text';
  encoding: string;
  lineEnding: 'LF' | 'CRLF';
  cursorPosition: { line: number; column: number };
  scrollPosition: { top: number; left: number };
}

interface ClipboardItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

interface SearchResult {
  path: string;
  name: string;
  type: 'file' | 'directory';
  matches: {
    line: number;
    content: string;
    startIndex: number;
    endIndex: number;
  }[];
}

interface Operation {
  id: string;
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy' | 'edit';
  path: string;
  oldPath?: string;
  newPath?: string;
  content?: string;
  timestamp: Date;
}

interface OperationLog {
  id: string;
  operation: string;
  path: string;
  user: string;
  timestamp: Date;
  details: string;
  status: 'success' | 'failed';
}

// 持久化配置
interface PersistedState {
  expandedPaths: string[];
  openFiles: string[];
  recentFiles: string[];
  editorSettings: {
    fontSize: number;
    tabSize: number;
    wordWrap: 'on' | 'off';
    minimap: boolean;
  };
}
```

## [S6.3] 样式设计

- 遵循现有Tailwind CSS风格
- VS Code Dark+主题配色
- 响应式布局（支持侧边栏折叠）
- 深色模式优先（与终端一致）

# [S7] 安全考虑

## [S7.1] 权限控制
- 基于角色的操作权限（admin可配置）
- 文件路径白名单/黑名单
- 敏感文件保护（如/etc/shadow）

## [S7.2] 输入验证
- 文件路径规范化（防止路径遍历攻击）
- 文件大小限制
- 文件类型过滤

## [S7.3] 审计日志
- 记录所有文件操作
- 操作人、时间、路径、操作类型
- 与现有审计系统集成

# [S8] 性能优化

## [S8.1] 文件树懒加载
- 按需加载子目录
- 虚拟滚动（大量文件时）

## [S8.2] 文件内容缓存
- LRU缓存最近打开的文件
- 缓存失效策略（文件变更时）

## [S8.3] 增量更新
- 文件变更时只更新差异部分
- WebSocket推送变更通知

# [S9] 测试策略

## [S9.1] 单元测试
- FileManagerService所有方法
- 文件操作权限检查
- 路径规范化函数

## [S9.2] 集成测试
- WebSocket事件流程
- 文件操作端到端测试
- 错误处理场景
- 并发操作测试
- 大文件处理测试
- 网络中断恢复测试
- 权限边界测试
- 路径遍历攻击测试

## [S9.3] E2E测试
- 文件浏览 → 打开 → 编辑 → 保存流程
- 终端侧边栏交互
- 多标签页管理

# [S10] 实现计划

## [S10.1] 第一阶段：基础架构（1周）
1. 创建fileManagerService.ts
2. 实现SFTP文件操作基础方法
3. 添加WebSocket事件处理
4. 创建FileBrowser基础组件

## [S10.2] 第二阶段：编辑器集成（1周）
1. 集成Monaco Editor
2. 实现SmartEditor组件
3. 实现TextEditor组件
4. 多标签页管理

## [S10.3] 第三阶段：终端集成（3天）
1. 扩展终端页面布局
2. 实现FileSidebar组件
3. 终端路径同步

## [S10.4] 第四阶段：独立页面（3天）
1. 创建FileManagerPage
2. 实现面包屑导航
3. 实现搜索功能

## [S10.5] 第五阶段：安全与优化（3天）
1. 权限控制实现
2. 审计日志集成
3. 性能优化

# [S11] 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SFTP性能问题 | 高 | 使用连接池，批量操作 |
| 大文件处理 | 中 | 流式读取，分块传输 |
| 浏览器兼容性 | 低 | File System Access API降级方案 |
| 安全漏洞 | 高 | 严格的路径验证，权限检查 |

# [S12] 未来扩展

## [S12.1] 文件对比
- 集成diff编辑器
- 版本历史对比

## [S12.2] 协作编辑
- 多人同时编辑
- 实时光标同步

## [S12.3] 文件搜索
- 全文搜索
- 正则表达式搜索

## [S12.4] 文件同步
- 本地 ↔ 远程同步
- 自动备份

# [S13] 参考资料

## 编辑器
- Monaco Editor: https://microsoft.github.io/monaco-editor/

## SSH/SFTP
- ssh2 SFTP: https://github.com/mscdex/ssh2#sftp

## 文件系统API
- File System Access API: https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API

## 终端
- xterm.js: https://xtermjs.org/

## 安全
- 路径遍历攻击防护: https://owasp.org/www-community/attacks/Path_Traversal
- 文件上传安全: https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload
- 输入验证最佳实践: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
