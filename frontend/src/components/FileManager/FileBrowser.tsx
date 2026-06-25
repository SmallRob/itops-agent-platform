import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileItem, FileOperations, SearchResult } from '../../types/fileManager';
import FileTreeItem from './FileTreeItem';
import FileContextMenu from './FileContextMenu';
import FileBreadcrumb from './FileBreadcrumb';
import FileSearch from './FileSearch';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');

  useEffect(() => {
    onLoadFiles(rootPath);
    setCurrentPath(rootPath);
  }, [serverId, rootPath, onLoadFiles]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleSearch = useCallback(
    (query: string) => {
      setIsSearching(true);
      setSearchQuery(query);
      const lowerQuery = query.toLowerCase();
      const results: SearchResult[] = [];

      Object.entries(files).forEach(([dirPath, items]) => {
        items.forEach((item) => {
          const nameMatch = item.name.toLowerCase().includes(lowerQuery);
          const pathMatch = item.path.toLowerCase().includes(lowerQuery);
          if (nameMatch || pathMatch) {
            results.push({
              path: item.path,
              name: item.name,
              type: item.type,
              matches: nameMatch
                ? [
                    {
                      line: 0,
                      content: item.name,
                      startIndex: item.name.toLowerCase().indexOf(lowerQuery),
                      endIndex: item.name.toLowerCase().indexOf(lowerQuery) + query.length,
                    },
                  ]
                : [],
            });
          }
        });
      });

      setSearchResults(results);
      setIsSearching(false);
    },
    [files],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleSelectSearchResult = useCallback(
    (path: string) => {
      onSelect(path);
      setSearchQuery('');
      setSearchResults([]);
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
      setCurrentPath(parentPath);
      onLoadFiles(parentPath);
    },
    [onSelect, onLoadFiles],
  );

  const handleBreadcrumbNavigate = useCallback(
    (path: string) => {
      setCurrentPath(path);
      onLoadFiles(path);
    },
    [onLoadFiles],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery) {
      return files[currentPath] || [];
    }
    const lowerQuery = searchQuery.toLowerCase();
    return searchResults
      .filter((r) => {
        const parentPath = r.path.substring(0, r.path.lastIndexOf('/')) || '/';
        return parentPath === currentPath;
      })
      .map(
        (r): FileItem => ({
          name: r.name,
          path: r.path,
          type: r.type,
          size: 0,
          modified: '',
          permissions: '',
          owner: '',
          group: '',
        }),
      );
  }, [files, currentPath, searchQuery, searchResults]);

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
    const items = level === 0 ? filteredItems : files[path] || [];

    return items.map((item) => (
      <React.Fragment key={item.path}>
        <FileTreeItem
          item={item}
          level={level}
          isExpanded={expandedPaths.includes(item.path)}
          isSelected={selectedPath === item.path}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onOpen={onOpen}
          onContextMenu={handleContextMenu}
        />
        {item.type === 'directory' && expandedPaths.includes(item.path) && renderFileTree(item.path, level + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-200">
      <div className="p-2 border-b border-gray-700">
        <h3 className="text-sm font-semibold mb-2">File Browser</h3>
        <FileSearch
          results={searchResults}
          isSearching={isSearching}
          onSearch={handleSearch}
          onClear={handleClearSearch}
          onSelectResult={handleSelectSearchResult}
        />
      </div>

      <div className="border-b border-gray-700">
        <FileBreadcrumb path={currentPath} onNavigate={handleBreadcrumbNavigate} />
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div role="status" aria-label="Loading" className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
