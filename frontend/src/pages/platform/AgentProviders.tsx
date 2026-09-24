import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Network, RefreshCw, Loader2, ArrowUp, ArrowDown, Save, RotateCcw, Star, Play,
  Activity, ShieldCheck, AlertTriangle, XCircle, Cpu, Cloud,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  threshold: number;
  openedAt?: string;
  retryAt?: string;
}

interface AgentProviderInfo {
  id: string;
  name: string;
  kind: 'local' | 'remote';
  capabilities: string[];
  healthy: boolean;
  message?: string;
  circuit: CircuitState;
}

interface ProvidersPayload {
  defaultProvider: string | null;
  fallbackChain: string[];
  providers: AgentProviderInfo[];
}

interface AgentAttempt {
  provider: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
  durationMs: number;
}

interface ChatResult {
  success: boolean;
  reply: string;
  provider: string;
  degraded?: boolean;
  attempts?: AgentAttempt[];
  skills?: Array<{ slug: string; name: string; score: number; reason: string }>;
  durationMs: number;
  error?: string;
}

const circuitStyles: Record<CircuitState['state'], { label: string; className: string; icon: typeof ShieldCheck }> = {
  closed: { label: '正常', className: 'bg-emerald-500/15 text-emerald-500', icon: ShieldCheck },
  'half-open': { label: '半开（探测中）', className: 'bg-amber-500/15 text-amber-500', icon: AlertTriangle },
  open: { label: '已熔断', className: 'bg-rose-500/15 text-rose-500', icon: XCircle },
};

