/**
 * 敏感信息脱敏工具
 * SEC-048: Improved masking algorithm - fewer visible characters, consistent length output
 */

const MASK_PLACEHOLDER = '********';

/**
 * 脱敏 API Key / Token
 * SEC-048: Show only first 3 and last 3 characters for keys > 12 chars; full mask for shorter keys
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return 'null';
  if (key.length <= 12) return MASK_PLACEHOLDER;
  return key.substring(0, 3) + '****' + key.substring(key.length - 3);
}

/**
 * 脱敏密码
 * SEC-048: Always return fixed-length placeholder to avoid leaking password length
 */
export function maskPassword(password: string | null | undefined): string {
  if (!password) return 'null';
  return MASK_PLACEHOLDER;
}

/**
 * 脱敏 SSH 私钥
 * SEC-048: Never expose any content from private keys
 */
export function maskPrivateKey(key: string | null | undefined): string {
  if (!key) return 'null';
  return '[REDACTED PRIVATE KEY]';
}

/**
 * 深度脱敏对象中的敏感信息
 * SEC-048: Extended pattern matching for connection strings, URLs with credentials, and nested sensitive data
 */
export function maskSensitiveData(obj: unknown): unknown {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    // SEC-048: Mask connection strings and URLs with embedded credentials
    // e.g., "mysql://user:password@host" or "postgres://user:pass@host/db"
    return obj.replace(
      /((?:mysql|postgres|postgresql|mongodb|redis|amqp|mssql|ftp|ssh):\/\/[^:]+:)([^@]+)(@)/gi,
      '$1********$3'
    );
  }
  
  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }
  
  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      
      // 敏感字段直接脱敏
      if (lowerKey.includes('password') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('passwd') ||
          lowerKey.includes('api_secret') ||
          lowerKey.includes('access_key') ||
          lowerKey.includes('master_key') ||
          lowerKey.includes('signing_key') ||
          lowerKey.includes('encryption_key')) {
        masked[key] = maskPassword(value as string);
      }
      else if (lowerKey.includes('token') ||
               lowerKey.includes('apikey') ||
               lowerKey.includes('api_key') ||
               lowerKey.includes('api-key') ||
               lowerKey.includes('accesskey') ||
               lowerKey.includes('access-key') ||
               lowerKey.includes('auth_token') ||
               lowerKey.includes('session_key')) {
        masked[key] = maskApiKey(value as string);
      }
      else if (lowerKey.includes('private') && lowerKey.includes('key')) {
        masked[key] = maskPrivateKey(value as string);
      }
      else if (lowerKey === 'key' || lowerKey.endsWith('_key') || lowerKey.includes('credential') ||
               lowerKey.includes('connection_string') || lowerKey.includes('connectionstring') ||
               lowerKey.includes('dsn')) {
        masked[key] = maskApiKey(value as string);
      }
      // 递归处理
      else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }
  
  return obj;
}

/**
 * 安全的日志输出函数 - 自动脱敏
 */
export function safeLog(...args: unknown[]): void {
  const maskedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return maskSensitiveData(arg);
    }
    return arg;
  });
  console.log(...maskedArgs);
}

export function safeError(...args: unknown[]): void {
  const maskedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return maskSensitiveData(arg);
    }
    return arg;
  });
  console.error(...maskedArgs);
}
