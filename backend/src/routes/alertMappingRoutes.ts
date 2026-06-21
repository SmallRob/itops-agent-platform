import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const mappings = db.prepare(`
      SELECT am.*, w.name as workflow_name
      FROM alert_workflow_mappings am
      LEFT JOIN workflows w ON am.workflow_id = w.id
      ORDER BY am.created_at DESC
    `).all();
    res.json({ success: true, data: mappings });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert workflow mappings' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mapping = db.prepare(`
      SELECT am.*, w.name as workflow_name
      FROM alert_workflow_mappings am
      LEFT JOIN workflows w ON am.workflow_id = w.id
      WHERE am.id = ?
    `).get(id);
    
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }
    
    res.json({ success: true, data: mapping });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch alert workflow mapping' });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { alert_source, alert_severity, alert_title_pattern, workflow_id, enabled = 1 } = req.body;
    
    if (!workflow_id) {
      return res.status(400).json({ success: false, error: 'Workflow ID is required' });
    }
    
    const workflow = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflow_id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }
    
    const id = randomUUID();
    
    db.prepare(`
      INSERT INTO alert_workflow_mappings (id, alert_source, alert_severity, alert_title_pattern, workflow_id, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, alert_source || null, alert_severity || null, alert_title_pattern || null, workflow_id, enabled ? 1 : 0);
    
    res.status(201).json({ success: true, data: { id, alert_source, alert_severity, alert_title_pattern, workflow_id, enabled } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create alert workflow mapping' });
  }
});

router.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { alert_source, alert_severity, alert_title_pattern, workflow_id, enabled } = req.body;
    
    const mapping = db.prepare('SELECT * FROM alert_workflow_mappings WHERE id = ?').get(id);
    if (!mapping) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }
    
    if (workflow_id) {
      const workflow = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflow_id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
    }
    
    const updates: string[] = [];
    const params: unknown[] = [];
    
    if (alert_source !== undefined) {
      updates.push('alert_source = ?');
      params.push(alert_source);
    }
    if (alert_severity !== undefined) {
      updates.push('alert_severity = ?');
      params.push(alert_severity);
    }
    if (alert_title_pattern !== undefined) {
      updates.push('alert_title_pattern = ?');
      params.push(alert_title_pattern);
    }
    if (workflow_id) {
      updates.push('workflow_id = ?');
      params.push(workflow_id);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    
    if (updates.length > 0) {
      params.push(id);
      db.prepare(`UPDATE alert_workflow_mappings SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    res.json({ success: true, message: 'Alert workflow mapping updated' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update alert workflow mapping' });
  }
});

router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = db.prepare('DELETE FROM alert_workflow_mappings WHERE id = ?').run(id);
    
    if ((result as { changes: number }).changes === 0) {
      return res.status(404).json({ success: false, error: 'Alert workflow mapping not found' });
    }
    
    res.json({ success: true, message: 'Alert workflow mapping deleted' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete alert workflow mapping' });
  }
});

export default router;
