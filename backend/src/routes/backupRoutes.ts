import { Router, Request, Response } from 'express';
import { backupService } from '../services/backupService';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: '/tmp/itops-uploads/' });

router.get('/status', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const status = backupService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    logger.error('Failed to get backup status', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/config', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const config = backupService.getConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to get backup config', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/config', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const config = backupService.updateConfig(req.body);
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Failed to update backup config', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/history', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const history = backupService.getHistory();
    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Failed to get backup history', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/create', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const backup = await backupService.createBackup('manual');
    res.json({ success: true, data: backup });
  } catch (error) {
    logger.error('Failed to create backup', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    backupService.deleteBackup(req.params.id);
    res.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete backup', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/restore/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await backupService.restoreBackup(req.params.id);
    res.json({ 
      success: true, 
      message: 'Backup restored successfully',
      data: result
    });
  } catch (error) {
    logger.error('Failed to restore backup', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/download/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const filePath = backupService.getBackupFilePath(req.params.id);
    const fileName = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.download(filePath);
  } catch (error) {
    logger.error('Failed to download backup', error as Error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/upload', requireRole('admin'), upload.single('backup'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const backup = await backupService.uploadBackup(req.file.path, req.file.originalname);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.json({ success: true, data: backup });
  } catch (error) {
    logger.error('Failed to upload backup', error as Error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
