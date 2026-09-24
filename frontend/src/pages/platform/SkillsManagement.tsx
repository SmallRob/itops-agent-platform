import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Puzzle, RefreshCw, Upload, Trash2, Loader2, Search, Wand2, ChevronDown, ChevronRight,
  AlertCircle, ShieldAlert, Wrench, FolderOpen, X, Package,
} from 'lucide-react';
import clsx from 'clsx';
import api, { formDataRequestConfig } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

interface SkillTool {
  name: string;
  description: string;
  kind: string;
  endpoint?: string;
  httpMethod?: string;
  requiresAdmin?: boolean;
  write?: boolean;
}

interface SkillManifest {
  slug: string;
  name: string;
  description: string;
  version: string;
  ownerId: string;
  tags: string[];
  triggers: string[];
  tools: SkillTool[];
  enabledByDefault: boolean;
  enabled: boolean;
  path: string;
  warnings: string[];
}

interface SkillLoadError {
  path: string;
  error: string;
}

interface SkillMatch {
  slug: string;
  name: string;
  score: number;
  reason: string;
  tools: string[];
}

interface SkillsPayload {
  skillsDir: string;
  loadedAt: string | null;
  skills: SkillManifest[];
  errors: SkillLoadError[];
}

type FilterMode = 'all' | 'enabled' | 'disabled';

const kindStyles: Record<string, string> = {
  ssh: 'bg-cyan-500/15 text-cyan-500',
  docker: 'bg-sky-500/15 text-sky-500',
  network: 'bg-emerald-500/15 text-emerald-500',
  http: 'bg-violet-500/15 text-violet-500',
  ai: 'bg-amber-500/15 text-amber-500',
  builtin: 'bg-slate-500/15 text-slate-400',
};

