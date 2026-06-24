# [文件管理功能] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为IT运维平台添加文件管理功能，支持远程服务器和本地文件的浏览、编辑、保存，包含终端侧边栏和独立文件管理页面。

**Architecture:** 基于现有SSH终端架构扩展，复用terminalService的SSH连接池，新增fileManagerService处理文件操作，前端集成Monaco Editor作为代码编辑器，支持智能编辑器切换。

**Tech Stack:** React 18, TypeScript, Monaco Editor, xterm.js, Socket.io, ssh2 SFTP, Tailwind CSS

## 文件结构

### 后端文件
```
backend/src/
├── services/
│   └── server/
│       ├── terminalService.ts        # 已有，需扩展
│       └── fileManagerService.ts     # 新增，文件操作服务
├── websocket/
│   └── handler.ts                    # 已有，需扩展文件事件
├── routes/
│   └── files.ts                      # 新增，REST API路由
└── types/
    └── fileManager.ts                # 新增，类型定义
```

### 前端文件
```
frontend/src/
├── components/
│   ├── FileManager/
│   │   ├── FileBrowser.tsx           # 新增，文件树浏览器
│   │   ├── FileTreeItem.tsx          # 新增，文件树节点
│   │   ├── FileContextMenu.tsx       # 新增，右键菜单
│   │   ├── FileBreadcrumb.tsx        # 新增，面包屑导航
│   │   └── FileSearch.tsx            # 新增，文件搜索
│   ├── Editor/
│   │   ├── SmartEditor.tsx           # 新增，智能编辑器容器
│   │   ├── MonacoEditor.tsx          # 新增，Monaco编辑器包装
│   │   ├── TextEditor.tsx            # 新增，简单文本编辑器
│   │   └── EditorTabs.tsx            # 新增，多标签页管理
│   └── WebTerminal.tsx               # 已有，需扩展侧边栏
├── pages/
│   ├── FileManagerPage.tsx           # 新增，独立文件管理页面
│   └── TerminalPage.tsx              # 已有，需扩展布局
├── hooks/
│   ├── useFileManager.ts             # 新增，文件管理Hook
│   └── useFileOperations.ts          # 新增，文件操作Hook
└── types/
    └── fileManager.ts                # 新增，类型定义
```

---

## Task 1: 类型定义

**Covers:** S4.1, S4.2, S6.2

**Files:**
- Create: `backend/src/types/fileManager.ts`
- Create: `frontend/src/types/fileManager.ts`

- [ ] **Step 1: 创建后端类型定义**

```typescript
// backend/src/types/fileManager.ts
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  permissions: string;
  owner: string;
  group: string;
}

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  created: Date;
  permissions: string;
  owner: string;
  group: string;
  mimeType: string;
  encoding: string;
}

export interface FileOperations {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  rename: boolean;
  upload: boolean;
  download: boolean;
  copy: boolean;
  paste: boolean;
  cut: boolean;
  compress: boolean;
  extract: boolean;
  permissions: boolean;
  ownership: boolean;
}

export interface FileManagerConfig {
  maxFileSize: number;
  allowedExtensions: string[];
  blockedPaths: string[];
  operations: FileOperations;
}

export interface ClipboardItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface SearchResult {
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

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy' | 'edit';
  path: string;
  oldPath?: string;
  newPath?: string;
  content?: string;
  timestamp: Date;
}

export interface OperationLog {
  id: string;
  operation: string;
  path: string;
  user: string;
  timestamp: Date;
  details: string;
  status: 'success' | 'failed';
}
```

- [ ] **Step 2: 创建前端类型定义**

```typescript
// frontend/src/types/fileManager.ts
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  permissions: string;
  owner: string;
  group: string;
}

export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  created: Date;
  permissions: string;
  owner: string;
  group: string;
  mimeType: string;
  encoding: string;
}

export interface FileOperations {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  rename: boolean;
  upload: boolean;
  download: boolean;
  copy: boolean;
  paste: boolean;
  cut: boolean;
  compress: boolean;
  extract: boolean;
  permissions: boolean;
  ownership: boolean;
}

export interface OpenFile {
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

export interface ClipboardItem {
  path: string;
  name: string;
  type: 'file' | 'directory';
}

export interface SearchResult {
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

export interface Operation {
  id: string;
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy' | 'edit';
  path: string;
  oldPath?: string;
  newPath?: string;
  content?: string;
  timestamp: Date;
}

export interface OperationLog {
  id: string;
  operation: string;
  path: string;
  user: string;
  timestamp: Date;
  details: string;
  status: 'success' | 'failed';
}

export interface FileManagerState {
  currentServerId: string | null;
  fileTree: Map<string, FileItem[]>;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  clipboard: {
    items: ClipboardItem[];
    operation: 'copy' | 'cut' | null;
  };
  search: {
    query: string;
    results: SearchResult[];
    isSearching: boolean;
  };
  history: {
    navigation: string[];
    recentFiles: string[];
    undoStack: Operation[];
    redoStack: Operation[];
  };
  loading: boolean;
  error: string | null;
  operationLogs: OperationLog[];
  operations: FileOperations;
}

export interface PersistedState {
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

- [ ] **Step 3: 验证类型定义**

Run: `cd backend && npm run typecheck`
Run: `cd frontend && npm run typecheck`
Expected: 无类型错误

- [ ] **Step 4: 提交代码**

```bash
git add backend/src/types/fileManager.ts frontend/src/types/fileManager.ts
git commit -m "feat: add file manager type definitions"
```

## Task 2: 后端文件管理服务

**Covers:** S5.1, S5.2

**Files:**
- Create: `backend/src/services/server/fileManagerService.ts`
- Modify: `backend/src/websocket/handler.ts`

- [ ] **Step 1: 创建fileManagerService完整实现**

```typescript
// backend/src/services/server/fileManagerService.ts
import { Client, SFTPWrapper } from 'ssh2';
import { logger } from '@utils/logger';
import { terminalService } from './terminalService';
import type { FileItem, FileInfo, FileManagerConfig } from '../../types/fileManager';

