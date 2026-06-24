import { useState, useCallback, useEffect } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
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

const CODE_EXTENSIONS = [
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs',
  'c', 'cpp', 'h', 'hpp', 'css', 'html', 'json', 'yaml',
  'yml', 'xml', 'md', 'sh', 'bash', 'sql',
];

function getParentPath(path: string): string {
  return path.split('/').slice(0, -1).join('/') || '/';
}

export function useFileManager(serverId: string | null, token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<FileManagerState>({
    currentServerId: serverId,
    fileTree: {},
    expandedPaths: [],
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
      // socket connected
    });

    newSocket.on('disconnect', () => {
      // socket disconnected
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
        setState(prev => ({ ...prev, loading: false, error: result.error ?? null }));
        return;
      }

      setState(prev => ({
        ...prev,
        fileTree: { ...prev.fileTree, [path]: result.items ?? [] },
        loading: false,
      }));
    });
  }, [socket, serverId]);

  const openFile = useCallback(async (path: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:read', { serverId, path }, (result: { content?: string; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error ?? null }));
        return;
      }

      const fileName = path.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const editorType = CODE_EXTENSIONS.includes(ext) ? 'monaco' : 'text';

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
        setState(prev => ({ ...prev, loading: false, error: result.error ?? null }));
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
        setState(prev => ({ ...prev, loading: false, error: result.error ?? null }));
        return;
      }

      setState(prev => {
        const remaining = prev.openFiles.filter(f => f.path !== path);
        return {
          ...prev,
          loading: false,
          openFiles: remaining,
          activeFileId: remaining[remaining.length - 1]?.id || null,
        };
      });

      const parentPath = getParentPath(path);
      loadFiles(parentPath);
    });
  }, [socket, serverId, loadFiles]);

  const renameFile = useCallback(async (oldPath: string, newPath: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:rename', { serverId, oldPath, newPath }, (result: { success?: boolean; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error ?? null }));
        return;
      }

      setState(prev => ({
        ...prev,
        loading: false,
        openFiles: prev.openFiles.map(f =>
          f.path === oldPath ? { ...f, path: newPath, name: newPath.split('/').pop() || '' } : f
        ),
      }));

      const parentPath = getParentPath(oldPath);
      loadFiles(parentPath);
    });
  }, [socket, serverId, loadFiles]);

  const createDirectory = useCallback(async (path: string) => {
    if (!socket || !serverId) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    socket.emit('file:mkdir', { serverId, path }, (result: { success?: boolean; error?: string }) => {
      if (result.error) {
        setState(prev => ({ ...prev, loading: false, error: result.error ?? null }));
        return;
      }

      setState(prev => ({ ...prev, loading: false }));

      const parentPath = getParentPath(path);
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
      const isExpanded = prev.expandedPaths.includes(path);
      const newExpanded = isExpanded
        ? prev.expandedPaths.filter(p => p !== path)
        : [...prev.expandedPaths, path];

      if (!isExpanded) {
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
