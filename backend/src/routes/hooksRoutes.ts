/**
 * Hooks 路由（借鉴 openocta /hooks/*）
 *   POST /api/hooks/alert/:source  异构告警入站（prometheus/zabbix/grafana/aliyun/tencent/generic）
 *   POST /api/hooks/agent          隔离 Agent 回合（可指定 sessionKey/model/provider）
 *   POST /api/hooks/wake           事件注入（可选触发 Agent 摘要）
 *   GET  /api/hooks/sources        可用来源与标准化能力
 *
 * 认证：外部系统用 X-Hook-Token（与 HOOKS_TOKEN 比对，未配置时回退 WEBHOOK_SECRET）；
 *       平台前端用管理员会话 JWT（配置了 HOOKS_TOKEN 也不影响，见 authorizeHook）。
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { createAuditLog } from '@services/audit';
import { hookService } from '@services/hooks';
import type { HookSource } from '@services/hooks';

const router = Router();

const VALID_SOURCES: HookSource[] = ['prometheus', 'zabbix', 'grafana', 'aliyun', 'tencent', 'generic'];

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

/**
 * 校验 Hook 令牌或平台管理员会话
 *
 * 两类调用方：
 *  ① 外部系统（Prometheus 等）：携带 X-Hook-Token，与 HOOKS_TOKEN（回退 WEBHOOK_SECRET）精确比对；
 *  ② 平台前端（能力中心 → Hooks 接入）：携带管理员 Bearer JWT。
 *
 * 注意：配置 HOOKS_TOKEN 后**不能**只认令牌——否则界面读取来源列表必然 401，
 * 而该 401 会触发前端 token 刷新（刷新令牌单次轮换），进而把用户异常踢回登录页。
 */
function authorizeHook(req: Request): { ok: boolean; reason?: string } {
  const configured = process.env.HOOKS_TOKEN || process.env.WEBHOOK_SECRET;
  const hookToken =
    (req.headers['x-hook-token'] as string) || (req.headers['x-webhook-secret'] as string) || '';
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : '';

  // ① 外部系统：令牌精确比对（常量时间）
  //    支持三种携带方式：X-Hook-Token / X-Webhook-Secret / Authorization: Bearer <HOOKS_TOKEN>
  //    （Alertmanager 等组件的 webhook http_config 只能配置 authorization，不能自定义请求头）
  for (const candidate of [hookToken, bearer]) {
    if (configured && candidate && safeEqual(candidate, configured)) return { ok: true };
  }

  // ② 平台管理员会话（hooks 路由挂在 authenticateToken 之前，此处自行校验 JWT）
  if (bearer) {
    try {
      const payload = jwt.verify(bearer, env.JWT_SECRET) as { role?: string };
      if (payload?.role === 'admin') return { ok: true };
      return { ok: false, reason: '需要管理员权限（或提供正确的 X-Hook-Token）' };
    } catch {
      // Bearer 不是合法 JWT：继续按「令牌不匹配」处理，避免暴露具体失败原因
    }
  }

  if (configured) return { ok: false, reason: '令牌校验失败' };
  return {
    ok: false,
    reason: '缺少凭据：请提供 X-Hook-Token，或配置 HOOKS_TOKEN 后由外部系统调用',
  };
}

function rejectUnauthorized(req: Request, res: Response, reason?: string) {
  createAuditLog({
    action: 'hook_auth_failed',
    resource_type: 'hook',
    details: { path: req.path, ip: req.ip },
  });
  res.status(401).json({ success: false, error: reason || 'Unauthorized' });
}

// 可用来源
router.get('/sources', (req: Request, res: Response) => {
  const auth = authorizeHook(req);
  if (!auth.ok) return rejectUnauthorized(req, res, auth.reason);
  res.json({ success: true, data: hookService.sources() });
});

// 告警入站（按来源标准化）
router.post('/alert/:source', async (req: Request, res: Response) => {
  const auth = authorizeHook(req);
  if (!auth.ok) return rejectUnauthorized(req, res, auth.reason);

  const source = req.params.source as HookSource;
  if (!VALID_SOURCES.includes(source)) {
    return res.status(400).json({
      success: false,
      error: `不支持的来源：${source}（可用：${VALID_SOURCES.join('/')}）`,
    });
  }

  try {
    const result = await hookService.ingestAlert(source, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '处理失败';
    logger.error(`[hooks] 告警入站失败（${source}）：${message}`);
    res.status(500).json({ success: false, error: message });
  }
});

// Agent 隔离回合
router.post('/agent', async (req: Request, res: Response) => {
  const auth = authorizeHook(req);
  if (!auth.ok) return rejectUnauthorized(req, res, auth.reason);

  const message = String(req.body?.message || '').trim();
  if (!message) {
    return res.status(400).json({ success: false, error: '缺少 message' });
  }

  try {
    const result = await hookService.ingestAgent({ ...req.body, message });
    res.json({ success: result.errors.length === 0, data: result });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : '处理失败';
    res.status(500).json({ success: false, error: errMessage });
  }
});

// 事件唤醒
router.post('/wake', async (req: Request, res: Response) => {
  const auth = authorizeHook(req);
  if (!auth.ok) return rejectUnauthorized(req, res, auth.reason);

  const text = String(req.body?.text || '').trim();
  if (!text) {
    return res.status(400).json({ success: false, error: '缺少 text' });
  }

  try {
    const result = await hookService.ingestWake({ ...req.body, text });
    res.json({ success: true, data: result });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : '处理失败';
    res.status(500).json({ success: false, error: errMessage });
  }
});

export default router;