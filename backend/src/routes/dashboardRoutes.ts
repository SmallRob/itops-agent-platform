import { Router, Request, Response } from 'express';
import db from '../models/database';
import { logger } from '../utils/logger';

const router = Router();

router.get('/stats', (_req: Request, res: Response) => {
  try {
    const serverStats = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM servers').get() as { total: number; enabled: number } | undefined;
    const agentStats = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM agents').get() as { total: number; enabled: number } | undefined;
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM tasks
    `).get() as { total: number; running: number; completed: number; failed: number; pending: number } | undefined;
    const alertStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN severity = 'critical' AND status = 'new' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' AND status = 'new' THEN 1 ELSE 0 END) as high
      FROM alerts
    `).get() as { total: number; active: number; critical: number; high: number } | undefined;
    const workflowCount = db.prepare('SELECT COUNT(*) as total, SUM(is_template) as templates FROM workflows').get() as { total: number; templates: number } | undefined;
    const knowledgeCount = db.prepare('SELECT COUNT(*) as total FROM knowledge_base').get() as { total: number } | undefined;

    if (!taskStats || !serverStats || !agentStats || !alertStats || !workflowCount || !knowledgeCount) {
      return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }

    const successRate = taskStats.total > 0
      ? parseFloat(((taskStats.completed / taskStats.total) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        servers: { total: serverStats.total || 0, enabled: serverStats.enabled || 0 },
        agents: { total: agentStats.total || 0, enabled: agentStats.enabled || 0 },
        tasks: {
          total: taskStats.total || 0,
          running: taskStats.running || 0,
          completed: taskStats.completed || 0,
          failed: taskStats.failed || 0,
          pending: taskStats.pending || 0,
          successRate,
        },
        alerts: {
          total: alertStats.total || 0,
          active: alertStats.active || 0,
          critical: alertStats.critical || 0,
          high: alertStats.high || 0,
        },
        workflows: { total: workflowCount.total || 0, templates: workflowCount.templates || 0 },
        knowledge: { total: knowledgeCount.total || 0 },
      },
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
});

router.get('/alert-trends', (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string, 10);

    const alerts = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', created_at) as time_bucket,
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low
      FROM alerts
      WHERE created_at >= datetime('now', ? || ' hours')
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `).all(`-${hoursNum}`);

    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Alert trends error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alert trends' });
  }
});

router.get('/task-trends', (req: Request, res: Response) => {
  try {
    const { hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string, 10);

    const tasks = db.prepare(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', created_at) as time_bucket,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
      FROM tasks
      WHERE created_at >= datetime('now', ? || ' hours')
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `).all(`-${hoursNum}`);

    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Task trends error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task trends' });
  }
});

router.get('/agent-stats', (_req: Request, res: Response) => {
  try {
    const agents = db.prepare(`
      SELECT 
        a.id, a.name, a.avatar, a.role, a.enabled, a.usage_count,
        (SELECT COUNT(*) FROM agent_executions ae WHERE ae.agent_id = a.id) as total_executions,
        (SELECT COUNT(*) FROM agent_executions ae WHERE ae.agent_id = a.id AND ae.status = 'success') as success_count,
        (SELECT COUNT(*) FROM agent_executions ae WHERE ae.agent_id = a.id AND ae.status = 'error') as error_count
      FROM agents a
      ORDER BY a.usage_count DESC
    `).all();

    const agentsWithRates = (agents as Array<{ total_executions?: number; success_count?: number; [key: string]: unknown }>).map(a => ({
      ...a,
      successRate: (a.total_executions || 0) > 0
        ? parseFloat((((a.success_count || 0) / (a.total_executions || 1)) * 100).toFixed(1))
        : null,
    }));

    const totalExecutions = agentsWithRates.reduce((sum, a) => sum + (a.total_executions || 0), 0);
    const totalSuccess = agentsWithRates.reduce((sum, a) => sum + (a.success_count || 0), 0);
    const overallSuccessRate = totalExecutions > 0
      ? parseFloat(((totalSuccess / totalExecutions) * 100).toFixed(1))
      : 0;

    const todayExecutions = db.prepare(`
      SELECT COUNT(*) as count FROM agent_executions
      WHERE created_at >= datetime('now', 'start of day')
    `).get() as { count: number } | undefined;

    res.json({
      success: true,
      data: {
        agents: agentsWithRates,
        overall: {
          totalExecutions,
          totalSuccess,
          overallSuccessRate,
          todayExecutions: todayExecutions?.count || 0,
        },
      },
    });
  } catch (error) {
    logger.error('Agent stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agent stats' });
  }
});