const DEFAULT_CONFIG: FileManagerConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: [],
  blockedPaths: ['/etc/shadow', '/etc/passwd', '/root/.ssh'],
  operations: {
    create: true,
    read: true,
    update: true,
    delete: true,
    rename: true,
    upload: true,
    download: true,
    copy: true,
    paste: true,
    cut: true,
    compress: true,
    extract: true,
    permissions: true,
    ownership: true,
  },
};

export class FileManagerService {
  private config: FileManagerConfig;

  constructor(config: FileManagerConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  async listFiles(serverId: string, path: string): Promise<FileItem[]> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      return new Promise((resolve, reject) => {
        sftp.readdir(path, (err, list) => {
          if (err) {
            reject(err);
            return;
          }

          const items: FileItem[] = list.map(item => ({
            name: item.filename,
            path: `${path}/${item.filename}`.replace(/\/\//g, '/'),
            type: item.attrs.isDirectory() ? 'directory' : 'file',
            size: item.attrs.size,
            modified: new Date(item.attrs.mtime * 1000),
            permissions: item.attrs.mode.toString(8).slice(-3),
            owner: item.attrs.uid.toString(),
            group: item.attrs.gid.toString(),
          }));

          resolve(items);
        });
      });
    } finally {
      cleanup();
    }
  }

  async readFile(serverId: string, path: string): Promise<string> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        
        const readStream = sftp.createReadStream(path);
        
        readStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        readStream.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });
        
        readStream.on('error', (err: Error) => {
          reject(err);
        });
      });
    } finally {
      cleanup();
    }
  }

  async writeFile(serverId: string, path: string, content: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      return new Promise((resolve, reject) => {
        const writeStream = sftp.createWriteStream(path);
        
        writeStream.on('close', () => {
          resolve();
        });
        
        writeStream.on('error', (err: Error) => {
          reject(err);
        });
        
        writeStream.write(content);
        writeStream.end();
      });
    } finally {
      cleanup();
    }
  }

  async delete(serverId: string, path: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      const stat = await new Promise<any>((resolve, reject) => {
        sftp.stat(path, (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });

      if (stat.isDirectory()) {
        await new Promise<void>((resolve, reject) => {
          sftp.rmdir(path, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(path, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } finally {
      cleanup();
    }
  }

  async rename(serverId: string, oldPath: string, newPath: string): Promise<void> {
    if (!this.validatePath(oldPath) || !this.validatePath(newPath)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.rename(oldPath, newPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      cleanup();
    }
  }

  async createDirectory(serverId: string, path: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(path, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      cleanup();
    }
  }

  async getFileInfo(serverId: string, path: string): Promise<FileInfo> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);
    
    try {
      const stat = await new Promise<any>((resolve, reject) => {
        sftp.stat(path, (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });

      const pathParts = path.split('/');
      const name = pathParts[pathParts.length - 1];

      return {
        path,
        name,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modified: new Date(stat.mtime * 1000),
        created: new Date(stat.atime * 1000),
        permissions: stat.mode.toString(8).slice(-3),
        owner: stat.uid.toString(),
        group: stat.gid.toString(),
        mimeType: this.getMimeType(name),
        encoding: 'utf-8',
      };
    } finally {
      cleanup();
    }
  }

  private validatePath(path: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    for (const blockedPath of this.config.blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        return false;
      }
    }
    return true;
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private async getSftpClient(serverId: string): Promise<{ sftp: SFTPWrapper; cleanup: () => void }> {
    const session = await terminalService.createTerminalSession(serverId, 80, 24);
    
    if (session.error) {
      throw new Error(`Failed to create SSH connection: ${session.error}`);
    }

    return new Promise((resolve, reject) => {
      const conn = session.shell.connection;
      
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }

        const cleanup = () => {
          sftp.end();
        };

        resolve({ sftp, cleanup });
      });
    });
  }
}

export const fileManagerService = new FileManagerService();
```

- [ ] **Step 2: 扩展WebSocket handler添加文件操作事件**

```typescript
// 在 backend/src/websocket/handler.ts 中添加
import { fileManagerService } from '@services/server';

// 在 socket.on('connection') 内部添加
socket.on('file:list', async (data: { serverId: string; path: string }, callback: (result: { items?: FileItem[]; error?: string }) => void) => {
  try {
    const items = await fileManagerService.listFiles(data.serverId, data.path);
    callback({ items });
  } catch (error: any) {
    callback({ error: error.message });
  }
});

socket.on('file:read', async (data: { serverId: string; path: string }, callback: (result: { content?: string; error?: string }) => void) => {
  try {
    const content = await fileManagerService.readFile(data.serverId, data.path);
    callback({ content });
  } catch (error: any) {
    callback({ error: error.message });
  }
});

socket.on('file:write', async (data: { serverId: string; path: string; content: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
  try {
    await fileManagerService.writeFile(data.serverId, data.path, data.content);
    callback({ success: true });
  } catch (error: any) {
    callback({ error: error.message });
  }
});

socket.on('file:delete', async (data: { serverId: string; path: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
  try {
    await fileManagerService.delete(data.serverId, data.path);
    callback({ success: true });
  } catch (error: any) {
    callback({ error: error.message });
  }
});

socket.on('file:rename', async (data: { serverId: string; oldPath: string; newPath: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
  try {
    await fileManagerService.rename(data.serverId, data.oldPath, data.newPath);
    callback({ success: true });
  } catch (error: any) {
    callback({ error: error.message });
  }
});

socket.on('file:mkdir', async (data: { serverId: string; path: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
  try {
    await fileManagerService.createDirectory(data.serverId, data.path);
    callback({ success: true });
  } catch (error: any) {
    callback({ error: error.message });
  }
});
```

- [ ] **Step 11: 验证后端代码**

Run: `cd backend && npm run typecheck`
Run: `cd backend && npm run build`
Expected: 无错误

- [ ] **Step 12: 提交代码**

```bash
git add backend/src/services/server/fileManagerService.ts backend/src/websocket/handler.ts
git commit -m "feat: add file manager service and websocket events"
```

## Task 3: 前端文件管理Hook

**Covers:** S6.2

**Files:**
- Create: `frontend/src/hooks/useFileManager.ts`
- Create: `frontend/src/hooks/useFileOperations.ts`

- [ ] **Step 1: 创建useFileManager Hook**

```typescript
// frontend/src/hooks/useFileManager.ts
import { useState, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { FileItem, OpenFile, FileManagerState, FileOperations } from '../types/fileManager';

const DEFAULT_OPERATIONS: FileOperations = {
  create: true,
  read: true,
  update: true,
  delete: true,
  rename: true,
  upload: true,
  download: true,
  copy: true,
  paste: true,
  cut: true,
  compress: true,
  extract: true,
  permissions: true,
  ownership: true,
};

export function useFileManager(serverId: string | null, token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<FileManagerState>({
    currentServerId: serverId,
    fileTree: new Map(),
    expandedPaths: new Set(),
    selectedPath: null,
    openFiles: [],
    activeFileId: null,
    clipboard: { items: [], operation: null },
    search: { query: '', results: [], isSearching: false },
    history: { navigation: [], recentFiles: [], undoStack: [], redoStack: [] },
    loading: false,
    error: null,
    operationLogs: [],
    operations: DEFAULT_OPERATIONS,
  });

  useEffect(() => {
    if (!token) return;

    const newSocket = io(undefined, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('File manager socket connected');
    });

    newSocket.on('disconnect', () => {
      console.log('File manager socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  const loadFiles = useCallback(async (path: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:list', { serverId, path }, (result: { items?: FileItem[]; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return;
      }

      setState(prev => {
        const newFileTree = new Map(prev.fileTree);
        newFileTree.set(path, result.items || []);
        return { ...prev, fileTree: newFileTree, loading: false };
      });
    });
  }, [socket, serverId]);

  const openFile = useCallback(async (path: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:read', { serverId, path }, (result: { content?: string; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return;
      }

      const fileName = path.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'css', 'html', 'json', 'yaml', 'yml', 'xml', 'md', 'sh', 'bash', 'sql'];
      const editorType = codeExtensions.includes(ext) ? 'monaco' : 'text';

      const newFile: OpenFile = {
        id: `${path}-${Date.now()}`,
        path,
        name: fileName,
        content: result.content || '',
        modified: false,
        editorType,
        encoding: 'utf-8',
        lineEnding: 'LF',
        cursorPosition: { line: 1, column: 1 },
        scrollPosition: { top: 0, left: 0 },
      };

      setState(prev => {
        const existingIndex = prev.openFiles.findIndex(f => f.path === path);
        if (existingIndex >= 0) {
          return { ...prev, activeFileId: prev.openFiles[existingIndex].id, loading: false };
        }
        return {
          ...prev,
          openFiles: [...prev.openFiles, newFile],
          activeFileId: newFile.id,
          loading: false,
          history: {
            ...prev.history,
            recentFiles: [path, ...prev.history.recentFiles.filter(p => p !== path)].slice(0, 10),
          },
        };
      });
    });
  }, [socket, serverId]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:write', { serverId, path, content }, (result: { success?: boolean; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        openFiles: prev.openFiles.map(f =>
          f.path === path ? { ...f, modified: false, content } : f
        ),
      }));
    });
  }, [socket, serverId]);

  const deleteFile = useCallback(async (path: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:delete', { serverId, path }, (result: { success?: boolean; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        openFiles: prev.openFiles.filter(f => f.path !== path),
        activeFileId: prev.openFiles.filter(f => f.path !== path)[0]?.id || null,
      }));

      const parentPath = path.split('/').slice(0, -1).join('/') || '/';
      loadFiles(parentPath);
    });
  }, [socket, serverId, loadFiles]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:rename', { serverId, oldPath, newPath }, (result: { success?: boolean; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        openFiles: prev.openFiles.map(f =>
          f.path === oldPath ? { ...f, path: newPath, name: newPath.split('/').pop() || '' } : f
        ),
      }));

      const parentPath = oldPath.split('/').slice(0, -1).join('/') || '/';
      loadFiles(parentPath);
    });
  }, [socket, serverId, loadFiles]);

  const createDirectory = useCallback(async (path: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:mkdir', { serverId, path }, (result: { success?: boolean; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error }));
        return;
      }

      setState(prev => ({ ...prev, loading: false }));

      const parentPath = path.split('/').slice(0, -1).join('/') || '/';
      loadFiles(parentPath);
    });
  }, [socket, serverId, loadFiles]);

  const setActiveFile = useCallback((fileId: string | null) => {
    setState(prev => ({ ...prev, activeFileId: fileId }));
  }, []);

  const closeFile = useCallback((fileId: string) => {
    setState(prev => {
      const newOpenFiles = prev.openFiles.filter(f => f.id !== fileId);
      const newActiveId = prev.activeFileId === fileId
        ? newOpenFiles[newOpenFiles.length - 1]?.id || null
        : prev.activeFileId;
      return { ...prev, openFiles: newOpenFiles, activeFileId: newActiveId };
    });
  }, []);

  const updateFileContent = useCallback((fileId: string, content: string) => {
    setState(prev => ({
      ...prev,
      openFiles: prev.openFiles.map(f =>
        f.id === fileId ? { ...f, content, modified: true } : f
      ),
    }));
  }, []);

  const toggleExpanded = useCallback((path: string) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedPaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
        loadFiles(path);
      }
      return { ...prev, expandedPaths: newExpanded };
    });
  }, [loadFiles]);

  const setSelectedPath = useCallback((path: string | null) => {
    setState(prev => ({ ...prev, selectedPath: path }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    loadFiles,
    openFile,
    saveFile,
    deleteFile,
    renameFile,
    createDirectory,
    setActiveFile,
    closeFile,
    updateFileContent,
    toggleExpanded,
    setSelectedPath,
    clearError,
  };
}
```

- [ ] **Step 2: 创建useFileOperations Hook**

```typescript
// frontend/src/hooks/useFileOperations.ts
import { useCallback } from 'react';
import type { FileManagerState, FileOperations } from '../types/fileManager';

export function useFileOperations(
  state: FileManagerState,
  operations: {
    deleteFile: (path: string) => Promise<void>;
    renameFile: (oldPath: string, newPath: string) => Promise<void>;
    createDirectory: (path: string) => Promise<void>;
  }
) {
  const canPerformOperation = useCallback((operation: keyof FileOperations): boolean => {
    return state.operations[operation];
  }, [state.operations]);

  const handleDelete = useCallback(async (path: string) => {
    if (!canPerformOperation('delete')) {
      return;
    }
    await operations.deleteFile(path);
  }, [canPerformOperation, operations.deleteFile]);

  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    if (!canPerformOperation('rename')) {
      return;
    }
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');
    await operations.renameFile(oldPath, newPath);
  }, [canPerformOperation, operations.renameFile]);

  const handleCreateDirectory = useCallback(async (parentPath: string, name: string) => {
    if (!canPerformOperation('create')) {
      return;
    }
    const newPath = `${parentPath}/${name}`.replace(/\/\//g, '/');
    await operations.createDirectory(newPath);
  }, [canPerformOperation, operations.createDirectory]);

  return {
    canPerformOperation,
    handleDelete,
    handleRename,
    handleCreateDirectory,
  };
}
```

- [ ] **Step 3: 验证前端代码**

Run: `cd frontend && npm run typecheck`
Expected: 无类型错误

- [ ] **Step 4: 提交代码**

```bash
git add frontend/src/hooks/useFileManager.ts frontend/src/hooks/useFileOperations.ts
git commit -m "feat: add file manager hooks"
```

## Task 4: 文件浏览器组件

**Covers:** S4.1, S6.1

**Files:**
- Create: `frontend/src/components/FileManager/FileBrowser.tsx`
- Create: `frontend/src/components/FileManager/FileTreeItem.tsx`
- Create: `frontend/src/components/FileManager/FileContextMenu.tsx`

- [ ] **Step 1: 创建FileTreeItem组件**

```typescript
// frontend/src/components/FileManager/FileTreeItem.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FileItem } from '../../types/fileManager';

interface FileTreeItemProps {
  item: FileItem;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  onToggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
  onOpen: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
}

export default function FileTreeItem({
  item,
  level,
  isExpanded,
  isSelected,
  onToggleExpand,
  onSelect,
  onOpen,
  onContextMenu,
}: FileTreeItemProps) {
  const handleClick = () => {
    onSelect(item.path);
    if (item.type === 'directory') {
      onToggleExpand(item.path);
    }
  };

  const handleDoubleClick = () => {
    if (item.type === 'file') {
      onOpen(item.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, item);
  };

  const getFileIcon = () => {
    if (item.type === 'directory') {
      return isExpanded ? '📂' : '📁';
    }
    const ext = item.name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'js': '📜',
      'ts': '📜',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'java': '☕',
      'go': '🐹',
      'rs': '🦀',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'sh': '💻',
      'bash': '💻',
    };
    return iconMap[ext || ''] || '📄';
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex items-center py-1 px-2 cursor-pointer hover:bg-gray-700 ${
        isSelected ? 'bg-blue-600' : ''
      }`}
      style={{ paddingLeft: `${level * 16 + 8}px` }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <span className="mr-2">{getFileIcon()}</span>
      <span className="flex-1 truncate text-sm">{item.name}</span>
      <span className="text-xs text-gray-400 ml-2">
        {item.type === 'file' ? formatSize(item.size) : ''}
      </span>
      <span className="text-xs text-gray-400 ml-2">
        {formatDate(item.modified)}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 创建FileContextMenu组件**

```typescript
// frontend/src/components/FileManager/FileContextMenu.tsx
import React from 'react';
import { FileItem, FileOperations } from '../../types/fileManager';

interface FileContextMenuProps {
  x: number;
  y: number;
  item: FileItem;
  operations: FileOperations;
  onClose: () => void;
  onAction: (action: string, item: FileItem) => void;
}

export default function FileContextMenu({
  x,
  y,
  item,
  operations,
  onClose,
  onAction,
}: FileContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const menuItems = [
    { label: 'Open', action: 'open', icon: '📖', show: operations.read },
    { label: 'Rename', action: 'rename', icon: '✏️', show: operations.rename },
    { label: 'Delete', action: 'delete', icon: '🗑️', show: operations.delete },
    { label: 'Copy', action: 'copy', icon: '📋', show: operations.copy },
    { label: 'Cut', action: 'cut', icon: '✂️', show: operations.cut },
    { label: 'Download', action: 'download', icon: '⬇️', show: operations.download && item.type === 'file' },
    { label: 'Permissions', action: 'permissions', icon: '🔐', show: operations.permissions },
  ].filter(item => item.show);

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-600 rounded shadow-lg py-1 z-50"
      style={{ left: x, top: y }}
    >
      {menuItems.map((menuItem) => (
        <button
          key={menuItem.action}
          className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 flex items-center"
          onClick={() => onAction(menuItem.action, item)}
        >
          <span className="mr-2">{menuItem.icon}</span>
          {menuItem.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 创建FileBrowser组件**

```typescript
// frontend/src/components/FileManager/FileBrowser.tsx
import React, { useState, useEffect } from 'react';
import { FileItem, FileOperations } from '../../types/fileManager';
import FileTreeItem from './FileTreeItem';
import FileContextMenu from './FileContextMenu';

interface FileBrowserProps {
  serverId: string;
  files: Map<string, FileItem[]>;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  operations: FileOperations;
  loading: boolean;
  onLoadFiles: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onSelect: (path: string) => void;
  onOpen: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onCreateDirectory: (parentPath: string, name: string) => void;
}

export default function FileBrowser({
  serverId,
  files,
  expandedPaths,
  selectedPath,
  operations,
  loading,
  onLoadFiles,
  onToggleExpand,
  onSelect,
  onOpen,
  onDelete,
  onRename,
  onCreateDirectory,
}: FileBrowserProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);
  const [rootPath, setRootPath] = useState('/');

  useEffect(() => {
    onLoadFiles(rootPath);
  }, [serverId, rootPath, onLoadFiles]);

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleContextAction = (action: string, item: FileItem) => {
    switch (action) {
      case 'open':
        onOpen(item.path);
        break;
      case 'delete':
        onDelete(item.path);
        break;
      case 'rename':
        const newName = prompt('Enter new name:', item.name);
        if (newName) {
          onRename(item.path, newName);
        }
        break;
      case 'copy':
        navigator.clipboard.writeText(item.path);
        break;
      case 'cut':
        navigator.clipboard.writeText(item.path);
        break;
      case 'download':
        const link = document.createElement('a');
        link.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
        link.download = item.name;
        link.click();
        break;
      case 'permissions':
        const newPermissions = prompt('Enter new permissions (e.g., 755):', item.permissions);
        if (newPermissions) {
          socket.emit('file:permissions', { serverId, path: item.path, permissions: newPermissions }, (result: { success?: boolean; error?: string }) => {
            if (result.error) {
              console.error('Failed to update permissions:', result.error);
            } else {
              loadFiles(item.path.split('/').slice(0, -1).join('/') || '/');
            }
          });
        }
        break;
    }
    handleCloseContextMenu();
  };

  const renderFileTree = (path: string, level: number = 0) => {
    const items = files.get(path) || [];
    
    return items.map((item) => (
      <React.Fragment key={item.path}>
        <FileTreeItem
          item={item}
          level={level}
          isExpanded={expandedPaths.has(item.path)}
          isSelected={selectedPath === item.path}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onOpen={onOpen}
          onContextMenu={handleContextMenu}
        />
        {item.type === 'directory' && expandedPaths.has(item.path) && (
          renderFileTree(item.path, level + 1)
        )}
      </React.Fragment>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-200">
      <div className="p-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold">File Browser</h3>
      </div>
      
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          renderFileTree(rootPath)
        )}
      </div>

      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          operations={operations}
          onClose={handleCloseContextMenu}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 验证组件代码**

Run: `cd frontend && npm run typecheck`
Expected: 无类型错误

- [ ] **Step 5: 提交代码**

```bash
git add frontend/src/components/FileManager/
git commit -m "feat: add file browser components"
```

## Task 5: 编辑器组件

**Covers:** S4.2, S6.1

**Files:**
- Create: `frontend/src/components/Editor/MonacoEditor.tsx`
- Create: `frontend/src/components/Editor/TextEditor.tsx`
- Create: `frontend/src/components/Editor/SmartEditor.tsx`
- Create: `frontend/src/components/Editor/EditorTabs.tsx`

- [ ] **Step 1: 创建MonacoEditor组件**

```typescript
// frontend/src/components/Editor/MonacoEditor.tsx
import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';

interface MonacoEditorProps {
  content: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function MonacoEditor({
  content,
  language,
  readOnly = false,
  onChange,
  onSave,
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Add save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave?.();
    });

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      minimap: { enabled: true },
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: true,
      formatOnType: true,
    });
  };

  const handleEditorChange: OnChange = (value) => {
    onChange?.(value || '');
  };

  return (
    <Editor
      height="100%"
      language={language}
      value={content}
      theme="vs-dark"
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      options={{
        readOnly,
        automaticLayout: true,
      }}
    />
  );
}
```

- [ ] **Step 2: 创建TextEditor组件**

```typescript
// frontend/src/components/Editor/TextEditor.tsx
import React, { useRef, useEffect } from 'react';

interface TextEditorProps {
  content: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function TextEditor({
  content,
  readOnly = false,
  onChange,
  onSave,
}: TextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = content;
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="w-full h-full bg-gray-900 text-gray-200 p-4 font-mono text-sm resize-none focus:outline-none"
      readOnly={readOnly}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      spellCheck={false}
    />
  );
}
```

- [ ] **Step 3: 创建SmartEditor组件**

```typescript
// frontend/src/components/Editor/SmartEditor.tsx
import React from 'react';
import MonacoEditor from './MonacoEditor';
import TextEditor from './TextEditor';

interface SmartEditorProps {
  content: string;
  editorType: 'monaco' | 'text';
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

export default function SmartEditor({
  content,
  editorType,
  language = 'plaintext',
  readOnly = false,
  onChange,
  onSave,
}: SmartEditorProps) {
  if (editorType === 'monaco') {
    return (
      <MonacoEditor
        content={content}
        language={language}
        readOnly={readOnly}
        onChange={onChange}
        onSave={onSave}
      />
    );
  }

  return (
    <TextEditor
      content={content}
      readOnly={readOnly}
      onChange={onChange}
      onSave={onSave}
    />
  );
}
```

- [ ] **Step 4: 创建EditorTabs组件**

```typescript
// frontend/src/components/Editor/EditorTabs.tsx
import React from 'react';
import { OpenFile } from '../../types/fileManager';

interface EditorTabsProps {
  files: OpenFile[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
  onClose: (fileId: string) => void;
}

export default function EditorTabs({
  files,
  activeFileId,
  onSelect,
  onClose,
}: EditorTabsProps) {
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'js': '📜',
      'ts': '📜',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'java': '☕',
      'go': '🐹',
      'rs': '🦀',
      'html': '🌐',
      'css': '🎨',
      'json': '📋',
      'md': '📝',
      'txt': '📄',
      'sh': '💻',
      'bash': '💻',
    };
    return iconMap[ext || ''] || '📄';
  };

  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 text-gray-400">
        <p>No files open</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {files.map((file) => (
          <div
            key={file.id}
            className={`flex items-center px-3 py-2 cursor-pointer border-r border-gray-700 min-w-0 ${
              activeFileId === file.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            onClick={() => onSelect(file.id)}
          >
            <span className="mr-2">{getFileIcon(file.name)}</span>
            <span className="truncate text-sm">
              {file.name}
              {file.modified && <span className="ml-1 text-yellow-500">●</span>}
            </span>
            <button
              className="ml-2 text-gray-500 hover:text-gray-300 focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      
      <div className="flex-1">
        {files.map((file) => (
          <div
            key={file.id}
            className={`h-full ${activeFileId === file.id ? 'block' : 'hidden'}`}
          >
            <SmartEditor
              content={file.content}
              editorType={file.editorType}
              language={getLanguageFromFilename(file.name)}
              onChange={(value) => {
                // This will be handled by the parent component
              }}
              onSave={() => {
                // This will be handled by the parent component
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'jsx': 'javascript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rs': 'rust',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'sh': 'shell',
    'bash': 'shell',
    'sql': 'sql',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
  };
  return languageMap[ext || ''] || 'plaintext';
}
```

- [ ] **Step 5: 验证组件代码**

Run: `cd frontend && npm run typecheck`
Expected: 无类型错误

- [ ] **Step 6: 提交代码**

```bash
git add frontend/src/components/Editor/
git commit -m "feat: add editor components"
```

## Task 6: 终端侧边栏集成

**Covers:** S4.3, S6.1

**Files:**
- Modify: `frontend/src/pages/TerminalPage.tsx`
- Modify: `frontend/src/components/WebTerminal.tsx`

- [ ] **Step 1: 修改TerminalPage布局**

```typescript
// frontend/src/pages/TerminalPage.tsx
import React, { useState } from 'react';
import WebTerminal from '../components/WebTerminal';
import FileBrowser from '../components/FileManager/FileBrowser';
import EditorTabs from '../components/Editor/EditorTabs';
import { useFileManager } from '../hooks/useFileManager';
import { useFileOperations } from '../hooks/useFileOperations';

export default function TerminalPage() {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [token] = useState(localStorage.getItem('token') || '');
  
  const {
    state,
    loadFiles,
    openFile,
    saveFile,
    deleteFile,
    renameFile,
    createDirectory,
    setActiveFile,
    closeFile,
    updateFileContent,
    toggleExpanded,
    setSelectedPath,
  } = useFileManager(selectedServer, token);

  const {
    canPerformOperation,
    handleDelete,
    handleRename,
    handleCreateDirectory,
  } = useFileOperations(state, {
    deleteFile,
    renameFile,
    createDirectory,
  });

  return (
    <div className="h-screen flex">
      {/* File Browser Sidebar */}
      <div className="w-64 border-r border-gray-700">
        <FileBrowser
          serverId={selectedServer || ''}
          files={state.fileTree}
          expandedPaths={state.expandedPaths}
          selectedPath={state.selectedPath}
          operations={state.operations}
          loading={state.loading}
          onLoadFiles={loadFiles}
          onToggleExpand={toggleExpanded}
          onSelect={setSelectedPath}
          onOpen={openFile}
          onDelete={handleDelete}
          onRename={handleRename}
          onCreateDirectory={handleCreateDirectory}
        />
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Tabs */}
        <div className="h-10 border-b border-gray-700">
          <EditorTabs
            files={state.openFiles}
            activeFileId={state.activeFileId}
            onSelect={setActiveFile}
            onClose={closeFile}
          />
        </div>

        {/* Terminal */}
        <div className="flex-1">
          {selectedServer && (
            <WebTerminal
              serverId={selectedServer}
              serverName="Server"
              token={token}
              onClose={() => setSelectedServer(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证页面代码**

Run: `cd frontend && npm run typecheck`
Expected: 无类型错误

- [ ] **Step 3: 提交代码**

```bash
git add frontend/src/pages/TerminalPage.tsx
git commit -m "feat: integrate file browser into terminal page"
```

## Task 7: 独立文件管理页面

**Covers:** S4.4, S6.1

**Files:**
- Create: `frontend/src/pages/FileManagerPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 创建FileManagerPage组件**

```typescript
// frontend/src/pages/FileManagerPage.tsx
import React, { useState } from 'react';
import FileBrowser from '../components/FileManager/FileBrowser';
import EditorTabs from '../components/Editor/EditorTabs';
import FileBreadcrumb from '../components/FileManager/FileBreadcrumb';
import FileSearch from '../components/FileManager/FileSearch';
import { useFileManager } from '../hooks/useFileManager';
import { useFileOperations } from '../hooks/useFileOperations';

export default function FileManagerPage() {
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [token] = useState(localStorage.getItem('token') || '');
  
  const {
    state,
    loadFiles,
    openFile,
    saveFile,
    deleteFile,
    renameFile,
    createDirectory,
    setActiveFile,
    closeFile,
    updateFileContent,
    toggleExpanded,
    setSelectedPath,
  } = useFileManager(selectedServer, token);

  const {
    canPerformOperation,
    handleDelete,
    handleRename,
    handleCreateDirectory,
  } = useFileOperations(state, {
    deleteFile,
    renameFile,
    createDirectory,
  });

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setState(prev => ({ ...prev, search: { query: '', results: [], isSearching: false } }));
      return;
    }

    setState(prev => ({ ...prev, search: { ...prev.search, isSearching: true } }));

    const results: SearchResult[] = [];
    for (const [path, items] of state.fileTree) {
      for (const item of items) {
        if (item.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            path: item.path,
            name: item.name,
            type: item.type,
            matches: [{
              line: 1,
              content: item.name,
              startIndex: item.name.toLowerCase().indexOf(query.toLowerCase()),
              endIndex: item.name.toLowerCase().indexOf(query.toLowerCase()) + query.length,
            }],
          });
        }
      }
    }

    setState(prev => ({ ...prev, search: { query, results, isSearching: false } }));
  };

  const handleBreadcrumbNavigate = (path: string) => {
    setSelectedPath(path);
    loadFiles(path);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-gray-700 flex items-center px-4">
        <h1 className="text-lg font-semibold text-white">File Manager</h1>
        <div className="ml-auto flex items-center space-x-4">
          <FileSearch onSearch={handleSearch} />
          <select
            className="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1"
            value={selectedServer || ''}
            onChange={(e) => setSelectedServer(e.target.value)}
          >
            <option value="">Select Server</option>
            {/* Server options will be populated dynamically */}
          </select>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="h-10 border-b border-gray-700 px-4">
        <FileBreadcrumb
          path={state.selectedPath || '/'}
          onNavigate={handleBreadcrumbNavigate}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* File Browser */}
        <div className="w-64 border-r border-gray-700">
          <FileBrowser
            serverId={selectedServer || ''}
            files={state.fileTree}
            expandedPaths={state.expandedPaths}
            selectedPath={state.selectedPath}
            operations={state.operations}
            loading={state.loading}
            onLoadFiles={loadFiles}
            onToggleExpand={toggleExpanded}
            onSelect={setSelectedPath}
            onOpen={openFile}
            onDelete={handleDelete}
            onRename={handleRename}
            onCreateDirectory={handleCreateDirectory}
          />
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col">
          <EditorTabs
            files={state.openFiles}
            activeFileId={state.activeFileId}
            onSelect={setActiveFile}
            onClose={closeFile}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-8 border-t border-gray-700 flex items-center px-4 text-sm text-gray-400">
        <span>
          {state.openFiles.find(f => f.id === state.activeFileId)?.name || 'No file open'}
        </span>
        <span className="ml-auto">
          {state.openFiles.find(f => f.id === state.activeFileId)?.encoding || 'UTF-8'}
        </span>
        <span className="ml-4">
          {state.openFiles.find(f => f.id === state.activeFileId)?.lineEnding || 'LF'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 添加路由到App.tsx**

```typescript
// 在 frontend/src/App.tsx 中添加
import FileManagerPage from './pages/FileManagerPage';

// 在路由配置中添加
<Route path="/files" element={<FileManagerPage />} />
```

- [ ] **Step 3: 验证页面代码**

Run: `cd frontend && npm run typecheck`
Expected: 无类型错误

- [ ] **Step 4: 提交代码**

```bash
git add frontend/src/pages/FileManagerPage.tsx frontend/src/App.tsx
git commit -m "feat: add file manager page"
```

## Task 8: 测试和文档

**Covers:** S9, S10

**Files:**
- Create: `backend/src/services/server/__tests__/fileManagerService.test.ts`
- Create: `frontend/src/components/FileManager/__tests__/FileBrowser.test.tsx`
- Create: `docs/FILE_MANAGER.md`

- [ ] **Step 1: 创建后端单元测试**

```typescript
// backend/src/services/server/__tests__/fileManagerService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileManagerService } from '../fileManagerService';

describe('FileManagerService', () => {
  let service: FileManagerService;

  beforeEach(() => {
    service = new FileManagerService();
  });

  describe('validatePath', () => {
    it('should allow valid paths', () => {
      expect(service['validatePath']('/home/user/file.txt')).toBe(true);
    });

    it('should block sensitive paths', () => {
      expect(service['validatePath']('/etc/shadow')).toBe(false);
      expect(service['validatePath']('/etc/passwd')).toBe(false);
      expect(service['validatePath']('/root/.ssh/id_rsa')).toBe(false);
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(service['getMimeType']('file.txt')).toBe('text/plain');
      expect(service['getMimeType']('file.html')).toBe('text/html');
      expect(service['getMimeType']('file.css')).toBe('text/css');
      expect(service['getMimeType']('file.js')).toBe('application/javascript');
      expect(service['getMimeType']('file.json')).toBe('application/json');
      expect(service['getMimeType']('file.unknown')).toBe('application/octet-stream');
    });
  });
});
```

- [ ] **Step 2: 创建前端组件测试**

```typescript
// frontend/src/components/FileManager/__tests__/FileBrowser.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileBrowser from '../FileBrowser';

describe('FileBrowser', () => {
  const mockProps = {
    serverId: 'test-server',
    files: new Map(),
    expandedPaths: new Set(),
    selectedPath: null,
    operations: {
      create: true,
      read: true,
      update: true,
      delete: true,
      rename: true,
      upload: true,
      download: true,
      copy: true,
      paste: true,
      cut: true,
      compress: true,
      extract: true,
      permissions: true,
      ownership: true,
    },
    loading: false,
    onLoadFiles: vi.fn(),
    onToggleExpand: vi.fn(),
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onCreateDirectory: vi.fn(),
  };

  it('should render loading state', () => {
    render(<FileBrowser {...mockProps} loading={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<FileBrowser {...mockProps} />);
    expect(screen.getByText('File Browser')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `cd backend && npm test`
Run: `cd frontend && npm test`
Expected: 所有测试通过

- [ ] **Step 4: 创建文档**

```markdown
# docs/FILE_MANAGER.md

## 概述

文件管理功能为IT运维平台提供了远程服务器和本地文件的浏览、编辑、保存能力。

## 功能特性

- 文件树浏览器
- 代码编辑器（Monaco Editor）
- 简单文本编辑器
- 终端侧边栏集成
- 独立文件管理页面
- 可配置的文件操作权限

## 技术架构

- 前端：React + TypeScript + Monaco Editor
- 后端：Node.js + Express + ssh2 SFTP
- 通信：WebSocket + REST API

## 使用方法

### 终端侧边栏

1. 打开Web终端
2. 选择服务器
3. 文件浏览器自动显示在左侧
4. 点击文件打开编辑器

### 独立页面

1. 访问 `/files` 路由
2. 选择服务器
3. 浏览和编辑文件

## 配置

文件操作权限可通过 `FileManagerConfig` 配置：

```typescript
interface FileOperations {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
  rename: boolean;
  upload: boolean;
  download: boolean;
  copy: boolean;
  paste: boolean;
  cut: boolean;
  compress: boolean;
  extract: boolean;
  permissions: boolean;
  ownership: boolean;
}
```

## 安全考虑

- 路径遍历攻击防护
- 敏感文件保护
- 操作权限控制
- 审计日志记录
```

- [ ] **Step 5: 提交代码**

```bash
git add backend/src/services/server/__tests__/ frontend/src/components/FileManager/__tests__/ docs/FILE_MANAGER.md
git commit -m "test: add file manager tests and documentation"
```

## 总结

本实现计划包含8个主要任务，涵盖类型定义、后端服务、前端组件、页面集成、测试和文档。每个任务都包含详细的步骤和代码示例，确保实现过程清晰可控。

预计完成时间：3-4周

关键里程碑：
1. 类型定义完成
2. 后端服务实现
3. 前端组件开发
4. 页面集成完成
5. 测试通过
6. 文档完善