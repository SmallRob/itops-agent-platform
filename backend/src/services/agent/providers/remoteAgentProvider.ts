/**
 * 远端 Agent Provider：包装独立的 Python Agent 服务（itops-agent-service）
 * 通过 AgentServiceClient 调用其 /api/chat，保持与内建 Provider 完全一致的契约。
 */
import { getAgentServiceClient } from '../agentServiceClient';
import type { AgentChatRequest, AgentChatResponse, AgentProvider } from '../contracts';

export class RemoteAgentProvider implements AgentProvider {
  readonly id = 'agent-service';
  readonly name = '外部 Agent 服务';
  readonly kind = 'remote' as const;

  capabilities(): string[] {
    return ['chat', 'stream', 'tools', 'knowledge'];
  }

  async health(): Promise<{ ok: boolean; message?: string }> {
    try {
      const agents = await getAgentServiceClient().listRegisteredAgents();
      return { ok: true, message: `已注册 Agent 类型 ${agents.agents.length} 个` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '外部 Agent 服务不可达' };
    }
  }

  async chat(request: AgentChatRequest): Promise<AgentChatResponse> {
    const startedAt = Date.now();
    const agentType = request.agentId && /^[a-zA-Z0-9_-]+$/.test(request.agentId) ? request.agentId : 'default';

    const response = await getAgentServiceClient().chat({
      message: request.message,
      agent_type: agentType,
      context: request.metadata,
      stream: false,
    });

    return {
      success: true,
      reply: response.content || '',
      sessionKey: request.sessionKey,
      provider: this.id,
      toolCalls: (response.tools_used || []).map((name) => ({ name })),
      durationMs: Date.now() - startedAt,
    };
  }
}

export const remoteAgentProvider = new RemoteAgentProvider();