export default function SkillsManagement() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installFile, setInstallFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [matchQuery, setMatchQuery] = useState('');
  const [matchResult, setMatchResult] = useState<SkillMatch[] | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<SkillsPayload>({
    queryKey: ['skills'],
    queryFn: () => api.get('/api/skills', { params: { all: 1 } }).then((r) => r.data.data),
    refetchInterval: 60000,
    retry: 1,
  });

  const skills = data?.skills ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['skills'] });

  const toggleSkill = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      api.post(`/api/skills/${slug}/toggle`, { enabled }),
    onSuccess: (res) => {
      const manifest = res.data?.data as SkillManifest | undefined;
      toast.success(`技能「${manifest?.name || ''}」已${manifest?.enabled ? '启用' : '停用'}`);
      invalidate();
    },
    onError: (error: any) => toast.error(`操作失败：${error.response?.data?.error || error.message}`),
  });

  const reloadSkills = useMutation({
    mutationFn: () => api.post('/api/skills/reload'),
    onSuccess: (res) => {
      const result = res.data?.data;
      toast.success(`已重新装载 ${result?.loaded ?? 0} 个技能${result?.errors?.length ? `（${result.errors.length} 个失败）` : ''}`);
      invalidate();
    },
    onError: (error: any) => toast.error(`重载失败：${error.response?.data?.error || error.message}`),
  });

  const installSkill = useMutation({
    mutationFn: () => {
      if (!installFile) throw new Error('请选择技能包文件');
      const form = new FormData();
      form.append('file', installFile);
      return api.post('/api/skills/install', form, {
        ...formDataRequestConfig,
        params: overwrite ? { overwrite: '1' } : {},
      });
    },
    onSuccess: (res) => {
      const result = res.data?.data;
      toast.success(`技能包「${result?.slug}」安装成功（${result?.files} 个文件${result?.overwritten ? '，已覆盖旧版本' : ''}）`);
      closeInstall();
      invalidate();
    },
    onError: (error: any) => toast.error(`安装失败：${error.response?.data?.error || error.message}`),
  });

  const uninstallSkill = useMutation({
    mutationFn: (slug: string) => api.delete(`/api/skills/${slug}`),
    onSuccess: (res) => {
      toast.success(`技能「${res.data?.data?.slug}」已卸载（移除 ${res.data?.data?.removedFiles} 个文件）`);
      invalidate();
    },
    onError: (error: any) => toast.error(`卸载失败：${error.response?.data?.error || error.message}`),
  });

  const runMatch = useMutation({
    mutationFn: (query: string) => api.post('/api/skills/match', { query, limit: 5 }),
    onSuccess: (res) => setMatchResult(res.data?.data || []),
    onError: (error: any) => toast.error(`匹配失败：${error.response?.data?.error || error.message}`),
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return skills.filter((skill) => {
      if (filter === 'enabled' && !skill.enabled) return false;
      if (filter === 'disabled' && skill.enabled) return false;
      if (!keyword) return true;
      return (
        skill.slug.toLowerCase().includes(keyword) ||
        skill.name.toLowerCase().includes(keyword) ||
        skill.description.toLowerCase().includes(keyword) ||
        skill.triggers.some((trigger) => trigger.toLowerCase().includes(keyword)) ||
        skill.tools.some((tool) => tool.name.toLowerCase().includes(keyword))
      );
    });
  }, [skills, search, filter]);

  const stats = useMemo(
    () => [
      { name: '技能总数', value: skills.length, icon: Puzzle, color: 'text-primary', bg: 'bg-primary/15' },
      { name: '已启用', value: skills.filter((s) => s.enabled).length, icon: Wrench, color: 'text-emerald-500', bg: 'bg-emerald-500/15' },
      {
        name: '可用工具',
        value: skills.filter((s) => s.enabled).reduce((sum, s) => sum + s.tools.length, 0),
        icon: Package,
        color: 'text-violet-500',
        bg: 'bg-violet-500/15',
      },
      {
        name: '装载告警',
        value: (data?.errors.length || 0) + skills.reduce((sum, s) => sum + s.warnings.length, 0),
        icon: AlertCircle,
        color: (data?.errors.length || 0) > 0 ? 'text-status-warning' : 'text-text-tertiary',
        bg: 'bg-status-warning/15',
      },
    ],
    [skills, data?.errors.length]
  );

  const closeInstall = () => {
    setInstallOpen(false);
    setInstallFile(null);
    setOverwrite(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmUninstall = (skill: SkillManifest) => {
    if (window.confirm(`确认卸载技能「${skill.name}」？将删除目录 ${skill.path} 并立即从注册表移除。`)) {
      uninstallSkill.mutate(skill.slug);
    }
  };

  const filters: Array<{ key: FilterMode; label: string; count: number }> = [
    { key: 'all', label: '全部', count: skills.length },
    { key: 'enabled', label: '已启用', count: skills.filter((s) => s.enabled).length },
    { key: 'disabled', label: '已停用', count: skills.filter((s) => !s.enabled).length },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Puzzle className="w-6 h-6 text-primary" />
            技能插件
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            技能 = 目录 + SKILL.md + skill.json，声明式描述能力与可用工具；Agent 按意图匹配自动装载，目录增删即插即用
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
            刷新
          </button>
          <button
            onClick={() => reloadSkills.mutate()}
            disabled={!isAdmin || reloadSkills.isPending}
            title={isAdmin ? '重新扫描技能目录' : '仅管理员可重载'}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-surface border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderOpen className="w-4 h-4" />
            重载目录
          </button>
          <button
            onClick={() => setInstallOpen(true)}
            disabled={!isAdmin}
            title={isAdmin ? '上传技能包（zip）' : '仅管理员可安装'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-4 h-4" />
            安装技能包
          </button>
        </div>
      </div>

      {/* 目录信息 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-text-tertiary">
        <span>技能目录：<span className="font-mono text-text-secondary">{data?.skillsDir || '-'}</span></span>
        <span>上次装载：{data?.loadedAt ? new Date(data.loadedAt).toLocaleString() : '-'}</span>
      </div>

      {/* 统计卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-surface rounded-xl p-5 border border-border hover:border-primary/50 transition-all">
            <div className={clsx('p-2.5 rounded-lg w-fit mb-3', stat.bg)}>
              <stat.icon className={clsx('w-5 h-5', stat.color)} />
            </div>
            <h3 className="text-2xl font-bold text-text-primary">{stat.value}</h3>
            <p className="text-xs text-text-secondary mt-0.5">{stat.name}</p>
          </div>
        ))}
      </div>

      {/* 装载错误 */}
      {(data?.errors.length || 0) > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-status-warning/40 bg-status-warning/10">
          <ShieldAlert className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">有 {data?.errors.length} 个目录装载失败（不影响其它技能）</p>
            {data?.errors.map((error) => (
              <p key={error.path} className="font-mono text-xs">
                {error.path}：{error.error}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* 搜索与过滤 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索技能名、slug、触发词或工具名..."
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

      {/* 技能卡片 */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-secondary text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary bg-surface rounded-xl border border-border">
          <Puzzle className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">{skills.length === 0 ? '未装载任何技能，请检查技能目录' : '没有匹配的技能'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((skill) => {
            const isExpanded = expanded === skill.slug;
            return (
              <div
                key={skill.slug}
                className={clsx(
                  'bg-surface rounded-xl border transition-all',
                  skill.enabled ? 'border-border hover:border-primary/50' : 'border-border/60 opacity-70'
                )}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary truncate">{skill.name}</h3>
                        <span className="px-2 py-0.5 rounded-md text-[11px] bg-background text-text-tertiary font-mono">
                          v{skill.version}
                        </span>
                        {!skill.enabled && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-status-warning/15 text-status-warning">
                            已停用
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary font-mono mt-1">{skill.slug}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer flex-shrink-0" title={isAdmin ? '启用 / 停用' : '仅管理员可切换'}>
                      <span className="text-xs text-text-tertiary">{skill.enabled ? '启用' : '停用'}</span>
                      <span
                        onClick={() => isAdmin && toggleSkill.mutate({ slug: skill.slug, enabled: !skill.enabled })}
                        className={clsx(
                          'w-10 h-5 rounded-full relative transition-colors',
                          skill.enabled ? 'bg-primary' : 'bg-border',
                          !isAdmin && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <span
                          className={clsx(
                            'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                            skill.enabled ? 'left-5' : 'left-0.5'
                          )}
                        />
                      </span>
                    </label>
                  </div>

                  <p className="text-sm text-text-secondary mt-3 line-clamp-2">{skill.description || '（无描述）'}</p>

                  {skill.triggers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {skill.triggers.slice(0, 8).map((trigger) => (
                        <span key={trigger} className="px-2 py-0.5 rounded-md text-[11px] bg-primary/10 text-primary">
                          {trigger}
                        </span>
                      ))}
                    </div>
                  )}

                  {skill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skill.tags.slice(0, 8).map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-md text-[11px] bg-background text-text-tertiary">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {skill.warnings.length > 0 && (
                    <div className="mt-3 space-y-0.5">
                      {skill.warnings.map((warning) => (
                        <p key={warning} className="text-xs text-status-warning flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/60">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : skill.slug)}
                      className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      工具契约（{skill.tools.length}）
                    </button>
                    <button
                      onClick={() => confirmUninstall(skill)}
                      disabled={!isAdmin || uninstallSkill.isPending}
                      title={isAdmin ? '卸载技能（删除目录）' : '仅管理员可卸载'}
                      className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-status-failed transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      卸载
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {skill.tools.length === 0 ? (
                        <p className="text-xs text-text-tertiary">该技能未声明工具（仅作为提示词上下文）</p>
                      ) : (
                        skill.tools.map((tool) => (
                          <div key={tool.name} className="rounded-lg bg-background border border-border/60 p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-text-primary">{tool.name}</span>
                              <span className={clsx('px-1.5 py-0.5 rounded text-[10px]', kindStyles[tool.kind] || kindStyles.builtin)}>
                                {tool.kind}
                              </span>
                              {tool.write && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-500">写操作</span>
                              )}
                              {tool.requiresAdmin && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-500">需管理员</span>
                              )}
                            </div>
                            {tool.description && <p className="text-xs text-text-secondary mt-1">{tool.description}</p>}
                            {tool.endpoint && (
                              <p className="text-[11px] font-mono text-text-tertiary mt-1">
                                {tool.httpMethod || 'POST'} {tool.endpoint}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 意图匹配置信 */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-violet-500" />
          意图匹配测试
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          输入用户原话，查看技能注册表会为 Agent 装载哪些技能（触发词 +5 / 标签 +2 / 技能名 +3 / 描述命中 +1）
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            value={matchQuery}
            onChange={(event) => setMatchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && matchQuery.trim()) runMatch.mutate(matchQuery.trim());
            }}
            placeholder="例如：帮我检查一下服务器磁盘使用情况"
            className="flex-1 min-w-[260px] px-3 py-2 rounded-lg text-sm bg-background border border-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60"
          />
          <button
            onClick={() => matchQuery.trim() && runMatch.mutate(matchQuery.trim())}
            disabled={!matchQuery.trim() || runMatch.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-violet-500/15 text-violet-500 font-medium hover:bg-violet-500/25 transition-colors disabled:opacity-50"
          >
            {runMatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            匹配
          </button>
        </div>
        {matchResult && (
          <div className="mt-3 space-y-2">
            {matchResult.length === 0 ? (
              <p className="text-xs text-text-tertiary">未命中任何技能——检查技能的 triggers 是否覆盖该说法</p>
            ) : (
              matchResult.map((match) => (
                <div key={match.slug} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs rounded-lg bg-background border border-border/60 px-3 py-2">
                  <span className="font-medium text-text-primary">{match.name}</span>
                  <span className="font-mono text-text-tertiary">{match.slug}</span>
                  <span className="px-1.5 py-0.5 rounded bg-primary/15 text-primary">score {match.score}</span>
                  <span className="text-text-secondary">{match.reason}</span>
                  <span className="text-text-tertiary font-mono">{match.tools.join(', ') || '无工具'}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 安装弹窗 */}
      {installOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeInstall}>
          <div className="w-full max-w-lg bg-surface rounded-xl border border-border p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                安装技能包
              </h3>
              <button onClick={closeInstall} className="text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-secondary mt-2">
              上传 zip（≤10MB）：根目录含 SKILL.md，或仅含一个顶层技能目录；只允许 .md/.json/.yaml/.yml/.txt/.sh/.py/.js
            </p>
            <div className="mt-4 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => setInstallFile(event.target.files?.[0] || null)}
                className="w-full text-sm text-text-secondary file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-primary/15 file:text-primary file:text-sm file:font-medium hover:file:bg-primary/25"
              />
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(event) => setOverwrite(event.target.checked)}
                  className="rounded border-border"
                />
                覆盖同名技能（overwrite=1）
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeInstall}
                className="px-4 py-2 rounded-lg text-sm bg-background border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => installSkill.mutate()}
                disabled={!installFile || installSkill.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {installSkill.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                安装
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}