export default function AgentProviders() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [chain, setChain] = useState<string[]>([]);
  const [message, setMessage] = useState('检查服务器磁盘使用情况');
  const [result, setResult] = useState<ChatResult | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery<ProvidersPayload>({
    queryKey: ['agent-providers'],
    queryFn: () => api.get('/api/agents/providers').then((r) => r.data.data),
    refetchInterval: 30000,
    retry: 1,
  });

  // 服务端降级链同步到本地编辑态（未编辑时保持一致）
  useEffect(() => {
    if (data?.fallbackChain) setChain(data.fallbackChain);
  }, [data?.fallbackChain]);

  const providers = data?.providers ?? [];
  const chainDirty = useMemo(
    () => JSON.stringify(chain) !== JSON.stringify(data?.fallbackChain ?? []),
    [chain, data?.fallbackChain]
  );

  const saveChain = useMutation({
    mutationFn: (next: string[]) => api.post('/api/agents/providers/chain', { chain: next }),
    onSuccess: (res) => {
      toast.success(`降级链已更新：${(res.data?.data?.fallbackChain || []).join(' → ') || '默认顺序'}`);
      queryClient.invalidateQueries({ queryKey: ['agent-providers'] });
    },
    onError: (error: any) => toast.error(`保存失败：${error.response?.data?.error || error.message}`),
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.post('/api/agents/providers/default', { id }),
    onSuccess: () => {
      toast.success('默认 Provider 已更新');
      queryClient.invalidateQueries({ queryKey: ['agent-providers'] });
    },
    onError: (error: any) => toast.error(`设置失败：${error.response?.data?.error || error.message}`),
  });

  const runChat = useMutation({
    mutationFn: () => api.post('/api/agents/providers/chat', { message, sessionKey: 'ui-provider-check' }),
    onSuccess: (res) => setResult(res.data?.data),
    onError: (error: any) => toast.error(`执行失败：${error.response?.data?.error || error.message}`),
  });

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= chain.length) return;
    const next = [...chain];
    [next[index], next[target]] = [next[target], next[index]];
    setChain(next);
  };

  // 未在链中的 Provider 追加到末尾，保证编辑器能看到全部候选
  const chainItems = useMemo(() => {
    const rest = providers.map((p) => p.id).filter((id) => !chain.includes(id));
    return [...chain, ...rest];
  }, [chain, providers]);

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Agent Provider 治理
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            契约化 Agent 执行入口：按降级链依次尝试，连续失败达到阈值自动熔断，冷却后放行探测请求
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

      {/* Provider 卡片 */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-secondary text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载中...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {providers.map((provider) => {
            const circuit = circuitStyles[provider.circuit.state];
            const CircuitIcon = circuit.icon;
            const isDefault = data?.defaultProvider === provider.id;
            return (
              <div key={provider.id} className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx('p-2.5 rounded-lg', provider.kind === 'local' ? 'bg-primary/15' : 'bg-violet-500/15')}>
                      {provider.kind === 'local' ? (
                        <Cpu className="w-5 h-5 text-primary" />
                      ) : (
                        <Cloud className="w-5 h-5 text-violet-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary truncate">{provider.name}</h3>
                        {isDefault && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-primary/15 text-primary flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            默认
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary font-mono mt-0.5">
                        {provider.id} · {provider.kind}
                      </p>
                    </div>
                  </div>
                  <span className={clsx('flex items-center gap-1 px-2 py-1 rounded-md text-[11px] flex-shrink-0', circuit.className)}>
                    <CircuitIcon className="w-3.5 h-3.5" />
                    {circuit.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-md text-[11px]',
                      provider.healthy ? 'bg-emerald-500/15 text-emerald-500' : 'bg-status-failed/15 text-status-failed'
                    )}
                  >
                    {provider.healthy ? '健康' : '不可用'}
                  </span>
                  {provider.capabilities.map((capability) => (
                    <span key={capability} className="px-2 py-0.5 rounded-md text-[11px] bg-background text-text-tertiary font-mono">
                      {capability}
                    </span>
                  ))}
                </div>

                {provider.message && <p className="text-xs text-text-tertiary mt-2">{provider.message}</p>}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary mt-3">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    连续失败 {provider.circuit.failures}/{provider.circuit.threshold}
                  </span>
                  {provider.circuit.state !== 'closed' && provider.circuit.retryAt && (
                    <span>恢复探测：{new Date(provider.circuit.retryAt).toLocaleTimeString()}</span>
                  )}
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t border-border/60">
                  <button
                    onClick={() => setDefault.mutate(provider.id)}
                    disabled={!isAdmin || isDefault || setDefault.isPending}
                    title={isAdmin ? '设为默认 Provider' : '仅管理员可设置'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/15 text-primary font-medium hover:bg-primary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Star className="w-3.5 h-3.5" />
                    {isDefault ? '当前默认' : '设为默认'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 降级链编辑 */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-text-primary">降级链</h3>
            <p className="text-xs text-text-secondary mt-1">
              顺序即优先级；上方的 Provider 失败或熔断时依次尝试下一个（全部熔断时兜底仍尝试链首）
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveChain.mutate([])}
              disabled={!isAdmin || saveChain.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-background border border-border text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              恢复默认
            </button>
            <button
              onClick={() => saveChain.mutate(chain)}
              disabled={!isAdmin || !chainDirty || saveChain.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary text-white font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {saveChain.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {chainItems.map((id, index) => {
            const provider = providers.find((item) => item.id === id);
            const inChain = index < chain.length;
            return (
              <div
                key={id}
                className={clsx(
                  'flex items-center gap-3 rounded-lg border px-3 py-2',
                  inChain ? 'bg-background border-border' : 'bg-background/50 border-border/50 opacity-70'
                )}
              >
                <span className="w-6 text-center text-xs font-mono text-text-tertiary">{inChain ? index + 1 : '-'}</span>
                <span className="flex-1 text-sm text-text-primary">
                  {provider?.name || id}
                  <span className="ml-2 font-mono text-xs text-text-tertiary">{id}</span>
                </span>
                {provider && (
                  <span className={clsx('px-2 py-0.5 rounded-md text-[11px]', circuitStyles[provider.circuit.state].className)}>
                    {circuitStyles[provider.circuit.state].label}
                  </span>
                )}
                <button
                  onClick={() => move(index, -1)}
                  disabled={!inChain || index === 0}
                  className="p-1 rounded text-text-tertiary hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={!inChain || index === chain.length - 1}
                  className="p-1 rounded text-text-tertiary hover:text-text-primary disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        {chainDirty && <p className="text-xs text-status-warning mt-2">降级链已修改，点击「保存」后生效</p>}
      </div>

      {/* 试运行 */}
      <div className="bg-surface rounded-xl border border-border p-5">
        <h3 className="font-semibold text-text-primary flex items-center gap-2">
          <Play className="w-4 h-4 text-emerald-500" />
          链路试运行
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          走一次真实调用：查看实际命中的 Provider、是否降级、每一步尝试与耗时（含被熔断跳过的 Provider）
        </p>
        <div className="flex flex-wrap items-start gap-2 mt-3">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            className="flex-1 min-w-[280px] px-3 py-2 rounded-lg text-sm bg-background border border-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 resize-y"
            placeholder="输入要发给 Agent 的内容"
          />
          <button
            onClick={() => runChat.mutate()}
            disabled={!message.trim() || runChat.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-500/15 text-emerald-500 font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            {runChat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            运行
          </button>
        </div>

        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className={clsx('px-2 py-0.5 rounded-md', result.success ? 'bg-emerald-500/15 text-emerald-500' : 'bg-status-failed/15 text-status-failed')}>
                {result.success ? '调用成功' : '调用失败'}
              </span>
              <span className="text-text-secondary">
                实际 Provider：<span className="font-mono text-text-primary">{result.provider}</span>
              </span>
              {result.degraded && <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-500">发生降级</span>}
              <span className="text-text-tertiary">{result.durationMs} ms</span>
              {(result.skills?.length || 0) > 0 && (
                <span className="text-text-tertiary">
                  命中技能：{result.skills?.map((skill) => skill.name).join('、')}
                </span>
              )}
            </div>

            {(result.attempts?.length || 0) > 0 && (
              <div className="rounded-lg bg-background border border-border/60 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-text-tertiary border-b border-border/60">
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 font-medium">结果</th>
                      <th className="px-3 py-2 font-medium">耗时</th>
                      <th className="px-3 py-2 font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.attempts?.map((attempt, index) => (
                      <tr key={`${attempt.provider}-${index}`} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 font-mono text-text-secondary">{attempt.provider}</td>
                        <td className="px-3 py-2">
                          {attempt.skipped ? (
                            <span className="text-amber-500">已跳过</span>
                          ) : attempt.success ? (
                            <span className="text-emerald-500">成功</span>
                          ) : (
                            <span className="text-status-failed">失败</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-tertiary">{attempt.durationMs} ms</td>
                        <td className="px-3 py-2 text-text-tertiary">{attempt.error || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(result.reply || result.error) && (
              <pre className="text-xs whitespace-pre-wrap break-words rounded-lg bg-background border border-border/60 p-3 text-text-secondary max-h-64 overflow-auto">
                {result.reply || result.error}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}