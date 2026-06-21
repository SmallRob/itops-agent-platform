import { randomUUID } from 'crypto';
import db from '../models/database';

export const createAuditLog = (data: {
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}): string | null => {
  try {
    const id = randomUUID();

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.user_id || null,
      data.action,
      data.resource_type,
      data.resource_id || null,
      data.details ? JSON.stringify(data.details) : null,
      data.ip_address || null
    );

    return id;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return null;
  }
};