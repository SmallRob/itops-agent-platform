/**
 * Hooks 契约（借鉴 openocta 的 /hooks/* 设计）
 *
 * 目标：把「外部事件源」与「Agent / 告警核心」解耦，任何来源都先归一化为 HookEvent，
 * 再按声明的路由动作（wake / agent / alert）分派，新增来源只需加一条映射配置。
 */

/** 支持的事件来源（可扩展：新增来源 = 加一条 mapping） */
export type HookSource =
  | 'prometheus'
  | 'zabbix'
  | 'grafana'
  | 'aliyun'
  | 'tencent'
  | 'generic';

/** Hook 动作类型（与 openocta /hooks/wake|agent|alert 对应） */
export type HookAction = 'wake' | 'agent' | 'alert';

/** 归一化后的事件（所有入站 webhook 的统一形态） */
export interface HookEvent {
  id: string;
  source: HookSource;
  action: HookAction;
  type: string;
  severity: string;
  title: string;
  description: string;
  host?: string;
  labels: Record<string, string>;
  fingerprint?: string;
  receivedAt: string;
  raw: unknown;
}

/** 单个告警的处理结果 */
export interface HookAlertResult {
  alertId: string;
  taskId: string | null;
  executionIds?: string[];
  status: 'created' | 'resolved';
}

/** ingest 统一返回 */
export interface HookIngestResult {
  source: HookSource;
  action: HookAction;
  accepted: number;
  processed: HookAlertResult[];
  errors: string[];
  /** wake / agent 动作的回执 */
  agentReply?: string;
  sessionKey?: string;
  provider?: string;
  durationMs: number;
}

/** wake 请求体 */
export interface HookWakeRequest {
  text: string;
  sessionKey?: string;
  /** 是否顺带触发一次 Agent 摘要（openocta 的 heartbeat 语义） */
  triggerAgent?: boolean;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

/** agent 请求体（openocta /hooks/agent：隔离回合 + 自定义会话/模型） */
export interface HookAgentRequest {
  message: string;
  sessionKey?: string;
  agentId?: string;
  model?: string;
  thinking?: boolean;
  provider?: string;
  metadata?: Record<string, unknown>;
}