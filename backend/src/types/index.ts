export interface ApprovalConfig {
  description: string;
  timeout: number;
  timeoutAction: 'reject' | 'wait';
  approvers: string[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    agentId?: string;
    allowFailure?: boolean;
    approvalConfig?: ApprovalConfig;
    description?: string;
    avatar?: string;
    prompt?: string;
    inputKey?: string;
    outputKey?: string;
  };
  position: {
    x: number;
    y: number;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  nodes: string;
  edges: string;
  agent_configs: string;
  is_template: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowParsed {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  agent_configs: Record<string, unknown>;
  is_template: number;
  created_at: string;
  updated_at: string;
}

export interface NodeResult {
  status: 'success' | 'failed' | 'pending';
  output?: string;
  error?: string;
  metadata?: {
    thinkingProcess?: string;
    executionTime?: number;
  };
}

export interface TaskLogEntry {
  type: 'thinking' | 'output' | 'error';
  content: string;
  nodeId?: string;
}

export interface Agent {
  id: string;
  name: string;
  system_prompt: string;
}

export interface Server {
  id: string;
  name: string;
  hostname: string;
}

export interface Task {
  id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  logs?: string;
}

export interface ApprovalRequest {
  id: string;
  task_id: string;
  node_id: string;
  node_label: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  reject_reason?: string;
  timeout_at?: string;
  timeout_action: 'reject' | 'wait';
  created_at: string;
  updated_at: string;
}

export interface ExecutionContext {
  variables: Record<string, unknown>;
  previousResults: Array<{ nodeId: string; status: string; output?: string; error?: string }>;
  metadata: {
    taskId: string;
    workflowName: string;
    currentNodeId?: string;
    executionDepth: number;
    startTime: string;
  };
}

export interface CommandExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface ComplianceCheckResult {
  success: boolean;
  details?: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  created_at: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  variables: string[];
  is_preset: boolean;
}

export interface Report {
  id: string;
  name: string;
  content: string;
  format: string;
  task_id?: string;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  enabled: number;
}

export interface RemediationPolicy {
  id: string;
  name: string;
  description?: string;
  alert_source: string;
  alert_severity?: string;
  alert_keywords?: string;
  alert_tags?: string;
  execution_mode: 'auto' | 'approval' | 'suggestion';
  workflow_id?: string;
  workflow_params?: string;
  max_executions_per_hour: number;
  cooldown_seconds: number;
  require_confirmation?: string;
  enable_verification: number;
  verification_workflow_id?: string;
  verification_params?: string;
  verification_timeout_seconds: number;
  enable_rollback: number;
  rollback_workflow_id?: string;
  rollback_on_failure: number;
  enabled: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RemediationExecution {
  id: string;
  policy_id: string;
  alert_id: string;
  alert_snapshot?: string;
  status: 'pending' | 'checking' | 'waiting_approval' | 'approved' | 'rejected' | 'running' | 'verifying' | 'success' | 'failed' | 'rolled_back' | 'skipped';
  status_reason?: string;
  approval_required: number;
  approved_by?: string;
  approved_at?: string;
  approval_comment?: string;
  workflow_execution_id?: string;
  started_at?: string;
  completed_at?: string;
  execution_result?: string;
  verification_status?: 'pending' | 'success' | 'failed' | 'skipped';
  verification_result?: string;
  verification_completed_at?: string;
  rollback_triggered: number;
  rollback_execution_id?: string;
  rollback_completed_at?: string;
  rollback_result?: string;
  execution_duration_ms?: number;
  created_at: string;
}

export interface RemediationHistory {
  id: string;
  policy_id: string;
  alert_source?: string;
  alert_severity?: string;
  execution_status: string;
  root_cause?: string;
  resolution?: string;
  duration_ms?: number;
  created_at: string;
}

export interface PolicyStats {
  total_triggers: number;
  success_count: number;
  failed_count: number;
  rolled_back_count: number;
  success_rate: number;
  avg_duration_ms: number;
  top_root_causes: Array<{ cause: string; count: number }>;
  daily_stats: Array<{ date: string; triggers: number; success: number; failed: number }>;
}
