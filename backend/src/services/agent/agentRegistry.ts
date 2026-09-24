/**
 * Agent Provider 注册表（动态插拔）
 *  - register/unregister：运行时装载与卸载 Provider
 *  - resolve：按 id 或能力选择 Provider（默认优先本地直连，远端作为后备）
 *  - chat：统一入口，按「降级链」依次尝试，带健康熔断与尝试记录
 *
 * 治理参数（settings 表可覆盖 env）：
 *   agent_fallback_chain  = ["local","agent-service"]  降级顺序
 *   agent_breaker_config  = {"threshold":3,"cooldownMs":60000}  熔断阈值与冷却时间
 *   env AGENT_BREAKER_THRESHOLD / AGENT_BREAKER_COOLDOWN_MS 提供默认值
 */
import db from '@models/database';
import { logger } from '@utils/logger';
import { skillRegistry } from '../skills/skillRegistry';
import type {
  AgentAttempt,
  AgentChatRequest,
  AgentChatResponse,
  AgentCircuitState,
  AgentProvider,
  AgentProviderInfo,
} from './contracts';

const FALLBACK_CHAIN_KEY = 'agent_fallback_chain';
const BREAKER_CONFIG_KEY = 'agent_breaker_config';
const DEFAULT_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 60_000;

interface BreakerRecord {
  failures: number;
  /** 熔断开启时间戳（null 表示闭合） */
  openedAt: number | null;
  lastError?: string;
}

function readSettingsJson<T>(key: string): T | undefined {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row?.value) return undefined;
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

function writeSettingsJson(key: string, value: unknown): void {
  const serialized = JSON.stringify(value);
  const existing = db.prepare('SELECT id FROM settings WHERE key = ?').get(key);
  if (existing) {
    db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?").run(serialized, key);
  } else {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, serialized);
  }
}

function readPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

class AgentRegistry {
  private providers = new Map<string, AgentProvider>();
  private defaultProviderId: string | null = null;
  private healthCache = new Map<string, { at: number; ok: boolean; message?: string }>();
  private breakers = new Map<string, BreakerRecord>();

