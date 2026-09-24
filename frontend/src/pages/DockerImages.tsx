import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes, HardDrive, Tag, RefreshCw, Search, Download, Trash2, Loader2, AlertCircle, Container, X,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import { formatDateTime } from '../lib/date';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import DockerHostSwitcher, { type DockerHostOption } from '../components/docker/DockerHostSwitcher';

interface DockerImage {
  id: string;
  shortId: string;
  repoTags: string[];
  repository: string;
  tag: string;
  size: number;
  sizeHuman: string;
  created: number;
  createdHuman: string;
  dangling: boolean;
  containers: number;
}

interface DockerOverview {
  available: boolean;
  socketPath: string;
  engineVersion?: string;
  message?: string;
  images: { total: number; tagged: number; dangling: number; totalSize: number; totalSizeHuman: string };
}

type FilterMode = 'all' | 'tagged' | 'dangling';

export default function DockerImages() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [pullOpen, setPullOpen] = useState(false);
  const [pullRef, setPullRef] = useState('');
  const [host, setHost] = useState('local');

  // 可选主机（本机 + 已接入的 Linux 服务器）
  const { data: hosts = [], isLoading: hostsLoading } = useQuery<DockerHostOption[]>({
    queryKey: ['docker-hosts'],
    queryFn: () => api.get('/api/docker/hosts').then((r) => r.data.data || []),
    refetchInterval: 120000,
  });
  const currentHost = hosts.find((item) => item.id === host);

  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
    isFetching: overviewFetching,
  } = useQuery<DockerOverview>({
    queryKey: ['docker-overview', host],
    queryFn: () => api.get('/api/docker/overview', { params: { server: host } }).then((r) => r.data.data),
    refetchInterval: 30000,
    retry: 1,
  });

  const {
    data: images = [],
    isLoading: imagesLoading,
    refetch: refetchImages,
  } = useQuery<DockerImage[]>({
    queryKey: ['docker-images', host],
    queryFn: () => api.get('/api/docker/images', { params: { server: host } }).then((r) => r.data.data || []),
    retry: 1,
  });

  const isLoading = overviewLoading || imagesLoading;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['docker-images', host] });
    queryClient.invalidateQueries({ queryKey: ['docker-overview', host] });
  };

  const pullImage = useMutation({
    mutationFn: (ref: string) => api.post('/api/docker/images/pull', { ref }, { params: { server: host } }),
    onSuccess: () => {
      toast.success(`镜像 ${pullRef} 拉取成功`);
      setPullOpen(false);
      setPullRef('');
      invalidate();
    },
    onError: (error: any) => {
      toast.error(`拉取失败：${error.response?.data?.error || error.message}`);
    },
  });

  const removeImage = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/docker/images/${encodeURIComponent(id)}`, { params: { server: host } }),
    onSuccess: () => {
      toast.success('镜像已删除');
      invalidate();
    },
    onError: (error: any) => {
      toast.error(`删除失败：${error.response?.data?.error || error.message}`);
    },
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return images.filter((image) => {
      if (filter === 'tagged' && image.dangling) return false;
      if (filter === 'dangling' && !image.dangling) return false;
      if (!keyword) return true;
      return (
        image.repository.toLowerCase().includes(keyword) ||
        image.tag.toLowerCase().includes(keyword) ||
        image.id.toLowerCase().includes(keyword) ||
        image.repoTags.some((repoTag) => repoTag.toLowerCase().includes(keyword))
      );
    });
  }, [images, search, filter]);

  const refresh = () => {
    refetchOverview();
    refetchImages();
  };

  const stats = [
    { name: '总镜像数', value: overview?.images.total ?? 0, icon: Boxes, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: '总大小', value: overview?.images.totalSizeHuman ?? '-', icon: HardDrive, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { name: '已标记', value: overview?.images.tagged ?? 0, icon: Tag, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  const filters: Array<{ key: FilterMode; label: string; count: number }> = [
    { key: 'all', label: '全部', count: images.length },
    { key: 'tagged', label: '已标记', count: overview?.images.tagged ?? 0 },
    { key: 'dangling', label: '无标签', count: overview?.images.dangling ?? 0 },
  ];

  const writable = isAdmin;

  const confirmRemove = (image: DockerImage) => {
    const used = image.containers > 0;
    const target = currentHost?.name || '本机';
    const prompt = used
      ? `在「${target}」上删除镜像 ${image.repoTags[0] || image.shortId}？\n该镜像正被 ${image.containers} 个容器使用，将强制删除，可能影响运行中的容器。`
      : `在「${target}」上删除镜像 ${image.repoTags[0] || image.shortId}？`;
    if (window.confirm(prompt)) {
      removeImage.mutate(image.id);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">镜像管理</h1>
            <p className="text-text-secondary">
              管理 Docker 镜像
              {overview?.engineVersion ? `（Engine ${overview.engineVersion}）` : ''}
              {currentHost && <span className="ml-2 text-text-tertiary text-xs">当前主机：{currentHost.name}</span>}
              {!isAdmin && <span className="ml-2 text-status-warning text-xs">写操作仅管理员可用</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              <RefreshCw className={clsx('w-4 h-4', overviewFetching && 'animate-spin')} />
              刷新
            </button>
            <button
              onClick={() => setPullOpen(true)}
              disabled={!writable}
              title={isAdmin ? '拉取镜像' : '仅管理员可拉取镜像'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              拉取镜像
            </button>
          </div>
        </div>

        {/* 服务器切换 */}
        <DockerHostSwitcher hosts={hosts} value={host} onChange={setHost} isLoading={hostsLoading} />

        {/* Docker 不可用提示 */}
        {overview && !overview.available && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-status-warning/40 bg-status-warning/10">
            <AlertCircle className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-text-primary mb-1">Docker Engine 不可用</p>
              <p>
                请确认后端容器已挂载 Docker socket（{overview.socketPath}），且环境变量 DOCKER_ENABLED 未关闭。
              </p>
              {overview.message && <p className="mt-1 text-xs text-text-tertiary">{overview.message}</p>}
            </div>
          </div>
        )}

        {/* 统计卡 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="bg-surface rounded-xl p-6 border border-border hover:border-primary/50 transition-all"
            >
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
              placeholder="搜索镜像名称、标签或ID..."
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
                  filter === item.key
                    ? 'bg-primary/15 text-primary'
                    : 'text-text-secondary hover:text-text-primary'
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
              <Container className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{images.length === 0 ? '暂无镜像' : '没有匹配的镜像'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary border-b border-border">
                    <th className="px-4 py-3 font-medium">仓库</th>
                    <th className="px-4 py-3 font-medium">标签</th>
                    <th className="px-4 py-3 font-medium">镜像ID</th>
                    <th className="px-4 py-3 font-medium">大小</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((image) => (
                    <tr key={image.id} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                      <td className="px-4 py-3 font-medium text-text-primary">{image.repository}</td>
                      <td className="px-4 py-3 text-text-secondary">{image.tag}</td>
                      <td className="px-4 py-3 font-mono text-xs text-text-tertiary">{image.shortId}</td>
                      <td className="px-4 py-3 text-text-secondary">{image.sizeHuman}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatDateTime(image.createdHuman)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => confirmRemove(image)}
                          disabled={!writable || removeImage.isPending}
                          title={isAdmin ? '删除镜像' : '仅管理员可删除'}
                          className={clsx(
                            'p-1.5 rounded transition-colors',
                            writable
                              ? 'text-text-tertiary hover:text-status-failed hover:bg-status-failed/10'
                              : 'text-text-tertiary/40 cursor-not-allowed'
                          )}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 拉取镜像对话框 */}
      {pullOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPullOpen(false)}>
          <div
            className="bg-surface rounded-xl border border-border p-6 w-full max-w-md shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">拉取镜像</h2>
              <button onClick={() => setPullOpen(false)} className="p-1 rounded hover:bg-background text-text-secondary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-sm text-text-secondary mb-1.5">
              目标主机：<span className="text-text-primary font-medium">{currentHost?.name || '本机'}</span>
            </label>
            <label className="block text-sm text-text-secondary mb-1.5">
              镜像引用（如 nginx:latest、registry:5000/ns/app:v1）
            </label>
            <input
              autoFocus
              value={pullRef}
              onChange={(event) => setPullRef(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && pullRef.trim() && !pullImage.isPending) {
                  pullImage.mutate(pullRef.trim());
                }
              }}
              placeholder="nginx:latest"
              className="w-full px-3 py-2 rounded-lg text-sm bg-background border border-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPullOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => pullImage.mutate(pullRef.trim())}
                disabled={!pullRef.trim() || pullImage.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pullImage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                拉取
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}