/**
 * Agent Provider 引导：注册内置 Provider（本地直连 / 外部 agent-service）
 * 第三方 Provider 可在运行时通过 agentRegistry.register() 动态插入。
 */
import { logger } from '@utils/logger';
import { agentRegistry } from './agentRegistry';
import { localAgentProvider } from './providers/localAgentProvider';
import { remoteAgentProvider } from './providers/remoteAgentProvider';
import { skillRegistry } from '../skills/skillRegistry';

let bootstrapped = false;

export function bootstrapAgentProviders(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  agentRegistry.register(localAgentProvider, { default: true });
  agentRegistry.register(remoteAgentProvider);

  try {
    skillRegistry.reload();
    skillRegistry.watchSkillsDir(() => {
      try {
        skillRegistry.reload();
      } catch (error) {
        logger.warn(`[skills] 自动重载失败：${error instanceof Error ? error.message : error}`);
      }
    });
  } catch (error) {
    logger.warn(`[skills] 初始化装载失败：${error instanceof Error ? error.message : error}`);
  }

  logger.info(`[agents] Agent Provider 引导完成，共 ${agentRegistry.list().length} 个`);
}

export { agentRegistry } from './agentRegistry';
export type { AgentProvider, AgentChatRequest, AgentChatResponse, AgentProviderInfo } from './contracts';