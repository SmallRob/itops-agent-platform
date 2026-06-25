import { useCallback } from 'react';
import type { FileManagerState, FileOperations } from '../types/fileManager';

export function useFileOperations(
  state: FileManagerState,
  operations: {
    deleteFile: (path: string) => Promise<void>;
    renameFile: (oldPath: string, newPath: string) => Promise<void>;
    createDirectory: (path: string) => Promise<void>;
  },
  setError?: (error: string | null) => void
) {
  const canPerformOperation = useCallback((operation: keyof FileOperations): boolean => {
    return state.operations[operation];
  }, [state.operations]);

  const handleDelete = useCallback(async (path: string) => {
    if (!canPerformOperation('delete')) {
      return;
    }
    try {
      await operations.deleteFile(path);
    } catch (err) {
      setError?.(err instanceof Error ? err.message : 'Failed to delete file');
    }
  }, [canPerformOperation, operations.deleteFile, setError]);

  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    if (!canPerformOperation('rename')) {
      return;
    }
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');
    try {
      await operations.renameFile(oldPath, newPath);
    } catch (err) {
      setError?.(err instanceof Error ? err.message : 'Failed to rename file');
    }
  }, [canPerformOperation, operations.renameFile, setError]);

  const handleCreateDirectory = useCallback(async (parentPath: string, name: string) => {
    if (!canPerformOperation('create')) {
      return;
    }
    const newPath = `${parentPath}/${name}`.replace(/\/\//g, '/');
    try {
      await operations.createDirectory(newPath);
    } catch (err) {
      setError?.(err instanceof Error ? err.message : 'Failed to create directory');
    }
  }, [canPerformOperation, operations.createDirectory, setError]);

  return {
    canPerformOperation,
    handleDelete,
    handleRename,
    handleCreateDirectory,
  };
}
