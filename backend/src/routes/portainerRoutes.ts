import { Router, Request, Response } from 'express';
import { portainerService } from '../services/portainerService';
import { logger } from '../utils/logger';

const router = Router();

router.get('/config', (_req: Request, res: Response) => {
  const config = portainerService.getConfig();
  res.json({
    success: true,
    data: {
      enabled: config.enabled,
      url: config.url,
    },
  });
});

router.put('/config', (req: Request, res: Response) => {
  try {
    const { enabled, url } = req.body;
    const config = portainerService.getConfig();
    portainerService.saveConfig({
      enabled: enabled ?? config.enabled,
      url: url ?? config.url,
    });
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    logger.error('Failed to save Portainer config:', error);
    res.status(500).json({ success: false, message: '保存配置失败' });
  }
});

export default router;
