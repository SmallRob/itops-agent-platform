/**
 * ITOps Agent Platform - Transport 层类型定义
 * 借鉴 NiceKit 的 Transport 抽象设计
 */

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Token 使用量 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 工具定义 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** 工具调用 */
export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** 模型配置 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKey: string;
  apiBase: string;
  maxTokens?: number;
  temperature?: number;
}

/** 传输层生成参数 */
export interface TransportGenerateParams {
  model: ModelConfig;
  messages: ChatMessage[];
  systemInstruction?: string;
  signal?: unknown; // AbortSignal (DOM type, may not be available in Node.js TypeScript config)
  temperature?: number;
  maxTokens?: number;
}

/** 传输层流式参数 */
export interface TransportStreamParams extends TransportGenerateParams {
  onReasoning?: (text: string) => void;
  onToken?: (token: string) => void;
}

/** 传输层响应 */
export interface TransportResponse {
  text: string;
  usage: TokenUsage;
  latencyMs: number;
  modelId: string;
}

/** 流式传输块 */
export interface TransportStreamChunk {
  type: 'content' | 'reasoning' | 'tool_call' | 'done';
  text?: string;
  toolCall?: ToolCall;
}

/** 工具调用参数 */
export interface TransportToolParams extends TransportGenerateParams {
  tools: ToolDefinition[];
}

/** 工具调用响应 */
export interface TransportToolResponse extends TransportResponse {
  toolCalls?: ToolCall[];
}

/** 传输层统一接口 */
export interface Transport {
  readonly id: string;
  
  /** 判断是否能处理该模型 */
  canHandle(model: ModelConfig): boolean;
  
  /** 生成文本 */
  generate(params: TransportGenerateParams): Promise<TransportResponse>;
  
  /** 流式生成文本 */
  generateStream(params: TransportStreamParams): AsyncGenerator<TransportStreamChunk, TransportResponse>;
  
  /** 带工具调用的生成（可选） */
  generateWithTools?(params: TransportToolParams): Promise<TransportToolResponse>;
}
