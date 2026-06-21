/**
 * ITOps Agent Platform - 结构化错误类型
 * 借鉴 NiceKit 的错误体系设计
 */

/** 基础错误类 */
export class ITOpsError extends Error {
  readonly code: string;
  readonly cause?: Error;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'ITOpsError';
    this.code = code;
    this.cause = cause;
  }
}

/** API 请求错误 */
export class ApiError extends ITOpsError {
  readonly statusCode?: number;
  readonly provider: string;

  constructor(message: string, provider: string, statusCode?: number, cause?: Error) {
    super(message, 'API_ERROR', cause);
    this.name = 'ApiError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

/** 限流错误 */
export class RateLimitError extends ApiError {
  readonly retryAfterMs?: number;

  constructor(provider: string, retryAfterMs?: number, cause?: Error) {
    super('Rate limit exceeded', provider, 429, cause);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** 超时错误 */
export class TimeoutError extends ITOpsError {
  constructor(message = 'Request timed out', cause?: Error) {
    super(message, 'TIMEOUT', cause);
    this.name = 'TimeoutError';
  }
}

/** 认证错误 */
export class AuthenticationError extends ApiError {
  constructor(provider: string, cause?: Error) {
    super('Invalid API key', provider, 401, cause);
    this.name = 'AuthenticationError';
  }
}

/** 服务器错误 */
export class ServerError extends ApiError {
  constructor(provider: string, statusCode: number, cause?: Error) {
    super(`Server error: ${statusCode}`, provider, statusCode, cause);
    this.name = 'ServerError';
  }
}

/** 响应解析错误 */
export class ParseError extends ITOpsError {
  readonly rawResponse: string;

  constructor(message: string, rawResponse: string, cause?: Error) {
    super(message, 'PARSE_ERROR', cause);
    this.name = 'ParseError';
    this.rawResponse = rawResponse;
  }
}

/** 配置错误 */
export class ConfigError extends ITOpsError {
  constructor(message: string, cause?: Error) {
    super(message, 'CONFIG_ERROR', cause);
    this.name = 'ConfigError';
  }
}

/** 熔断器错误 */
export class CircuitBreakerError extends ITOpsError {
  readonly provider: string;

  constructor(provider: string, cause?: Error) {
    super(`Circuit breaker is OPEN for provider: ${provider}`, 'CIRCUIT_BREAKER_OPEN', cause);
    this.name = 'CircuitBreakerError';
    this.provider = provider;
  }
}

/** 分类错误类型 */
export function classifyError(error: unknown): 'apiError' | 'timeout' | 'parseError' | 'circuitBreaker' | 'unknown' {
  if (error instanceof CircuitBreakerError) return 'circuitBreaker';
  if (error instanceof RateLimitError || (error instanceof ApiError && error.statusCode === 429)) return 'apiError';
  if (error instanceof TimeoutError) return 'timeout';
  if (error instanceof ParseError) return 'parseError';
  if (error instanceof ApiError) return 'apiError';
  return 'unknown';
}

/** 构建面向用户的错误消息 */
export function buildUserFacingMessage(error: unknown): string {
  if (error instanceof CircuitBreakerError) {
    return `${error.provider} 服务暂时不可用，请稍后再试`;
  }
  if (error instanceof AuthenticationError) {
    return 'API Key 无效，请在设置中重新配置';
  }
  if (error instanceof RateLimitError) {
    return '请求过于频繁，请稍后再试';
  }
  if (error instanceof TimeoutError) {
    return '请求超时，请检查网络后重试';
  }
  if (error instanceof ServerError) {
    return 'AI 服务暂时不可用，请稍后再试';
  }
  if (error instanceof ApiError) {
    if (error.statusCode === 403) return 'API 访问被拒绝，请检查权限';
    return `AI 请求失败 (${error.statusCode})`;
  }
  if (error instanceof ParseError) return 'AI 返回数据解析失败，请重试';
  if (error instanceof ConfigError) return 'AI 配置异常，请在设置中检查';
  if (error instanceof Error) return error.message || '发生未知错误';
  return '发生未知错误';
}
