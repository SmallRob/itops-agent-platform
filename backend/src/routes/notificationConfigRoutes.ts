import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import { logger } from '../utils/logger';
import { requireRole } from '../middleware/auth';
import { notificationService } from '@services/notification';
import { sendWeCom, sendDingTalk } from '@services/notification';
import nodemailer from 'nodemailer';
import { URL } from 'url';

const router = Router();

// SEC-038: Validate webhook URLs to prevent SSRF attacks
function isValidWebhookUrl(urlStr: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'Webhook URL must use http or https protocol' };
    }

    // Block private/internal IP ranges
    const hostname = parsed.hostname;
    const privatePatterns = [
      /^127\./,              // Loopback
      /^10\./,               // Class A private
      /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
      /^192\.168\./,         // Class C private
      /^0\./,                // Invalid
      /^169\.254\./,         // Link-local
      /^::1$/,               // IPv6 loopback
      /^fc00:/i,             // IPv6 private
      /^fe80:/i,             // IPv6 link-local
    ];

    if (privatePatterns.some(p => p.test(hostname))) {
      return { valid: false, reason: 'Webhook URL cannot point to private/internal addresses' };
    }

    // Block localhost
    if (/^localhost$/i.test(hostname)) {
      return { valid: false, reason: 'Webhook URL cannot point to localhost' };
    }

    // Block metadata endpoints
    if (/^169\.254\.169\.254$/.test(hostname)) {
      return { valid: false, reason: 'Webhook URL cannot point to cloud metadata endpoint' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

// 获取通知配置
router.get('/', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const configs = db.prepare('SELECT * FROM settings WHERE key LIKE ?').all('notification_%') as Array<{ key: string; value: string }>;
    
    const config: Record<string, unknown> = {};
    configs.forEach((c) => {
      const key = c.key.replace('notification_', '');
      try {
        config[key] = JSON.parse(c.value);
      } catch {
        config[key] = c.value;
      }
    });

    res.json({
      success: true,
      data: {
        webhook_enabled: config.webhook_enabled ?? true,
        email_enabled: config.email_enabled ?? false,
        wechat_enabled: config.wechat_enabled ?? false,
        dingtalk_enabled: config.dingtalk_enabled ?? false,
        email_config: config.email_config ?? {},
        wechat_config: config.wechat_config ?? {},
        dingtalk_config: config.dingtalk_config ?? {},
        alert_notification: config.alert_notification ?? {
          critical: true,
          warning: true,
          info: false
        },
        task_notification: config.task_notification ?? {
          success: true,
          failed: true,
          running: false
        }
      }
    });
  } catch (error) {
    logger.error('获取通知配置失败:', error);
    res.status(500).json({ success: false, error: '获取通知配置失败' });
  }
});

// 测试通知渠道
router.post('/test/:channel', requireRole('admin'), async (req: Request, res: Response) => {
  const { channel } = req.params;

  try {
    switch (channel) {
      case 'email': {
        const { smtp_host, smtp_port, user, password, to } = req.body;
        if (!smtp_host || !user) {
          return res.status(400).json({ success: false, error: 'SMTP 服务器和邮箱账号不能为空' });
        }
        const transporter = nodemailer.createTransport({
          host: smtp_host,
          port: smtp_port || 465,
          secure: (smtp_port || 465) === 465,
          auth: { user, pass: password || '' },
        });
        await transporter.sendMail({
          from: `"ITOps-Agent" <${user}>`,
          to: to || user,
          subject: '🔔 ITOps-Agent 自动化运维平台 - 通知渠道测试',
          text: '这是一封测试邮件，证明邮件通知配置正确。\n\n如果您收到此邮件，说明 SMTP 配置已生效。',
          html: '<h2>✅ 通知配置测试</h2><p>这是一封测试邮件，证明邮件通知配置正确。</p><hr/><small>ITOps-Agent 自动化运维平台</small>',
        });
        return res.json({ success: true, message: '测试邮件发送成功' });
      }

      case 'wechat': {
        const { webhook_url } = req.body;
        if (!webhook_url) {
          return res.status(400).json({ success: false, error: '企业微信 Webhook URL 不能为空' });
        }
        // SEC-038: Validate webhook URL to prevent SSRF
        const wecomUrlCheck = isValidWebhookUrl(webhook_url);
        if (!wecomUrlCheck.valid) {
          return res.status(400).json({ success: false, error: wecomUrlCheck.reason });
        }
        await sendWeCom(webhook_url, {
          title: '🔔 ITOps Agent - 通知渠道测试',
          content: '这是一条测试消息，证明企业微信通知配置正确。\n> 时间: ' + new Date().toLocaleString(),
          severity: 'info',
          source: 'ITOps Platform',
        });
        return res.json({ success: true, message: '企业微信测试消息发送成功' });
      }

      case 'dingtalk': {
        const { webhook_url } = req.body;
        if (!webhook_url) {
          return res.status(400).json({ success: false, error: '钉钉 Webhook URL 不能为空' });
        }
        // SEC-038: Validate webhook URL to prevent SSRF
        const dingtalkUrlCheck = isValidWebhookUrl(webhook_url);
        if (!dingtalkUrlCheck.valid) {
          return res.status(400).json({ success: false, error: dingtalkUrlCheck.reason });
        }
        await sendDingTalk(webhook_url, {
          title: '🔔 ITOps Agent - 通知渠道测试',
          content: '这是一条测试消息，证明钉钉通知配置正确。',
          severity: 'info',
          source: 'ITOps Platform',
        });
        return res.json({ success: true, message: '钉钉测试消息发送成功' });
      }

      default:
        return res.status(400).json({ success: false, error: `未知的通知渠道: ${channel}` });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`通知渠道测试失败 [${channel}]:`, error as Error);
    return res.status(500).json({ success: false, error: `测试失败: ${msg}` });
  }
});

// 更新通知配置
router.put('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      webhook_enabled,
      email_enabled,
      wechat_enabled,
      dingtalk_enabled,
      email_config,
      wechat_config,
      dingtalk_config,
      alert_notification,
      task_notification
    } = req.body;

    const updates = [
      { key: 'notification_webhook_enabled', value: JSON.stringify(webhook_enabled) },
      { key: 'notification_email_enabled', value: JSON.stringify(email_enabled) },
      { key: 'notification_wechat_enabled', value: JSON.stringify(wechat_enabled) },
      { key: 'notification_dingtalk_enabled', value: JSON.stringify(dingtalk_enabled) },
      { key: 'notification_email_config', value: JSON.stringify(email_config) },
      { key: 'notification_wechat_config', value: JSON.stringify(wechat_config) },
      { key: 'notification_dingtalk_config', value: JSON.stringify(dingtalk_config) },
      { key: 'notification_alert_notification', value: JSON.stringify(alert_notification) },
      { key: 'notification_task_notification', value: JSON.stringify(task_notification) }
    ];

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now','localtime'))
    `);

    updates.forEach(update => {
      stmt.run(update.key, update.value);
    });

    res.json({
      success: true,
      message: '通知配置已更新'
    });
  } catch (error) {
    logger.error('更新通知配置失败:', error);
    res.status(500).json({ success: false, error: '更新通知配置失败' });
  }
});

export default router;
