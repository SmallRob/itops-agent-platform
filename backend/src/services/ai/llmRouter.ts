/**
 * ITOps Agent Platform - LLM 多 Provider 路由器
 * 
 * 参考 Ongrid 的 MultiClient + ProvidersResolver 动态路由设计，
 * 支持多 Provider 热切换、故障转移、健康检查和并发控制。
 * 
 * 支持的 Provider：
 * - openai:    标准 OpenAI API
 * - anthropic: Claude API（需要特殊 x-api-key header）
 * - zhipu:     智谱 API（需要 JWT 签名）
 * - gemini:    Google Gemini API（通过 generativelanguage.googleapis.com）
 * - custom:    任意 OpenAI 兼容接口
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '@utils/logger';

// ============================================================
// 类型定义
// ============================================================

/** Provider 类型 */
export type ProviderType = 'openai' | 'anthropic' | 'zhipu' | 'gemini' | 'custom';

/** Provider 配置 */
export interface ProviderConfig {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  label: string;
  /** API Key */
  apiKey: string;
  /** 默认模型 ID */
  model: string;
  /** API 基础地址 */
  baseURL: string;
  /** 该 Provider 支持的模型列表 */
  models: string[];
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数值越小优先级越高） */
  priority: number;
  /** 最大并发请求数 */
  maxConcurrent: number;
  /** 请求超时（毫秒） */
  timeout: number;
  /** Provider 类型 */
  type: ProviderType;
  /** 额外配置（用于 custom 类型或特殊 Provider） */
  extra?: Record<string, unknown>;
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 聊天请求 */
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/** Token 使用量 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 聊天响应 */
export interface ChatResponse {
  /** 响应内容 */
  content: string;
  /** Token 使用量 */
  usage: TokenUsage;
  /** 实际使用的 Provider ID */
  provider: string;
  /** 实际使用的模型 */
  model: string;
  /** 延迟（毫秒） */
  latencyMs: number;
}

/** 健康状态 */
export interface HealthStatus {
  healthy: boolean;
  lastCheck: number;
  failures: number;
}

// ============================================================
// 内部辅助类型
// ============================================================

/** Provider 运行时状态 */
interface ProviderRuntime {
  /** 当前并发请求数 */
  currentConcurrent: number;
  /** 连续失败次数 */
  consecutiveFailures: number;
  /** 最后一次健康检查时间 */
  lastHealthCheck: number;
  /** 最后一次失败时间 */
  lastFailureTime: number;
  /** 上次成功时间 */
  lastSuccessTime: number;
}

// ============================================================
// Token 估算（简单字符级估算，不依赖外部 tokenizer）
// ============================================================

/**
 * 简单 Token 估算
 * - 英文大约 1 token / 4 字符
 * - 中文大约 1 token / 1.5 字符（约 2 字符 ≈ 1 token）
 * - 混合内容按比例估算
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;

  let chineseChars = 0;
  let otherChars = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // CJK 统一汉字范围 + 扩展
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      chineseChars++;
    } else {
      otherChars++;
    }
  }

  const chineseTokens = Math.ceil(chineseChars / 1.5);
  const englishTokens = Math.ceil(otherChars / 4);

  return chineseTokens + englishTokens;
}

// ============================================================
// LLMRouter 主类
// ============================================================

export class LLMRouter {
  /** Provider 配置映射 */
  public providers: Map<string, ProviderConfig> = new Map();

  /** HTTP 客户端映射 */
  public clients: Map<string, AxiosInstance> = new Map();

  /** 运行时状态映射 */
  private runtimes: Map<string, ProviderRuntime> = new Map();

  /** 健康状态映射 */
  private healthStatuses: Map<string, HealthStatus> = new Map();

