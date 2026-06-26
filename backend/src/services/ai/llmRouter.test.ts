/**
 * ITOps Agent Platform - LLM 多 Provider 路由器 测试
 * 
 * 测试覆盖：
 * - Provider 管理（add/remove/update/list）
 * - 请求构建（不同 Provider 的 headers 和 body）
 * - 故障转移（chatWithFallback）
 * - Token 估算
 * - Zhipu JWT 签名
 * - 健康状态管理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 外部依赖
vi.mock('@models/database', () => ({
  default: {
    prepare: vi.fn(() => ({
      all: vi.fn(() => []),
      get: vi.fn(() => undefined),
      run: vi.fn(),
    })),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock axios
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => ({
        post: vi.fn(),
        get: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
      isAxiosError: vi.fn((error: unknown) => {
        return error && typeof error === 'object' && 'isAxiosError' in error;
      }),
    },
  };
});

import axios from 'axios';
import {
  LLMRouter,
  estimateTokens,
  getLLMRouter,
  resetLLMRouter,
  type ProviderConfig,
  type ChatRequest,
} from './llmRouter';

// ============================================================
// 测试辅助函数
// ============================================================

function createTestProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-openai',
    label: 'Test OpenAI',
    apiKey: 'sk-test-key-123',
    model: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    enabled: true,
    priority: 10,
    maxConcurrent: 5,
    timeout: 30000,
    type: 'openai',
    ...overrides,
  };
}

function createTestRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [
      { role: 'system', content: '你是一个助手' },
      { role: 'user', content: '你好，请自我介绍' },
    ],
    temperature: 0.7,
    maxTokens: 1024,
    ...overrides,
  };
}

// ============================================================
// 测试套件
// ============================================================

describe('LLMRouter', () => {
  let router: LLMRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = new LLMRouter();
  });

  // ==========================================================
  // Provider 管理
  // ==========================================================

  describe('Provider 管理', () => {
    describe('addProvider', () => {
      it('应该成功添加 Provider', () => {
        const config = createTestProvider();
        router.addProvider(config);

        expect(router.providers.size).toBe(1);
        expect(router.getProvider('test-openai')).toBeDefined();
        expect(router.getProvider('test-openai')?.label).toBe('Test OpenAI');
      });

      it('应该为每个 Provider 创建 HTTP 客户端', () => {
        const config = createTestProvider();
        router.addProvider(config);

        expect(axios.create).toHaveBeenCalled();
        expect(router.clients.has('test-openai')).toBe(true);
      });

      it('重复添加相同 ID 应覆盖旧配置', () => {
        const config1 = createTestProvider({ label: 'First' });
        const config2 = createTestProvider({ label: 'Second' });

        router.addProvider(config1);
        router.addProvider(config2);

        expect(router.providers.size).toBe(1);
        expect(router.getProvider('test-openai')?.label).toBe('Second');
      });

      it('缺少 id 时应抛出错误', () => {
        const config = createTestProvider({ id: '' });
        expect(() => router.addProvider(config)).toThrow('Provider ID 不能为空');
      });

      it('缺少 label 时应抛出错误', () => {
        const config = createTestProvider({ label: '' });
        expect(() => router.addProvider(config)).toThrow('Provider label 不能为空');
      });

      it('maxConcurrent < 1 时应抛出错误', () => {
        const config = createTestProvider({ maxConcurrent: 0 });
        expect(() => router.addProvider(config)).toThrow('Provider maxConcurrent 必须 >= 1');
      });

      it('timeout < 1000 时应抛出错误', () => {
        const config = createTestProvider({ timeout: 500 });
        expect(() => router.addProvider(config)).toThrow('Provider timeout 必须 >= 1000ms');
      });
    });

    describe('removeProvider', () => {
      it('应该成功移除已存在的 Provider', () => {
        const config = createTestProvider();
        router.addProvider(config);

        const result = router.removeProvider('test-openai');

        expect(result).toBe(true);
        expect(router.providers.size).toBe(0);
        expect(router.getProvider('test-openai')).toBeUndefined();
      });

      it('移除不存在的 Provider 应返回 false', () => {
        const result = router.removeProvider('non-existent');
        expect(result).toBe(false);
      });

      it('应该同时清理相关联的客户端和状态', () => {
        const config = createTestProvider();
        router.addProvider(config);

        router.removeProvider('test-openai');

        expect(router.clients.has('test-openai')).toBe(false);
      });
    });

    describe('updateProvider', () => {
      it('应该成功部分更新 Provider 配置', () => {
        const config = createTestProvider();
        router.addProvider(config);

        router.updateProvider('test-openai', {
          label: 'Updated OpenAI',
          priority: 5,
        });

        const updated = router.getProvider('test-openai');
        expect(updated?.label).toBe('Updated OpenAI');
        expect(updated?.priority).toBe(5);
        // 未更新的字段应保持不变
        expect(updated?.apiKey).toBe('sk-test-key-123');
      });

      it('更新不存在的 Provider 应抛出错误', () => {
        expect(() => router.updateProvider('non-existent', { label: 'test' })).toThrow(
          'Provider 不存在: non-existent'
        );
      });

      it('id 字段不应被覆盖', () => {
        const config = createTestProvider();
        router.addProvider(config);

        router.updateProvider('test-openai', { id: 'new-id' } as Partial<ProviderConfig>);

        expect(router.getProvider('test-openai')).toBeDefined();
      });
    });

    describe('getProvider', () => {
      it('应返回指定 Provider 的配置副本', () => {
        const config = createTestProvider();
        router.addProvider(config);

        const result = router.getProvider('test-openai');
        expect(result).toBeDefined();
        expect(result?.id).toBe('test-openai');
      });

      it('不存在的 Provider 应返回 undefined', () => {
        expect(router.getProvider('non-existent')).toBeUndefined();
      });
    });

    describe('listProviders', () => {
      it('应返回所有 Provider 列表', () => {
        router.addProvider(createTestProvider({ id: 'a', label: 'Provider A' }));
        router.addProvider(createTestProvider({ id: 'b', label: 'Provider B' }));

        const list = router.listProviders();
        expect(list).toHaveLength(2);
      });

      it('空路由器应返回空数组', () => {
        expect(router.listProviders()).toEqual([]);
      });
    });
  });

  // ==========================================================
  // 请求构建
  // ==========================================================

  describe('请求构建', () => {
    describe('buildHeaders', () => {
      it('OpenAI 类型应使用 Bearer 认证', () => {
        const config = createTestProvider({ type: 'openai', apiKey: 'sk-abc' });
        router.addProvider(config);

        const headers = router.buildHeaders(config);

        expect(headers['Authorization']).toBe('Bearer sk-abc');
        expect(headers['Content-Type']).toBe('application/json');
      });

      it('custom 类型应使用 Bearer 认证', () => {
        const config = createTestProvider({ type: 'custom', id: 'custom-1' });
        router.addProvider(config);

        const headers = router.buildHeaders(config);

        expect(headers['Authorization']).toBe(`Bearer ${config.apiKey}`);
      });

      it('Anthropic 类型应使用 x-api-key 认证', () => {
        const config = createTestProvider({
          type: 'anthropic',
          id: 'claude',
          apiKey: 'sk-ant-abc',
        });
        router.addProvider(config);

        const headers = router.buildHeaders(config);

        expect(headers['x-api-key']).toBe('sk-ant-abc');
        expect(headers['anthropic-version']).toBe('2023-06-01');
        expect(headers['Authorization']).toBeUndefined();
      });

      it('Gemini 类型应使用 x-goog-api-key 认证', () => {
        const config = createTestProvider({
          type: 'gemini',
          id: 'gemini-1',
          apiKey: 'gemini-key',
        });
        router.addProvider(config);

        const headers = router.buildHeaders(config);

        expect(headers['x-goog-api-key']).toBe('gemini-key');
        expect(headers['Authorization']).toBeUndefined();
      });

      it('Zhipu 类型应使用 JWT Bearer 认证', () => {
        const config = createTestProvider({
          type: 'zhipu',
          id: 'zhipu-1',
          apiKey: 'test-id.test-secret',
        });
        router.addProvider(config);

        const headers = router.buildHeaders(config);

        // Zhipu 使用 JWT 签名的 Bearer Token
        expect(headers['Authorization']).toBeDefined();
        expect(headers['Authorization']?.startsWith('Bearer ')).toBe(true);
        // Token 不应是原始 API Key
        expect(headers['Authorization']).not.toBe('Bearer test-id.test-secret');
      });
    });
  });

  // ==========================================================
  // chat 方法
  // ==========================================================

  describe('chat', () => {
    it('请求不存在的 Provider 应抛出错误', async () => {
      await expect(router.chat('non-existent', createTestRequest())).rejects.toThrow(
        'Provider 不存在'
      );
    });

    it('请求已禁用的 Provider 应抛出错误', () => {
      const config = createTestProvider({ enabled: false });
      router.addProvider(config);

      expect(router.chat('test-openai', createTestRequest())).rejects.toThrow(
        'Provider 已禁用'
      );
    });

    it('成功请求应返回统一格式的 ChatResponse', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: '你好！我是 AI 助手。' } }],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        },
      });

      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      const config = createTestProvider();
      router.addProvider(config);

      const result = await router.chat('test-openai', createTestRequest());

      expect(result.content).toBe('你好！我是 AI 助手。');
      expect(result.provider).toBe('test-openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage.promptTokens).toBe(20);
      expect(result.usage.completionTokens).toBe(10);
      expect(result.usage.totalTokens).toBe(30);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('应使用请求中指定的模型覆盖默认模型', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });

      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      const config = createTestProvider();
      router.addProvider(config);

      await router.chat('test-openai', createTestRequest({ model: 'gpt-4o-mini' }));

      // 验证调用参数中使用了请求指定的模型
      const callArgs = mockPost.mock.calls[0];
      const body = callArgs[1];
      expect(body.model).toBe('gpt-4o-mini');
    });

    it('API 错误应被正确包装', async () => {
      const mockPost = vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: { status: 401, data: { error: { message: 'Unauthorized' } } },
        message: 'Request failed with status code 401',
      });

      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      const config = createTestProvider();
      router.addProvider(config);

      await expect(router.chat('test-openai', createTestRequest())).rejects.toThrow(
        '认证失败'
      );
    });
  });

  // ==========================================================
  // chatWithFallback 故障转移
  // ==========================================================

  describe('chatWithFallback', () => {
    it('所有 Provider 都不可用时应抛出错误', async () => {
      await expect(router.chatWithFallback(createTestRequest())).rejects.toThrow(
        '没有可用的 Provider'
      );
    });

    it('第一个 Provider 失败时应自动切换到第二个', async () => {
      let callCount = 0;

      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('First provider failed'));
          }
          return Promise.resolve({
            data: {
              choices: [{ message: { content: 'Fallback 成功' } }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            },
          });
        }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      router.addProvider(createTestProvider({ id: 'provider-1', priority: 1 }));
      router.addProvider(createTestProvider({ id: 'provider-2', priority: 2 }));

      const result = await router.chatWithFallback(createTestRequest());

      expect(result.content).toBe('Fallback 成功');
      expect(result.provider).toBe('provider-2');
    });

    it('preferredProviders 应优先使用', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: '优先 Provider 响应' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
      });

      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      router.addProvider(createTestProvider({ id: 'low-priority', priority: 100 }));
      router.addProvider(createTestProvider({ id: 'high-priority', priority: 1 }));

      const result = await router.chatWithFallback(
        createTestRequest(),
        ['high-priority']
      );

      expect(result.provider).toBe('high-priority');
    });

    it('所有 Provider 都失败时应抛出最后一个错误', async () => {
      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: vi.fn().mockRejectedValue(new Error('Service unavailable')),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      router.addProvider(createTestProvider({ id: 'p1', priority: 1 }));
      router.addProvider(createTestProvider({ id: 'p2', priority: 2 }));

      await expect(router.chatWithFallback(createTestRequest())).rejects.toThrow(
        'Service unavailable'
      );
    });

    it('应该跳过禁用的 Provider', async () => {
      const mockPost = vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'OK' } }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        },
      });

      (axios.create as ReturnType<typeof vi.fn>).mockReturnValue({
        post: mockPost,
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      });

      router.addProvider(createTestProvider({ id: 'disabled', enabled: false, priority: 1 }));
      router.addProvider(createTestProvider({ id: 'enabled', priority: 2 }));

      const result = await router.chatWithFallback(createTestRequest());

      expect(result.provider).toBe('enabled');
    });
  });

  // ==========================================================
  // Token 估算
  // ==========================================================

  describe('estimateTokens', () => {
    it('空字符串应返回 0', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('纯英文文本应按约 4 字符 / token 估算', () => {
      const text = 'Hello World Test'; // 16 字符（含空格）
      const tokens = estimateTokens(text);
      // 16 / 4 = 4
      expect(tokens).toBe(4);
    });

    it('纯中文文本应按约 1.5 字符 / token 估算', () => {
      const text = '你好世界测试'; // 6 个中文字符
      const tokens = estimateTokens(text);
      // ceil(6 / 1.5) = 4
      expect(tokens).toBe(4);
    });

    it('混合文本应分别估算中英文', () => {
      const text = 'Hello 你好'; // 6 英文字符 + 2 中文字符
      const tokens = estimateTokens(text);
      // 英文: ceil(6 / 4) = 2, 中文: ceil(2 / 1.5) = 2 => 4
      expect(tokens).toBe(4);
    });

    it('较长的中文文本估算应合理', () => {
      // 模拟一段典型的 IT 运维提示词
      const text = '你是一个专业的IT运维助手，需要帮助用户分析网络故障、服务器性能问题以及安全告警。请根据以下信息提供解决方案。';
      const tokens = estimateTokens(text);
      // 应该大于 0 且在一个合理范围内
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // token 数应少于字符数
    });

    it('较长的英文文本估算应合理', () => {
      const text = 'You are a professional IT operations assistant. Help users analyze network issues and server performance problems.';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
      // ~110 chars / 4 ≈ 28
      expect(tokens).toBeLessThan(text.length);
    });
  });

  // ==========================================================
  // Zhipu JWT 签名
  // ==========================================================

  describe('handleZhipuAuth', () => {
    it('应生成有效的 JWT Token', () => {
      const config = createTestProvider({
        type: 'zhipu',
        id: 'zhipu-1',
        apiKey: 'test-id-12345.test-secret-67890',
      });
      router.addProvider(config);

      const token = router.handleZhipuAuth('test-id-12345.test-secret-67890');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      // JWT Token 有三个用 . 分隔的部分
      expect(token.split('.')).toHaveLength(3);
    });

    it('相同的 API Key 应返回缓存的 Token', () => {
      const apiKey = 'cached-id.cached-secret';

      const token1 = router.handleZhipuAuth(apiKey);
      const token2 = router.handleZhipuAuth(apiKey);

      expect(token1).toBe(token2);
    });

    it('错误格式的 API Key 应抛出错误', () => {
      expect(() => router.handleZhipuAuth('invalid-key-format')).toThrow(
        '智谱 API Key 格式错误'
      );
    });

    it('API Key 缺少 secret 部分应抛出错误', () => {
      expect(() => router.handleZhipuAuth('only-id-part')).toThrow(
        '智谱 API Key 格式错误'
      );
    });

    it('生成的 Token 应包含正确的 payload', () => {
      const jwt = require('jsonwebtoken');
      const apiKey = 'my-api-id.my-api-secret';

      const token = router.handleZhipuAuth(apiKey);

      // 解码但不验证（因为我们在测试中没有原始 secret 来 verify）
      const decoded = jwt.decode(token) as Record<string, unknown>;

      expect(decoded).toBeDefined();
      expect(decoded.api_key).toBe('my-api-id');
      expect(typeof decoded.exp).toBe('number');
      expect(typeof decoded.timestamp).toBe('number');
    });
  });

  // ==========================================================
  // 健康状态管理
  // ==========================================================

  describe('getHealthStatus', () => {
    it('新添加的 Provider 应为健康状态', () => {
      const config = createTestProvider();
      router.addProvider(config);

      const health = router.getHealthStatus();

      expect(health.has('test-openai')).toBe(true);
      expect(health.get('test-openai')?.healthy).toBe(true);
      expect(health.get('test-openai')?.failures).toBe(0);
    });

    it('应该返回状态的副本（不可变）', () => {
      const config = createTestProvider();
      router.addProvider(config);

      const health1 = router.getHealthStatus();
      const health2 = router.getHealthStatus();

      expect(health1).not.toBe(health2); // 不同引用
      expect(health1.get('test-openai')?.healthy).toBe(health2.get('test-openai')?.healthy);
    });

    it('空路由器应返回空 Map', () => {
      const health = router.getHealthStatus();
      expect(health.size).toBe(0);
    });
  });

  // ==========================================================
  // 单例管理
  // ==========================================================

  describe('单例管理', () => {
    afterEach(() => {
      resetLLMRouter();
    });

    it('getLLMRouter 应返回同一实例', () => {
      const router1 = getLLMRouter();
      const router2 = getLLMRouter();

      expect(router1).toBe(router2);
    });

    it('resetLLMRouter 后应返回新实例', () => {
      const router1 = getLLMRouter();
      resetLLMRouter();
      const router2 = getLLMRouter();

      expect(router1).not.toBe(router2);
    });
  });

  // ==========================================================
  // 多 Provider 类型支持
  // ==========================================================

  describe('多 Provider 类型', () => {
    it('应支持同时管理不同类型的 Provider', () => {
      router.addProvider(createTestProvider({ id: 'openai', type: 'openai' }));
      router.addProvider(createTestProvider({ id: 'anthropic', type: 'anthropic', apiKey: 'sk-ant-key' }));
      router.addProvider(createTestProvider({ id: 'zhipu', type: 'zhipu', apiKey: 'id.secret' }));
      router.addProvider(createTestProvider({ id: 'gemini', type: 'gemini', apiKey: 'gemini-key' }));
      router.addProvider(createTestProvider({ id: 'custom', type: 'custom', baseURL: 'http://localhost:8080/v1' }));

      expect(router.listProviders()).toHaveLength(5);

      // 验证每种类型的 headers 差异
      const openaiHeaders = router.buildHeaders(router.getProvider('openai')!);
      expect(openaiHeaders['Authorization']).toMatch(/^Bearer /);

      const anthropicHeaders = router.buildHeaders(router.getProvider('anthropic')!);
      expect(anthropicHeaders['x-api-key']).toBe('sk-ant-key');
      expect(anthropicHeaders['anthropic-version']).toBeDefined();

      const geminiHeaders = router.buildHeaders(router.getProvider('gemini')!);
      expect(geminiHeaders['x-goog-api-key']).toBe('gemini-key');
    });
  });
});
