import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '../../lib/api';
import { Agent, AIModel } from './shared';

const CATEGORIES = [
  '告警处理', '故障处理', '数据分析', '巡检审计', '服务器管理', '操作执行', '文档报告', '数据库运维', '网络管理',
];

const AVATARS = ['🤖', '🚨', '🩺', '📜', '🔍', '🔧', '📝', '🛡️', '💻', '⌨️', '🌐', '🗄️'];

/**
 * Agent 新建/编辑弹窗（单层结构，无嵌套测试弹窗）。
 * 修复旧版问题：测试结果误读 data.result（接口实际返回 data.output）。
 */
export default function AgentEditModal({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [tagsInput, setTagsInput] = useState(Array.isArray(agent?.tags) ? agent.tags.join(', ') : '');

  const { data: aiModels } = useQuery({
    queryKey: ['ai-models'],
    queryFn: async () => {
      const res = await api.get('/api/ai-models');
      return res.data.data as AIModel[];
    },
  });

  const [formData, setFormData] = useState({
    name: agent?.name || '',
    avatar: agent?.avatar || '🤖',
    role: agent?.role || '',
    system_prompt: agent?.system_prompt || '',
    temperature: agent?.temperature ?? 0.7,
    enabled: agent?.enabled !== 0,
    category: agent?.category || '',
    description: agent?.description || '',
    primary_model_id: agent?.primary_model_id || '',
    fallback_model_id: agent?.fallback_model_id || '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (data: typeof formData & { tags?: string[] }) => {
      if (agent) {
        await api.put(`/api/agents/${agent.id}`, data);
      } else {
        await api.post('/api/agents', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      onClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || '保存失败');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.primary_model_id) {
      setError('请选择主模型（Agent 执行使用的 LLM）');
      return;
    }
    setError(null);
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    mutation.mutate({ ...formData, tags });
  };

  const inputCls =
    'w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all';
  const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-700/50 shadow-2xl scrollbar-thin">
        <div className="p-6 border-b border-slate-700/30 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <h2 className="text-xl font-bold text-white">{agent ? '编辑 Agent' : '新建 Agent'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Agent 名称 *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>角色描述 *</label>
              <input type="text" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className={inputCls} required placeholder="例如：告警分析与处理专家" />
            </div>
          </div>

          <div>
            <label className={labelCls}>头像</label>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar: a })}
                  className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border transition-all ${
                    formData.avatar === a
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/60'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>分类</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={inputCls}>
                <option value="">选择分类…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-slate-800">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>标签（逗号分隔）</label>
              <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputCls} placeholder="例如: 运维, 自动化" />
            </div>
          </div>

          <div>
            <label className={labelCls}>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className={`${inputCls} h-16 resize-none`}
              placeholder="简短描述这个 Agent 的作用"
            />
          </div>

          <div>
            <label className={labelCls}>系统提示词 *</label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className={`${inputCls} h-44 resize-y font-mono`}
              required
              placeholder="定义 Agent 的职责、输出格式与安全约束…"
            />
            <p className="text-xs text-slate-500 mt-1">
              提示：服务器/巡检/数据库类 Agent 由平台真实执行采集，提示词应要求「基于采集数据分析」。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
              <label className={labelCls}>主模型 *</label>
              <select value={formData.primary_model_id} onChange={(e) => setFormData({ ...formData, primary_model_id: e.target.value })} className={inputCls}>
                <option value="">选择主模型…</option>
                {(aiModels || []).filter((m) => m.enabled === 1).map((model) => (
                  <option key={model.id} value={model.id} className="bg-slate-800">
                    {model.name}（{model.provider_type}/{model.model_id}）
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Agent 执行时优先使用的 LLM</p>
            </div>
            <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/30">
              <label className={labelCls}>备选模型（可选）</label>
              <select value={formData.fallback_model_id} onChange={(e) => setFormData({ ...formData, fallback_model_id: e.target.value })} className={inputCls}>
                <option value="">不使用备选模型</option>
                {(aiModels || []).filter((m) => m.enabled === 1).map((model) => (
                  <option key={model.id} value={model.id} className="bg-slate-800">{model.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">主模型失败时自动切换</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>温度参数（0-2）</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 0 })}
                className={inputCls}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
                />
                <span className="text-sm text-slate-300">启用此 Agent</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-700/50 text-slate-300 rounded-xl hover:bg-slate-700/70 transition-all font-semibold border border-slate-600/30">
              取消
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 transition-all duration-300 font-semibold"
            >
              {mutation.isPending ? '保存中…' : agent ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
