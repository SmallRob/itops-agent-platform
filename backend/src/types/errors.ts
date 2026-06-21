export enum ErrorCode {
  SERVER_ERROR = 'SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  BUSINESS_ERROR = 'BUSINESS_ERROR'
}

export interface AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;
  isOperational?: boolean;
}

export function createAppError(
  code: ErrorCode,
  message: string,
  statusCode: number = 500,
  details?: Record<string, unknown>
): AppError {
  const error = new Error(message) as AppError;
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  error.isOperational = true;
  return error;
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.SERVER_ERROR]: '服务器内部错误，请稍后重试',
  [ErrorCode.VALIDATION_ERROR]: '请求参数验证失败',
  [ErrorCode.AUTH_ERROR]: '认证失败，请重新登录',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [ErrorCode.AUTH_TOKEN_INVALID]: '无效的认证令牌',
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: '权限不足，无法执行此操作',
  [ErrorCode.NOT_FOUND]: '请求的资源不存在',
  [ErrorCode.RESOURCE_NOT_FOUND]: '未找到指定的资源',
  [ErrorCode.DUPLICATE_RESOURCE]: '资源已存在，请勿重复创建',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求频率过高，请稍后重试',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: '外部服务调用失败',
  [ErrorCode.TIMEOUT_ERROR]: '请求超时，请稍后重试',
  [ErrorCode.INVALID_REQUEST]: '请求格式错误',
  [ErrorCode.BUSINESS_ERROR]: '业务处理失败'
};

export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.SERVER_ERROR;
}