router.get('/task-distribution', (_req: Request, res: Response) => {
  try {
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks GROUP BY status
    `).all();

    const byWorkflow = db.prepare(`
      SELECT w.name, COUNT(*) as count
      FROM tasks t
      JOIN workflows w ON t.workflow_id = w.id
      GROUP BY t.workflow_id
      ORDER BY count DESC
      LIMIT 10
    `).all();

    res.json({ success: true, data: { byStatus, byWorkflow } });
  } catch (error) {
    logger.error('Task distribution error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task distribution' });
  }
});

router.get('/remediation-stats', (_req: Request, res: Response) => {
  try {
    const policyCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies').get() as { count: number };
    const enabledPolicyCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies WHERE enabled = 1').get() as { count: number };

    const todayExecutions = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE created_at >= datetime('now', 'start of day')
    `).get() as { count: number };

    const todaySuccess = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE status = 'success' AND created_at >= datetime('now', 'start of day')
    `).get() as { count: number };

    const todayFailed = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE status = 'failed' AND created_at >= datetime('now', 'start of day')
    `).get() as { count: number };

    const waitingApproval = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE status = 'waiting_approval'
    `).get() as { count: number };

    const rolledBack = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE status = 'rolled_back' AND created_at >= datetime('now', 'start of day')
    `).get() as { count: number };

    const avgDuration = db.prepare(`
      SELECT AVG(execution_duration_ms) as avg_ms FROM remediation_executions
      WHERE execution_duration_ms IS NOT NULL AND created_at >= datetime('now', 'start of day')
    `).get() as { avg_ms: number | null };

    const total = todayExecutions?.count || 0;
    const successCount = todaySuccess?.count || 0;
    const successRate = total > 0 ? parseFloat(((successCount / total) * 100).toFixed(1)) : 0;

    const recentExecutions = db.prepare(`
      SELECT re.id, re.status, re.status_reason, re.created_at,
             rp.name as policy_name, rp.execution_mode,
             a.title as alert_title, a.severity as alert_severity
      FROM remediation_executions re
      JOIN remediation_policies rp ON re.policy_id = rp.id
      LEFT JOIN alerts a ON re.alert_id = a.id
      ORDER BY re.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        total_policies: policyCount?.count || 0,
        enabled_policies: enabledPolicyCount?.count || 0,
        today: {
          total: total,
          success: successCount,
          failed: todayFailed?.count || 0,
          rolled_back: rolledBack?.count || 0,
          success_rate: successRate,
          avg_duration_ms: avgDuration?.avg_ms ? Math.round(avgDuration.avg_ms) : 0,
        },
        waiting_approval: waitingApproval?.count || 0,
        recent_executions: recentExecutions,
      },
    });
  } catch (error) {
    logger.error('Remediation stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch remediation stats' });
  }
});

router.get('/sla-stats', (_req: Request, res: Response) => {
  try {
    const completedTasks = db.prepare(`
      SELECT AVG(
        CAST(julianday(end_time) - julianday(created_at) AS REAL) * 24 * 60
      ) as avg_minutes
      FROM tasks
      WHERE status = 'completed' AND end_time IS NOT NULL
      AND created_at >= datetime('now', '-7 days')
    `).get() as { avg_minutes: number | null };

    const totalServers = db.prepare('SELECT COUNT(*) as count FROM servers WHERE enabled = 1').get() as { count: number };
    const activeServers = db.prepare(`
      SELECT COUNT(*) as count FROM servers
      WHERE enabled = 1 AND last_connected IS NOT NULL
      AND last_connected >= datetime('now', '-5 minutes')
    `).get() as { count: number };

    const avgResponseTime = db.prepare(`
      SELECT AVG(
        CAST(julianday(updated_at) - julianday(created_at) AS REAL) * 24 * 60 * 60
      ) as avg_seconds
      FROM alerts
      WHERE status IN ('confirmed', 'resolved', 'resolved_auto')
      AND updated_at IS NOT NULL
      AND created_at >= datetime('now', '-24 hours')
    `).get() as { avg_seconds: number | null };

    const todayAlerts = db.prepare(`
      SELECT COUNT(*) as count FROM alerts
      WHERE created_at >= datetime('now', 'start of day')
    `).get() as { count: number };

    const resolvedToday = db.prepare(`
      SELECT COUNT(*) as count FROM alerts
      WHERE status IN ('confirmed', 'resolved', 'resolved_auto')
      AND created_at >= datetime('now', 'start of day')
    `).get() as { count: number };

    const totalAlerts = todayAlerts?.count || 0;
    const resolvedCount = resolvedToday?.count || 0;
    const alertResolutionRate = totalAlerts > 0
      ? parseFloat(((resolvedCount / totalAlerts) * 100).toFixed(1))
      : 100;

    const uptime = totalServers.count > 0
      ? parseFloat((((activeServers?.count || 0) / totalServers.count) * 100).toFixed(2))
      : 100;

    const mttr = completedTasks?.avg_minutes
      ? parseFloat(completedTasks.avg_minutes.toFixed(1))
      : 0;

    const avgResponseSeconds = avgResponseTime?.avg_seconds
      ? parseFloat(avgResponseTime.avg_seconds.toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        mttr_minutes: mttr,
        uptime_percentage: uptime,
        avg_response_seconds: avgResponseSeconds,
        alert_resolution_rate: alertResolutionRate,
        total_alerts_today: totalAlerts,
        resolved_today: resolvedCount,
      },
    });
  } catch (error) {
    logger.error('SLA stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SLA stats' });
  }
});

router.get('/server-metrics', (_req: Request, res: Response) => {
  try {
    const enabledServers = db.prepare('SELECT id, name, hostname FROM servers WHERE enabled = 1 ORDER BY name LIMIT 10').all() as Array<{ id: string; name: string; hostname: string }>;

    if (enabledServers.length === 0) {
      return res.json({
        success: true,
        data: {
          servers: [],
          has_real_data: false,
          cpu_history: [],
          memory_history: [],
          network_history: [],
          disk_history: [],
        },
      });
    }

    const serverIds = enabledServers.map(s => s.id);
    const idPlaceholders = serverIds.map(() => '?').join(',');

    const latestMetricsRaw = db.prepare(`
      SELECT sm.server_id, s.name as server_name,
             sm.cpu_usage, sm.memory_usage, sm.disk_usage,
             sm.network_in_mbps, sm.network_out_mbps, sm.load_1min, sm.collected_at
      FROM server_metrics sm
      JOIN servers s ON sm.server_id = s.id
      WHERE sm.server_id IN (${idPlaceholders})
        AND sm.collected_at = (
          SELECT MAX(sm2.collected_at) FROM server_metrics sm2 WHERE sm2.server_id = sm.server_id
        )
    `).all(...serverIds) as Array<{
      server_id: string;
      server_name: string;
      cpu_usage: number | null;
      memory_usage: number | null;
      disk_usage: number | null;
      network_in_mbps: number | null;
      network_out_mbps: number | null;
      load_1min: number | null;
      collected_at: string | null;
    }>;

    const latestMetricsMap = new Map<string, typeof latestMetricsRaw[0]>();
    latestMetricsRaw.forEach(m => latestMetricsMap.set(m.server_id, m));

    const latestMetrics = enabledServers.map(server => {
      const metric = latestMetricsMap.get(server.id);
      return {
        server_id: server.id,
        server_name: server.name,
        cpu_usage: metric?.cpu_usage ?? null,
        memory_usage: metric?.memory_usage ?? null,
        disk_usage: metric?.disk_usage ?? null,
        network_in_mbps: metric?.network_in_mbps ?? null,
        network_out_mbps: metric?.network_out_mbps ?? null,
        load_1min: metric?.load_1min ?? null,
        collected_at: metric?.collected_at ?? null,
      };
    });

    const allHistory = db.prepare(`
      SELECT server_id, cpu_usage, memory_usage, disk_usage,
             COALESCE(network_in_mbps, 0) + COALESCE(network_out_mbps, 0) as network_value,
             collected_at as timestamp
      FROM server_metrics
      WHERE server_id IN (${idPlaceholders})
        AND collected_at >= datetime('now', '-30 minutes')
      ORDER BY server_id, collected_at ASC
    `).all(...serverIds) as Array<{
      server_id: string;
      cpu_usage: number | null;
      memory_usage: number | null;
      disk_usage: number | null;
      network_value: number;
      timestamp: string;
    }>;

    const cpuHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];
    const memoryHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];
    const networkHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];
    const diskHistory: Array<{ server_id: string; value: number; timestamp: string }> = [];

    allHistory.forEach(h => {
      if (h.cpu_usage !== null) cpuHistory.push({ server_id: h.server_id, value: h.cpu_usage, timestamp: h.timestamp });
      if (h.memory_usage !== null) memoryHistory.push({ server_id: h.server_id, value: h.memory_usage, timestamp: h.timestamp });
      diskHistory.push({ server_id: h.server_id, value: h.disk_usage ?? 0, timestamp: h.timestamp });
      networkHistory.push({ server_id: h.server_id, value: h.network_value, timestamp: h.timestamp });
    });

    res.json({
      success: true,
      data: {
        servers: latestMetrics,
        has_real_data: latestMetrics.some(m => m.cpu_usage !== null),
        cpu_history: cpuHistory,
        memory_history: memoryHistory,
        network_history: networkHistory,
        disk_history: diskHistory,
      },
    });
  } catch (error) {
    logger.error('Server metrics error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch server metrics' });
  }
});

router.get('/full', (_req: Request, res: Response) => {
  try {
    const serverStats = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM servers').get() as { total: number; enabled: number } | undefined;
    const agentStats = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM agents').get() as { total: number; enabled: number } | undefined;
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM tasks
    `).get() as { total: number; running: number; completed: number; failed: number; pending: number } | undefined;
    const alertStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN severity = 'critical' AND status = 'new' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN severity = 'high' AND status = 'new' THEN 1 ELSE 0 END) as high
      FROM alerts
    `).get() as { total: number; active: number; critical: number; high: number } | undefined;
    const workflowCount = db.prepare('SELECT COUNT(*) as total, SUM(is_template) as templates FROM workflows').get() as { total: number; templates: number } | undefined;
    const knowledgeCount = db.prepare('SELECT COUNT(*) as total FROM knowledge_base').get() as { total: number } | undefined;

    const recentTasks = db.prepare(`
      SELECT id, name, status, created_at, workflow_id, execution_order, node_results, current_node_id
      FROM tasks ORDER BY created_at DESC LIMIT 10
    `).all();

    const recentAlerts = db.prepare(`
      SELECT id, title, severity, status, created_at
      FROM alerts WHERE status = 'new' ORDER BY created_at DESC LIMIT 10
    `).all();

    const servers = db.prepare('SELECT id, name, hostname, enabled, last_connected FROM servers ORDER BY name').all();

    const taskSuccessRate = (taskStats?.total || 0) > 0
      ? parseFloat((((taskStats?.completed || 0) / (taskStats?.total || 1)) * 100).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        stats: {
          servers: { total: serverStats?.total || 0, enabled: serverStats?.enabled || 0 },
          agents: { total: agentStats?.total || 0, enabled: agentStats?.enabled || 0 },
          tasks: {
            total: taskStats?.total || 0,
            running: taskStats?.running || 0,
            completed: taskStats?.completed || 0,
            failed: taskStats?.failed || 0,
            pending: taskStats?.pending || 0,
            successRate: taskSuccessRate,
          },
          alerts: {
            total: alertStats?.total || 0,
            active: alertStats?.active || 0,
            critical: alertStats?.critical || 0,
            high: alertStats?.high || 0,
          },
          workflows: { total: workflowCount?.total || 0, templates: workflowCount?.templates || 0 },
          knowledge: { total: knowledgeCount?.total || 0 },
        },
        recentTasks,
        recentAlerts,
        servers,
      },
    });
  } catch (error) {
    logger.error('Full dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch full dashboard' });
  }
});

router.get('/alert-source-stats', (_req: Request, res: Response) => {
  try {
    const sourceStats = db.prepare(`
      SELECT 
        source,
        COUNT(*) as total_alerts,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_alerts,
        SUM(CASE WHEN status IN ('confirmed', 'in_progress') THEN 1 ELSE 0 END) as active_alerts,
        SUM(CASE WHEN status = 'resolved' OR status = 'resolved_auto' THEN 1 ELSE 0 END) as resolved_alerts,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_count,
        MIN(created_at) as first_alert,
        MAX(created_at) as last_alert
      FROM alerts
      GROUP BY source
      ORDER BY total_alerts DESC
    `).all();

    const webhookLogs = db.prepare(`
      SELECT 
        source,
        COUNT(*) as total_webhooks,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(processing_time_ms) as avg_processing_ms,
        MAX(created_at) as last_webhook
      FROM alert_webhook_logs
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY source
      ORDER BY total_webhooks DESC
    `).all();

    const last24h = db.prepare(`
      SELECT 
        source,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
      FROM alerts
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY source
    `).all();

    const totalAlerts = db.prepare('SELECT COUNT(*) as count FROM alerts').get() as { count: number } | undefined;
    const activeAlerts = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status IN ('new', 'confirmed', 'in_progress')").get() as { count: number } | undefined;

    res.json({
      success: true,
      data: {
        source_stats: sourceStats,
        webhook_logs_24h: webhookLogs,
        last_24h: last24h,
        total: totalAlerts?.count || 0,
        active: activeAlerts?.count || 0,
      },
    });
  } catch (error) {
    logger.error('Alert source stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alert source stats' });
  }
});

export default router;
