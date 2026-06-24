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
