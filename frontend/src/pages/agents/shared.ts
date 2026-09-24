import api from '../../lib/api';

/** Agent（列表/详情共用） */
export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: number;
  is_preset: number;
  category?: string;
  tags?: string[];
  description?: string;
  usage_count?: number;
  last_used_at?: string;
  created_at?: string;
  primary_model_id?: string;
  fallback_model_id?: string;
  primary_model_name?: string;
  fallback_model_name?: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider_type: string;
  model_id: string;
  enabled: number;
}

export interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  enabled: number;
}

export interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  database: string;
  description?: string;
  enabled: number;
}

export interface AgentExecution {
  id: string;
  agent_id: string;
  agent_name: string;
  input_text: string;
  output_text: string;
  status: string;
  error_message?: string;
  execution_time_ms: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

/** 前端兜底的推荐测试输入（按名称关键字匹配，与后端 agentExecutor 的路由逻辑一致）。
 *  优先调用 GET /api/agents/:id/test-input 获取后端推荐，仅在其无预设时使用。 */
export const KEYWORD_TEST_INPUTS: Array<{ match: string; input: string }> = [
  { match: '告警处理', input: '服务器CPU使用率异常，当前92%，阈值80%，请分析并提供处理建议' },
  { match: '故障诊断', input: '应用服务响应超时，请诊断可能的原因并提供排查步骤' },
  { match: '日志分析', input: '系统日志中出现大量 Connection refused 记录，请分析问题根源' },
  { match: '自动巡检', input: '请对选择的服务器执行批量巡检' },
  { match: '系统巡检', input: '请执行系统健康检查，检查CPU、内存、磁盘、网络状况' },
  { match: '服务器命令执行', input: '请检查服务器磁盘使用情况' },
  { match: '合规检查', input: '请执行安全合规检查，验证系统配置是否符合安全标准' },
  { match: '变更执行', input: '请为「Nginx 服务重启」制定变更执行方案' },
  { match: '文档生成', input: '请根据巡检结果生成一份系统运维报告' },
  { match: '数据库运维', input: '检查数据库健康状态' },
  { match: '命令生成', input: '查看当前系统监听端口列表' },
  { match: '网络巡检', input: '请给出华为交换机标准巡检的检查项与判断标准' },
];

export function keywordTestInput(agentName: string): string {
  return (
    KEYWORD_TEST_INPUTS.find((p) => agentName.includes(p.match))?.input ||
    '请描述您要处理的运维问题'
  );
}

/** 是否为数据库运维类 Agent（测试时选择数据库连接而非服务器） */
export function isDatabaseAgent(agentName: string): boolean {
  return agentName.includes('数据库运维');
}

/** 是否为真实作用于服务器/数据库的 Agent（测试面板据此显示目标选择） */
export function needsTargetSelection(agentName: string): boolean {
  return (
    agentName.includes('服务器') ||
    agentName.includes('巡检') ||
    agentName.includes('数据库运维')
  );
}

/** 获取后端推荐的测试输入；失败时回退到前端关键字匹配 */
export async function fetchTestInput(agent: Agent): Promise<string> {
  try {
    const res = await api.get(`/api/agents/${agent.id}/test-input`);
    const input = res.data?.data?.testInput as string | undefined;
    if (input && input !== '你好，我是' + (agent.role || '运维助手') + '，帮助我处理一个运维相关的问题') {
      return input;
    }
  } catch {
    /* 后端无预设时静默回退 */
  }
  return keywordTestInput(agent.name);
}
