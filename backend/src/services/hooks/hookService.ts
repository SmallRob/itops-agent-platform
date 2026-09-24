/**
 * Hook 服务：统一入站事件处理（wake / agent / alert）
 *
 * 流程：请求 → 归一化(HookEvent) → 动作分派
 *   - alert：走平台既有告警流水线（alertIngest），含 RCA / 设备关联 / 修复策略
 *   - agent：交给 Agent Provider 注册表（动态插拔的契约实现）
 *   - wake ：事件落通知 + 审计，可选触发一次 Agent 摘要
 */
import { randomUUID } from 'crypto';
import { logger } from '@utils/logger';
import { createAuditLog } from '@services/audit';
import { createNotification } from '../../routes/notificationRoutes';
import { agentRegistry } from '../agent/agentRegistry';
import { processNormalizedAlert } from './alertIngest';
import { getSourceMapping, listSourceMappings } from './hookMappings';
import type { HookAgentRequest, HookAlertResult, HookEvent, HookIngestResult, HookSource, HookWakeRequest } from './types';

function buildEvent(
  source: HookSource,
  action: HookEvent['action'],
  payload: Record<string, unknown>,
  fallbackTitle: string
): HookEvent {
  return {
    id: randomUUID(),
    source,
    action,
    type: String(payload.type || (action === 'alert' ? 'alert' : action)),
    severity: String(payload.severity || 'warning'),
    title: String(payload.title || payload.text || fallbackTitle).slice(0, 200),
    description: String(payload.description || payload.text || ''),
    host: payload.host ? String(payload.host) : undefined,
    labels: (payload.labels as Record<string, string>) || {},
    fingerprint: payload.fingerprint ? String(payload.fingerprint) : undefined,
    receivedAt: new Date().toISOString(),
    raw: payload,
  };
}

class HookService {
  /** 可用来源（供前端/接入方查询标准化能力） */
  sources() {
    return listSourceMappings();
  }

  /**
   * 告警类入站：标准化 → 落库 → 处置流水线
   * @param source 来源标识；generic 会按 payload 自动识别
   */
  async ingestAlert(source: HookSource, payload: unknown): Promise<HookIngestResult> {
    const startedAt = Date.now();
    const mapping = getSourceMapping(source);
    if (!mapping) {
      throw new Error(`未支持的 Hook 来源：${source}（可用：${listSourceMappings().map((m) => m.source).join('/')}）`);
    }

    const adapted = mapping.adapter(payload);
    const errors = [...adapted.errors];
    const processed: HookAlertResult[] = [];

    for (const alert of adapted.alerts) {
      try {
        processed.push(processNormalizedAlert(alert, mapping.label));
      } catch (error) {
        const message = error instanceof Error ? error.message : '处理失败';
        errors.push(`${alert.title}：${message}`);
      }
    }

    logger.info(
      `[hooks] ${source} 告警入站：${adapted.alerts.length} 条，成功 ${processed.length}，失败 ${errors.length}`
    );

    return {
      source,
      action: 'alert',
      accepted: adapted.alerts.length,
      processed,
      errors,
      durationMs: Date.now() - startedAt,
    };
  }

  /** Agent 类入站：交给 Provider 注册表执行（隔离回合，可指定会话/模型/Provider） */
  async ingestAgent(request: HookAgentRequest): Promise<HookIngestResult> {
    const startedAt = Date.now();
    const sessionKey = request.sessionKey || `hook-agent-${randomUUID()}`;

    const response = await agentRegistry.chat(
      {
        sessionKey,
        message: request.message,
        agentId: request.agentId,
        model: request.model,
        thinking: request.thinking,
        metadata: { source: 'hook', ...(request.metadata || {}) },
      },
      request.provider
    );

    return {
      source: 'generic',
      action: 'agent',
      accepted: 1,
      processed: [],
      errors: response.success ? [] : [response.error || 'Agent 执行失败'],
      agentReply: response.reply,
      sessionKey,
      provider: response.provider,
      durationMs: Date.now() - startedAt,
    };
  }

  /** 唤醒类入站：事件注入（通知 + 审计），可选触发 Agent 摘要 */
  async ingestWake(request: HookWakeRequest): Promise<HookIngestResult> {
    const startedAt = Date.now();
    const payload = { text: request.text, ...(request.metadata || {}) } as Record<string, unknown>;
    const event = buildEvent('generic', 'wake', payload, '系统事件');
    const sessionKey = request.sessionKey || 'main';

    createNotification({
      type: 'system',
      title: `事件通知: ${event.title}`,
      content: event.description || event.title,
    });

    createAuditLog({
      action: 'hook_wake',
      resource_type: 'hook',
      resource_id: event.id,
      details: { title: event.title, sessionKey, source: event.source },
    });

    let agentReply: string | undefined;
    let provider: string | undefined;
    const errors: string[] = [];

    if (request.triggerAgent) {
      const response = await agentRegistry.chat({
        sessionKey,
        message: `事件：${event.title}\n${event.description}`.trim(),
        agentId: request.agentId,
        metadata: { source: 'hook:wake' },
      });
      agentReply = response.reply;
      provider = response.provider;
      if (!response.success) errors.push(response.error || 'Agent 摘要失败');
    }

    return {
      source: 'generic',
      action: 'wake',
      accepted: 1,
      processed: [],
      errors,
      agentReply,
      sessionKey,
      provider,
      durationMs: Date.now() - startedAt,
    };
  }

  /** 统一入口（供 /api/hooks/:action 使用） */
  async ingestEvents(
    source: HookSource,
    payload: Record<string, unknown>,
    action: HookEvent['action']
  ): Promise<HookIngestResult> {
    if (action === 'alert') {
      return this.ingestAlert(source, payload);
    }
    if (action === 'agent') {
      return this.ingestAgent(payload as unknown as HookAgentRequest);
    }
    return this.ingestWake(payload as unknown as HookWakeRequest);
  }
}

export const hookService = new HookService();