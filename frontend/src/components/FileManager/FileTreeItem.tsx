import React from 'react';
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
      js: '📜',
      ts: '📜',
      jsx: '⚛️',
      tsx: '⚛️',
      py: '🐍',
      java: '☕',
      go: '🐹',
      rs: '🦀',
      html: '🌐',
      css: '🎨',
      json: '📋',
      md: '📝',
      txt: '📄',
      sh: '💻',
      bash: '💻',
    };
    return iconMap[ext || ''] || '📄';
  };

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string) => {
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
