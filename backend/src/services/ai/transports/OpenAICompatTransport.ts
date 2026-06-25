/**
 * ITOps Agent Platform - OpenAI 兼容传输层
 * 适用于 DeepSeek / Qwen / VolcEngine / ZhiPu 等 OpenAI 兼容 API
 * 借鉴 NiceKit 的 Transport 设计
 */

import axios from 'axios';
import { logger } from '@utils/logger';
import {
  ApiError,
  AuthenticationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  CircuitBreakerError,
} from '@utils/errors';
import type {
  Transport,
  TransportGenerateParams,
  TransportResponse,
  TransportStreamParams,
  TransportStreamChunk,
  TransportToolParams,
  TransportToolResponse,
  ModelConfig,
  TokenUsage,
} from './types';

/** 熔断器状态 */
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  lastUsedTime: number;
  isOpen: boolean;
  halfOpenAttempts: number;
}

/** 熔断器实现 */
class CircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    lastUsedTime: Date.now(),
    isOpen: false,
    halfOpenAttempts: 0,
  };

  constructor(
    private readonly maxFailures = 5,
    private readonly resetTimeout = 60000,
    private readonly maxHalfOpenAttempts = 3
  ) {}

  canCall(): boolean {
    this.state.lastUsedTime = Date.now();

    if (this.state.isOpen) {
      const now = Date.now();
      if (now - this.state.lastFailureTime > this.resetTimeout) {
        if (this.state.halfOpenAttempts >= this.maxHalfOpenAttempts) {
          return false;
        }
        this.state.halfOpenAttempts++;
        return true;
      }
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
    this.state.halfOpenAttempts = 0;
    this.state.lastUsedTime = Date.now();
  }

  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailureTime = Date.now();
    this.state.lastUsedTime = Date.now();
    if (this.state.failures >= this.maxFailures) {
      this.state.isOpen = true;
      this.state.halfOpenAttempts = 0;
    }
  }

  getLastUsedTime(): number {
    return this.state.lastUsedTime;
  }

  isIdle(idleThresholdMs: number): boolean {
    return Date.now() - this.state.lastUsedTime > idleThresholdMs;
  }
}

/**
 * 估算 Token 数量（简单实现）
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的 API 调用
 */
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 10000
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        logger.info(`✅ Request succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`⚠️ Request attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);

      if (attempt < maxRetries) {
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        logger.info(`⏳ Waiting ${delayMs}ms before retry...`);
        await delay(delayMs + Math.random() * baseDelay);
      }
    }
  }

  logger.error(`❌ All ${maxRetries} retries failed`);
  throw lastError;
}

/**
 * OpenAI 兼容传输层
 */
export class OpenAICompatTransport implements Transport {
  readonly id = 'openai-compat';

  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(
    private readonly maxFailures = 5,
    private readonly resetTimeout = 60000
  ) {}

  canHandle(model: ModelConfig): boolean {
    return Boolean(model.apiKey && model.apiBase);
  }

  private getCircuitBreaker(provider: string): CircuitBreaker {
    if (!this.circuitBreakers.has(provider)) {
      this.circuitBreakers.set(
        provider,
        new CircuitBreaker(this.maxFailures, this.resetTimeout)
      );
    }
    return this.circuitBreakers.get(provider)!;
  }

  private buildApiEndpoint(apiBase: string, path: string): string {
    const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    return `${base}/${path}`;
  }

  private cleanApiBase(apiBase: string): string {
    if (apiBase.includes('/chat/completions')) {
      return apiBase.replace('/chat/completions', '');
    }
    return apiBase;
  }

  private handleApiError(error: unknown, provider: string): never {
    const err = error as { response?: { status?: number; headers?: Record<string, string> }; code?: string; message?: string };
    const status = err.response?.status;

    if (status === 401) {
      throw new AuthenticationError(provider, error instanceof Error ? error : undefined);
    }
    if (status === 429) {
      const retryAfter = err.response?.headers?.['retry-after'];
      throw new RateLimitError(
        provider,
        retryAfter ? parseInt(retryAfter) * 1000 : undefined,
        error instanceof Error ? error : undefined
      );
    }
    if (status && status >= 500) {
      throw new ServerError(provider, status, error instanceof Error ? error : undefined);
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      throw new TimeoutError('Request timed out', error instanceof Error ? error : undefined);
    }

    throw new ApiError(
      `Request failed: ${err.message || 'Unknown error'}`,
      provider,
      status,
      error instanceof Error ? error : undefined
    );
  }

