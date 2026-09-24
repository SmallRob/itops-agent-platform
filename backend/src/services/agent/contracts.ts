/**
 * Agent 契约（动态插拔）
 *
 * 借鉴 openocta 的分层：Gateway（HTTP）与 Agent Runtime 通过契约解耦，
 * 这里把「Agent 执行」抽象为可注册/注销的 Provider，
 * 使本地 LLM 直连、外部 agent-service、未来的第三方 Agent 都能以同一契约接入。
 */
import type { SkillMatch, SkillToolContract } from '../skills/types';

/** Agent 执行请求（与具体实现无关） */
export interface AgentChatRequest {
  /** 会话键：同一会话保持上下文（openocta 的 sessionKey 语义） */
  sessionKey: string;
  /** 用户输入或注入的事件文本 */
  message: string;
  /** 指定 Agent（对应平台 agents 表 id，可选） */
  agentId?: string;
  /** 指定模型（可选，缺省走平台模型路由） */
  model?: string;
  /** 是否输出思考过程 */
  thinking?: boolean;
  /** 元数据（来源渠道、告警 id、技能匹配结果等） */
  metadata?: Record<string, unknown>;
}

/** Agent 执行结果 */
export interface AgentChatResponse {
  success: boolean;
  reply: string;
  sessionKey: string;
  provider: string;
  /** 实际使用的技能与工具（便于审计与前端展示） */
  skills?: SkillMatch[];
  toolCalls?: Array<{ name: string; args?: Record<string, unknown>; result?: unknown }>;
  /** 降级链尝试记录（按顺序，含被熔断跳过的 Provider） */
  attempts?: AgentAttempt[];
  /** 是否发生了降级（首选 Provider 不可用而走后备） */
  degraded?: boolean;
  durationMs: number;
  error?: string;
}

/** 单次 Provider 尝试记录 */
export interface AgentAttempt {
  provider: string;
  success: boolean;
  /** 被熔断跳过（未实际调用） */
  skipped?: boolean;
  error?: string;
  durationMs: number;
}

/** 熔断器状态（健康熔断与降级链的对外视图） */
export interface AgentCircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  threshold: number;
  /** 熔断开启时间与预计恢复时间（half-open 恢复探测） */
  openedAt?: string;
  retryAt?: string;
}

/** Agent Provider 契约：任何实现满足此接口即可被注册表装载 */
export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  readonly kind: 'local' | 'remote';
  /** 能力声明（如 chat / stream / tools / skills） */
  capabilities(): string[];
  /** 可用性探测 */
  health(): Promise<{ ok: boolean; message?: string }>;
  /** 执行一轮对话 */
  chat(request: AgentChatRequest): Promise<AgentChatResponse>;
  /** 可选：暴露该 Provider 可用的工具（默认取平台技能注册表） */
  tools?(): SkillToolContract[];
}

export interface AgentProviderInfo {
  id: string;
  name: string;
  kind: 'local' | 'remote';
  capabilities: string[];
  healthy: boolean;
  message?: string;
  /** 熔断状态（open 时会被降级链跳过） */
  circuit: AgentCircuitState;
}