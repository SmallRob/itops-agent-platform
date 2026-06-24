import React, { useRef, useEffect } from 'react';
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    {
      label: 'Download',
      action: 'download',
      icon: '⬇️',
      show: operations.download && item.type === 'file',
    },
    { label: 'Permissions', action: 'permissions', icon: '🔐', show: operations.permissions },
  ].filter((menuItem) => menuItem.show);

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
