import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container, Play, Square, RefreshCw, Search, Loader2, AlertCircle, Layers, RotateCw, ScrollText, X,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import { formatDateTime } from '../lib/date';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import DockerHostSwitcher, { type DockerHostOption } from '../components/docker/DockerHostSwitcher';

interface DockerContainer {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  createdHuman: string;
  ports: Array<{ privatePort: number; publicPort?: number; type: string; ip?: string }>;
  labels: Record<string, string>;
}

interface DockerOverview {
  available: boolean;
  socketPath: string;
  message?: string;
  containers: { total: number; running: number; stopped: number; paused: number };
}

type FilterMode = 'all' | 'running' | 'stopped';

const STATE_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  running: { label: '运行中', dot: 'bg-status-success', text: 'text-status-success' },
  exited: { label: '已停止', dot: 'bg-status-pending', text: 'text-text-secondary' },
  created: { label: '已创建', dot: 'bg-status-warning', text: 'text-status-warning' },
  paused: { label: '已暂停', dot: 'bg-status-paused', text: 'text-status-paused' },
  restarting: { label: '重启中', dot: 'bg-status-running', text: 'text-status-running' },
  dead: { label: '异常', dot: 'bg-status-failed', text: 'text-status-failed' },
};

function stateStyle(state: string) {
  return STATE_STYLES[state] || { label: state || '未知', dot: 'bg-status-pending', text: 'text-text-secondary' };
}

function formatPorts(ports: DockerContainer['ports']): string {
  if (!ports || ports.length === 0) return '-';
  return ports
    .slice(0, 3)
    .map((port) => (port.publicPort ? `${port.publicPort}→${port.privatePort}/${port.type}` : `${port.privatePort}/${port.type}`))
    .join(', ')
    .concat(ports.length > 3 ? ` +${ports.length - 3}` : '');
}

