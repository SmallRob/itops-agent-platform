import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Webhook, RefreshCw, Loader2, Copy, Check, Radio, Bot, BellRing, ListChecks, KeyRound, ShieldAlert,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';

interface HookSource {
  source: string;
  label: string;
  autoDetect?: boolean;
}

const endpoints = [
  {
    method: 'GET',
    path: '/api/hooks/sources',
    icon: ListChecks,
    title: '查询可用来源',
    description: '返回当前支持的事件来源与标准化能力，接入前自检用。',
    curl: `curl -s http://<平台地址>/api/hooks/sources \\
  -H "X-Hook-Token: $HOOKS_TOKEN"`,
  },
  {
    method: 'POST',
    path: '/api/hooks/alert/:source',
    icon: BellRing,
    title: '告警入站',
    description: '异构告警标准化后进入平台处置流水线（落库 → 降噪/关联 → 根因 → 修复策略 → 通知）。',
    curl: `curl -s -X POST http://<平台地址>/api/hooks/alert/prometheus \\
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"alerts":[{"labels":{"alertname":"DiskFull","instance":"10.0.0.9:9100","severity":"critical"},
                  "annotations":{"summary":"磁盘使用率 95%"},"status":"firing"}]}'`,
  },
  {
    method: 'POST',
    path: '/api/hooks/agent',
    icon: Bot,
    title: 'Agent 隔离回合',
    description: '让 Agent 执行一次独立回合（可指定 sessionKey / 模型 / Provider），复用技能匹配、降级链与熔断。',
    curl: `curl -s -X POST http://<平台地址>/api/hooks/agent \\
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"message":"分析这条磁盘告警的影响面","sessionKey":"disk-2026-09-24"}'`,
  },
  {
    method: 'POST',
    path: '/api/hooks/wake',
    icon: Radio,
    title: '事件唤醒',
    description: '注入一条事件（落通知 + 审计），可选触发 Agent 摘要；适合发布窗口、值班交接等场景。',
    curl: `curl -s -X POST http://<平台地址>/api/hooks/wake \\
  -H "X-Hook-Token: $HOOKS_TOKEN" -H 'Content-Type: application/json' \\
  -d '{"text":"发布窗口开始","triggerAgent":true}'`,
  },
];

export default function HooksIntegration() {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: sources = [], isLoading, isFetching, isError, error, refetch } = useQuery<HookSource[]>({
    queryKey: ['hook-sources'],
    queryFn: () => api.get('/api/hooks/sources').then((r) => r.data.data || []),
    retry: 1,
  });

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('复制失败，请手动选择文本');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Webhook className="w-6 h-6 text-primary" />
            Hooks 事件接入
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            机器入口：外部监控/自动化系统投递事件，厂商字段差异由声明式映射表收敛，调用方无需关心平台内部结构
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

      {/* 认证说明 */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-primary/30 bg-primary/5">
        <KeyRound className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary space-y-1">
          <p className="font-medium text-text-primary">认证方式（二者其一）</p>
          <p>
            ① 外部系统：请求头 <span className="font-mono text-xs">X-Hook-Token</span> 与服务端环境变量{' '}
            <span className="font-mono text-xs">HOOKS_TOKEN</span> 比对（未配置时回退{' '}
            <span className="font-mono text-xs">WEBHOOK_SECRET</span>）；
            ② 平台前端：携带管理员会话（Bearer Token）即可，本页即走此方式。
          </p>
          <p className="text-xs text-text-tertiary">
            Hooks 端点已豁免 CSRF（机器入口不使用 Cookie 会话）；认证失败会写入审计日志（hook_auth_failed）。
          </p>
        </div>
      </div>

      {/* 来源表 */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">支持的来源</h3>
          <span className="text-xs text-text-tertiary">{sources.length} 个</span>
        </div>
        {isError && (
          <div className="flex items-start gap-3 px-5 py-4 border-b border-status-warning/40 bg-status-warning/10">
            <ShieldAlert className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-text-secondary">
              <p className="font-medium text-text-primary">来源列表加载失败</p>
              <p className="text-xs mt-1">
                {(error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                  (error as Error)?.message ||
                  '请检查后端 /api/hooks/sources 是否可访问'}
                ：管理员会话或 X-Hook-Token 二者其一即可（见上方认证方式）
              </p>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-text-secondary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载中...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary border-b border-border">
                  <th className="px-5 py-3 font-medium">来源标识</th>
                  <th className="px-5 py-3 font-medium">上游系统</th>
                  <th className="px-5 py-3 font-medium">解析方式</th>
                  <th className="px-5 py-3 font-medium">端点</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.source} className="border-b border-border/60 last:border-0 hover:bg-background/60">
                    <td className="px-5 py-3 font-mono text-xs text-text-primary">{source.source}</td>
                    <td className="px-5 py-3 text-text-secondary">{source.label}</td>
                    <td className="px-5 py-3 text-text-secondary">
                      {source.autoDetect ? '自动识别（识别失败走通用结构）' : '专用适配器'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-text-tertiary">
                      POST /api/hooks/alert/{source.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 端点与示例 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {endpoints.map((endpoint) => {
          const Icon = endpoint.icon;
          const key = `${endpoint.method} ${endpoint.path}`;
          return (
            <div key={key} className="bg-surface rounded-xl border border-border p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-primary/15">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-text-primary">{endpoint.title}</h3>
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-mono',
                        endpoint.method === 'GET' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-blue-500/15 text-blue-500'
                      )}
                    >
                      {endpoint.method}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-text-tertiary mt-1">{endpoint.path}</p>
                  <p className="text-sm text-text-secondary mt-2">{endpoint.description}</p>
                </div>
              </div>
              <div className="relative mt-3">
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded-lg bg-background border border-border/60 p-3 pr-10 text-text-secondary font-mono">
                  {endpoint.curl}
                </pre>
                <button
                  onClick={() => copy(key, endpoint.curl)}
                  title="复制示例"
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-surface border border-border text-text-tertiary hover:text-text-primary transition-colors"
                >
                  {copied === key ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 排障 */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface">
        <ShieldAlert className="w-5 h-5 text-status-warning flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary space-y-1">
          <p className="font-medium text-text-primary">常见错误</p>
          <p><span className="font-mono text-xs">401 缺少凭据</span>：未带令牌且服务端未配置 HOOKS_TOKEN / WEBHOOK_SECRET → 配置环境变量后重启后端。</p>
          <p><span className="font-mono text-xs">400 不支持的来源</span>：<span className="font-mono text-xs">:source</span> 不在上表内，先用 GET /api/hooks/sources 确认。</p>
          <p><span className="font-mono text-xs">accepted &gt; 0 但 errors 非空</span>：个别条目字段缺失（如无标题），errors 中会逐条说明，processed 里的记录已成功入库。</p>
        </div>
      </div>
    </div>
  );
}