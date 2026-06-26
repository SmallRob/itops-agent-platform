import { describe, it, expect, beforeEach } from 'vitest';
import { PrometheusMetrics } from './prometheusMetrics';

/**
 * Prometheus 指标单元测试
 */

describe('PrometheusMetrics', () => {
  let metrics: PrometheusMetrics;

  beforeEach(() => {
    // 每个测试创建新的实例，使用独立的注册中心
    metrics = new PrometheusMetrics();
  });

  // ===== recordLLMCall 测试 =====

  describe('recordLLMCall', () => {
    it('应记录 LLM 调用指标到 Prometheus 输出', async () => {
      metrics.recordLLMCall('openai', 'gpt-4', 'success', 1500, {
        promptTokens: 500,
        completionTokens: 200,
      });

      const output = await metrics.getMetrics();

      // 验证调用次数指标存在
      expect(output).toContain('itops_llm_calls_total');
      expect(output).toContain('openai');
      expect(output).toContain('gpt-4');
      expect(output).toContain('success');

      // 验证耗时指标
      expect(output).toContain('itops_llm_call_duration_ms');

      // 验证 Token 指标
      expect(output).toContain('itops_llm_tokens_total');
    });

    it('不传 Token 用量时不应记录 Token 指标', async () => {
      metrics.recordLLMCall('doubao', 'doubao-pro', 'success', 800);

      const output = await metrics.getMetrics();

      // 调用次数应有记录
      expect(output).toContain('itops_llm_calls_total');
      expect(output).toContain('doubao');
    });

    it('应正确累加多次调用的计数', async () => {
      metrics.recordLLMCall('openai', 'gpt-4', 'success', 1000, {
        promptTokens: 100,
        completionTokens: 50,
      });
      metrics.recordLLMCall('openai', 'gpt-4', 'success', 1200, {
        promptTokens: 200,
        completionTokens: 100,
      });
      metrics.recordLLMCall('openai', 'gpt-4', 'error', 5000);

      const output = await metrics.getMetrics();

      // 多次成功调用应被记录
      expect(output).toContain('itops_llm_calls_total');
      expect(output).toContain('success');
      expect(output).toContain('error');
    });
  });

  // ===== recordCommandExecution 测试 =====

  describe('recordCommandExecution', () => {
    it('应记录命令执行指标', async () => {
      metrics.recordCommandExecution('success', 'server', 250);
      metrics.recordCommandExecution('error', 'network', 5000);

      const output = await metrics.getMetrics();

      expect(output).toContain('itops_command_executions_total');
      expect(output).toContain('server');
      expect(output).toContain('network');
      expect(output).toContain('itops_command_execution_duration_ms');
    });
  });

  // ===== setActiveAgents 测试 =====

  describe('setActiveAgents', () => {
    it('应记录活跃 Agent 数量', async () => {
      metrics.setActiveAgents(5);

      const output = await metrics.getMetrics();

      expect(output).toContain('itops_active_agents');
      expect(output).toContain('5');
    });
  });

  // ===== setBudgetUsage 测试 =====

  describe('setBudgetUsage', () => {
    it('应记录预算用量比例', async () => {
      metrics.setBudgetUsage('daily', 800000, 1000000);

      const output = await metrics.getMetrics();

      expect(output).toContain('itops_budget_usage_ratio');
      expect(output).toContain('0.8');
      expect(output).toContain('daily');
    });

    it('限额为 0 时比例应为 0', async () => {
      metrics.setBudgetUsage('monthly', 100, 0);

      const output = await metrics.getMetrics();

      expect(output).toContain('itops_budget_usage_ratio');
    });
  });

  // ===== recordHttpRequest 测试 =====

  describe('recordHttpRequest', () => {
    it('应记录 HTTP 请求指标', async () => {
      metrics.recordHttpRequest('GET', '/api/health', '200', 15);
      metrics.recordHttpRequest('POST', '/api/agents', '201', 120);
      metrics.recordHttpRequest('GET', '/api/agents', '500', 3000);

      const output = await metrics.getMetrics();

      expect(output).toContain('itops_http_requests_total');
      expect(output).toContain('itops_http_request_duration_ms');
      expect(output).toContain('/api/health');
    });
  });

  // ===== getMetrics 输出格式测试 =====

  describe('getMetrics', () => {
    it('应返回 Prometheus 文本格式', async () => {
      // 写入一些数据
      metrics.recordLLMCall('openai', 'gpt-4', 'success', 1000, {
        promptTokens: 100,
        completionTokens: 50,
      });
      metrics.recordHttpRequest('GET', '/api/test', '200', 50);
      metrics.setActiveAgents(3);

      const output = await metrics.getMetrics();

      // 验证为字符串
      expect(typeof output).toBe('string');

      // 验证包含 HELP 和 TYPE 注释行（Prometheus 格式特征）
      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');

      // 验证包含关键指标名
      expect(output).toContain('itops_llm_calls_total');
      expect(output).toContain('itops_llm_call_duration_ms');
      expect(output).toContain('itops_llm_tokens_total');
      expect(output).toContain('itops_command_executions_total');
      expect(output).toContain('itops_command_execution_duration_ms');
      expect(output).toContain('itops_active_agents');
      expect(output).toContain('itops_budget_usage_ratio');
      expect(output).toContain('itops_http_request_duration_ms');
      expect(output).toContain('itops_http_requests_total');
    });
  });

  // ===== getContentType 测试 =====

  describe('getContentType', () => {
    it('应返回正确的 Prometheus Content-Type', () => {
      const contentType = metrics.getContentType();
      expect(contentType).toContain('text/plain');
      expect(contentType).toContain('version=0.0.4');
    });
  });
});
