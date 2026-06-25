import db from '@models/database';
import { randomUUID, createHash } from 'crypto';
import { logger } from '@utils/logger';

interface AlertNoiseRecord {
  id: string;
  alert_fingerprint: string;
  alert_source: string;
  alert_title: string;
  occurrence_count: number;
  first_occurrence: Date;
  last_occurrence: Date;
  is_suppressed: boolean;
  suppression_reason?: string;
  suppression_until?: Date;
}

class AlertNoiseReductionService {
  generateFingerprint(source: string, title: string, _content?: string): string {
    const normalizedTitle = title.toLowerCase().replace(/[\d\s_-]+/g, ' ').trim();
    const normalizedSource = source.toLowerCase();
    const fingerprint = `${normalizedSource}:${normalizedTitle}`;
    return createHash('md5').update(fingerprint).digest('hex');
  }

  async processAlert(
    source: string,
    title: string,
    content?: string,
    severity?: string
  ): Promise<{
    shouldNotify: boolean;
    isDuplicate: boolean;
    suppressionReason?: string;
    occurrenceCount: number;
  }> {
    const fingerprint = this.generateFingerprint(source, title, content);
    const now = new Date();

    const existing = db.prepare(
      'SELECT * FROM alert_noise_reduction WHERE alert_fingerprint = ?'
    ).get(fingerprint) as AlertNoiseRecord | null;

    if (existing) {
      return this.handleExistingRecord(existing, fingerprint, now, severity);
    }

    return this.handleNewRecord(source, title, fingerprint, now, severity);
  }

  private handleExistingRecord(
    existing: AlertNoiseRecord,
    fingerprint: string,
    now: Date,
    severity?: string
  ): {
    shouldNotify: boolean;
    isDuplicate: boolean;
    suppressionReason?: string;
    occurrenceCount: number;
  } {
    const isSuppressed = existing.is_suppressed &&
      (!existing.suppression_until || new Date(existing.suppression_until) > now);

    const newCount = existing.occurrence_count + 1;
    db.prepare(
      `UPDATE alert_noise_reduction SET occurrence_count = ?, last_occurrence = ? WHERE alert_fingerprint = ?`
    ).run(newCount, now.toISOString(), fingerprint);

    const shouldSuppress = this.shouldSuppressAlert(existing, severity);

    if (shouldSuppress && !isSuppressed) {
      db.prepare(
        `UPDATE alert_noise_reduction SET is_suppressed = 1, suppression_reason = ?, suppression_until = ? WHERE alert_fingerprint = ?`
      ).run(
        '频繁告警自动抑制',
        new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        fingerprint
      );
    }

    return {
      shouldNotify: !isSuppressed && !shouldSuppress,
      isDuplicate: true,
      suppressionReason: isSuppressed ? existing.suppression_reason : undefined,
      occurrenceCount: newCount
    };
  }

  private handleNewRecord(
    source: string,
    title: string,
    fingerprint: string,
    now: Date,
    severity?: string
  ): {
    shouldNotify: boolean;
    isDuplicate: boolean;
    suppressionReason?: string;
    occurrenceCount: number;
  } {
    const result = db.prepare(
      `INSERT OR IGNORE INTO alert_noise_reduction (id, alert_fingerprint, alert_source, alert_title, occurrence_count, first_occurrence, last_occurrence) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      fingerprint,
      source,
      title,
      1,
      now.toISOString(),
      now.toISOString()
    );

    if (result.changes === 0) {
      return this.handleExistingRecord(
        db.prepare('SELECT * FROM alert_noise_reduction WHERE alert_fingerprint = ?').get(fingerprint) as AlertNoiseRecord,
        fingerprint,
        now,
        severity
      );
    }

    return {
      shouldNotify: true,
      isDuplicate: false,
      occurrenceCount: 1
    };
  }

  private shouldSuppressAlert(record: AlertNoiseRecord, severity?: string): boolean {
    if (severity === 'critical' || severity === 'high') {
      return false;
    }
    return record.occurrence_count >= 5;
  }

  getNoiseReductionStats(): {
    totalAlerts: number;
    suppressedAlerts: number;
    duplicateCount: number;
    noiseReductionRate: number;
  } {
    const stats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN is_suppressed = 1 THEN 1 ELSE 0 END) as suppressed,
             SUM(occurrence_count - 1) as duplicates
      FROM alert_noise_reduction
    `).get() as { total: number; suppressed: number; duplicates: number } | undefined;

    const total = stats?.total || 0;
    const suppressed = stats?.suppressed || 0;
    const duplicates = stats?.duplicates || 0;
    const noiseReductionRate = total > 0
      ? Math.round(((suppressed + duplicates) / (total + duplicates)) * 100)
      : 0;

    return { totalAlerts: total, suppressedAlerts: suppressed, duplicateCount: duplicates, noiseReductionRate };
  }

  getSuppressedAlerts(): AlertNoiseRecord[] {
    const records = db.prepare(
      `SELECT * FROM alert_noise_reduction WHERE is_suppressed = 1 ORDER BY last_occurrence DESC LIMIT 50`
    ).all() as Array<{
      id: string;
      alert_title: string;
      alert_content: string;
      alert_fingerprint: string;
      occurrence_count: number;
      first_occurrence: string;
      last_occurrence: string;
      is_suppressed: number;
      suppression_until: string | null;
    }>;

    return records.map(r => ({
      id: r.id,
      alert_fingerprint: r.alert_fingerprint,
      alert_source: '',
      alert_title: r.alert_title,
      occurrence_count: r.occurrence_count,
      first_occurrence: new Date(r.first_occurrence),
      last_occurrence: new Date(r.last_occurrence),
      is_suppressed: Boolean(r.is_suppressed),
      suppression_until: r.suppression_until ? new Date(r.suppression_until) : undefined
    }));
  }

  unsuppressAlert(fingerprint: string): boolean {
    const result = db.prepare(
      `UPDATE alert_noise_reduction SET is_suppressed = 0, suppression_reason = NULL, suppression_until = NULL WHERE alert_fingerprint = ?`
    ).run(fingerprint);
    return result.changes > 0;
  }

  cleanupOldRecords(daysToKeep: number = 30): number {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = db.prepare(
      `DELETE FROM alert_noise_reduction WHERE last_occurrence < ?`
    ).run(cutoffDate.toISOString());
    return result.changes;
  }

  manuallySuppressAlert(fingerprint: string, reason: string, durationMinutes: number = 60): boolean {
    const now = new Date();
    const suppressionUntil = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const result = db.prepare(
      `UPDATE alert_noise_reduction SET is_suppressed = 1, suppression_reason = ?, suppression_until = ? WHERE alert_fingerprint = ?`
    ).run(reason, suppressionUntil.toISOString(), fingerprint);
    return result.changes > 0;
  }
}

export const alertNoiseReductionService = new AlertNoiseReductionService();

// Auto-cleanup old records every 6 hours
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
setInterval(() => {
  const cleaned = alertNoiseReductionService.cleanupOldRecords(30);
  if (cleaned > 0) {
    logger.info(`Auto-cleaned ${cleaned} old alert noise reduction records`);
  }
}, CLEANUP_INTERVAL_MS).unref();
