import React, { useState, useEffect, useCallback } from 'react';
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
  onPermissionsChange?: (path: string, permissions: string) => void;
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
  onPermissionsChange,
}: FileBrowserProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileItem;
  } | null>(null);
  const [rootPath] = useState('/');

  useEffect(() => {
    onLoadFiles(rootPath);
  }, [serverId, rootPath, onLoadFiles]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextAction = useCallback(
    (action: string, item: FileItem) => {
      switch (action) {
        case 'open':
          onOpen(item.path);
          break;
        case 'delete':
          onDelete(item.path);
          break;
        case 'rename': {
          const newName = prompt('Enter new name:', item.name);
          if (newName) {
            onRename(item.path, newName);
          }
          break;
        }
        case 'copy':
          navigator.clipboard.writeText(item.path);
          break;
        case 'cut':
          navigator.clipboard.writeText(item.path);
          break;
        case 'download': {
          const link = document.createElement('a');
          link.href = `/api/files/download?path=${encodeURIComponent(item.path)}`;
          link.download = item.name;
          link.click();
          break;
        }
        case 'permissions': {
          const newPermissions = prompt('Enter new permissions (e.g., 755):', item.permissions);
          if (newPermissions && onPermissionsChange) {
            onPermissionsChange(item.path, newPermissions);
          }
          break;
        }
      }
      handleCloseContextMenu();
    },
    [onOpen, onDelete, onRename, onPermissionsChange, handleCloseContextMenu],
  );

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
        {item.type === 'directory' && expandedPaths.has(item.path) && renderFileTree(item.path, level + 1)}
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