export default function DockerContainers() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [logsTarget, setLogsTarget] = useState<DockerContainer | null>(null);
  const [host, setHost] = useState('local');

  // 可选主机（本机 + 已接入的 Linux 服务器）
  const { data: hosts = [], isLoading: hostsLoading } = useQuery<DockerHostOption[]>({
    queryKey: ['docker-hosts'],
    queryFn: () => api.get('/api/docker/hosts').then((r) => r.data.data || []),
    refetchInterval: 120000,
  });
  const currentHost = hosts.find((item) => item.id === host);

  const { data: overview, isLoading: overviewLoading } = useQuery<DockerOverview>({
    queryKey: ['docker-overview', host],
    queryFn: () => api.get('/api/docker/overview', { params: { server: host } }).then((r) => r.data.data),
    refetchInterval: 30000,
    retry: 1,
  });

  const {
    data: containers = [],
    isLoading: containersLoading,
    refetch,
    isFetching,
  } = useQuery<DockerContainer[]>({
    queryKey: ['docker-containers', host],
    queryFn: () => api.get('/api/docker/containers', { params: { server: host } }).then((r) => r.data.data || []),
    refetchInterval: 30000,
    retry: 1,
  });

  const {
    data: logsData,
    isFetching: logsFetching,
    refetch: refetchLogs,
  } = useQuery<{ id: string; tail: number; logs: string }>({
    queryKey: ['docker-container-logs', host, logsTarget?.id],
    queryFn: () =>
      api
        .get(`/api/docker/containers/${encodeURIComponent(logsTarget!.id)}/logs`, { params: { tail: 300, server: host } })
        .then((r) => r.data.data),
    enabled: Boolean(logsTarget),
    retry: 1,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['docker-containers', host] });
    queryClient.invalidateQueries({ queryKey: ['docker-overview', host] });
  };

  const containerAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' }) =>
      api.post(`/api/docker/containers/${encodeURIComponent(id)}/${action}`, null, { params: { server: host } }),
    onSuccess: (_result, variables) => {
      const label = { start: '启动', stop: '停止', restart: '重启' }[variables.action];
      toast.success(`容器${label}成功`);
      invalidate();
    },
    onError: (error: any, variables) => {
      const label = { start: '启动', stop: '停止', restart: '重启' }[variables.action];
      toast.error(`容器${label}失败：${error.response?.data?.error || error.message}`);
    },
  });

  const isLoading = overviewLoading || containersLoading;

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return containers.filter((item) => {
      if (filter === 'running' && item.state !== 'running') return false;
      if (filter === 'stopped' && item.state === 'running') return false;
      if (!keyword) return true;
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.image.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword) ||
        item.status.toLowerCase().includes(keyword)
      );
    });
  }, [containers, search, filter]);

  const stats = [
    { name: '容器总数', value: overview?.containers.total ?? 0, icon: Container, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: '运行中', value: overview?.containers.running ?? 0, icon: Play, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { name: '已停止', value: overview?.containers.stopped ?? 0, icon: Square, color: 'text-slate-400', bg: 'bg-slate-500/10' },
  ];

  const filters: Array<{ key: FilterMode; label: string; count: number }> = [
    { key: 'all', label: '全部', count: containers.length },
    { key: 'running', label: '运行中', count: overview?.containers.running ?? 0 },
    { key: 'stopped', label: '未运行', count: (overview?.containers.total ?? 0) - (overview?.containers.running ?? 0) },
  ];

  const writable = isAdmin;

  const confirmAction = (container: DockerContainer, action: 'start' | 'stop' | 'restart') => {
    const label = { start: '启动', stop: '停止', restart: '重启' }[action];
    const target = currentHost?.name || '本机';
    if (window.confirm(`在「${target}」上${label}容器 ${container.name}？`)) {
      containerAction.mutate({ id: container.id, action });
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">容器管理</h1>
            <p className="text-text-secondary">
              管理 Docker 容器
              {currentHost && <span className="ml-2 text-text-tertiary text-xs">当前主机：{currentHost.name}</span>}
              {!isAdmin && <span className="ml-2 text-status-warning text-xs">写操作仅管理员可用</span>}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
            刷新
          </button>
        </div>

        {/* 服务器切换 */}
        <DockerHostSwitcher hosts={hosts} value={host} onChange={setHost} isLoading={hostsLoading} />

        {/* Docker 不可用提示 */}
        {overview && !overview.available && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-status-warning/40 bg-status-warning/10">
            <AlertCircle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-text-primary mb-1">Docker Engine 不可用</p>
              <p>请确认后端容器已挂载 Docker socket（{overview.socketPath}），且环境变量 DOCKER_ENABLED 未关闭。</p>
              {overview.message && <p className="mt-1 text-xs text-text-tertiary">{overview.message}</p>}
            </div>
          </div>
        )}

        {/* 统计卡 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-surface rounded-xl p-6 border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <h3 className="text-3xl font-bold text-text-primary mb-1">{stat.value}</h3>
              <p className="text-sm text-text-secondary">{stat.name}</p>
            </div>
          ))}
        </div>

        {/* 搜索 + 过滤 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索容器名称、镜像或状态..."
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60"
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface border border-border">
            {filters.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  filter === item.key ? 'bg-primary/15 text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
        </div>

        {/* 表 */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-text-secondary text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
              <Layers className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{containers.length === 0 ? '暂无容器' : '没有匹配的容器'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary border-b border-border">
                    <th className="px-4 py-3 font-medium">名称</th>
                    <th className="px-4 py-3 font-medium">镜像</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">端口</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const style = stateStyle(item.state);
                    const isRunning = item.state === 'running';
                    return (
                      <tr key={item.id} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                        <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                        <td className="px-4 py-3 text-text-secondary">{item.image}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('inline-flex items-center gap-2', style.text)}>
                            <span className={clsx('w-2 h-2 rounded-full', style.dot)} />
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-secondary">{formatPorts(item.ports)}</td>
                        <td className="px-4 py-3 text-text-secondary">{formatDateTime(item.createdHuman)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setLogsTarget(item)}
                              title="查看日志"
                              className="p-1.5 rounded text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <ScrollText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => confirmAction(item, isRunning ? 'stop' : 'start')}
                              disabled={!writable || containerAction.isPending}
                              title={isAdmin ? (isRunning ? '停止容器' : '启动容器') : '仅管理员可操作'}
                              className={clsx(
                                'p-1.5 rounded transition-colors',
                                writable
                                  ? isRunning
                                    ? 'text-text-tertiary hover:text-status-failed hover:bg-status-failed/10'
                                    : 'text-text-tertiary hover:text-status-success hover:bg-status-success/10'
                                  : 'text-text-tertiary/40 cursor-not-allowed'
                              )}
                            >
                              {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => confirmAction(item, 'restart')}
                              disabled={!writable || containerAction.isPending}
                              title={isAdmin ? '重启容器' : '仅管理员可操作'}
                              className={clsx(
                                'p-1.5 rounded transition-colors',
                                writable
                                  ? 'text-text-tertiary hover:text-status-warning hover:bg-status-warning/10'
                                  : 'text-text-tertiary/40 cursor-not-allowed'
                              )}
                            >
                              <RotateCw className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 日志弹窗 */}
      {logsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLogsTarget(null)}>
          <div
            className="bg-surface rounded-xl border border-border w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-bold text-text-primary">容器日志</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  {logsTarget.name} · {logsTarget.image} · 最近 300 行
                  {currentHost && ` · ${currentHost.name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetchLogs()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-background border border-border text-text-secondary hover:text-text-primary transition-colors"
                >
                  <RefreshCw className={clsx('w-3.5 h-3.5', logsFetching && 'animate-spin')} />
                  刷新
                </button>
                <button onClick={() => setLogsTarget(null)} className="p-1.5 rounded hover:bg-background text-text-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-background/60">
              {logsFetching && !logsData ? (
                <div className="flex items-center justify-center gap-2 py-10 text-text-secondary text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载日志...
                </div>
              ) : (
                <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all">
                  {logsData?.logs?.trim() || '（暂无日志输出）'}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}