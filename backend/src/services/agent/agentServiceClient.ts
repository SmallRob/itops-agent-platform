import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { logger } from '@utils/logger';

export interface AgentServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface ChatRequest {
  message: string;
  agent_type: string;
  context?: Record<string, unknown>;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  agent_type: string;
  thinking?: string;
  tools_used: string[];
  suggestions: string[];
}

export interface AgentConfig {
  name: string;
  system_prompt: string;
  model?: string;
  tools?: string[];
}

export interface LLMConfig {
  provider: string;
  model: string;
  api_key?: string;
  api_base?: string;
  temperature?: number;
  max_tokens?: number;
}

export class AgentServiceClient {
  private config: AgentServiceConfig;
  private axios: AxiosInstance;

  constructor(config: AgentServiceConfig) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await this.withRetry(() =>
        this.axios.post('/api/chat', request)
      );
      return response.data;
    } catch (error) {
      logger.error('Agent service chat failed:', error);
      throw error;
    }
  }

  async registerAgent(agentType: string, config: AgentConfig): Promise<void> {
    try {
      await this.axios.post(`/api/agents/${agentType}/register`, config);
      logger.info(`Agent ${agentType} registered successfully`);
    } catch (error) {
      logger.error(`Failed to register agent ${agentType}:`, error);
      throw error;
    }
  }

  async unregisterAgent(agentType: string): Promise<void> {
    try {
      await this.axios.post(`/api/agents/${agentType}/unregister`);
      logger.info(`Agent ${agentType} unregistered successfully`);
    } catch (error) {
      logger.error(`Failed to unregister agent ${agentType}:`, error);
      throw error;
    }
  }

  async listRegisteredAgents(): Promise<{ agents: string[]; configs: Record<string, AgentConfig> }> {
    try {
      const response = await this.axios.get('/api/agents/registered');
      return response.data;
    } catch (error) {
      logger.error('Failed to list registered agents:', error);
      throw error;
    }
  }

  async syncLLMConfig(config: LLMConfig): Promise<void> {
    try {
      await this.axios.post('/api/llm/config', config);
      logger.info('LLM config synced successfully');
    } catch (error) {
      logger.error('Failed to sync LLM config:', error);
      throw error;
    }
  }

  async getLLMConfig(): Promise<LLMConfig> {
    try {
      const response = await this.axios.get('/api/llm/config');
      return response.data.config;
    } catch (error) {
      logger.error('Failed to get LLM config:', error);
      throw error;
    }
  }

  async searchKnowledge(query: string, category?: string): Promise<unknown[]> {
    try {
      const response = await this.axios.post('/api/knowledge/search', {
        query,
        category,
      });
      return response.data.results;
    } catch (error) {
      logger.error('Failed to search knowledge:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axios.get('/api/health');
      return response.data.status === 'healthy';
    } catch {
      return false;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.config.retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < this.config.retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }
}

// Default client instance
let defaultClient: AgentServiceClient | null = null;

export function getAgentServiceClient(): AgentServiceClient {
  if (!defaultClient) {
    const config: AgentServiceConfig = {
      baseUrl: process.env.AGENT_SERVICE_URL || 'http://localhost:8000',
      timeout: parseInt(process.env.AGENT_SERVICE_TIMEOUT || '30000'),
      retries: parseInt(process.env.AGENT_SERVICE_RETRIES || '3'),
    };
    defaultClient = new AgentServiceClient(config);
  }
  return defaultClient;
}
