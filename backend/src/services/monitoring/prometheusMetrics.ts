/**
 * Prometheus 指标暴露服务
 *
 * 基于 prom-client 库，为 ITOps Agent Platform 提供标准化的 Prometheus 指标。
 * 覆盖 LLM 调用、命令执行、活跃 Agent、预算用量、HTTP 请求等维度。
 *
 * 依赖安装: npm install prom-client
 * 类型声明: npm install -D @types/prom-client (如有需要)
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// ===== 类型定义 =====

/** LLM Token 用量信息 */
export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
}

// ===== Prometheus 指标管理类 =====

export class PrometheusMetrics {
  /** 指标注册中心 */
  private register: Registry;

  // ---- LLM 相关指标 ----

  /** LLM 调用总次数 */
  private llmCallsTotal: Counter<string>;

  /** LLM 调用耗时（毫秒） */
  private llmCallDuration: Histogram<string>;

  /** LLM Token 消耗总量 */
  private llmTokensTotal: Counter<string>;

  // ---- 命令执行相关指标 ----

  /** 命令执行总次数 */
  private commandExecutionsTotal: Counter<string>;

  /** 命令执行耗时（毫秒） */
  private commandExecutionDuration: Histogram<string>;

  // ---- Agent 相关指标 ----

  /** 当前活跃 Agent 数量 */
  private activeAgents: Gauge<string>;

  // ---- 预算相关指标 ----

  /** 预算用量比例 */
  private budgetUsage: Gauge<string>;

  // ---- HTTP 相关指标 ----

  /** HTTP 请求耗时（毫秒） */
  private httpRequestDuration: Histogram<string>;

  /** HTTP 请求总次数 */
  private httpRequestsTotal: Counter<string>;

  constructor(registry?: Registry) {
    // 使用传入的注册中心或创建新的
    this.register = registry || new Registry();
    // ---- LLM 调用次数 ----
    this.llmCallsTotal = new Counter({
      name: 'itops_llm_calls_total',
      help: 'LLM API 调用总次数',
      labelNames: ['provider', 'model', 'status'],
      registers: [this.register],
    });

    // ---- LLM 调用耗时 ----
    this.llmCallDuration = new Histogram({
      name: 'itops_llm_call_duration_ms',
      help: 'LLM API 调用耗时（毫秒）',
      labelNames: ['provider', 'model'],
      buckets: [100, 500, 1000, 2000, 5000, 10000, 30000],
      registers: [this.register],
    });

    // ---- LLM Token 消耗 ----
    this.llmTokensTotal = new Counter({
      name: 'itops_llm_tokens_total',
      help: 'LLM Token 消耗总量',
      labelNames: ['provider', 'model', 'type'],
      registers: [this.register],
    });

    // ---- 命令执行次数 ----
    this.commandExecutionsTotal = new Counter({
      name: 'itops_command_executions_total',
      help: '命令执行总次数',
      labelNames: ['status', 'class'],
      registers: [this.register],
    });

    // ---- 命令执行耗时 ----
    this.commandExecutionDuration = new Histogram({
      name: 'itops_command_execution_duration_ms',
      help: '命令执行耗时（毫秒）',
      labelNames: ['class'],
      buckets: [10, 50, 100, 500, 1000, 5000, 30000],
      registers: [this.register],
    });

    // ---- 活跃 Agent 数量 ----
    this.activeAgents = new Gauge({
      name: 'itops_active_agents',
      help: '当前活跃 Agent 数量',
      registers: [this.register],
    });

    // ---- 预算用量 ----
    this.budgetUsage = new Gauge({
      name: 'itops_budget_usage_ratio',
      help: '预算用量比例（已用/限额）',
      labelNames: ['period'],
      registers: [this.register],
    });

    // ---- HTTP 请求耗时 ----
    this.httpRequestDuration = new Histogram({
      name: 'itops_http_request_duration_ms',
      help: 'HTTP 请求处理耗时（毫秒）',
      labelNames: ['method', 'path', 'status'],
      buckets: [5, 10, 50, 100, 250, 500, 1000, 5000],
      registers: [this.register],
    });

    // ---- HTTP 请求次数 ----
    this.httpRequestsTotal = new Counter({
      name: 'itops_http_requests_total',
      help: 'HTTP 请求总次数',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });

    // 收集 Node.js 进程默认指标
    // 注意：如果需要 collectDefaultMetrics，可取消以下注释
    // import { collectDefaultMetrics } from 'prom-client';
    // collectDefaultMetrics({ register, prefix: 'itops_' });
  }

  // ===== 公共方法 =====

  /**
   * 记录一次 LLM 调用
   * @param provider - LLM 提供商（如 openai, doubao）
   * @param model - 模型名称
   * @param status - 调用状态（success / error / timeout）
   * @param durationMs - 调用耗时（毫秒）
   * @param usage - Token 用量信息（可选）
   */
  recordLLMCall(
    provider: string,
    model: string,
    status: string,
    durationMs: number,
    usage?: LLMTokenUsage,
  ): void {
    this.llmCallsTotal.inc({ provider, model, status });
    this.llmCallDuration.observe({ provider, model }, durationMs);

    if (usage) {
      this.llmTokensTotal.inc({ provider, model, type: 'prompt' }, usage.promptTokens);
      this.llmTokensTotal.inc({ provider, model, type: 'completion' }, usage.completionTokens);
    }
  }

  /**
   * 记录一次命令执行
   * @param status - 执行状态（success / error / timeout）
   * @param commandClass - 命令分类（如 server, network, script）
   * @param durationMs - 执行耗时（毫秒）
   */
  recordCommandExecution(status: string, commandClass: string, durationMs: number): void {
    this.commandExecutionsTotal.inc({ status, class: commandClass });
    this.commandExecutionDuration.observe({ class: commandClass }, durationMs);
  }

  /**
   * 设置当前活跃 Agent 数量
   * @param count - 活跃 Agent 数
   */
  setActiveAgents(count: number): void {
    this.activeAgents.set(count);
  }

  /**
   * 设置预算用量比例
   * @param period - 预算周期（如 daily, monthly）
   * @param usage - 已用量
   * @param limit - 限额
   */
  setBudgetUsage(period: string, usage: number, limit: number): void {
    const ratio = limit > 0 ? usage / limit : 0;
    this.budgetUsage.set({ period }, ratio);
  }

  /**
   * 记录一次 HTTP 请求
   * @param method - 请求方法
   * @param path - 请求路径
   * @param status - 响应状态码
   * @param durationMs - 请求耗时（毫秒）
   */
  recordHttpRequest(method: string, path: string, status: string, durationMs: number): void {
    this.httpRequestsTotal.inc({ method, path, status });
    this.httpRequestDuration.observe({ method, path, status }, durationMs);
  }

  /**
   * 获取所有指标的 Prometheus 格式文本
   * @returns Prometheus 文本格式指标
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * 获取 Prometheus 指标的 Content-Type
   * @returns content-type 字符串
   */
  getContentType(): string {
    return this.register.contentType;
  }
}

// ===== 导出单例 =====

/** 全局 Prometheus 指标实例 */
export const prometheusMetrics = new PrometheusMetrics();