  /** Zhipu JWT 缓存（避免每次请求都生成） */
  private zhipuTokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  /** 默认配置刷新间隔（毫秒） */
  private dbRefreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    logger.info('[LLMRouter] 初始化 LLM 多 Provider 路由器');
  }

  // ==========================================================
  // Provider 管理方法
  // ==========================================================

  /**
   * 添加 Provider 配置
   */
  addProvider(config: ProviderConfig): void {
    this.validateProviderConfig(config);
    this.providers.set(config.id, { ...config });
    this.clients.set(config.id, this.createHttpClient(config));
    this.runtimes.set(config.id, this.createDefaultRuntime());
    this.healthStatuses.set(config.id, {
      healthy: true,
      lastCheck: Date.now(),
      failures: 0,
    });
    logger.info(`[LLMRouter] 添加 Provider: ${config.id} (${config.label}, type=${config.type}, priority=${config.priority})`);
  }

  /**
   * 移除 Provider 配置
   */
  removeProvider(id: string): boolean {
    const existed = this.providers.has(id);
    this.providers.delete(id);
    this.clients.delete(id);
    this.runtimes.delete(id);
    this.healthStatuses.delete(id);
    this.zhipuTokenCache.delete(id);
    if (existed) {
      logger.info(`[LLMRouter] 移除 Provider: ${id}`);
    }
    return existed;
  }

  /**
   * 更新 Provider 配置（部分更新）
   */
  updateProvider(id: string, updates: Partial<ProviderConfig>): void {
    const existing = this.providers.get(id);
    if (!existing) {
      throw new Error(`Provider 不存在: ${id}`);
    }

    const merged: ProviderConfig = { ...existing, ...updates, id };
    this.validateProviderConfig(merged);
    this.providers.set(id, merged);
    this.clients.set(id, this.createHttpClient(merged));
    this.zhipuTokenCache.delete(id);
    logger.info(`[LLMRouter] 更新 Provider: ${id}`);
  }

  /**
   * 获取指定 Provider 配置
   */
  getProvider(id: string): ProviderConfig | undefined {
    return this.providers.get(id);
  }

  /**
   * 列出所有 Provider 配置
   */
  listProviders(): ProviderConfig[] {
    return Array.from(this.providers.values());
  }

  // ==========================================================
  // 聊天方法
  // ==========================================================

  /**
   * 通过指定 Provider 发送聊天请求
   */
  async chat(providerId: string, req: ChatRequest): Promise<ChatResponse> {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`Provider 不存在: ${providerId}`);
    }
    if (!config.enabled) {
      throw new Error(`Provider 已禁用: ${providerId}`);
    }

    const runtime = this.getRuntime(providerId);
    const client = this.clients.get(providerId);

    if (!client) {
      throw new Error(`Provider HTTP 客户端未初始化: ${providerId}`);
    }

    // 并发控制
    if (runtime.currentConcurrent >= config.maxConcurrent) {
      throw new Error(`Provider ${providerId} 已达最大并发数 ${config.maxConcurrent}`);
    }

    runtime.currentConcurrent++;
    const startTime = Date.now();

    try {
      const model = req.model || config.model;
      const endpoint = this.buildEndpoint(config);
      const headers = this.buildHeaders(config);
      const body = this.buildRequestBody(config, req, model);

      logger.info(`[LLMRouter] 请求 Provider: ${providerId}, 模型: ${model}`);

      const response = await client.post(endpoint, body, {
        headers,
        timeout: req.stream ? undefined : config.timeout,
      });

      const latencyMs = Date.now() - startTime;
      const chatResponse = this.parseResponse(config, response.data, model, latencyMs);

      // 更新运行时状态
      runtime.consecutiveFailures = 0;
      runtime.lastSuccessTime = Date.now();
      this.updateHealthStatus(providerId, true);

      return chatResponse;
    } catch (error: unknown) {
      runtime.consecutiveFailures++;
      runtime.lastFailureTime = Date.now();
      this.updateHealthStatus(providerId, false);

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[LLMRouter] Provider ${providerId} 请求失败: ${errorMessage}`);
      throw this.wrapError(error, providerId);
    } finally {
      runtime.currentConcurrent = Math.max(0, runtime.currentConcurrent - 1);
    }
  }

  /**
   * 带故障转移的聊天请求
   * 按优先级排序，自动在失败时切换到下一个 Provider
   */
  async chatWithFallback(req: ChatRequest, preferredProviders?: string[]): Promise<ChatResponse> {
    const candidates = this.resolveProviders(req.model, preferredProviders);

    if (candidates.length === 0) {
      throw new Error('没有可用的 Provider，请检查配置');
    }

    let lastError: Error | null = null;

    for (const provider of candidates) {
      try {
        const result = await this.chat(provider.id, req);
        logger.info(`[LLMRouter] chatWithFallback 成功，使用 Provider: ${provider.id}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          `[LLMRouter] chatWithFallback: Provider ${provider.id} 失败 (${lastError.message})，尝试下一个`
        );
      }
    }

    logger.error('[LLMRouter] chatWithFallback: 所有 Provider 均失败');
    throw lastError || new Error('所有 Provider 均不可用');
  }

  // ==========================================================
  // 数据库刷新
  // ==========================================================

  /**
   * 从数据库加载 Provider 配置
   * 从 settings 和 ai_models 表中读取配置并同步到路由器
   */
  async refreshFromDB(): Promise<void> {
    try {
      // 动态导入 db 避免循环依赖
      const db = (await import('@models/database')).default;

      // 1. 从 ai_models 表读取模型配置
      const models = db.prepare(
        'SELECT * FROM ai_models WHERE enabled = 1 ORDER BY sort_order ASC'
      ).all() as Array<{
        id: string;
        name: string;
        provider_type: string;
        api_key: string | null;
        api_base: string | null;
        model_id: string;
        is_default: number;
      }>;

      // 按 provider_type 分组
      const providerGroups = new Map<string, typeof models>();
      for (const model of models) {
        const group = providerGroups.get(model.provider_type) || [];
        group.push(model);
        providerGroups.set(model.provider_type, group);
      }

      // 2. 为每种 provider_type 生成/更新配置
      for (const [providerType, groupModels] of providerGroups) {
        const firstModel = groupModels.find(m => m.is_default === 1) || groupModels[0];
        if (!firstModel || !firstModel.api_key) continue;

        const mappedType = this.mapProviderType(providerType);
        const existingConfig = this.providers.get(providerType);

        const config: ProviderConfig = {
          id: providerType,
          label: this.getProviderLabel(mappedType),
          apiKey: firstModel.api_key,
          model: firstModel.model_id,
          baseURL: firstModel.api_base || this.getDefaultBaseURL(mappedType),
          models: groupModels.map(m => m.model_id),
          enabled: true,
          priority: existingConfig?.priority ?? this.getDefaultPriority(mappedType),
          maxConcurrent: existingConfig?.maxConcurrent ?? 5,
          timeout: existingConfig?.timeout ?? 60000,
          type: mappedType,
        };

        this.addProvider(config);
      }

      logger.info(`[LLMRouter] 从数据库刷新完成，当前 ${this.providers.size} 个 Provider`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[LLMRouter] 从数据库刷新失败: ${errorMessage}`);
      throw error;
    }
  }

  // ==========================================================
  // 健康状态
  // ==========================================================

  /**
   * 获取所有 Provider 的健康状态
   */
  getHealthStatus(): Map<string, HealthStatus> {
    return new Map(this.healthStatuses);
  }

  // ==========================================================
  // 内部方法 - 请求构建
  // ==========================================================

  /**
   * 构建 API 端点路径
   */
  private buildEndpoint(config: ProviderConfig): string {
    switch (config.type) {
      case 'anthropic':
        return '/v1/messages';
      case 'gemini': {
        // Gemini 使用模型名作为路径的一部分
        return ''; // 在 buildRequestBody 中动态构建
      }
      case 'openai':
      case 'zhipu':
      case 'custom':
      default:
        return '/chat/completions';
    }
  }

  /**
   * 构建请求头（支持不同 Provider 的认证方式）
   */
  buildHeaders(config: ProviderConfig): Record<string, string> {
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (config.type) {
      case 'openai':
      case 'custom':
        return {
          ...baseHeaders,
          'Authorization': `Bearer ${config.apiKey}`,
        };

      case 'anthropic':
        return {
          ...baseHeaders,
          'x-api-key': config.apiKey,
          'anthropic-version': (config.extra?.anthropicVersion as string) || '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        };

      case 'zhipu': {
        const token = this.handleZhipuAuth(config.apiKey);
        return {
          ...baseHeaders,
          'Authorization': `Bearer ${token}`,
        };
      }

      case 'gemini':
        // Gemini 通过 URL 参数传递 key，但也可以用 Bearer
        return {
          ...baseHeaders,
          'x-goog-api-key': config.apiKey,
        };

      default:
        return {
          ...baseHeaders,
          'Authorization': `Bearer ${config.apiKey}`,
        };
    }
  }

  /**
   * 构建请求体
   */
  private buildRequestBody(config: ProviderConfig, req: ChatRequest, model: string): Record<string, unknown> {
    switch (config.type) {
      case 'anthropic': {
        // Claude API 的消息格式：system 单独提取，消息只能包含 user/assistant
        const systemMessages = req.messages.filter(m => m.role === 'system');
        const nonSystemMessages = req.messages.filter(m => m.role !== 'system');
        const systemPrompt = systemMessages.map(m => m.content).join('\n');

        return {
          model,
          max_tokens: req.maxTokens || 4096,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: nonSystemMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        };
      }

      case 'gemini': {
        // Gemini API 格式：contents + generationConfig
        const geminiMessages = req.messages.filter(m => m.role !== 'system');
        const geminiSystemMessages = req.messages.filter(m => m.role === 'system');

        const contents = geminiMessages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        return {
          contents,
          ...(geminiSystemMessages.length > 0
            ? {
                systemInstruction: {
                  parts: [{ text: geminiSystemMessages.map(m => m.content).join('\n') }],
                },
              }
            : {}),
          generationConfig: {
            ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
            ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
          },
        };
      }

      case 'openai':
      case 'zhipu':
      case 'custom':
      default:
        // 标准 OpenAI 兼容格式
        return {
          model,
          messages: req.messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
          ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
          ...(req.stream ? { stream: true } : {}),
        };
    }
  }

  // ==========================================================
  // 内部方法 - 响应解析
  // ==========================================================

  /**
   * 解析不同 Provider 的响应格式为统一格式
   */
  private parseResponse(config: ProviderConfig, data: Record<string, unknown>, model: string, latencyMs: number): ChatResponse {
    switch (config.type) {
      case 'anthropic': {
        const content = (data as { content?: Array<{ type: string; text: string }> }).content;
        const text = content && content.length > 0 ? content[0].text : '';
        const usage = (data as { usage?: Record<string, number> }).usage || {};
        return {
          content: text,
          usage: {
            promptTokens: (usage.input_tokens as number) || 0,
            completionTokens: (usage.output_tokens as number) || 0,
            totalTokens: ((usage.input_tokens as number) || 0) + ((usage.output_tokens as number) || 0),
          },
          provider: config.id,
          model,
          latencyMs,
        };
      }

      case 'gemini': {
        const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
        const text = candidates && candidates.length > 0
          ? candidates[0].content?.parts?.[0]?.text || ''
          : '';
        const usageMetadata = (data as { usageMetadata?: Record<string, number> }).usageMetadata || {};
        return {
          content: text,
          usage: {
            promptTokens: (usageMetadata.promptTokenCount as number) || 0,
            completionTokens: (usageMetadata.candidatesTokenCount as number) || 0,
            totalTokens: (usageMetadata.totalTokenCount as number) || 0,
          },
          provider: config.id,
          model,
          latencyMs,
        };
      }

      case 'openai':
      case 'zhipu':
      case 'custom':
      default: {
        const choices = (data as { choices?: Array<{ message?: { content?: string } }> }).choices;
        const text = choices && choices.length > 0 ? choices[0].message?.content || '' : '';
        const usage = (data as { usage?: Record<string, number> }).usage || {};
        return {
          content: text,
          usage: {
            promptTokens: (usage.prompt_tokens as number) || 0,
            completionTokens: (usage.completion_tokens as number) || 0,
            totalTokens: (usage.total_tokens as number) || 0,
          },
          provider: config.id,
          model,
          latencyMs,
        };
      }
    }
  }

  // ==========================================================
  // 内部方法 - Zhipu JWT 签名
  // ==========================================================

  /**
   * 智谱 API JWT 自动签名
   * 智谱要求使用 JWT Token 进行认证
   * 
   * apiKey 格式: {id}.{secret}
   */
  handleZhipuAuth(apiKey: string): string {
    // 检查缓存
    const cached = this.zhipuTokenCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const parts = apiKey.split('.');
    if (parts.length !== 2) {
      throw new Error('智谱 API Key 格式错误，应为 {id}.{secret}');
    }

    const [id, secret] = parts;
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      api_key: id,
      exp: now + 3600, // 1 小时过期
      timestamp: now,
    };

    const token = jwt.sign(payload, secret, {
      algorithm: 'HS256',
    });

    // 缓存 Token
    this.zhipuTokenCache.set(apiKey, {
      token,
      expiresAt: (now + 3500) * 1000, // 提前 100 秒刷新
    });

    return token;
  }

  // ==========================================================
  // 内部方法 - Provider 解析
  // ==========================================================

  /**
   * 解析可用的 Provider 列表（按优先级排序）
   * 如果指定了 preferredProviders，优先使用
   * 如果指定了 model，只返回支持该模型的 Provider
   */
  private resolveProviders(model?: string, preferredProviders?: string[]): ProviderConfig[] {
    const allProviders = Array.from(this.providers.values())
      .filter(p => p.enabled);

    let candidates: ProviderConfig[];

    if (preferredProviders && preferredProviders.length > 0) {
      // 优先使用指定的 Provider
      const preferred = preferredProviders
        .map(id => this.providers.get(id))
        .filter((p): p is ProviderConfig => p !== undefined && p.enabled);

      const others = allProviders
        .filter(p => !preferredProviders.includes(p.id));

      candidates = [...preferred, ...others];
    } else {
      candidates = allProviders;
    }

    // 如果指定了模型，过滤掉不支持该模型的 Provider
    if (model) {
      const withModel = candidates.filter(
        p => p.models.length === 0 || p.models.includes(model) || p.model === model
      );
      // 如果有支持该模型的 Provider，使用它们；否则使用全部
      if (withModel.length > 0) {
        candidates = withModel;
      }
    }

    // 按优先级排序
    candidates.sort((a, b) => a.priority - b.priority);

    return candidates;
  }

  // ==========================================================
  // 内部方法 - HTTP 客户端
  // ==========================================================

  /**
   * 为 Provider 创建 Axios 实例
   */
  private createHttpClient(config: ProviderConfig): AxiosInstance {
    let baseURL = config.baseURL;

    // Gemini 特殊处理：URL 中包含模型名
    if (config.type === 'gemini') {
      const modelId = config.model || 'gemini-pro';
      baseURL = `${config.baseURL.replace(/\/$/, '')}/v1beta/models/${modelId}`;
    }

    // 移除末尾的斜杠
    baseURL = baseURL.replace(/\/$/, '');

    return axios.create({
      baseURL,
      timeout: config.timeout,
    });
  }

  // ==========================================================
  // 内部方法 - 健康状态管理
  // ==========================================================

  /**
   * 更新 Provider 健康状态
   */
  private updateHealthStatus(providerId: string, success: boolean): void {
    const status = this.healthStatuses.get(providerId);
    if (!status) return;

    status.lastCheck = Date.now();

    if (success) {
      status.healthy = true;
      status.failures = 0;
    } else {
      status.failures++;
      // 连续失败 3 次标记为不健康
      if (status.failures >= 3) {
        status.healthy = false;
      }
    }
  }

  /**
   * 获取 Provider 运行时状态（自动初始化）
   */
  private getRuntime(providerId: string): ProviderRuntime {
    let runtime = this.runtimes.get(providerId);
    if (!runtime) {
      runtime = this.createDefaultRuntime();
      this.runtimes.set(providerId, runtime);
    }
    return runtime;
  }

  /**
   * 创建默认运行时状态
   */
  private createDefaultRuntime(): ProviderRuntime {
    return {
      currentConcurrent: 0,
      consecutiveFailures: 0,
      lastHealthCheck: Date.now(),
      lastFailureTime: 0,
      lastSuccessTime: 0,
    };
  }

  // ==========================================================
  // 内部方法 - 辅助函数
  // ==========================================================

  /**
   * 校验 Provider 配置
   */
  private validateProviderConfig(config: ProviderConfig): void {
    if (!config.id) {
      throw new Error('Provider ID 不能为空');
    }
    if (!config.label) {
      throw new Error('Provider label 不能为空');
    }
    if (!config.type) {
      throw new Error('Provider type 不能为空');
    }
    if (!config.baseURL) {
      throw new Error('Provider baseURL 不能为空');
    }
    if (config.maxConcurrent < 1) {
      throw new Error('Provider maxConcurrent 必须 >= 1');
    }
    if (config.timeout < 1000) {
      throw new Error('Provider timeout 必须 >= 1000ms');
    }
  }

  /**
   * 错误包装
   */
  private wrapError(error: unknown, providerId: string): Error {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const data = error.response?.data as Record<string, unknown> | undefined;
      const serverMsg = (data?.error as Record<string, unknown>)?.message as string || data?.message as string;

      if (status === 401) {
        return new Error(`[${providerId}] 认证失败，请检查 API Key 配置`);
      }
      if (status === 429) {
        return new Error(`[${providerId}] 请求频率超限，请稍后重试`);
      }
      if (status && status >= 500) {
        return new Error(`[${providerId}] 服务端错误 (${status}): ${serverMsg || '未知错误'}`);
      }
      return new Error(`[${providerId}] 请求失败: ${serverMsg || error.message}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * 将数据库中的 provider_type 映射到路由器的 ProviderType
   */
  private mapProviderType(dbType: string): ProviderType {
    const mapping: Record<string, ProviderType> = {
      volcengine: 'custom',
      openai: 'openai',
      aliyun: 'custom',
      deepseek: 'custom',
      zhipu: 'zhipu',
      local: 'custom',
      anthropic: 'anthropic',
      gemini: 'gemini',
    };
    return mapping[dbType] || 'custom';
  }

  /**
   * 获取 Provider 显示名称
   */
  private getProviderLabel(type: ProviderType): string {
    const labels: Record<ProviderType, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic (Claude)',
      zhipu: '智谱 AI',
      gemini: 'Google Gemini',
      custom: '自定义 (OpenAI 兼容)',
    };
    return labels[type] || '未知 Provider';
  }

  /**
   * 获取 Provider 默认 API 基础地址
   */
  private getDefaultBaseURL(type: ProviderType): string {
    const defaults: Record<ProviderType, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      gemini: 'https://generativelanguage.googleapis.com',
      custom: '',
    };
    return defaults[type] || '';
  }

  /**
   * 获取 Provider 默认优先级
   */
  private getDefaultPriority(type: ProviderType): number {
    const priorities: Record<ProviderType, number> = {
      openai: 10,
      anthropic: 20,
      zhipu: 30,
      gemini: 40,
      custom: 100,
    };
    return priorities[type] || 50;
  }
}

// ============================================================
// 单例导出
// ============================================================

let routerInstance: LLMRouter | null = null;

/**
 * 获取 LLMRouter 单例
 */
export function getLLMRouter(): LLMRouter {
  if (!routerInstance) {
    routerInstance = new LLMRouter();
  }
  return routerInstance;
}

/**
 * 重置 LLMRouter 单例（仅用于测试）
 */
export function resetLLMRouter(): void {
  routerInstance = null;
}
