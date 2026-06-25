import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, Terminal, Search, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import WebTerminal from '../components/WebTerminal';
import FileBrowser from '../components/FileManager/FileBrowser';
import EditorTabs from '../components/Editor/EditorTabs';
import { useFileManager } from '../hooks/useFileManager';
import { useFileOperations } from '../hooks/useFileOperations';

interface ServerItem {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  use_ssh_key: number;
  description?: string;
  tags?: string[];
  enabled: number;
  last_connected?: string;
  created_at: string;
}

export default function TerminalPage() {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServer, setSelectedServer] = useState<ServerItem | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleServerClick = useCallback((server: ServerItem) => {
    setSelectedServer(server);
  }, []);

  const handleCloseTerminal = useCallback(() => {
    setSelectedServer(null);
  }, []);

  const { data: serversData, isLoading } = useQuery<{ success: boolean; data: ServerItem[] }>({
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
        s.username.toLowerCase().includes(term) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(term))
    );
  }, [serversData, searchTerm]);

  if (!selectedServer || !token) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Terminal className="w-6 h-6" />
            Web 终端
          </h1>
          <p className="text-text-secondary mt-1">
            选择服务器打开交互式 SSH 终端
          </p>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
          <input
            type="text"
            placeholder="搜索服务器名称、IP、用户名或标签..."
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

        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary/60">
            <Server className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">
              {searchTerm ? '未找到匹配的服务器' : '暂无可用服务器'}
            </p>
            <p className="text-sm mt-1">
              {searchTerm ? '请尝试其他搜索关键词' : '请先在服务器管理页面添加服务器'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => handleServerClick(server)}
                className="group flex flex-col items-start p-4 bg-surface border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start justify-between w-full mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Terminal className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-text-primary group-hover:text-primary transition-colors">
                        {server.name}
                      </h3>
                      <p className="text-xs text-text-secondary">{server.hostname}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${server.enabled ? 'bg-status-success' : 'bg-text-secondary/30'}`} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-2 py-0.5 text-xs bg-background text-text-secondary rounded">
                    {server.username}@{server.port}
                  </span>
                  {server.use_ssh_key ? (
                    <span className="px-2 py-0.5 text-xs bg-status-success/10 text-status-success rounded">
                      密钥
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-status-warning/10 text-status-warning rounded">
                      密码
                    </span>
                  )}
                </div>
                {server.tags && server.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {server.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-2 text-xs text-text-secondary group-hover:text-primary transition-colors">
                  <Terminal className="w-3 h-3" />
                  <span>点击打开终端</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <TerminalWorkspace
      server={selectedServer}
      token={token}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      onClose={handleCloseTerminal}
    />
  );
}

function TerminalWorkspace({
  server,
  token,
  sidebarOpen,
  onToggleSidebar,
  onClose,
}: {
  server: ServerItem;
  token: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onClose: () => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);

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
  } = useFileManager(sessionId, token);

  const { handleDelete, handleRename, handleCreateDirectory } = useFileOperations(
    fmState,
    { deleteFile, renameFile, createDirectory },
  );

  return (
    <div className="h-full flex">
      {sidebarOpen && (
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
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-2 py-1 bg-surface border-b border-border">
          <button
            onClick={onToggleSidebar}
            className="p-1 text-text-secondary hover:text-text-primary rounded"
            title={sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          <span className="text-sm text-text-secondary truncate">
            {server.name} ({server.hostname})
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1 text-text-secondary hover:text-text-primary rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {fmState.openFiles.length > 0 && (
          <div className="h-80 flex-shrink-0 border-b border-border">
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
          </div>
        )}

        <div className="flex-1 min-h-0">
          <WebTerminal
            serverId={server.id}
            serverName={`${server.name} (${server.hostname})`}
            token={token}
            onClose={onClose}
            onSessionReady={setSessionId}
          />
        </div>
      </div>
    </div>
  );
}
