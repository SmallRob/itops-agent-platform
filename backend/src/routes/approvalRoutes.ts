import { Router, Request, Response } from 'express';
import db from '../models/database';
import { requireRole } from '../middleware/auth';
import { resumeWorkflow, rejectWorkflow } from '@services/workflow';
import type { ApprovalRequest } from '../types';

const router = Router();

// 查询审批列表
router.get('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { status, limit } = req.query;
    let query = 'SELECT * FROM approval_requests';
    const params: unknown[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit as string));
    }

    const approvals = db.prepare(query).all(...params) as ApprovalRequest[];
    res.json({ success: true, data: approvals });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch approvals' });
  }
});

// 查询待审批数量（用于前端角标）
router.get('/pending/count', requireRole('admin', 'operator'), (_req: Request, res: Response) => {
  try {
    const result = db.prepare("SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'").get() as { count: number };
    res.json({ success: true, data: { count: result.count } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to count pending approvals' });
  }
});

// 查询审批详情
router.get('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id) as ApprovalRequest | undefined;
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }
    res.json({ success: true, data: approval });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch approval' });
  }
});

// 审批通过
router.post('/:id/approve', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = (req as any).user?.id || 'unknown';

    const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as ApprovalRequest | undefined;
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Approval already ${approval.status}` });
    }

    // 异步恢复工作流，不阻塞响应
    res.json({ success: true, message: 'Approval granted, resuming workflow' });

    // 恢复工作流执行（异步）
    setImmediate(async () => {
      try {
        await resumeWorkflow(approval.task_id, id, userId, comment);
      } catch (error) {
        console.error('Failed to resume workflow:', error);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to approve' });
  }
});

// 审批拒绝
router.post('/:id/reject', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id || 'unknown';

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Reject reason is required' });
    }

    const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as ApprovalRequest | undefined;
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }

    if (approval.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Approval already ${approval.status}` });
    }

    // 异步拒绝工作流，不阻塞响应
    res.json({ success: true, message: 'Approval rejected, workflow terminated' });

    // 拒绝工作流（异步）
    setImmediate(async () => {
      try {
        await rejectWorkflow(approval.task_id, id, userId, reason);
      } catch (error) {
        console.error('Failed to reject workflow:', error);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reject' });
  }
});

export default router;
