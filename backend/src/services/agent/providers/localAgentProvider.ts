/**
 * 本地 Agent Provider：直接使用平台内建 LLM 能力（不经外部 agent-service）
 */
import { executeAgentWithLLM, generateCompletion } from '@services/ai';
import { skillRegistry } from '../../skills/skillRegistry';
import type { AgentChatRequest, AgentChatResponse, AgentProvider } from '../contracts';

export class LocalAgentProvider implements AgentProvider {
  readonly id = 'local';
  readonly name = '平台内建 LLM';
  readonly kind = 'local' as const;

  capabilities(): string[] {
    return ['chat', 'skills', 'tools'];
  }

  async health(): Promise<{ ok: boolean; message?: string }> {
    const tools = skillRegistry.listTools();
    return { ok: true, message: `可用技能工具 ${tools.length} 个` };
  }

  tools() {
    return skillRegistry.listTools();
  }

  async chat(request: AgentChatRequest): Promise<AgentChatResponse> {
    const startedAt = Date.now();

    const reply = request.agentId
      ? await executeAgentWithLLM(request.agentId, request.message)
      : await generateCompletion(request.message);

    return {
      success: true,
      reply: reply || '',
      sessionKey: request.sessionKey,
      provider: this.id,
      durationMs: Date.now() - startedAt,
    };
  }
}

export const localAgentProvider = new LocalAgentProvider();