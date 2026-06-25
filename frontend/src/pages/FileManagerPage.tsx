import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Search, X, ChevronRight, Server } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import FileBrowser from '../components/FileManager/FileBrowser';
import EditorTabs from '../components/Editor/EditorTabs';
import { useFileManager } from '../hooks/useFileManager';
import { useFileOperations } from '../hooks/useFileOperations';
import type { OpenFile } from '../types/fileManager';

interface ServerItem {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  description?: string;
  tags?: string[];
}

function StatusBar({ activeFile, serverName }: { activeFile: OpenFile | null; serverName: string }) {
  return (
    <div className="h-6 flex items-center px-3 bg-surface border-t border-border text-xs text-text-secondary gap-4">
      <span className="flex items-center gap-1">
        <Server className="w-3 h-3" />
        {serverName}
      </span>
      {activeFile && (
        <>
          <span>{activeFile.path}</span>
          <span>{activeFile.encoding.toUpperCase()}</span>
          <span>{activeFile.lineEnding}</span>
          <span>
            Ln {activeFile.cursorPosition.line}, Col {activeFile.cursorPosition.column}
          </span>
          {activeFile.modified && <span className="text-yellow-500">Modified</span>}
        </>
      )}
    </div>
  );
}

export default function FileManagerPage() {
  const { token } = useAuth();
  const [selectedServer, setSelectedServer] = useState<ServerItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: serversData, isLoading: serversLoading } = useQuery<{ success: boolean; data: ServerItem[] }>({
    queryKey: ['servers'],
    queryFn: () => api.get('/api/servers').then((r) => r.data),
  });

  const servers = useMemo(() => {
    const all = serversData?.data || [];
    if (!searchTerm) return all;
    const term = searchTerm.toLowerCase();
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.hostname.toLowerCase().includes(term) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(term))
    );
  }, [serversData, searchTerm]);

  const handleSelectServer = useCallback((server: ServerItem) => {
    setSelectedServer(server);
  }, []);

  if (!selectedServer || !token) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <FolderOpen className="w-6 h-6" />
            文件管理
          </h1>
          <p className="text-text-secondary mt-1">选择服务器进行文件浏览和编辑</p>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索服务器名称、IP 或标签..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {serversLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary/60">
            <Server className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">{searchTerm ? '未找到匹配的服务器' : '暂无可用服务器'}</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => handleSelectServer(server)}
                className="group p-4 bg-surface rounded-lg border border-border hover:border-primary/50 hover:bg-background/30 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{server.name}</p>
                    <p className="text-xs text-text-secondary truncate">{server.hostname}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                </div>
                {server.description && (
                  <p className="text-xs text-text-secondary truncate mt-1">{server.description}</p>
                )}
                {server.tags && server.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {server.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-background rounded text-xs text-text-secondary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-2 text-xs text-text-secondary group-hover:text-primary transition-colors">
                  <FolderOpen className="w-3 h-3" />
                  <span>点击打开文件管理</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <FileManagerWorkspace
      server={selectedServer}
      token={token}
      onClose={() => setSelectedServer(null)}
    />
  );
}

function FileManagerWorkspace({
  server,
  token,
  onClose,
}: {
  server: ServerItem;
  token: string;
  onClose: () => void;
}) {
  const {
    state: fmState,
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
  } = useFileManager(server.id, token);

  const { handleDelete, handleRename, handleCreateDirectory } = useFileOperations(
    fmState,
    { deleteFile, renameFile, createDirectory },
  );

  const activeFile = fmState.openFiles.find((f) => f.id === fmState.activeFileId) || null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border-b border-border">
        <button
          onClick={onClose}
          className="p-1 text-text-secondary hover:text-text-primary rounded"
          title="返回服务器列表"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1 text-sm text-text-secondary">
          <Server className="w-3.5 h-3.5" />
          <span className="font-medium text-text-primary">{server.name}</span>
          <span>({server.hostname})</span>
        </div>
        {fmState.selectedPath && (
          <span className="text-xs text-text-secondary truncate ml-2">{fmState.selectedPath}</span>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-64 flex-shrink-0 border-r border-border bg-surface">
          <FileBrowser
            serverId={server.id}
            files={fmState.fileTree}
            expandedPaths={fmState.expandedPaths}
            selectedPath={fmState.selectedPath}
            operations={fmState.operations}
            loading={fmState.loading}
            onLoadFiles={loadFiles}
            onToggleExpand={toggleExpanded}
            onSelect={setSelectedPath}
            onOpen={openFile}
            onDelete={handleDelete}
            onRename={handleRename}
            onCreateDirectory={handleCreateDirectory}
          />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            {fmState.openFiles.length > 0 ? (
              <EditorTabs
                files={fmState.openFiles}
                activeFileId={fmState.activeFileId}
                onSelect={setActiveFile}
                onClose={closeFile}
                onChange={updateFileContent}
                onSave={(fileId) => {
                  const file = fmState.openFiles.find((f) => f.id === fileId);
                  if (file) saveFile(file.path, file.content);
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-800 text-gray-400">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">从左侧文件树打开文件进行编辑</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <StatusBar activeFile={activeFile} serverName={`${server.name} (${server.hostname})`} />
    </div>
  );
}
