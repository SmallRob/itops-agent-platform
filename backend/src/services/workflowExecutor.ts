import { randomUUID } from 'crypto';
import db, { getIOInstance } from '../models/database';
import { logger } from '../utils/logger';
import { executeAgentNode, getThinkingSteps } from './agentExecutor';
import { reportService } from './reportService';
import { notificationService } from './notificationService';
import { createAuditLog } from './auditService';
import {
  WorkflowNode,
  WorkflowEdge,
  NodeResult,
  TaskLogEntry,
  WorkflowParsed,
  ExecutionContext
} from '../types';

function calculateTextSimilarity(text1: string, text2: string): number {
  const set1 = new Set(text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const set2 = new Set(text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

function isDuplicateKnowledgeBase(content: string, similarityThreshold: number = 0.7): string | null {
  try {
    const existing = db.prepare('SELECT id, content FROM knowledge_base WHERE category = ? ORDER BY created_at DESC LIMIT 50').all('故障处理') as Array<{ id: string; content: string }>;
    const targetError = content.toLowerCase();
    
    for (const entry of existing) {
      const similarity = calculateTextSimilarity(targetError, entry.content.toLowerCase());
      if (similarity >= similarityThreshold) {
        return entry.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** 保存到 tasks.context 的执行上下文（用于审批恢复） */
interface PersistedExecutionState {
  workflowId: string;
  workflowName: string;
  initialInput?: string;
  executionOrder: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeResults: Record<string, NodeResult>;
  executionContext: ExecutionContext;
  pausedAtIndex: number;
}

export async function executeWorkflow(
  taskId: string,
  workflow: WorkflowParsed,
  initialInput?: string,
  context?: Record<string, unknown>
) {
  const io = getIOInstance();
  const MAX_EXECUTION_DEPTH = 50;
  let executionDepth = 0;
  const nodeResults: Record<string, NodeResult> = {};
  let nodes: WorkflowNode[] = [];
  let edges: WorkflowEdge[] = [];
  let executionOrder: string[] = [];
  const startTime = new Date().toISOString();
  const executionContext: ExecutionContext = {
    variables: context ? { ...context } : {},
    previousResults: [],
    metadata: {
      taskId,
      workflowName: workflow.name,
      executionDepth: 0,
      startTime
    }
  };
  
  try {
    logger.info('🔄 Starting workflow execution:', { taskId, workflowName: workflow.name, context });
    
    nodes = Array.isArray(workflow.nodes) ? workflow.nodes : JSON.parse(workflow.nodes as unknown as string || '[]') as WorkflowNode[];
    edges = Array.isArray(workflow.edges) ? workflow.edges : JSON.parse(workflow.edges as unknown as string || '[]') as WorkflowEdge[];
    executionOrder = topologicalSort(nodes, edges);
    
    if (executionOrder.length === 0) {
      logger.error(`❌ Workflow ${workflow.name} has circular dependencies, aborting execution`);
      db.prepare('UPDATE tasks SET status = ?, end_time = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run('failed', taskId);
      io?.to(`task:${taskId}`).emit('task:failed', { taskId, error: 'Circular dependency detected in workflow' });
      return;
    }
    
    logger.info('📊 Parsed workflow nodes:', nodes);
    logger.info('📊 Execution order:', executionOrder);
    
    db.prepare('UPDATE tasks SET status = ?, start_time = datetime(\'now\',\'localtime\'), execution_order = ? WHERE id = ?')
      .run('running', JSON.stringify(executionOrder), taskId);
    
    io?.to(`task:${taskId}`).emit('task:started', { taskId, executionOrder });
    
    await executeFromIndex(
      taskId, workflow, nodes, edges, executionOrder, nodeResults,
      executionContext, 0, initialInput, executionDepth, MAX_EXECUTION_DEPTH
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    db.prepare(`
      UPDATE tasks 
      SET status = ?, end_time = datetime('now','localtime'), current_node_id = NULL
      WHERE id = ?
    `).run('failed', taskId);
    
    try {
      await generateWorkflowExecutionReport(taskId, workflow, nodes, nodeResults, executionOrder, 'failed', errorMessage);
    } catch (reportError) {
      logger.error('Failed to generate workflow report (failed case):', reportError);
    }
    
    io?.to(`task:${taskId}`).emit('task:failed', {
      taskId,
      error: errorMessage
    });
  }
}

/**
 * 从指定索引开始执行工作流节点。
 * 遇到审批节点时暂停并保存状态，返回 'paused'。
 * 全部执行完返回 'completed'。
 */
async function executeFromIndex(
  taskId: string,
  workflow: WorkflowParsed,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  executionOrder: string[],
  nodeResults: Record<string, NodeResult>,
  executionContext: ExecutionContext,
  startIndex: number,
  initialInput: string | undefined,
  executionDepth: number,
  MAX_EXECUTION_DEPTH: number
): Promise<'completed' | 'paused'> {
  const io = getIOInstance();

  for (let i = startIndex; i < executionOrder.length; i++) {
    if (executionDepth++ >= MAX_EXECUTION_DEPTH) {
      logger.error(`❌ Workflow ${workflow.name} exceeded maximum execution depth`);
      break;
    }

    const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
    if (task?.status === 'cancelled') {
      break;
    }

    const nodeId = executionOrder[i];
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // ---- 审批节点处理 ----
    if (node.type === 'approval') {
      logger.info(`🛑 Approval node ${nodeId} (${node.data.label}) reached, pausing workflow`);

      const approvalConfig = node.data.approvalConfig || {
        description: node.data.label,
        timeout: 3600,
        timeoutAction: 'reject' as const,
        approvers: ['admin']
      };

      const approvalId = randomUUID();
      const timeoutAt = approvalConfig.timeout > 0
        ? new Date(Date.now() + approvalConfig.timeout * 1000).toISOString()
        : null;

      db.prepare(`
        INSERT INTO approval_requests (id, task_id, node_id, node_label, description, status, timeout_at, timeout_action)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
      `).run(approvalId, taskId, nodeId, node.data.label, approvalConfig.description, timeoutAt, approvalConfig.timeoutAction);

      // 保存执行上下文到 tasks.context
      const persistedState: PersistedExecutionState = {
        workflowId: workflow.id,
        workflowName: workflow.name,
        initialInput,
        executionOrder,
        nodes,
        edges,
        nodeResults: { ...nodeResults },
        executionContext: {
          ...executionContext,
          previousResults: [...executionContext.previousResults],
          metadata: { ...executionContext.metadata }
        },
        pausedAtIndex: i
      };
      db.prepare('UPDATE tasks SET status = ?, current_node_id = ?, context = ? WHERE id = ?')
        .run('waiting_approval', nodeId, JSON.stringify(persistedState), taskId);

      io?.to(`task:${taskId}`).emit('task:node:started', { nodeId, nodeName: node.data.label });
      io?.to(`task:${taskId}`).emit('task:approval:requested', {
        taskId,
        approvalId,
        nodeId,
        nodeLabel: node.data.label,
        description: approvalConfig.description,
        timeout: approvalConfig.timeout,
        timeoutAt
      });
      io?.emit('approval:new', {
        approvalId,
        taskId,
        nodeLabel: node.data.label,
        description: approvalConfig.description
      });

      addTaskLog(taskId, { type: 'output', content: `⏸️ 等待审批: ${node.data.label} — ${approvalConfig.description}`, nodeId });

      // 发送通知到企业微信/钉钉/邮箱
      try {
        await notificationService.sendNotification({
          type: 'approval_request',
          title: `⏸️ 工作流审批请求: ${node.data.label}`,
          content: `**工作流**: ${workflow.name}\n**节点**: ${node.data.label}\n**说明**: ${approvalConfig.description}\n**超时**: ${approvalConfig.timeout}秒\n**任务ID**: ${taskId}\n**审批ID**: ${approvalId}\n\n请登录系统进入审批中心处理`,
          related_task_id: taskId,
        });
        logger.info('✅ 审批通知已发送');
      } catch (notifyError) {
        logger.warn('⚠️ 审批通知发送失败（非致命错误）:', notifyError);
      }

      logger.info(`✅ Approval request ${approvalId} created for task ${taskId}`);
      return 'paused';
    }

    // ---- Agent 节点处理（原有逻辑） ----
    if (node.type !== 'agent') continue;

    logger.info(`🤖 Processing node ${nodeId}:`, node.data);

    io?.to(`task:${taskId}`).emit('task:node:started', {
      nodeId,
      nodeName: node.data.label
    });

    try {
      const previousResults = Object.values(nodeResults).map((r) => r.output).filter(Boolean).join('\n\n');
      const input = previousResults || initialInput || '请开始执行任务';

      executionContext.metadata.currentNodeId = nodeId;
      executionContext.metadata.executionDepth = executionDepth;
      executionContext.previousResults.push({
        nodeId,
        status: 'running',
        output: undefined,
        error: undefined
      });

      const thinkingProcess = getThinkingSteps(node.data.label);
      for (const step of thinkingProcess) {
        await delay(300);
        io?.to(`task:${taskId}`).emit('task:node:thinking', {
          taskId,
          nodeId,
          content: step
        });
        addTaskLog(taskId, { type: 'thinking', content: step, nodeId });
      }

      logger.info(`🤖 Calling executeAgentNode with agentId: ${node.data.agentId} context:`, executionContext.variables);
      
      if (!node.data.agentId) {
        throw new Error(`Node ${nodeId} is missing agentId`);
      }
      
      const output = await executeAgentNode(node.data.agentId, input, executionContext.variables);

      nodeResults[nodeId] = {
        status: 'success',
        output,
        metadata: {
          thinkingProcess: thinkingProcess.join('\n'),
          executionTime: Date.now()
        }
      };

      const lastResultIdx = executionContext.previousResults.findIndex(r => r.nodeId === nodeId && r.status === 'running');
      if (lastResultIdx !== -1) {
        executionContext.previousResults[lastResultIdx] = {
          nodeId,
          status: 'success',
          output
        };
      }

      io?.to(`task:${taskId}`).emit('task:node:output', { taskId, nodeId, output });
      io?.to(`task:${taskId}`).emit('task:node:completed', { taskId, nodeId, status: 'success', output });
      addTaskLog(taskId, { type: 'output', content: output, nodeId });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      nodeResults[nodeId] = {
        status: 'failed',
        error: errorMessage
      };

      io?.to(`task:${taskId}`).emit('task:node:completed', {
        taskId,
        nodeId,
        status: 'failed',
        error: errorMessage
      });
      addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });

      if (!node.data.allowFailure) {
        throw error;
      }
    }
  }

  // 所有节点执行完成
  await finalizeWorkflow(taskId, workflow, nodes, nodeResults, executionOrder, 'completed');
  return 'completed';
}

/**
 * 审批通过后恢复工作流执行
 */
export async function resumeWorkflow(
  taskId: string,
  approvalId: string,
  approvedBy: string,
  comment?: string
): Promise<void> {
  const io = getIOInstance();

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as { status: string; context?: string; workflow_id?: string } | undefined;
  if (!task || task.status !== 'waiting_approval') {
    throw new Error(`Task ${taskId} is not waiting for approval`);
  }

  const persistedState = JSON.parse(task.context || '{}') as PersistedExecutionState;
  if (!persistedState.executionOrder || persistedState.pausedAtIndex === undefined) {
    throw new Error(`Task ${taskId} has no saved execution context`);
  }

  // 更新审批记录
  db.prepare(`
    UPDATE approval_requests
    SET status = 'approved', approved_by = ?, approved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(approvedBy, approvalId);

  // 通知审批结果
  io?.to(`task:${taskId}`).emit('task:approval:resolved', {
    taskId,
    approvalId,
    status: 'approved',
    approvedBy,
    comment
  });

  addTaskLog(taskId, { type: 'output', content: `✅ 审批通过 by ${approvedBy}${comment ? `: ${comment}` : ''}`, nodeId: persistedState.executionOrder[persistedState.pausedAtIndex] });

  // 恢复执行
  db.prepare('UPDATE tasks SET status = ?, current_node_id = NULL WHERE id = ?')
    .run('running', taskId);

  const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(persistedState.workflowId) as Record<string, unknown> | undefined;
  const workflowParsed: WorkflowParsed = workflow ? {
    id: workflow.id as string,
    name: workflow.name as string,
    description: workflow.description as string,
    nodes: persistedState.nodes,
    edges: persistedState.edges,
    agent_configs: JSON.parse((workflow.agent_configs as string) || '{}'),
    is_template: workflow.is_template as number,
    created_at: workflow.created_at as string,
    updated_at: workflow.updated_at as string,
  } : {
    id: persistedState.workflowId,
    name: persistedState.workflowName,
    nodes: persistedState.nodes,
    edges: persistedState.edges,
    agent_configs: {},
    is_template: 0,
    created_at: '',
    updated_at: '',
  };

  try {
    await executeFromIndex(
      taskId,
      workflowParsed,
      persistedState.nodes,
      persistedState.edges,
      persistedState.executionOrder,
      persistedState.nodeResults,
      persistedState.executionContext,
      persistedState.pausedAtIndex + 1,
      persistedState.initialInput,
      persistedState.executionContext.metadata.executionDepth,
      50
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await finalizeWorkflow(taskId, workflowParsed, persistedState.nodes, persistedState.nodeResults, persistedState.executionOrder, 'failed', errorMessage);
    io?.to(`task:${taskId}`).emit('task:failed', { taskId, error: errorMessage });
  }
}

/**
 * 审批拒绝，终止工作流
 */
export async function rejectWorkflow(
  taskId: string,
  approvalId: string,
  rejectedBy: string,
  reason: string
): Promise<void> {
  const io = getIOInstance();

  db.prepare(`
    UPDATE approval_requests
    SET status = 'rejected', approved_by = ?, reject_reason = ?, approved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(rejectedBy, reason, approvalId);

  db.prepare(`
    UPDATE tasks
    SET status = 'failed', end_time = datetime('now','localtime'), current_node_id = NULL
    WHERE id = ?
  `).run(taskId);

  io?.to(`task:${taskId}`).emit('task:approval:resolved', {
    taskId,
    approvalId,
    status: 'rejected',
    approvedBy: rejectedBy,
    comment: reason
  });

  addTaskLog(taskId, { type: 'error', content: `❌ 审批拒绝 by ${rejectedBy}: ${reason}` });

  io?.to(`task:${taskId}`).emit('task:failed', {
    taskId,
    error: `审批被拒绝: ${reason}`
  });
}

/**
 * 审批超时处理
 */
export async function timeoutApproval(approvalId: string): Promise<void> {
  const approval = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(approvalId) as {
    id: string; task_id: string; node_id: string; timeout_action: string;
  } | undefined;
  if (!approval) return;

  db.prepare(`
    UPDATE approval_requests
    SET status = 'timeout', updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(approvalId);

  if (approval.timeout_action === 'reject') {
    await rejectWorkflow(approval.task_id, approvalId, 'system', '审批超时自动拒绝');
  }
}

async function finalizeWorkflow(
  taskId: string,
  workflow: WorkflowParsed,
  nodes: WorkflowNode[],
  nodeResults: Record<string, NodeResult>,
  executionOrder: string[],
  status: 'completed' | 'failed',
  errorMessage?: string
) {
  const io = getIOInstance();

  db.prepare(`
    UPDATE tasks 
    SET status = ?, end_time = datetime('now','localtime'), 
        node_results = ?, current_node_id = NULL
    WHERE id = ?
  `).run(status, JSON.stringify(nodeResults), taskId);

  // 故障案例自动存入知识库
  try {
    const failedNodes = Object.entries(nodeResults)
      .filter(([_, result]) => result.status === 'failed')
      .map(([nodeId, result]) => {
        const node = nodes.find((n) => n.id === nodeId);
        return { ...result, nodeId, node };
      });

    if (failedNodes.length > 0) {
      failedNodes.forEach((nodeResult) => {
        const title = `${workflow.name} - 故障案例`;
        const content = `**故障节点**: ${nodeResult.node?.data?.label || nodeResult.nodeId}\n**错误**: ${nodeResult.error}\n**分析时间**: ${new Date().toISOString()}`;

        const duplicateId = isDuplicateKnowledgeBase(content);
        if (duplicateId) {
          logger.info(`ℹ️ 跳过重复的故障案例，已存在相似条目: ${duplicateId}`);
          return;
        }

        db.prepare(`
          INSERT INTO knowledge_base (id, title, category, content, created_at)
          VALUES (?, ?, ?, ?, datetime('now','localtime'))
        `).run(randomUUID(), title, '故障处理', content);
      });
      logger.info('✅ 故障案例已自动存入知识库');
    }
  } catch (insertError) {
    logger.error('Failed to insert into knowledge_base:', insertError);
  }

  try {
    await generateWorkflowExecutionReport(taskId, workflow, nodes, nodeResults, executionOrder, status, errorMessage);
  } catch (reportError) {
    logger.error('Failed to generate workflow report:', reportError);
  }

  // ── 验证失败时自动回滚 ──
  // 检测验证节点是否失败，如果失败且存在回滚节点，则自动执行回滚
  const verificationNode = nodes.find(n =>
    n.data?.label?.includes('验证') && n.type === 'agent'
  );
  const verificationFailed = verificationNode &&
    nodeResults[verificationNode.id]?.status === 'failed';

  if (verificationFailed) {
    logger.warn(`⚠️ 验证节点 "${verificationNode.data.label}" 执行失败，尝试自动回滚...`);
    const rollbackNode = nodes.find(n =>
      n.data?.label?.includes('回滚') && n.type === 'agent'
    );

    if (rollbackNode) {
      try {
        addTaskLog(taskId, {
          type: 'output',
          content: '⚠️ 验证失败，正在执行自动回滚...',
          nodeId: rollbackNode.id,
        });
        io?.to(`task:${taskId}`).emit('task:node:started', {
          taskId, nodeId: rollbackNode.id, nodeName: rollbackNode.data.label,
        });

        const rollbackOutput = await executeAgentNode(
          rollbackNode.data.agentId || 'server-command-agent',
          rollbackNode.data.prompt || '执行回滚操作',
          {}
        );

        nodeResults[rollbackNode.id] = {
          status: 'success',
          output: rollbackOutput,
          metadata: { executionTime: Date.now() },
        };

        io?.to(`task:${taskId}`).emit('task:node:output', {
          taskId, nodeId: rollbackNode.id, output: rollbackOutput,
        });
        io?.to(`task:${taskId}`).emit('task:node:completed', {
          taskId, nodeId: rollbackNode.id, status: 'success', output: rollbackOutput,
        });
        addTaskLog(taskId, {
          type: 'output',
          content: `✅ 自动回滚完成: ${rollbackOutput.substring(0, 200)}`,
          nodeId: rollbackNode.id,
        });

        // 更新 ai_remediations 记录状态
        try {
          const taskCtx = db.prepare('SELECT context FROM tasks WHERE id = ?').get(taskId) as { context?: string } | undefined;
          const ctx = taskCtx?.context ? JSON.parse(taskCtx.context) : {};
          if (ctx.remediation_id) {
            db.prepare(`
              UPDATE ai_remediations SET status = 'failed', execution_result = ?, updated_at = datetime('now','localtime')
              WHERE id = ?
            `).run(JSON.stringify({ verification: 'failed', rollback: 'executed', rollback_output: rollbackOutput.substring(0, 500) }), ctx.remediation_id);
          }
        } catch { /* ai_remediations 表可能不存在 */ }

        logger.info(`✅ 自动回滚执行完成 (task: ${taskId})`);
      } catch (rollbackError) {
        const rollbackErrMsg = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        nodeResults[rollbackNode.id] = {
          status: 'failed',
          error: rollbackErrMsg,
          metadata: { executionTime: Date.now() },
        };
        addTaskLog(taskId, {
          type: 'error',
          content: `❌ 自动回滚失败: ${rollbackErrMsg}`,
          nodeId: rollbackNode.id,
        });
        logger.error(`❌ 自动回滚执行失败: ${rollbackErrMsg}`);

        // 更新 ai_remediations 记录
        try {
          const taskCtx = db.prepare('SELECT context FROM tasks WHERE id = ?').get(taskId) as { context?: string } | undefined;
          const ctx = taskCtx?.context ? JSON.parse(taskCtx.context) : {};
          if (ctx.remediation_id) {
            db.prepare(`
              UPDATE ai_remediations SET status = 'failed', error_message = ?, updated_at = datetime('now','localtime')
              WHERE id = ?
            `).run(`验证失败且回滚失败: ${rollbackErrMsg}`, ctx.remediation_id);
          }
        } catch { /* ai_remediations 表可能不存在 */ }
      }

      // 更新 tasks 表中的 node_results（包含回滚节点结果）
      db.prepare('UPDATE tasks SET node_results = ? WHERE id = ?')
        .run(JSON.stringify(nodeResults), taskId);
    }
  }

  // ── 反馈通知 ──
  const successCount = Object.values(nodeResults).filter(r => r.status === 'success').length;
  const failedCount = Object.values(nodeResults).filter(r => r.status === 'failed').length;

  try {
    await notificationService.sendTaskNotification(
      { id: taskId, name: workflow.name, workflow_id: workflow.id },
      status
    );
  } catch (notifyError) {
    logger.warn('⚠️ 工作流完成通知发送失败（非致命错误）:', notifyError);
  }

  // 验证失败回滚的额外通知
  if (verificationFailed) {
    try {
      await notificationService.sendNotification({
        type: 'remediation_rollback',
        title: `⚠️ AI 修复验证失败并已回滚: ${workflow.name}`,
        content: `**工作流**: ${workflow.name}\n**验证结果**: 失败\n**回滚操作**: 已自动执行\n**任务ID**: ${taskId}\n\n请登录系统查看详细信息`,
        related_task_id: taskId,
      });
    } catch (notifyError) {
      logger.warn('⚠️ 回滚通知发送失败:', notifyError);
    }
  }

  // ── 审计日志 ──
  createAuditLog({
    action: status === 'completed' ? 'workflow_completed' : 'workflow_failed',
    resource_type: 'task',
    resource_id: taskId,
    details: {
      workflowName: workflow.name,
      workflowId: workflow.id,
      successCount,
      failedCount,
      verificationFailed: !!verificationFailed,
      errorMessage: errorMessage || null,
    },
  });

  if (verificationFailed) {
    createAuditLog({
      action: 'remediation_rollback_triggered',
      resource_type: 'task',
      resource_id: taskId,
      details: {
        workflowName: workflow.name,
        reason: '验证节点执行失败，自动触发回滚',
        rollbackResult: nodeResults[nodes.find(n => n.data?.label?.includes('回滚'))?.id || '']?.status || 'unknown',
      },
    });
  }

  if (status === 'completed') {
    io?.to(`task:${taskId}`).emit('task:completed', { taskId, status: 'completed', nodeResults });
  }
}

async function generateWorkflowExecutionReport(
  taskId: string,
  workflow: WorkflowParsed,
  nodes: WorkflowNode[],
  nodeResults: Record<string, NodeResult>,
  executionOrder: string[],
  status: 'completed' | 'failed',
  errorMessage?: string
) {
  logger.info('📄 开始生成工作流执行报告...');
  
  const templates = reportService.getTemplates();
  let workflowTemplate = templates.find(t => t.name.includes('工作流执行报告'));
  
  if (!workflowTemplate) {
    logger.info('📄 未找到工作流执行报告模板，正在创建...');
    workflowTemplate = reportService.createTemplate({
      name: '工作流执行报告',
      description: '工作流执行完成后自动生成的执行报告',
      type: 'inspection',
      content: `# 工作流执行报告\n\n## 基本信息\n- **工作流名称**: {{workflow_name}}\n- **执行任务ID**: {{task_id}}\n- **执行状态**: {{execution_status}}\n- **开始时间**: {{start_time}}\n- **结束时间**: {{end_time}}\n\n## 执行顺序\n{{execution_order}}\n\n## 节点执行详情\n{{node_details}}\n\n## 执行总结\n{{execution_summary}}\n\n{{error_section}}\n\n---\n报告生成时间: {{generated_time}}`,
      variables: ['workflow_name', 'task_id', 'execution_status', 'start_time', 'end_time', 'execution_order', 'node_details', 'execution_summary', 'error_section', 'generated_time'],
      is_preset: true
    });
    logger.info('✅ 工作流执行报告模板创建成功:', workflowTemplate.id);
  } else {
    logger.info('✅ 使用已存在的工作流执行报告模板:', workflowTemplate.id);
  }
  
  const task = db.prepare('SELECT start_time, end_time FROM tasks WHERE id = ?').get(taskId) as { start_time?: string; end_time?: string } | undefined;
  
  const executionOrderDesc = executionOrder.map((nodeId, index) => {
    const node = nodes.find(n => n.id === nodeId);
    const nodeResult = nodeResults[nodeId];
    const nodeStatus = nodeResult?.status || 'pending';
    return `${index + 1}. ${node?.data?.label || nodeId} (${nodeStatus})`;
  }).join('\n');
  
  const nodeDetails = executionOrder.map((nodeId, index) => {
    const node = nodes.find(n => n.id === nodeId);
    const nodeResult = nodeResults[nodeId];
    
    let detail = `### ${index + 1}. ${node?.data?.label || nodeId}\n`;
    detail += `- **状态**: ${nodeResult?.status || 'pending'}\n`;
    
    if (nodeResult?.output) {
      detail += `- **输出**: \n${nodeResult.output.substring(0, 500)}${nodeResult.output.length > 500 ? '...' : ''}\n`;
    }
    
    if (nodeResult?.error) {
      detail += `- **错误**: ${nodeResult.error}\n`;
    }
    
    return detail;
  }).join('\n\n');
  
  const successCount = Object.values(nodeResults).filter((r) => r.status === 'success').length;
  const failedCount = Object.values(nodeResults).filter((r) => r.status === 'failed').length;
  const totalCount = Object.keys(nodeResults).length;
  
  const executionSummary = `共执行 ${totalCount} 个节点，成功 ${successCount} 个，失败 ${failedCount} 个。`;
  
  let errorSection = '';
  if (status === 'failed' && errorMessage) {
    errorSection = `## 错误信息\n\n${errorMessage}`;
  }
  
  const variables: Record<string, string> = {
    workflow_name: workflow.name,
    task_id: taskId,
    execution_status: status === 'completed' ? '成功完成' : '执行失败',
    start_time: task?.start_time ? new Date(task.start_time).toLocaleString() : '-',
    end_time: task?.end_time ? new Date(task.end_time).toLocaleString() : '-',
    execution_order: executionOrderDesc,
    node_details: nodeDetails,
    execution_summary: executionSummary,
    error_section: errorSection,
    generated_time: new Date().toLocaleString()
  };
  
  try {
    logger.info('📄 正在使用报告服务生成报告...');
    const generatedReport = reportService.generateReport(workflowTemplate.id, variables, 'markdown');
    logger.info('✅ 报告已通过服务生成:', generatedReport.id);
    
    try {
      logger.info('📄 正在向 reports 表插入报告...');
      db.prepare(`
        INSERT INTO reports (id, name, content, format, task_id, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
      `).run(
        generatedReport.id,
        generatedReport.name,
        generatedReport.content,
        'markdown',
        taskId
      );
      
      logger.info('📄 正在更新 tasks 表的 report_id 字段...');
      db.prepare('UPDATE tasks SET report_id = ? WHERE id = ?').run(generatedReport.id, taskId);
      
      logger.info('✅ 工作流执行报告已生成并关联到任务:', generatedReport.id);
      
      const savedReport = db.prepare('SELECT * FROM reports WHERE id = ?').get(generatedReport.id);
      logger.info('✅ 验证：从数据库中读取到的报告:', savedReport ? '存在' : '不存在');
      
    } catch (e) {
      logger.error('❌ 报告关联失败:', e);
    }
  } catch (generateError) {
    logger.error('❌ 报告生成过程出错:', generateError);
  }
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });
  
  edges.forEach(edge => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  });
  
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  const getNodePosition = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return { x: node?.position?.x || 0, y: node?.position?.y || 0 };
  };
  
  const queue: string[] = [];
  const startNodes = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort((a, b) => {
      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      return posA.x - posB.x;
    });
  
  queue.push(...startNodes);
  
  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);
    
    const neighbors = adjacency.get(nodeId) || [];
    neighbors.sort((a, b) => {
      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      return posA.x - posB.x;
    });
    
    neighbors.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    });
  }
  
  const nodeIds = nodes.map(n => n.id);
  const unsortedNodes = nodeIds.filter(id => !result.includes(id));
  
  if (unsortedNodes.length > 0) {
    logger.warn(`⚠️ 工作流存在循环依赖，以下节点处于环中: ${unsortedNodes.join(', ')}`);
    return [];
  }
  
  return result;
}

function addTaskLog(taskId: string, log: TaskLogEntry) {
  db.prepare(`
    UPDATE tasks 
    SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
      'timestamp', datetime('now'),
      'type', ?,
      'content', ?,
      'nodeId', ?
    ))
    WHERE id = ?
  `).run(log.type, log.content, log.nodeId || null, taskId);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