  /** 注册（或覆盖）一个 Provider —— 动态插拔入口 */
  register(provider: AgentProvider, options: { default?: boolean } = {}): void {
    this.providers.set(provider.id, provider);
    if (options.default || !this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
    this.healthCache.delete(provider.id);
    this.breakers.delete(provider.id);
    logger.info(`[agents] 已注册 Agent Provider：${provider.id}（${provider.kind}）`);
  }

  /** 注销 Provider */
  unregister(id: string): boolean {
    const removed = this.providers.delete(id);
    if (removed) {
      this.healthCache.delete(id);
      this.breakers.delete(id);
      if (this.defaultProviderId === id) {
        this.defaultProviderId = this.providers.keys().next().value ?? null;
      }
      logger.info(`[agents] 已注销 Agent Provider：${id}`);
    }
    return removed;
  }

  list(): AgentProvider[] {
    return [...this.providers.values()];
  }

  get(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  getDefaultId(): string | null {
    return this.defaultProviderId;
  }

  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Agent Provider 不存在：${id}`);
    }
    this.defaultProviderId = id;
  }

  // ============================================================
  // 降级链
  // ============================================================

  /** 当前生效的降级顺序（settings 覆盖 > 默认 Provider + 注册顺序） */
  getFallbackChain(): string[] {
    return this.orderProviders().map((provider) => provider.id);
  }

  /** 设置降级顺序（持久化到 settings） */
  setFallbackChain(ids: string[]): string[] {
    const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
    for (const id of unique) {
      if (!this.providers.has(id)) {
        throw new Error(`Agent Provider 不存在：${id}`);
      }
    }
    writeSettingsJson(FALLBACK_CHAIN_KEY, unique);
    logger.info(`[agents] 降级链已更新：${unique.join(' → ') || '(空，按注册顺序)'}`);
    return this.getFallbackChain();
  }

  /** 解析目标 Provider：显式 id > 默认 > 第一个 */
  resolve(id?: string): AgentProvider {
    if (id) {
      const provider = this.providers.get(id);
      if (!provider) throw new Error(`Agent Provider 不存在：${id}`);
      return provider;
    }
    const fallbackId = this.defaultProviderId || this.providers.keys().next().value;
    const provider = fallbackId ? this.providers.get(fallbackId) : undefined;
    if (!provider) throw new Error('未注册任何 Agent Provider');
    return provider;
  }

  /** 按降级链排出候选 Provider（配置顺序 → 默认 → 其余注册顺序） */
  private orderProviders(): AgentProvider[] {
    const ordered: AgentProvider[] = [];
    const configured = readSettingsJson<string[]>(FALLBACK_CHAIN_KEY);
    for (const id of Array.isArray(configured) ? configured : []) {
      const provider = this.providers.get(id);
      if (provider && !ordered.includes(provider)) ordered.push(provider);
    }
    const defaultProvider = this.defaultProviderId ? this.providers.get(this.defaultProviderId) : undefined;
    if (defaultProvider && !ordered.includes(defaultProvider)) ordered.push(defaultProvider);
    for (const provider of this.providers.values()) {
      if (!ordered.includes(provider)) ordered.push(provider);
    }
    return ordered;
  }

  /**
   * 构建本次调用的候选链：显式指定则只用该 Provider（尊重调用方意愿），
   * 否则按降级顺序过滤掉熔断中的 Provider（全熔断时兜底仍尝试首选）。
   */
  private resolveChain(explicitId?: string): { chain: AgentProvider[]; skipped: AgentAttempt[] } {
    if (explicitId) {
      return { chain: [this.resolve(explicitId)], skipped: [] };
    }

    const ordered = this.orderProviders();
    const available: AgentProvider[] = [];
    const skipped: AgentAttempt[] = [];

    for (const provider of ordered) {
      if (this.isCircuitOpen(provider.id)) {
        skipped.push({ provider: provider.id, success: false, skipped: true, error: '熔断中，已跳过', durationMs: 0 });
      } else {
        available.push(provider);
      }
    }

    if (available.length === 0 && ordered.length > 0) {
      const head = ordered[0];
      available.push(head);
      const index = skipped.findIndex((attempt) => attempt.provider === head.id);
      if (index !== -1) {
        skipped[index] = { ...skipped[index], error: '全部 Provider 熔断，兜底尝试', skipped: false };
      }
    }

    return { chain: available, skipped };
  }

  // ============================================================
  // 健康熔断
  // ============================================================

  private getBreakerConfig(): { threshold: number; cooldownMs: number } {
    const settings = readSettingsJson<{ threshold?: number; cooldownMs?: number }>(BREAKER_CONFIG_KEY) || {};
    return {
      threshold:
        readPositiveNumber(settings.threshold) ??
        readPositiveNumber(process.env.AGENT_BREAKER_THRESHOLD) ??
        DEFAULT_THRESHOLD,
      cooldownMs:
        readPositiveNumber(settings.cooldownMs) ??
        readPositiveNumber(process.env.AGENT_BREAKER_COOLDOWN_MS) ??
        DEFAULT_COOLDOWN_MS,
    };
  }

  circuitState(id: string): AgentCircuitState {
    const { threshold, cooldownMs } = this.getBreakerConfig();
    const record = this.breakers.get(id);
    if (!record || !record.openedAt) {
      return { state: 'closed', failures: record?.failures ?? 0, threshold };
    }
    const openedAt = new Date(record.openedAt).toISOString();
    const retryAt = new Date(record.openedAt + cooldownMs).toISOString();
    if (Date.now() - record.openedAt >= cooldownMs) {
      return { state: 'half-open', failures: record.failures, threshold, openedAt, retryAt };
    }
    return { state: 'open', failures: record.failures, threshold, openedAt, retryAt };
  }

  private isCircuitOpen(id: string): boolean {
    return this.circuitState(id).state === 'open';
  }

  private recordSuccess(id: string): void {
    const previous = this.breakers.get(id);
    if (previous && previous.failures > 0) {
      logger.info(`[agents] Provider ${id} 已恢复（此前失败 ${previous.failures} 次）`);
    }
    this.breakers.set(id, { failures: 0, openedAt: null });
  }

  private recordFailure(id: string, message: string): void {
    const { threshold, cooldownMs } = this.getBreakerConfig();
    const previous = this.breakers.get(id);
    const failures = (previous?.failures ?? 0) + 1;
    const shouldOpen = failures >= threshold;
    this.breakers.set(id, { failures, openedAt: shouldOpen ? Date.now() : null, lastError: message });
    if (shouldOpen) {
      logger.warn(`[agents] Provider ${id} 连续失败 ${failures} 次，熔断 ${Math.round(cooldownMs / 1000)}s：${message}`);
    }
  }

  /** 带缓存的健康探测（供 /providers 列表展示） */
  async describe(provider: AgentProvider): Promise<AgentProviderInfo> {
    const cached = this.healthCache.get(provider.id);
    let health: { ok: boolean; message?: string };
    if (cached && Date.now() - cached.at < 30000) {
      health = { ok: cached.ok, message: cached.message };
    } else {
      try {
        health = await provider.health();
      } catch (error) {
        health = { ok: false, message: error instanceof Error ? error.message : '探测失败' };
      }
      this.healthCache.set(provider.id, { at: Date.now(), ok: health.ok, message: health.message });
    }

    return {
      id: provider.id,
      name: provider.name,
      kind: provider.kind,
      capabilities: provider.capabilities(),
      healthy: health.ok,
      message: health.message,
      circuit: this.circuitState(provider.id),
    };
  }

  /**
   * 统一执行入口：技能匹配 → 按降级链依次尝试 → 结果附带技能与尝试记录
   */
  async chat(request: AgentChatRequest, providerId?: string): Promise<AgentChatResponse> {
    const startedAt = Date.now();

    let skills: AgentChatResponse['skills'];
    try {
      skills = skillRegistry.match(request.message, 3);
    } catch (error) {
      logger.warn(`[agents] 技能匹配失败（忽略）：${error instanceof Error ? error.message : error}`);
    }

    let chain: AgentProvider[];
    let attempts: AgentAttempt[];
    try {
      const resolved = this.resolveChain(providerId);
      chain = resolved.chain;
      attempts = resolved.skipped;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent 执行失败';
      return {
        success: false,
        reply: '',
        sessionKey: request.sessionKey,
        provider: providerId || 'none',
        skills,
        attempts: [],
        durationMs: Date.now() - startedAt,
        error: message,
      };
    }

    let lastError = '无可用 Agent Provider';
    for (const provider of chain) {
      const attemptStartedAt = Date.now();
      try {
        const response = await provider.chat({
          ...request,
          metadata: { ...request.metadata, skills, fallbackChain: chain.map((item) => item.id) },
        });
        if (!response.success) {
          throw new Error(response.error || 'Provider 返回失败');
        }

        this.recordSuccess(provider.id);
        attempts.push({
          provider: provider.id,
          success: true,
          durationMs: response.durationMs || Date.now() - attemptStartedAt,
        });
        return {
          ...response,
          skills: response.skills ?? skills,
          attempts,
          degraded: attempts.some((attempt) => !attempt.success),
          durationMs: response.durationMs || Date.now() - startedAt,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Agent 执行失败';
        lastError = message;
        this.recordFailure(provider.id, message);
        attempts.push({
          provider: provider.id,
          success: false,
          error: message,
          durationMs: Date.now() - attemptStartedAt,
        });
        logger.error(`[agents] Provider ${provider.id} 执行失败：${message}`);
      }
    }

    return {
      success: false,
      reply: '',
      sessionKey: request.sessionKey,
      provider: chain[chain.length - 1]?.id ?? providerId ?? 'none',
      skills,
      attempts,
      degraded: attempts.length > 1,
      durationMs: Date.now() - startedAt,
      error: lastError,
    };
  }
}

export const agentRegistry = new AgentRegistry();