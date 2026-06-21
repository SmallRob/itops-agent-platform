/**
 * ITOps Agent Harness 类型定义
 * 借鉴 NiceKit 的三层上下文架构
 */

// ─── 上下文工程类型 ───

/** 三层上下文架构 */
export interface ContextLayer {
  /** 核心层：永不丢弃的长期规则（System Prompt + 角色设定） */
  core: string;
  /** 工作层：当前任务的活跃上下文（用户输入 + 知识库检索 + 工具结果） */
  working: string;
  /** 历史层：已压缩的过往信息（对话摘要 + 关键决策记录） */
  archived: string;
}

/** Token 预算配置 */
export interface ContextBudget {
  /** 总 token 预算（默认 4000） */
  maxTokens: number;
  /** 核心层比例（默认 0.15 → 600 tokens） */
  coreRatio: number;
  /** 工作层比例（默认 0.65 → 2600 tokens） */
  workingRatio: number;
  /** 历史层比例（默认 0.2 → 800 tokens） */
  archivedRatio: number;
}

/** 上下文段（用于预算管理） */
export interface ContextSection {
  /** 段名称标识 */
  name: string;
  /** 段内容 */
  content: string;
  /** 优先级（0-10，数值越高越重要） */
  priority: number;
}

/** Agent 执行上下文 */
export interface AgentExecutionContext {
  /** Agent ID */
  agentId: string;
  /** Agent 名称 */
  agentName: string;
  /** System Prompt */
  systemPrompt: string;
  /** 用户输入 */
  userInput: string;
  /** 知识库检索结果 */
  knowledgeContext?: string;
  /** 对话历史 */
  conversationHistory?: ConversationMessage[];
  /** 工具调用结果 */
  toolResults?: ToolResultRecord[];
  /** Token 预算 */
  budget?: Partial<ContextBudget>;
}

/** 对话消息 */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/** 工具调用记录 */
export interface ToolResultRecord {
  name: string;
  arguments: Record<string, unknown>;
  result: string;
  success: boolean;
  timestamp: number;
}

/** 上下文构建输出 */
export interface ContextBuildOutput {
  /** systemInstruction（通过 AI SDK 原生传递） */
  systemInstruction: string;
  /** 用户消息（包含工作层 + 历史层 + 对话 + 行动指令） */
  userMessage: string;
  /** 各段 token 统计（调试用） */
  stats: ContextStats;
}

/** 上下文统计 */
export interface ContextStats {
  /** 总 token 数 */
  totalTokens: number;
  /** systemInstruction token 数 */
  systemTokens: number;
  /** userMessage token 数 */
  userTokens: number;
  /** 各段明细 */
  sections: Array<{ name: string; tokens: number; included: boolean }>;
}

// ─── 对话摘要类型 ───

/** 对话摘要 */
export interface ConversationSummary {
  /** 摘要内容 */
  summary: string;
  /** 摘要覆盖的消息 ID 范围 */
  coversMessageIds: string[];
  /** 原始消息数量 */
  originalCount: number;
  /** 关键决策/结论 */
  keyDecisions: string[];
  /** 摘要生成时间 */
  generatedAt: string;
}

/** 对话构建选项 */
export interface ConversationBuildOptions {
  /** 最近 N 条完整保留（默认 4） */
  maxRecentFull?: number;
  /** 最近 N 条保留截断（默认 10） */
  maxRecentTrimmed?: number;
  /** 超过此条数生成摘要（默认 10） */
  summaryThreshold?: number;
}

// ─── Agent Loop 类型 ───

/** Agent Loop 配置 */
export interface AgentLoopConfig {
  /** 最大工具调用次数（防止无限循环） */
  maxIterations?: number;
  /** 工具调用超时（毫秒） */
  toolTimeout?: number;
  /** 是否启用流式输出 */
  streaming?: boolean;
  /** 是否在思考过程中输出日志 */
  verbose?: boolean;
  /** 整体超时（毫秒） */
  timeoutMs?: number;
}

/** Agent Loop 结果 */
export interface AgentLoopResult {
  /** 最终响应文本 */
  response: string;
  /** 是否完成（false 表示达到最大迭代次数） */
  completed: boolean;
  /** 工具调用记录 */
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: string;
    success: boolean;
    timestamp: number;
  }>;
  /** 总迭代次数 */
  iterations: number;
  /** 总耗时（毫秒） */
  durationMs?: number;
  /** 是否因超时结束 */
  timedOut?: boolean;
}

// ─── 默认值 ───

export const DEFAULT_BUDGET: ContextBudget = {
  maxTokens: 4000,
  coreRatio: 0.15,
  workingRatio: 0.65,
  archivedRatio: 0.2,
};

export const DEFAULT_CONVERSATION_OPTIONS: Required<ConversationBuildOptions> = {
  maxRecentFull: 4,
  maxRecentTrimmed: 10,
  summaryThreshold: 10,
};
