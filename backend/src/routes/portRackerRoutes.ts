import { Router, Request, Response } from 'express';
import { portRackerService } from '../services/portRackerService';
import { logger } from '../utils/logger';

const router = Router();

router.get('/config', (_req: Request, res: Response) => {
  const config = portRackerService.getConfig();
  res.json({
    success: true,
    data: {
      enabled: config.enabled,
      apiUrl: config.apiUrl,
      directUrl: config.directUrl,
      hasApiKey: !!config.apiKey,
    },
  });
});

router.put('/config', (req: Request, res: Response) => {
  try {
    const { enabled, apiUrl, apiKey, directUrl } = req.body;
    const config = portRackerService.getConfig();
    portRackerService.saveConfig({
      enabled: enabled ?? config.enabled,
      apiUrl: apiUrl ?? config.apiUrl,
      apiKey: apiKey ?? config.apiKey,
      directUrl: directUrl ?? config.directUrl,
    });
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    logger.error('Failed to save PortRacker config:', error);
    res.status(500).json({ success: false, message: '保存配置失败' });
  }
});

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await portRackerService.healthCheck();
    res.json({ success: true, data: result });
  } catch (error) {
    res.json({ success: true, data: { reachable: false } });
  }
});

router.get('/ports', async (_req: Request, res: Response) => {
  try {
    const data = await portRackerService.getPorts();
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('PortRacker getPorts failed:', error.message);
    res.status(502).json({ success: false, message: '获取端口数据失败', error: error.message });
  }
});

router.get('/all-ports', async (_req: Request, res: Response) => {
  try {
    const data = await portRackerService.getAllPorts();
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('PortRacker getAllPorts failed:', error.message);
    res.status(502).json({ success: false, message: '获取端口数据失败', error: error.message });
  }
});

router.get('/services', async (_req: Request, res: Response) => {
  try {
    const data = await portRackerService.getServices();
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('PortRacker getServices failed:', error.message);
    res.status(502).json({ success: false, message: '获取服务数据失败', error: error.message });
  }
});

router.get('/servers', async (_req: Request, res: Response) => {
  try {
    const data = await portRackerService.getServers();
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('PortRacker getServers failed:', error.message);
    res.status(502).json({ success: false, message: '获取服务器数据失败', error: error.message });
  }
});

router.get('/ping', async (req: Request, res: Response) => {
  try {
    const { host, port } = req.query;
    if (!host || !port) {
      return res.status(400).json({ success: false, message: '缺少 host 或 port 参数' });
    }
    const data = await portRackerService.pingPort(host as string, Number(port));
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('PortRacker ping failed:', error.message);
    res.status(502).json({ success: false, message: '端口探测失败', error: error.message });
  }
});

router.post('/servers/:serverId/scan', async (req: Request, res: Response) => {
  try {
    const data = await portRackerService.scanServer(req.params.serverId);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('PortRacker scan failed:', error.message);
    res.status(502).json({ success: false, message: '扫描失败', error: error.message });
  }
});

router.get('/version', async (_req: Request, res: Response) => {
  try {
    const data = await portRackerService.getVersion();
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(502).json({ success: false, message: '获取版本失败', error: error.message });
  }
});

export default router;
