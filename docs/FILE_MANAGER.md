# File Manager

Remote file management over SSH/SFTP for the ITOps Agent Platform.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend                          │
│  FileBrowser → FileTreeItem / FileContextMenu /     │
│                FileBreadcrumb / FileSearch           │
└──────────────────────┬──────────────────────────────┘
                       │ WebSocket (socket.io)
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Backend                           │
│  FileManagerService                                 │
│    ├── validatePath()   (security)                  │
│    ├── getSftpClient()  (connection pool)           │
│    ├── listFiles / readFile / writeFile / delete     │
│    ├── rename / createDirectory / getFileInfo        │
│    └── cleanup()                                    │
│          │                                          │
│          ▼ SSH/SFTP                                 │
│     Remote Server                                   │
└─────────────────────────────────────────────────────┘
```

## Backend: FileManagerService

**Location:** `backend/src/services/server/fileManagerService.ts`

### API

| Method | Description |
|--------|-------------|
| `listFiles(sessionId, path)` | List directory contents |
| `readFile(sessionId, path)` | Read file (utf-8 or base64 for binary) |
| `writeFile(sessionId, path, content)` | Write text content to file |
| `delete(sessionId, path)` | Delete file or empty directory |
| `rename(sessionId, oldPath, newPath)` | Rename/move file |
| `createDirectory(sessionId, path)` | Create directory |
| `getFileInfo(sessionId, path)` | Get file metadata + MIME type |
| `cleanup(sessionId)` | Close SFTP session |

### Security

- **Path validation:** Blocks access to configured paths (default: `/etc/shadow`, `/etc/passwd`, `/root/.ssh`)
- **Path normalization:** Backslashes are normalized; paths are resolved to absolute
- **Size limits:** Files exceeding `maxFileSize` (default 10 MB) are rejected
- **Binary write protection:** Writing binary files is blocked

### SFTP Connection Pooling

SFTP clients are cached per session ID. A health check (`stat('/')`) validates cached connections before reuse. Stale connections are evicted and reconnected automatically.

### Configuration

```typescript
interface FileManagerConfig {
  maxFileSize: number;        // bytes, default 10MB
  allowedExtensions: string[];// empty = all allowed
  blockedPaths: string[];     // paths that cannot be accessed
  operations: FileOperations; // feature flags per operation
}
```

## Frontend: FileBrowser

**Location:** `frontend/src/components/FileManager/FileBrowser.tsx`

### Components

| Component | Purpose |
|-----------|---------|
| `FileBrowser` | Main container, manages state and file tree rendering |
| `FileTreeItem` | Individual file/directory row with icons and actions |
| `FileBreadcrumb` | Path navigation breadcrumb |
| `FileSearch` | File search with results dropdown |
| `FileContextMenu` | Right-click context menu |

### Features

- Tree-style file browsing with expand/collapse
- Breadcrumb navigation
- File search across loaded directories
- Context menu: open, rename, delete, copy path, download, permissions
- Loading state with spinner
- Keyboard and mouse interaction

### Props

```typescript
interface FileBrowserProps {
  serverId: string;
  files: Record<string, FileItem[]>;
  expandedPaths: string[];
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
  onPermissionsChange?: (path: string, permissions: string) => void;
}
```

## Testing

### Backend

```bash
cd backend && npm test
```

Tests cover: path validation, MIME type detection, binary detection, SFTP caching, cleanup, size limits, blocked paths, directory operations.

### Frontend

```bash
cd frontend && npm test
```

Tests cover: rendering, loading state, file selection, context menu, search, breadcrumb navigation, server switching.

## Types

Shared types are in `shared/types/fileManager.ts` and re-exported by both `backend/src/types/fileManager.ts` and `frontend/src/types/fileManager.ts`.

Key types: `FileItem`, `FileInfo`, `FileOperations`, `FileManagerConfig`, `SearchResult`, `Operation`, `OperationLog`.
