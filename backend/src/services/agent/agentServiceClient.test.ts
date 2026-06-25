import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentServiceClient, getAgentServiceClient, resetAgentServiceClient } from './agentServiceClient';
import type { AxiosInstance } from 'axios';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
    })),
  },
}));

vi.mock('@utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockAxios() {
  return {
    post: vi.fn(),
    get: vi.fn(),
  } as unknown as AxiosInstance & { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
}

describe('AgentServiceClient', () => {
  let client: AgentServiceClient;
  let mockAxios: ReturnType<typeof createMockAxios>;

  beforeEach(() => {
    client = new AgentServiceClient({
      baseUrl: 'http://localhost:8000',
      timeout: 30000,
      retries: 1,
    });
    mockAxios = createMockAxios();
    (client as any).axios = mockAxios;
  });

  it('should create client with config', () => {
    expect(client).toBeDefined();
  });

  it('should call chat endpoint', async () => {
    const mockResponse = { data: { content: 'test response', agent_type: 'general', tools_used: [], suggestions: [] } };
    mockAxios.post.mockResolvedValue(mockResponse);

    const result = await client.chat({
      message: 'test message',
      agent_type: 'general',
    });

    expect(result.content).toBe('test response');
    expect(mockAxios.post).toHaveBeenCalledWith('/api/chat', {
      message: 'test message',
      agent_type: 'general',
    });
  });

  it('should register agent', async () => {
    mockAxios.post.mockResolvedValue({ data: {} });

    await client.registerAgent('test-agent', {
      name: 'Test Agent',
      system_prompt: 'You are a test agent',
    });

    expect(mockAxios.post).toHaveBeenCalledWith('/api/agents/test-agent/register', {
      name: 'Test Agent',
      system_prompt: 'You are a test agent',
    });
  });

  it('should unregister agent', async () => {
    mockAxios.post.mockResolvedValue({ data: {} });

    await client.unregisterAgent('test-agent');

    expect(mockAxios.post).toHaveBeenCalledWith('/api/agents/test-agent/unregister');
  });

  it('should list registered agents', async () => {
    const agents = { agents: ['a', 'b'], configs: {} };
    mockAxios.get.mockResolvedValue({ data: agents });

    const result = await client.listRegisteredAgents();

    expect(result).toEqual(agents);
    expect(mockAxios.get).toHaveBeenCalledWith('/api/agents/registered');
  });

  it('should sync LLM config', async () => {
    mockAxios.post.mockResolvedValue({ data: {} });
    const config = { provider: 'openai', model: 'gpt-4' };

    await client.syncLLMConfig(config);

    expect(mockAxios.post).toHaveBeenCalledWith('/api/llm/config', config);
  });

  it('should get LLM config', async () => {
    const config = { provider: 'openai', model: 'gpt-4' };
    mockAxios.get.mockResolvedValue({ data: { config } });

    const result = await client.getLLMConfig();

    expect(result).toEqual(config);
  });

  it('should search knowledge with typed results', async () => {
    const results = [
      { id: '1', title: 'Doc', content: 'Body', category: 'ops', relevance: 0.9 },
    ];
    mockAxios.post.mockResolvedValue({ data: { results } });

    const result = await client.searchKnowledge('test', 'ops');

    expect(result).toEqual(results);
    expect(result[0].relevance).toBe(0.9);
  });

  describe('agentType validation', () => {
    it('should reject agentType with path traversal', async () => {
      await expect(client.registerAgent('../evil', { name: 'X', system_prompt: 'Y' }))
        .rejects.toThrow('Invalid agentType');
    });

    it('should reject agentType with spaces', async () => {
      await expect(client.registerAgent('bad type', { name: 'X', system_prompt: 'Y' }))
        .rejects.toThrow('Invalid agentType');
    });

    it('should reject agentType with special characters', async () => {
      await expect(client.registerAgent('a/b', { name: 'X', system_prompt: 'Y' }))
        .rejects.toThrow('Invalid agentType');
    });

    it('should accept valid agentType with hyphens and underscores', async () => {
      mockAxios.post.mockResolvedValue({ data: {} });
      await expect(client.registerAgent('my_agent-1', { name: 'X', system_prompt: 'Y' }))
        .resolves.toBeUndefined();
    });

    it('should reject agentType in unregisterAgent', async () => {
      await expect(client.unregisterAgent('../evil')).rejects.toThrow('Invalid agentType');
    });
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      mockAxios.get.mockResolvedValue({ data: { status: 'healthy' } });

      const result = await client.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when unhealthy', async () => {
      mockAxios.get.mockResolvedValue({ data: { status: 'degraded' } });

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false on failure', async () => {
      mockAxios.get.mockRejectedValue(new Error('Connection refused'));

      const result = await client.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from chat', async () => {
      mockAxios.post.mockRejectedValue(new Error('Service unavailable'));

      await expect(client.chat({ message: 'hi', agent_type: 'general' }))
        .rejects.toThrow('Service unavailable');
    });

    it('should propagate errors from registerAgent', async () => {
      mockAxios.post.mockRejectedValue(new Error('Conflict'));

      await expect(client.registerAgent('test', { name: 'X', system_prompt: 'Y' }))
        .rejects.toThrow('Conflict');
    });

    it('should propagate errors from listRegisteredAgents', async () => {
      mockAxios.get.mockRejectedValue(new Error('Timeout'));

      await expect(client.listRegisteredAgents()).rejects.toThrow('Timeout');
    });

    it('should propagate errors from syncLLMConfig', async () => {
      mockAxios.post.mockRejectedValue(new Error('Bad request'));

      await expect(client.syncLLMConfig({ provider: 'x', model: 'y' }))
        .rejects.toThrow('Bad request');
    });

    it('should propagate errors from getLLMConfig', async () => {
      mockAxios.get.mockRejectedValue(new Error('Not found'));

      await expect(client.getLLMConfig()).rejects.toThrow('Not found');
    });

    it('should propagate errors from searchKnowledge', async () => {
      mockAxios.post.mockRejectedValue(new Error('Internal error'));

      await expect(client.searchKnowledge('q')).rejects.toThrow('Internal error');
    });
  });

  describe('withRetry', () => {
    it('should retry on failure and eventually succeed', async () => {
      const retryClient = new AgentServiceClient({
        baseUrl: 'http://localhost:8000',
        timeout: 30000,
        retries: 3,
      });
      const retryMock = createMockAxios();
      (retryClient as any).axios = retryMock;

      const error = new Error('Temporary failure');
      retryMock.post
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ data: { content: 'ok', agent_type: 'g', tools_used: [], suggestions: [] } });

      const result = await retryClient.chat({ message: 'hi', agent_type: 'general' });

      expect(result.content).toBe('ok');
      expect(retryMock.post).toHaveBeenCalledTimes(3);
    }, 15000);

    it('should fail after exhausting retries', async () => {
      const retryClient = new AgentServiceClient({
        baseUrl: 'http://localhost:8000',
        timeout: 30000,
        retries: 3,
      });
      const retryMock = createMockAxios();
      (retryClient as any).axios = retryMock;

      retryMock.post.mockRejectedValue(new Error('Permanent failure'));

      await expect(retryClient.chat({ message: 'hi', agent_type: 'general' }))
        .rejects.toThrow('Permanent failure');
      expect(retryMock.post).toHaveBeenCalledTimes(3);
    }, 15000);
  });
});

describe('getAgentServiceClient', () => {
  beforeEach(() => {
    resetAgentServiceClient();
    delete process.env.AGENT_SERVICE_URL;
    delete process.env.AGENT_SERVICE_TIMEOUT;
    delete process.env.AGENT_SERVICE_RETRIES;
  });

  afterEach(() => {
    resetAgentServiceClient();
  });

  it('should return a singleton instance', () => {
    const a = getAgentServiceClient();
    const b = getAgentServiceClient();
    expect(a).toBe(b);
  });

  it('should use default config when env vars are unset', () => {
    const client = getAgentServiceClient();
    expect(client).toBeDefined();
  });

  it('should use env vars when set', () => {
    process.env.AGENT_SERVICE_URL = 'http://custom:9000';
    process.env.AGENT_SERVICE_TIMEOUT = '5000';
    process.env.AGENT_SERVICE_RETRIES = '5';
    const client = getAgentServiceClient();
    expect(client).toBeDefined();
  });

  it('should handle NaN env vars gracefully', () => {
    process.env.AGENT_SERVICE_TIMEOUT = 'not-a-number';
    process.env.AGENT_SERVICE_RETRIES = 'also-bad';
    const client = getAgentServiceClient();
    expect(client).toBeDefined();
  });
});
