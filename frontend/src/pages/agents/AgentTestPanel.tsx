import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Server, Database, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../../lib/api';
import MarkdownOutput from '../../components/MarkdownOutput';
import {
  Agent,
  ServerInfo,
  DbConnection,
  isDatabaseAgent,
  needsTargetSelection,
  fetchTestInput,
} from './shared';

interface TestResult {
  output: string;
  durationMs: number;
  status: 'success' | 'error';
}

/**
 * Agent 测试面板（详情页内嵌，替代旧版 modal-in-modal）：
 * 目标选择（服务器/数据库） + 输入 + 真实执行 + 结果渲染
 */
export default function AgentTestPanel({ agent }: { agent: Agent }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [databaseId, setDatabaseId] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);

  const isDbAgent = isDatabaseAgent(agent.name);
  const withTarget = needsTargetSelection(agent.name);

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
      return res.data.data as ServerInfo[];
    },
    enabled: !isDbAgent,
  });

  const { data: dbConnections } = useQuery({
    queryKey: ['db-connections'],
    queryFn: async () => {
      const res = await api.get('/api/db-connections');
      return res.data.data as DbConnection[];
    },
    enabled: isDbAgent,
  });

  // 切换 Agent 时填充推荐测试输入并清空结果
  useEffect(() => {
    let cancelled = false;
    fetchTestInput(agent).then((v) => {
      if (!cancelled) setInput(v);
    });
    setResult(null);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  // 目标数据加载完成后预选：数据库默认选第一个可用连接；服务器不预选（显式选择，
  // 避免误对未预期的服务器执行操作）
  useEffect(() => {
    if (isDbAgent) {
      const first = dbConnections?.find((d) => d.enabled);
      setDatabaseId(first?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, servers, dbConnections]);

  const runMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { input };
      if (isDbAgent) {
        if (databaseId) payload.databaseId = databaseId;
      } else if (serverIds.length > 0) {
        payload.serverIds = serverIds;
      }
      const res = await api.post(`/api/agents/${agent.id}/test`, payload);
      return res.data.data as { output: string; status: string; executionTime: number; errorMessage?: string | null };
    },
    onSuccess: (data) => {
      setResult({
        output: data.output || '',
        durationMs: data.executionTime || 0,
        status: data.status === 'success' ? 'success' : 'error',
      });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent-executions', agent.id] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      setResult({
        output: `调用失败: ${err.response?.data?.error || err.message || '未知错误'}`,
        durationMs: 0,
        status: 'error',
      });
    },
  });

  const canRun =
    input.trim().length > 0 &&
    !runMutation.isPending &&
    (isDbAgent
      ? !!databaseId || !(dbConnections || []).some((d) => d.enabled)
      : !withTarget || serverIds.length > 0);

  return (
    <div className="space-y-4">
      {/* 目标选择 */}
      {withTarget && (
        <div>
          <div className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-1.5">
            {isDbAgent ? <Database className="w-4 h-4" /> : <Server className="w-4 h-4" />}
            {isDbAgent ? '选择数据库' : '选择目标服务器（多选）'}
          </div>

          {isDbAgent ? (
            <div className="flex flex-wrap gap-2">
              {(dbConnections || []).filter((d) => d.enabled).map((conn) => (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => setDatabaseId(conn.id)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs border transition-all',
                    databaseId === conn.id
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                      : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                  )}
                >
                  {conn.name}
                  <span className="ml-1.5 text-slate-500">{conn.db_type}</span>
                </button>
              ))}
              {(dbConnections || []).length === 0 && (
                <p className="text-xs text-amber-400/80">暂无数据库连接。请先在「数据库连接」中添加，本 Agent 需真实数据库连接才能完整执行。</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(servers || []).filter((s) => s.enabled).map((server) => {
                  const checked = serverIds.includes(server.id);
                  return (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() =>
                        setServerIds((prev) =>
                          checked ? prev.filter((id) => id !== server.id) : [...prev, server.id]
                        )
                      }
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs border transition-all flex items-center gap-1.5',
                        checked
                          ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                          : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                      )}
                    >
                      <Server className="w-3.5 h-3.5" />
                      {server.name}
                      <span className="text-slate-500">{server.hostname}</span>
                    </button>
                  );
                })}
                {(servers || []).length === 0 && (
                  <p className="text-xs text-amber-400/80">暂无可用服务器。请先在「服务器管理」中添加。</p>
                )}
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                该类 Agent 将对所选服务器真实执行检查（SSH）。默认不选择服务器——请显式勾选目标（只读命令为主，变更类操作请先评审）。
              </p>
            </>
          )}
        </div>
      )}

      {/* 输入 */}
      <div>
        <div className="text-sm font-medium text-slate-300 mb-2">测试输入</div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入要发送给 Agent 的内容…"
          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-28 resize-none scrollbar-thin"
        />
      </div>

      {/* 执行 */}
      <button
        type="button"
        onClick={() => runMutation.mutate()}
        disabled={!canRun}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 font-semibold"
      >
        {runMutation.isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            执行中…
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            运行测试
          </>
        )}
      </button>

      {/* 结果 */}
      {result && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className={clsx(
                'px-2.5 py-1 rounded-full text-xs font-semibold border',
                result.status === 'success'
                  ? 'bg-green-500/15 text-green-400 border-green-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              )}
            >
              {result.status === 'success' ? '执行成功' : '执行失败'}
            </span>
            <span className="text-xs text-slate-500">耗时 {result.durationMs}ms</span>
          </div>
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 max-h-96 overflow-y-auto scrollbar-thin">
            <MarkdownOutput content={result.output} />
          </div>
        </div>
      )}
    </div>
  );
}
