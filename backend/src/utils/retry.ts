import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  factor: 2,
  shouldRetry: () => true,
  onRetry: () => {}
};

export function calculateExponentialBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  factor: number
): number {
  const delay = initialDelayMs * Math.pow(factor, attempt);
  return Math.min(delay, maxDelayMs);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...defaultOptions, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delayMs = calculateExponentialBackoffDelay(
          attempt - 1,
          config.initialDelayMs,
          config.maxDelayMs,
          config.factor
        );
        logger.debug(`🔄 Retry attempt ${attempt}/${config.maxRetries}, waiting ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === config.maxRetries || !config.shouldRetry(error)) {
        logger.error(`❌ Operation failed after ${attempt + 1} attempts:`, error);
        break;
      }

      const delayMs = calculateExponentialBackoffDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.factor
      );

      config.onRetry(attempt + 1, error, delayMs);
      logger.warn(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, 
        error instanceof Error ? error.message : String(error));
    }
  }

  throw lastError;
}

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableError';
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableError) return true;
  
  const retryableErrors = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'Timeout',
    'timed out',
    'Connection refused',
    'Connection reset'
  ];

  const errorMessage = error instanceof Error ? error.message : String(error);
  return retryableErrors.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase())
  );
}
