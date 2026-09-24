/**
 * Skills 路由：技能清单 / 详情 / 重载 / 启停 / 工具视图 / 意图匹配 / zip 安装卸载
 * 技能目录即插件：新增或删除目录后调用 reload 即完成动态插拔；
 * zip 安装与卸载会自动重载注册表（对齐 openocta marketplace 的分发方式）。
 */
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { logger } from '../utils/logger';
import { createAuditLog } from '@services/audit';
import {
  skillRegistry,
  installSkillPackage,
  uninstallSkill,
  MAX_SKILL_PACKAGE_SIZE,
} from '@services/skills';
import { requireRole } from '../middleware/auth';

const router = Router();

/** 技能包走内存接收（zip 体积小，避免落临时文件带来的清理负担） */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SKILL_PACKAGE_SIZE, files: 1 },
});

// 技能列表
router.get('/', (req: Request, res: Response) => {
  const includeDisabled = req.query.all === '1';
  res.json({
    success: true,
    data: {
      skillsDir: skillRegistry.getSkillsDir(),
      loadedAt: skillRegistry.getLoadedAt(),
      skills: skillRegistry.list(includeDisabled),
      errors: skillRegistry.getErrors(),
    },
  });
});

// 工具视图（供 Agent / 工作流节点编排使用）
router.get('/tools', (_req: Request, res: Response) => {
  res.json({ success: true, data: skillRegistry.listTools() });
});

// 意图匹配（输入自然语言，返回应装载的技能）
router.post('/match', (req: Request, res: Response) => {
  const query = String(req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({ success: false, error: '缺少 query' });
  }
  const limit = Math.min(Math.max(Number(req.body?.limit) || 3, 1), 10);
  res.json({ success: true, data: skillRegistry.match(query, limit) });
});

// 安装技能包（zip 上传，admin）：?overwrite=1 覆盖同名技能
router.post('/install', requireRole('admin'), (req: Request, res: Response) => {
  upload.single('file')(req, res, (uploadError: unknown) => {
    if (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : '上传失败';
      return res.status(400).json({ success: false, error: `技能包上传失败：${message}` });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        error: `缺少技能包文件（multipart 字段名 file，仅支持 zip，最大 ${Math.round(MAX_SKILL_PACKAGE_SIZE / 1024 / 1024)}MB）`,
      });
    }

    const overwrite = req.query.overwrite === '1' || req.body?.overwrite === '1' || req.body?.overwrite === true;
    try {
      const result = installSkillPackage(req.file.buffer, { overwrite });
      createAuditLog({
        action: 'skill_install',
        resource_type: 'skill',
        resource_id: result.slug,
        details: {
          overwritten: result.overwritten,
          files: result.files,
          version: result.manifest.version,
          filename: req.file.originalname,
        },
        ip_address: req.ip,
      });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : '安装失败';
      logger.warn(`[skills] 技能包安装失败：${message}`);
      res.status(400).json({ success: false, error: message });
    }
  });
});

// 卸载技能（删除技能目录 + 重载注册表，admin）
router.delete('/:slug', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const result = uninstallSkill(req.params.slug);
    createAuditLog({
      action: 'skill_uninstall',
      resource_type: 'skill',
      resource_id: result.slug,
      details: { removedFiles: result.removedFiles },
      ip_address: req.ip,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '卸载失败';
    logger.warn(`[skills] 技能卸载失败：${message}`);
    res.status(400).json({ success: false, error: message });
  }
});

// 重新装载（动态插拔）
router.post('/reload', requireRole('admin'), (req: Request, res: Response) => {
  const result = skillRegistry.reload();
  createAuditLog({
    action: 'skills_reload',
    resource_type: 'skill',
    resource_id: 'all',
    details: { loaded: result.loaded, errors: result.errors.length, skillsDir: result.skillsDir },
    ip_address: req.ip,
  });
  res.json({ success: true, data: result });
});

// 启用 / 停用
router.post('/:slug/toggle', requireRole('admin'), (req: Request, res: Response) => {
  const enabled = req.body?.enabled !== false;
  try {
    const manifest = skillRegistry.setEnabled(req.params.slug, enabled);
    createAuditLog({
      action: enabled ? 'skill_enabled' : 'skill_disabled',
      resource_type: 'skill',
      resource_id: req.params.slug,
      details: { enabled },
      ip_address: req.ip,
    });
    res.json({ success: true, data: manifest });
  } catch (error) {
    const message = error instanceof Error ? error.message : '操作失败';
    logger.warn(`[skills] 启停失败：${message}`);
    res.status(404).json({ success: false, error: message });
  }
});

// 技能详情
router.get('/:slug', (req: Request, res: Response) => {
  const manifest = skillRegistry.get(req.params.slug);
  if (!manifest) {
    return res.status(404).json({ success: false, error: `技能不存在：${req.params.slug}` });
  }
  res.json({ success: true, data: manifest });
});

export default router;