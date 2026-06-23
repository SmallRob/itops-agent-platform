import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { createAuditLog } from '@services/audit';
import { schedulerService } from '@services/workflow';
import { requireRole } from '../middleware/auth';

interface ScheduledTaskRecord {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  workflow_id: string;
  enabled: number;
}

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const tasks = db.prepare(`
      SELECT st.*, w.name as workflow_name
      FROM scheduled_tasks st
      LEFT JOIN workflows w ON st.workflow_id = w.id
      ORDER BY st.created_at DESC
    `).all();
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = db.prepare(`
      SELECT st.*, w.name as workflow_name
      FROM scheduled_tasks st
      LEFT JOIN workflows w ON st.workflow_id = w.id
      WHERE st.id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, description, workflow_id, schedule, enabled = 1 } = req.body;
    
    if (!name || !schedule) {
      return res.status(400).json({ success: false, error: 'Name and cron expression are required' });
    }
    
    if (workflow_id) {
      const workflow = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflow_id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
    }
    
    const id = randomUUID();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO scheduled_tasks (id, name, description, workflow_id, schedule, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description || null, workflow_id || null, schedule, enabled ? 1 : 0, now, now);
    
    // 如果启用，则立即调度任务
    if (enabled) {
      schedulerService.scheduleTask({
        id,
        name,
        description,
        workflow_id,
        schedule,
        enabled: 1
      });
    }
    
    createAuditLog({
      user_id: 'system',
      action: 'create_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name, workflow_id, schedule }
    });
    
    res.status(201).json({ success: true, data: { id, name, description, workflow_id, schedule, enabled } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, workflow_id, schedule, enabled } = req.body;
    
    const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    
    if (workflow_id) {
      const workflow = db.prepare('SELECT id FROM workflows WHERE id = ?').get(workflow_id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }
    }
    
    const updates: string[] = [];
    const params: unknown[] = [];
    
    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (workflow_id !== undefined) {
      updates.push('workflow_id = ?');
      params.push(workflow_id);
    }
    if (schedule) {
      updates.push('schedule = ?');
      params.push(schedule);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString(), id);
      
      db.prepare(`UPDATE scheduled_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    
    // 更新调度器
    const updatedTask = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as ScheduledTaskRecord;
    schedulerService.updateTask(updatedTask);
    
    createAuditLog({
      user_id: 'system',
      action: 'update_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name, workflow_id, schedule, enabled }
    });
    
    res.json({ success: true, message: 'Scheduled task updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    
    // 从调度器中删除
    schedulerService.deleteTask(id);
    
    db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
    
    createAuditLog({
      user_id: 'system',
      action: 'delete_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name: (task as { name: string }).name }
    });
    
    res.json({ success: true, message: 'Scheduled task deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/toggle', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as { enabled: number };
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    
    const newEnabled = !task.enabled ? 1 : 0;
    db.prepare('UPDATE scheduled_tasks SET enabled = ?, updated_at = ? WHERE id = ?').run(newEnabled, new Date().toISOString(), id);
    
    schedulerService.updateTask(db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as ScheduledTaskRecord);
    
    createAuditLog({
      user_id: 'system',
      action: 'toggle_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { enabled: !!newEnabled }
    });
    
    res.json({ success: true, data: { enabled: !!newEnabled } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/run', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const task = db.prepare('SELECT id, name, workflow_id, schedule, enabled FROM scheduled_tasks WHERE id = ?').get(id) as {
      id: string;
      name: string;
      workflow_id: string;
      schedule: string;
      enabled: number;
    };
    if (!task) {
      return res.status(404).json({ success: false, error: 'Scheduled task not found' });
    }
    
    schedulerService.executeWorkflow(task);
    
    createAuditLog({
      user_id: 'system',
      action: 'manual_run_scheduled_task',
      resource_type: 'scheduled_task',
      resource_id: id,
      details: { name: task.name, manual_run: true }
    });
    
    res.json({ success: true, message: 'Task triggered manually' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