  async generate(params: TransportGenerateParams): Promise<TransportResponse> {
    const { model, messages, systemInstruction, temperature, maxTokens } = params;
    const startTime = Date.now();

    const breaker = this.getCircuitBreaker(model.provider);
    if (!breaker.canCall()) {
      throw new CircuitBreakerError(model.provider);
    }

    const apiMessages = this.buildMessages(messages, systemInstruction);
    const apiBase = this.cleanApiBase(model.apiBase);

    try {
      const response = await callWithRetry(async () => {
        return axios.post(
          this.buildApiEndpoint(apiBase, 'chat/completions'),
          {
            model: model.modelId,
            messages: apiMessages,
            temperature: temperature ?? model.temperature ?? 0.7,
            max_tokens: maxTokens ?? model.maxTokens ?? 2048,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${model.apiKey}`,
            },
            timeout: 60000,
          }
        );
      });

      breaker.recordSuccess();

      const text = response.data.choices?.[0]?.message?.content ?? '';
      const latencyMs = Date.now() - startTime;
      const usage = this.parseUsage(response.data, apiMessages, text);

      logger.info(
        `[${model.name}] API call successful, ${text.length} chars, ${latencyMs}ms`
      );

      return { text, usage, latencyMs, modelId: model.id };
    } catch (error) {
      breaker.recordFailure();
      this.handleApiError(error, model.provider);
    }
  }

  async *generateStream(
    params: TransportStreamParams
  ): AsyncGenerator<TransportStreamChunk, TransportResponse> {
    const { model, messages, systemInstruction, temperature, maxTokens, onToken } = params;
    const startTime = Date.now();

    const breaker = this.getCircuitBreaker(model.provider);
    if (!breaker.canCall()) {
      throw new CircuitBreakerError(model.provider);
    }

    const apiMessages = this.buildMessages(messages, systemInstruction);
    const apiBase = this.cleanApiBase(model.apiBase);

    try {
      const response = await axios.post(
        this.buildApiEndpoint(apiBase, 'chat/completions'),
        {
          model: model.modelId,
          messages: apiMessages,
          temperature: temperature ?? model.temperature ?? 0.7,
          max_tokens: maxTokens ?? model.maxTokens ?? 2048,
          stream: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${model.apiKey}`,
          },
          timeout: 60000,
          responseType: 'text',
        }
      );

      breaker.recordSuccess();

      const text = response.data;
      let fullText = '';

      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));
          const delta = data.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.reasoning_content) {
            yield { type: 'reasoning', text: delta.reasoning_content };
          }

          if (delta.content) {
            fullText += delta.content;
            onToken?.(delta.content);
            yield { type: 'content', text: delta.content };
          }
        } catch {
          // 跳过解析失败的行
        }
      }

      yield { type: 'done' };

      const latencyMs = Date.now() - startTime;
      const usage: TokenUsage = {
        promptTokens: estimateTokens(apiMessages.map((m) => m.content).join('\n')),
        completionTokens: estimateTokens(fullText),
        totalTokens:
          estimateTokens(apiMessages.map((m) => m.content).join('\n')) +
          estimateTokens(fullText),
      };

      return { text: fullText, usage, latencyMs, modelId: model.id };
    } catch (error) {
      breaker.recordFailure();
      this.handleApiError(error, model.provider);
    }
  }

  async generateWithTools(
    params: TransportToolParams
  ): Promise<TransportToolResponse> {
    const { model, messages, systemInstruction, tools, temperature, maxTokens } = params;
    const startTime = Date.now();

    const breaker = this.getCircuitBreaker(model.provider);
    if (!breaker.canCall()) {
      throw new CircuitBreakerError(model.provider);
    }

    const apiMessages = this.buildMessages(messages, systemInstruction);
    const apiBase = this.cleanApiBase(model.apiBase);

    try {
      const response = await callWithRetry(async () => {
        return axios.post(
          this.buildApiEndpoint(apiBase, 'chat/completions'),
          {
            model: model.modelId,
            messages: apiMessages,
            tools: tools.map((t) => ({
              type: 'function',
              function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              },
            })),
            temperature: temperature ?? model.temperature ?? 0.7,
            max_tokens: maxTokens ?? model.maxTokens ?? 2048,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${model.apiKey}`,
            },
            timeout: 60000,
          }
        );
      });

      breaker.recordSuccess();

      const message = response.data.choices?.[0]?.message;
      const text = message?.content ?? '';
      const toolCalls = message?.tool_calls?.map((tc: Record<string, unknown>) => ({
        id: tc.id as string,
        name: (tc.function as Record<string, string>)?.name ?? '',
        arguments: JSON.parse((tc.function as Record<string, string>)?.arguments ?? '{}'),
      }));

      const latencyMs = Date.now() - startTime;
      const usage = this.parseUsage(response.data, apiMessages, text);

      logger.info(
        `[${model.name}] Tool call successful, ${toolCalls?.length ?? 0} tools, ${latencyMs}ms`
      );

      return {
        text,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage,
        latencyMs,
        modelId: model.id,
      };
    } catch (error) {
      breaker.recordFailure();
      this.handleApiError(error, model.provider);
    }
  }

  private buildMessages(
    messages: Array<{ role: string; content: string }>,
    systemInstruction?: string
  ): Array<{ role: string; content: string }> {
    const apiMessages: Array<{ role: string; content: string }> = [];
    if (systemInstruction) {
      apiMessages.push({ role: 'system', content: systemInstruction });
    }
    for (const msg of messages) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }
    return apiMessages;
  }

  private parseUsage(
    data: Record<string, unknown>,
    messages: Array<{ content: string }>,
    text: string
  ): TokenUsage {
    const usage = data?.usage as Record<string, number> | undefined;
    if (usage) {
      const promptTokens = usage.prompt_tokens ?? estimateTokens(messages.map((m) => m.content).join('\n'));
      const completionTokens = usage.completion_tokens ?? estimateTokens(text);
      return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    }
    const promptTokens = estimateTokens(messages.map((m) => m.content).join('\n'));
    const completionTokens = estimateTokens(text);
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  getCircuitBreakerStats(): Array<{ provider: string; isOpen: boolean; failures: number }> {
    const stats: Array<{ provider: string; isOpen: boolean; failures: number }> = [];
    for (const [provider, breaker] of this.circuitBreakers.entries()) {
      stats.push({
        provider,
        isOpen: !breaker.canCall(),
        failures: 0,
      });
    }
    return stats;
  }
}
