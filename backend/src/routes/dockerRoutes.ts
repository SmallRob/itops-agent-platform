/**
 * Docker 资源管理路由
 * 读接口：登录用户可用；写接口：仅管理员（requireRole('admin')）并写入审计日志
 */
import { Router, Request, Response } from 'express';
import { dockerService, DockerEngineError } from '@services/docker';
import { createAuditLog } from '@services/audit';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';

const router = Router();

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof DockerEngineError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[docker] ${context} 失败:`, error);
  res.status(500).json({ success: false, error: `${context}失败` });
}

/** 写操作统一审计留痕 */
function audit(
  req: Request & { user?: { id?: string } },
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>
): void {
  createAuditLog({
    user_id: req.user?.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    ip_address: req.ip,
  });
}

/** 解析目标主机：local（本机）或 servers 表中的服务器 id */
function resolveHost(req: Request): string {
  const server = String(req.query.server || '').trim();
  return server || 'local';
}

// Docker 可用状态
router.get('/status', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dockerService.getStatus() });
  } catch (error) {
    handleError(res, error, '获取 Docker 状态');
  }
});

// 可选主机清单（本机 + 已接入的 Linux 服务器）
router.get('/hosts', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dockerService.listHosts() });
  } catch (error) {
    handleError(res, error, '获取主机列表');
  }
});

// 统计概览（镜像数/总大小/容器数/卷/网络）
router.get('/overview', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dockerService.getOverview(resolveHost(req)) });
  } catch (error) {
    handleError(res, error, '获取 Docker 概览');
  }
});

// 镜像列表
router.get('/images', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dockerService.listImages(resolveHost(req)) });
  } catch (error) {
    handleError(res, error, '获取镜像列表');
  }
});

// 容器列表（?all=0 仅运行中）
router.get('/containers', async (req: Request, res: Response) => {
  try {
    const all = req.query.all !== '0';
    res.json({ success: true, data: await dockerService.listContainers(all, resolveHost(req)) });
  } catch (error) {
    handleError(res, error, '获取容器列表');
  }
});

// 卷列表
router.get('/volumes', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dockerService.listVolumes() });
  } catch (error) {
    handleError(res, error, '获取卷列表');
  }
});

// 网络列表
router.get('/networks', async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await dockerService.listNetworks() });
  } catch (error) {
    handleError(res, error, '获取网络列表');
  }
});

// 容器日志
router.get('/containers/:id/logs', async (req: Request, res: Response) => {
  try {
    const tail = Number(req.query.tail ?? 200);
    res.json({ success: true, data: await dockerService.getContainerLogs(req.params.id, tail, resolveHost(req)) });
  } catch (error) {
    handleError(res, error, '获取容器日志');
  }
});

// ============================================================
// 写操作（仅管理员 + 审计）
// ============================================================

// 拉取镜像
router.post('/images/pull', requireRole('admin'), async (req: Request, res: Response) => {
  const ref = String(req.body?.ref || '').trim();
  const host = resolveHost(req);
  if (!ref) {
    return res.status(400).json({ success: false, error: '缺少镜像引用（如 nginx:latest）' });
  }
  try {
    const result = await dockerService.pullImage(ref, host);
    audit(req, 'docker.image.pull', 'docker_image', result.ref, { ref: result.ref, status: result.status, host });
    res.json({ success: true, data: result });
  } catch (error) {
    audit(req, 'docker.image.pull', 'docker_image', ref, { ref, host, failed: true });
    handleError(res, error, '拉取镜像');
  }
});

// 删除镜像
router.delete('/images/:id', requireRole('admin'), async (req: Request, res: Response) => {
  const force = req.query.force === '1';
  const host = resolveHost(req);
  try {
    const result = await dockerService.removeImage(req.params.id, force, host);
    audit(req, 'docker.image.remove', 'docker_image', result.id, { force, host });
    res.json({ success: true, data: result });
  } catch (error) {
    audit(req, 'docker.image.remove', 'docker_image', req.params.id, { force, host, failed: true });
    handleError(res, error, '删除镜像');
  }
});

// 容器操作：启动 / 停止 / 重启
router.post('/containers/:id/:action(start|stop|restart)', requireRole('admin'), async (req: Request, res: Response) => {
  const { id, action } = req.params as { id: string; action: 'start' | 'stop' | 'restart' };
  const host = resolveHost(req);
  try {
    const result = await dockerService.containerAction(id, action, host);
    audit(req, `docker.container.${action}`, 'docker_container', id, { container: id, action, host });
    res.json({ success: true, data: result });
  } catch (error) {
    audit(req, `docker.container.${action}`, 'docker_container', id, { container: id, action, host, failed: true });
    handleError(res, error, `容器${action}`);
  }
});

export default router;