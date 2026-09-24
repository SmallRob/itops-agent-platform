import { formatTime, formatDate } from '../lib/date';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit, Trash2, Play, Search, BookOpen, Loader2,
  ShieldCheck, AlertTriangle, CircleDot, X, ListChecks
} from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import AgentEditModal from './agents/AgentEditModal';
import AgentTestPanel from './agents/AgentTestPanel';
import AgentExecutions from './agents/AgentExecutions';
import { Agent, fetchTestInput } from './agents/shared';

type DetailTab = 'overview' | 'test' | 'executions';

interface BatchItem {
  agentId: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  durationMs?: number;
  output?: string;
  error?: string;
}

export default function Agents() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents', selectedCategory, searchQuery],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;
      const res = await api.get('/api/agents', { params });
      return res.data.data as Agent[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      setSelectedId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await api.put(`/api/agents/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const categories = useMemo(
    () => Array.from(new Set((agents || []).map((a) => a.category).filter(Boolean) as string[])),
    [agents]
  );

  const filteredAgents = agents || [];
  const selectedAgent = filteredAgents.find((a) => a.id === selectedId) || null;
  const onlineCount = filteredAgents.filter((a) => a.enabled).length;

  const handleNew = () => {
    setEditingAgent(null);
    setShowModal(true);
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowModal(true);
  };

  const handleDelete = (agent: Agent) => {
    if (window.confirm(`确定要删除 Agent "${agent.name}" 吗？`)) {
      deleteMutation.mutate(agent.id);
    }
  };

  const openDetail = (agent: Agent, tab: DetailTab) => {
    setSelectedId(agent.id);
    setDetailTab(tab);
  };

  /** 批量验证：对所有启用的 Agent 按推荐输入逐个真实调用 */
  const runBatchVerify = async () => {
    const targets = (agents || []).filter((a) => a.enabled);
    if (targets.length === 0) return;
    const items: BatchItem[] = targets.map((a) => ({
      agentId: a.id,
      name: a.name,
      status: 'pending',
    }));
    setBatchItems(items);

    for (let i = 0; i < targets.length; i++) {
      const agent = targets[i];
      setBatchItems((prev) =>
        prev ? prev.map((it, idx) => (idx === i ? { ...it, status: 'running' } : it)) : prev
      );
      const started = Date.now();
      try {
        const input = await fetchTestInput(agent);
        // 数据库类 Agent 不预选目标：无真实连接时应返回结构化兜底提示（也是契约的一部分）
        const payload: Record<string, unknown> = { input };
        const res = await api.post(`/api/agents/${agent.id}/test`, payload);
        const data = res.data?.data;
        const ok = data?.status === 'success' && (data?.output || '').trim().length > 0;
        setBatchItems((prev) =>
          prev
            ? prev.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: ok ? 'success' : 'error',
                      durationMs: Date.now() - started,
                      output: (data?.output || '').slice(0, 400),
                      error: ok ? undefined : '输出为空或执行失败',
                    }
                  : it
              )
            : prev
        );
      } catch (error: unknown) {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        setBatchItems((prev) =>
          prev
            ? prev.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: 'error',
                      durationMs: Date.now() - started,
                      error: err.response?.data?.error || err.message || '调用失败',
                    }
                  : it
              )
            : prev
        );
      }
    }
    queryClient.invalidateQueries({ queryKey: ['agents'] });
  };

  const batchDone = (batchItems || []).every((it) => it.status !== 'running' && it.status !== 'pending');
  const batchSummary = (batchItems || []).reduce(
    (acc, it) => {
      if (it.status === 'success') acc.ok++;
      else if (it.status === 'error') acc.fail++;
      return acc;
    },
    { ok: 0, fail: 0 }
  );

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Agent 管理</h1>
          <p className="text-slate-400 mt-1 text-sm">
            共 {filteredAgents.length} 个 Agent · {onlineCount} 个在线 · 主从布局，点击 Agent 查看详情、测试与执行历史
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={runBatchVerify}
            disabled={!!batchItems && !batchDone}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600/80 to-teal-700/80 text-white rounded-xl hover:from-emerald-500 hover:to-teal-600 disabled:opacity-50 transition-all duration-300 font-semibold"
          >
            <ListChecks className="w-5 h-5" />
            {batchItems && !batchDone ? '验证中…' : '批量验证'}
          </button>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 font-semibold"
          >
            <Plus className="w-5 h-5" />
            新建 Agent
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-5 px-6 pb-6">
        {/* 左侧：列表栏 */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl border border-slate-700/50 px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 Agent…"
              className="bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none flex-1 min-w-0"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory(null)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                !selectedCategory
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800/80 border border-slate-700/50 text-slate-400 hover:text-slate-200'
              )}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-400 hover:text-slate-200'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 scrollbar-thin pr-1">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700/50" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-28 bg-slate-700/50 rounded" />
                      <div className="h-3 w-20 bg-slate-700/50 rounded" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">没有匹配的 Agent</div>
            ) : (
              filteredAgents.map((agent) => {
                const active = agent.id === selectedId;
                const batchItem = batchItems?.find((it) => it.agentId === agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => openDetail(agent, 'overview')}
                    className={clsx(
                      'w-full text-left rounded-xl border p-3 transition-all group',
                      active
                        ? 'bg-blue-500/15 border-blue-500/50'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/70'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-xl">
                          {agent.avatar}
                        </div>
                        <span
                          className={clsx(
                            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900',
                            agent.enabled ? 'bg-green-400' : 'bg-slate-500'
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white text-sm truncate">{agent.name}</span>
                          {agent.is_preset === 1 && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 flex-shrink-0">预设</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">{agent.role}</div>
                      </div>
                      {/* 批量验证状态徽标 */}
                      {batchItem && (
                        <span className="flex-shrink-0">
                          {batchItem.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                          {batchItem.status === 'pending' && <CircleDot className="w-4 h-4 text-slate-500" />}
                          {batchItem.status === 'success' && <ShieldCheck className="w-4 h-4 text-green-400" />}
                          {batchItem.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="truncate">{agent.primary_model_name || agent.model || '未绑定模型'}</span>
                      <span>·</span>
                      <span>{agent.usage_count || 0} 次调用</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧：详情面板 */}
        <div className="flex-1 min-w-0 bg-slate-800/40 rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden">
          {!selectedAgent ? (
            batchItems ? (
              <BatchVerifyPanel items={batchItems} summary={batchSummary} done={batchDone} onClose={() => setBatchItems(null)} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
                <BookOpen className="w-14 h-14 opacity-40" />
                <p>从左侧选择一个 Agent 查看详情与测试</p>
              </div>
            )
          ) : (
            <>
              {/* 详情头 */}
              <div className="p-5 border-b border-slate-700/40 flex items-start justify-between flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-3xl">
                    {selectedAgent.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                          selectedAgent.enabled
                            ? 'bg-green-500/15 text-green-400 border-green-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        )}
                      >
                        {selectedAgent.enabled ? '在线' : '离线'}
                      </span>
                      {selectedAgent.category && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-700/50 text-slate-300 border border-slate-600/50">
                          {selectedAgent.category}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 mt-0.5">{selectedAgent.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { openDetail(selectedAgent, 'test'); }}
                    className="p-2.5 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all"
                    title="测试"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(selectedAgent)}
                    className="p-2.5 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {selectedAgent.is_preset !== 1 && (
                    <button
                      onClick={() => handleDelete(selectedAgent)}
                      className="p-2.5 hover:bg-red-500/20 text-red-400 rounded-xl transition-all"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 统计条 */}
              <div className="px-5 py-3 border-b border-slate-700/40 grid grid-cols-4 gap-3 flex-shrink-0 text-sm">
                <Stat label="主模型" value={selectedAgent.primary_model_name || selectedAgent.model || '未绑定'} warn={!selectedAgent.primary_model_id && !selectedAgent.model} />
                <Stat label="备选模型" value={selectedAgent.fallback_model_name || '-'} />
                <Stat label="温度" value={String(selectedAgent.temperature ?? '-')} />
                <Stat
                  label="调用次数 / 最近"
                  value={`${selectedAgent.usage_count || 0} · ${selectedAgent.last_used_at ? formatDate(selectedAgent.last_used_at) : '从未'}`}
                />
              </div>

              {/* 页签 */}
              <div className="px-5 pt-3 flex gap-1 border-b border-slate-700/40 flex-shrink-0">
                {([
                  ['overview', '概览'],
                  ['test', '测试'],
                  ['executions', '执行历史'],
                ] as Array<[DetailTab, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDetailTab(key)}
                    className={clsx(
                      'px-4 py-2 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px',
                      detailTab === key
                        ? 'text-blue-300 border-blue-500 bg-blue-500/5'
                        : 'text-slate-400 border-transparent hover:text-slate-200'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 内容 */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 scrollbar-thin">
                {detailTab === 'overview' && (
                  <AgentOverview agent={selectedAgent} />
                )}
                {detailTab === 'test' && <AgentTestPanel agent={selectedAgent} />}
                {detailTab === 'executions' && <AgentExecutions agentId={selectedAgent.id} />}
              </div>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <AgentEditModal agent={editingAgent} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="bg-slate-900/40 rounded-xl px-3 py-2 border border-slate-700/40 min-w-0">
      <div className="text-[11px] text-slate-500 mb-0.5">{label}</div>
      <div className={clsx('text-sm font-medium truncate', warn ? 'text-amber-400' : 'text-slate-200')}>{value}</div>
    </div>
  );
}

function AgentOverview({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-5">
      {agent.description && (
        <div>
          <div className="text-sm font-medium text-slate-300 mb-1.5">描述</div>
          <p className="text-sm text-slate-400 leading-relaxed">{agent.description}</p>
        </div>
      )}

      {agent.tags && agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 bg-slate-700/40 border border-slate-600/50 text-xs text-slate-300 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-slate-300 mb-1.5">系统提示词</div>
        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{agent.system_prompt}</pre>
        </div>
      </div>

      <div className="text-xs text-slate-500 flex items-center gap-3">
        <span>最后使用：{agent.last_used_at ? formatTime(agent.last_used_at) : '从未'}</span>
        <span>·</span>
        <span>创建于：{formatDate(agent.created_at || '')}</span>
      </div>
    </div>
  );
}

/** 批量验证结果面板（未选中 Agent 时展示于详情区） */
function BatchVerifyPanel({
  items,
  summary,
  done,
  onClose,
}: {
  items: BatchItem[];
  summary: { ok: number; fail: number };
  done: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-thin">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">批量验证</h2>
          {done ? (
            <span className={clsx(
              'px-3 py-1 rounded-full text-xs font-semibold border',
              summary.fail === 0
                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            )}>
              {summary.ok} 通过 / {summary.fail} 未通过
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-blue-500/15 text-blue-300 border-blue-500/30">
              执行中（{items.filter((i) => i.status === 'success' || i.status === 'error').length}/{items.length}）
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all">
          <X className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        逐个以推荐测试输入真实调用每个启用的 Agent（与「测试」页签同链路）。验证结论同时取决于 LLM 与真实执行器（服务器/数据库）可用性。
      </p>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.agentId} className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === it.agentId ? null : it.agentId)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-all"
            >
              <div className="flex items-center gap-3">
                {it.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                {it.status === 'pending' && <CircleDot className="w-4 h-4 text-slate-500" />}
                {it.status === 'success' && <ShieldCheck className="w-4 h-4 text-green-400" />}
                {it.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                <span className="text-sm text-slate-200">{it.name}</span>
              </div>
              <span className="text-xs text-slate-500">
                {it.status === 'pending' && '等待'}
                {it.status === 'running' && '执行中…'}
                {it.status === 'success' && `${it.durationMs}ms`}
                {it.status === 'error' && (it.error || '失败')}
              </span>
            </button>
            {expanded === it.agentId && it.output && (
              <div className="px-4 pb-3">
                <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-950/50 rounded-lg p-3 max-h-56 overflow-y-auto scrollbar-thin">
                  {it.output}…
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
