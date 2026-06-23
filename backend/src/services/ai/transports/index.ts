/**
 * ITOps Agent Platform - Transport 层索引
 * 导出所有 Transport 相关类型和实现
 */

export type {
  ChatMessage,
  TokenUsage,
  ToolDefinition,
  ToolCall,
  ModelConfig,
  TransportGenerateParams,
  TransportResponse,
  TransportStreamParams,
  TransportStreamChunk,
  TransportToolParams,
  TransportToolResponse,
  Transport,
} from './types';

export { OpenAICompatTransport } from './OpenAICompatTransport';

import type { Transport, ModelConfig } from './types';
import { OpenAICompatTransport } from './OpenAICompatTransport';

/**
 * Transport 管理器
 * 负责管理和选择合适的 Transport
 */
export class TransportManager {
  private transports: Transport[] = [];

  constructor() {
    // 默认注册 OpenAI 兼容传输层
    this.transports.push(new OpenAICompatTransport());
  }

  /**
   * 注册新的 Transport
   */
  register(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * 获取能处理该模型的 Transport
   */
  getTransport(model: ModelConfig): Transport {
    for (const transport of this.transports) {
      if (transport.canHandle(model)) {
        return transport;
      }
    }
    throw new Error(`No transport found for model: ${model.name} (${model.provider})`);
  }

  /**
   * 获取所有已注册的 Transport
   */
  getTransports(): Transport[] {
    return [...this.transports];
  }
}

/**
 * 创建默认的 Transport 管理器
 */
export function createTransportManager(): TransportManager {
  return new TransportManager();
}
