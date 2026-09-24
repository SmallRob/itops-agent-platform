import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import clsx from 'clsx';
import api from '../../lib/api';
import { formatTime } from '../../lib/date';
import { AgentExecution } from './shared';

/** Agent 执行历史（来自 /api/agents/:id/executions） */
export default function AgentExecutions({ agentId }: { agentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-executions', agentId],
    queryFn: async () => {
      const res = await api.get(`/api/agents/${agentId}/executions`, { params: { limit: 30 } });
      return res.data.data as { executions: AgentExecution[]; pagination: { total: number; page: number; limit: number } };
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const executions = data?.executions || [];
  if (executions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">暂无执行记录，切到「测试」页签运行一次即可生成。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {executions.map((exec) => (
        <div key={exec.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  'px-2.5 py-1 rounded-full text-xs font-semibold border',
                  exec.status === 'success'
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                )}
              >
                {exec.status === 'success' ? '成功' : '失败'}
              </span>
              <span className="text-sm text-slate-400">{formatTime(exec.created_at)}</span>
              <span className="text-xs text-slate-500">
                {(() => {
                  const meta = exec.metadata as { serverIds?: string[] } | null | undefined;
                  return meta?.serverIds?.length ? `目标服务器 ${meta.serverIds.length} 台` : '';
                })()}
              </span>
            </div>
            <span className="text-xs text-slate-500">{exec.execution_time_ms}ms</span>
          </div>
          <div className="mb-2">
            <span className="text-xs text-slate-500 block mb-1">输入</span>
            <p className="text-sm text-slate-300 line-clamp-2">{exec.input_text}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500 block mb-1">输出</span>
            <pre className="text-sm text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto scrollbar-thin">
              {exec.output_text}
            </pre>
          </div>
          {exec.error_message && (
            <div className="mt-2">
              <span className="text-xs text-amber-400 block mb-1">错误</span>
              <p className="text-sm text-red-400">{exec.error_message}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
