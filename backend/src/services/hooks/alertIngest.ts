/**
 * 告警落库与处置流水线（从 webhookRoutes 抽出，供 hooks 与各厂商 webhook 共用）
 * 职责：告警去重/落库 → 通知 → 设备关联 → RCA → 修复策略匹配执行 → WebSocket 广播
 */
import db, { getIOInstance } from '@models/database';
import { logger } from '@utils/logger';
import { randomUUID } from 'crypto';
import { createAuditLog } from '@services/audit';
import { createNotification } from '../../routes/notificationRoutes';
import { alertService } from '@services/alert';
import { remediationService } from '@services/ai';
import { alertDeviceResolver } from '@services/alert';
import { alertAutoAnalyzer } from '@services/alert';
import { NormalizedAlert } from '@services/alert';
import { emitToAlerts } from '../../websocket/handler';

export function processNormalizedAlert(
  alert: NormalizedAlert,
  sourceLabel: string
): { alertId: string; taskId: string | null; executionIds: string[]; status: 'created' | 'resolved' } {
  const io = getIOInstance();

  if (alert.status === 'resolved') {
    let updated = 0;
    if (alert.external_id) {
      const result = db.prepare(
        `UPDATE alerts SET status = 'resolved_auto', resolved_at = local_now(),
         resolved_by = 'auto', resolution_notes = ?
         WHERE metadata LIKE ? AND status IN ('new', 'confirmed', 'in_progress')`
      ).run(`Auto-resolved by ${sourceLabel}`, `%${alert.external_id}%`);
      updated = result.changes;
    }

    if (updated === 0 && alert.host) {
      db.prepare(
        `UPDATE alerts SET status = 'resolved_auto', resolved_at = local_now(),
         resolved_by = 'auto', resolution_notes = ?
         WHERE source = ? AND title LIKE ? AND status IN ('new', 'confirmed', 'in_progress')
         AND created_at >= datetime('now', '-24 hours')`
      ).run(`Auto-resolved by ${sourceLabel}`, alert.source, `%${alert.host}%`);
    }

    createAuditLog({
      action: 'alert_auto_resolved',
      resource_type: 'alert',
      details: { source: alert.source, title: alert.title, host: alert.host },
    });

    if (io) {
      io.emit('alert:resolved', { source: alert.source, title: alert.title, host: alert.host });
    }

    return { alertId: '', taskId: null, executionIds: [], status: 'resolved' };
  }

  const id = randomUUID();
  const severity = alert.severity;
  const title = alert.title;
  const content = alert.content;

  db.prepare(`
    INSERT INTO alerts (id, source, severity, title, content, metadata, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    alert.source,
    severity,
    title,
    content,
    JSON.stringify(alert.metadata),
    'new'
  );

  // ============================================================
  //  统一修复流水线: 修复策略匹配 + 设备关联 + RCA + WebSocket
  // ============================================================
  const executionIds: string[] = [];
  setImmediate(async () => {
    try {
      // ── 匹配修复策略并触发执行 ──
      const alertForMatching = {
        id,
        source: alert.source,
        severity,
        title,
        content: alert.content,
        tags: [] as string[],
      };
      if (alert.metadata?.tags) {
        alertForMatching.tags = Array.isArray(alert.metadata.tags) ? alert.metadata.tags : [];
      }

      if (io) {
        emitToAlerts(io, 'remediation:started', {
          alertId: id, title, timestamp: new Date().toISOString()
        });
      }

      // ── RCA ──
      if (severity === 'critical' || severity === 'high' || severity === 'disaster') {
        alertService.processDatabaseAlert(id);
      }

      // ── 设备关联 ──
      try {
        const assoc = alertDeviceResolver.resolve(id, title, content, alert.host, alert.source);
        if (assoc) {
          alertDeviceResolver.saveAssociation(id, assoc.device_type, assoc.device_id, assoc.match_method, assoc.confidence);
        }
      } catch (error) {
        logger.error(`[Webhook] 告警设备关联失败: ${error instanceof Error ? error.message : error}`);
      }

      // ── AI 自动分析（高优告警即时触发） ──
      if (severity === 'critical' || severity === 'high') {
        alertAutoAnalyzer.analyzeAlert(id).catch((err: Error) => {
          logger.error(`[Webhook] AI 自动分析失败: ${err.message}`);
        });
      }

      // ── 修复策略执行 ──
      const matchedPolicies = await remediationService.matchAlertToPolicies(alertForMatching);
      for (const policy of matchedPolicies) {
        logger.info(`🔧 [Webhook] 匹配到修复策略: ${policy.name}, 自动触发...`);
        const result = await remediationService.triggerRemediation(policy, alertForMatching);
        if (result.id) {
          executionIds.push(result.id);
        }
        if (io) {
          emitToAlerts(io, 'remediation:result', {
            alertId: id,
            policyId: policy.id,
            policyName: policy.name,
            executionId: result.id,
            status: result.status,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (io) {
        emitToAlerts(io, 'remediation:completed', {
          alertId: id,
          totalPolicies: matchedPolicies.length,
          timestamp: new Date().toISOString()
        });
      }

      if (matchedPolicies.length > 0) {
        logger.info(`✅ [Webhook] 已触发 ${matchedPolicies.length} 个修复策略 (alert: ${id}, executions: ${executionIds.join(',')})`);
      }
    } catch (error) {
      logger.error(`❌ [Webhook] 修复流水线异常: ${error instanceof Error ? error.message : error}`);
      if (io) {
        emitToAlerts(io, 'remediation:error', {
          alertId: id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  createNotification({
    type: 'alert',
    title: `新告警: ${title}`,
    content: content.substring(0, 200),
    related_alert_id: id,
  });

  createAuditLog({
    action: 'alert_received',
    resource_type: 'alert',
    resource_id: id,
    details: { source: alert.source, severity, title, executionIds },
  });

  if (io) {
    io.emit('alert:new', { id, source: alert.source, severity, title, content, executionIds, host: alert.host });
  }

  return { alertId: id, taskId: executionIds[0] || null, executionIds, status: 'created' };
}
