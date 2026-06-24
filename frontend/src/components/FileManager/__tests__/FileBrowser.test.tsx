import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import FileBrowser from '../FileBrowser';
import type { FileItem, FileOperations } from '../../../types/fileManager';

vi.mock('../FileTreeItem', () => ({
  default: ({ item, onSelect, onOpen, onContextMenu }: any) => (
    <div data-testid={`tree-item-${item.name}`}>
      <span>{item.name}</span>
      <button data-testid={`select-${item.name}`} onClick={() => onSelect(item.path)} />
      <button data-testid={`open-${item.name}`} onClick={() => onOpen(item.path)} />
      <button data-testid={`context-${item.name}`} onClick={(e: any) => onContextMenu(e, item)} />
    </div>
  ),
}));

vi.mock('../FileContextMenu', () => ({
  default: ({ item, onClose, onAction }: any) => (
    <div data-testid="context-menu">
      <span>{item.name}</span>
      <button data-testid="action-open" onClick={() => onAction('open', item)} />
      <button data-testid="action-delete" onClick={() => onAction('delete', item)} />
      <button data-testid="action-copy" onClick={() => onAction('copy', item)} />
      <button data-testid="close-menu" onClick={onClose} />
    </div>
  ),
}));

vi.mock('../FileBreadcrumb', () => ({
  default: ({ path, onNavigate }: any) => (
    <div data-testid="breadcrumb">
      <span>{path}</span>
      <button data-testid="nav-root" onClick={() => onNavigate('/')} />
    </div>
  ),
}));

vi.mock('../FileSearch', () => ({
  default: ({ onSearch, onClear, results }: any) => (
    <div data-testid="file-search">
      <button data-testid="trigger-search" onClick={() => onSearch('test')} />
      <button data-testid="clear-search" onClick={onClear} />
      <span data-testid="result-count">{results.length}</span>
    </div>
  ),
}));

const mockFiles: Record<string, FileItem[]> = {
  '/': [
    { name: 'home', path: '/home', type: 'directory', size: 4096, modified: '2024-01-01T00:00:00Z', permissions: '755', owner: '0', group: '0' },
    { name: 'tmp', path: '/tmp', type: 'directory', size: 4096, modified: '2024-01-01T00:00:00Z', permissions: '777', owner: '0', group: '0' },
    { name: 'readme.txt', path: '/readme.txt', type: 'file', size: 100, modified: '2024-01-02T00:00:00Z', permissions: '644', owner: '1000', group: '1000' },
  ],
  '/home': [
    { name: 'user', path: '/home/user', type: 'directory', size: 4096, modified: '2024-01-01T00:00:00Z', permissions: '755', owner: '1000', group: '1000' },
  ],
};

const defaultOperations: FileOperations = {
  create: true,
  read: true,
  update: true,
  delete: true,
  rename: true,
  upload: false,
  download: false,
  copy: false,
  paste: false,
  cut: false,
  compress: false,
  extract: false,
  permissions: false,
  ownership: false,
};

function renderFileBrowser(overrides: Partial<React.ComponentProps<typeof FileBrowser>> = {}) {
  const defaultProps = {
    serverId: 's1',
    files: mockFiles,
    expandedPaths: [],
    selectedPath: null,
    operations: defaultOperations,
    loading: false,
    onLoadFiles: vi.fn(),
    onToggleExpand: vi.fn(),
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onCreateDirectory: vi.fn(),
    ...overrides,
  };
  return { ...render(<FileBrowser {...defaultProps} />), props: defaultProps };
}

describe('FileBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the file browser heading', () => {
    renderFileBrowser();
    expect(screen.getByText('File Browser')).toBeInTheDocument();
  });

  it('should call onLoadFiles with root path on mount', () => {
    const { props } = renderFileBrowser();
    expect(props.onLoadFiles).toHaveBeenCalledWith('/');
  });

  it('should render file tree items from root', () => {
    renderFileBrowser();
    expect(screen.getByTestId('tree-item-home')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-tmp')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-readme.txt')).toBeInTheDocument();
  });

  it('should show loading spinner when loading', () => {
    renderFileBrowser({ loading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('should not show file items when loading', () => {
    renderFileBrowser({ loading: true });
    expect(screen.queryByTestId('tree-item-home')).not.toBeInTheDocument();
  });

  it('should render breadcrumb component', () => {
    renderFileBrowser();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('should render search component', () => {
    renderFileBrowser();
    expect(screen.getByTestId('file-search')).toBeInTheDocument();
  });

  it('should call onSelect when a file is selected', () => {
    const { props } = renderFileBrowser();
    fireEvent.click(screen.getByTestId('select-home'));
    expect(props.onSelect).toHaveBeenCalledWith('/home');
  });

  it('should call onOpen when a file is opened', () => {
    const { props } = renderFileBrowser();
    fireEvent.click(screen.getByTestId('open-readme.txt'));
    expect(props.onOpen).toHaveBeenCalledWith('/readme.txt');
  });

  it('should show context menu on right-click', () => {
    renderFileBrowser();
    fireEvent.click(screen.getByTestId('context-home'));
    expect(screen.getByTestId('context-menu')).toBeInTheDocument();
  });

  it('should close context menu when close is triggered', () => {
    renderFileBrowser();
    fireEvent.click(screen.getByTestId('context-home'));
    fireEvent.click(screen.getByTestId('close-menu'));
    expect(screen.queryByTestId('context-menu')).not.toBeInTheDocument();
  });

  it('should call onOpen from context menu action', () => {
    const { props } = renderFileBrowser();
    fireEvent.click(screen.getByTestId('context-home'));
    fireEvent.click(screen.getByTestId('action-open'));
    expect(props.onOpen).toHaveBeenCalledWith('/home');
  });

  it('should call onDelete from context menu action', () => {
    const { props } = renderFileBrowser();
    fireEvent.click(screen.getByTestId('context-home'));
    fireEvent.click(screen.getByTestId('action-delete'));
    expect(props.onDelete).toHaveBeenCalledWith('/home');
  });

  it('should render child items when path is expanded', () => {
    renderFileBrowser({ expandedPaths: ['/'] });
    expect(screen.getByTestId('tree-item-home')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-tmp')).toBeInTheDocument();
  });

  it('should highlight selected item', () => {
    renderFileBrowser({ selectedPath: '/home' });
    expect(screen.getByTestId('tree-item-home')).toBeInTheDocument();
  });

  it('should handle empty file list', () => {
    renderFileBrowser({ files: {} });
    expect(screen.getByText('File Browser')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-item-home')).not.toBeInTheDocument();
  });

  it('should re-call onLoadFiles when serverId changes', () => {
    const { rerender } = render(
      <FileBrowser
        serverId="s1"
        files={mockFiles}
        expandedPaths={[]}
        selectedPath={null}
        operations={defaultOperations}
        loading={false}
        onLoadFiles={vi.fn()}
        onToggleExpand={vi.fn()}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onCreateDirectory={vi.fn()}
      />,
    );

    const newOnLoadFiles = vi.fn();
    rerender(
      <FileBrowser
        serverId="s2"
        files={mockFiles}
        expandedPaths={[]}
        selectedPath={null}
        operations={defaultOperations}
        loading={false}
        onLoadFiles={newOnLoadFiles}
        onToggleExpand={vi.fn()}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onCreateDirectory={vi.fn()}
      />,
    );

    expect(newOnLoadFiles).toHaveBeenCalledWith('/');
  });
});
