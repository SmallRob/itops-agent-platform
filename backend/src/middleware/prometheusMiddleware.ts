/**
 * Prometheus HTTP 指标中间件
 *
 * 自动拦截 Express 请求并记录 HTTP 请求次数和耗时指标。
 * 挂载到 Express app 后，所有经过的请求都会被自动计量。
 *
 * 用法:
 *   import { prometheusMiddleware, metricsEndpoint } from './middleware/prometheusMiddleware';
 *   app.use(prometheusMiddleware);
 *   app.get('/metrics', metricsEndpoint);
 */

import { Request, Response, NextFunction } from 'express';
import { prometheusMetrics } from '../services/monitoring/prometheusMetrics';

// ===== 路径归一化 =====

/**
 * 将请求路径归一化，避免高基数标签导致 Prometheus 指标爆炸。
 * 例如: /api/agents/123 -> /api/agents/:id
 *
 * @param path - 原始请求路径
 * @returns 归一化后的路径
 */
function normalizePath(path: string): string {
  // 移除查询参数
  const cleanPath = path.split('?')[0];

  // 将 UUID / 数字 ID 替换为 :id
  return cleanPath
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    )
    .replace(/\/\d+/g, '/:id');
}

// ===== Express 中间件 =====

/**
 * Prometheus HTTP 请求指标中间件
 *
 * 记录每个请求的方法、路径、状态码和耗时。
 * 指标名:
 *   - itops_http_requests_total (Counter)
 *   - itops_http_request_duration_ms (Histogram)
 */
export function prometheusMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  const path = normalizePath(req.originalUrl || req.url);

  // 响应完成时记录指标
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const status = String(res.statusCode);

    prometheusMetrics.recordHttpRequest(method, path, status, durationMs);
  });

  next();
}

// ===== Metrics 端点 =====

/**
 * /metrics 端点处理函数
 *
 * 返回当前所有 Prometheus 指标的文本格式数据。
 * 建议注册方式: app.get('/metrics', metricsEndpoint);
 */
export async function metricsEndpoint(_req: Request, res: Response): Promise<void> {
  try {
    const metrics = await prometheusMetrics.getMetrics();
    const contentType = prometheusMetrics.getContentType();

    res.setHeader('Content-Type', contentType);
    res.status(200).end(metrics);
  } catch (error) {
    res.status(500).end('Error collecting metrics');
  }
}
