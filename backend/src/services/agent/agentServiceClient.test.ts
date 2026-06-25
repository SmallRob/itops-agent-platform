import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentServiceClient } from './agentServiceClient';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
    })),
  },
}));

describe('AgentServiceClient', () => {
  let client: AgentServiceClient;

  beforeEach(() => {
    client = new AgentServiceClient({
      baseUrl: 'http://localhost:8000',
      timeout: 30000,
      retries: 3,
    });
  });

  it('should create client with config', () => {
    expect(client).toBeDefined();
  });

  it('should call chat endpoint', async () => {
    const mockResponse = { data: { content: 'test response', agent_type: 'general' } };
    (client as any).axios.post = vi.fn().mockResolvedValue(mockResponse);

    const result = await client.chat({
      message: 'test message',
      agent_type: 'general',
    });

    expect(result.content).toBe('test response');
  });

  it('should register agent', async () => {
    const mockResponse = { data: { success: true } };
    (client as any).axios.post = vi.fn().mockResolvedValue(mockResponse);

    await client.registerAgent('test', {
      name: 'Test Agent',
      system_prompt: 'You are a test agent',
    });

    expect((client as any).axios.post).toHaveBeenCalledWith('/api/agents/test/register', {
      name: 'Test Agent',
      system_prompt: 'You are a test agent',
    });
  });
});
