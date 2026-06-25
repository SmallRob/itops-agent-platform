# Agent Service Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate itops-agent-service into itops-agent-platform backend, enabling platform to call independent agent service via HTTP API, with dynamic agent registration and shared LLM configuration.

**Architecture:** HTTP API proxy pattern - agent-service runs as independent FastAPI service, platform calls via AgentServiceClient. Supports dynamic agent registration, LLM config sync, and graceful degradation.

**Tech Stack:** TypeScript (Platform), Python (Agent Service), FastAPI, Axios, PydanticAI

---

## File Structure

### Agent Service (itops-agent-service/)
- `src/api/agent_registry.py` - Dynamic agent registration manager
- `src/api/llm_config_manager.py` - LLM configuration manager
- `src/api/health.py` - Health check endpoint
- `tests/test_agent_registry.py` - Agent registry tests
- `tests/test_llm_config_manager.py` - LLM config manager tests

### Platform Backend (backend/src/)
- `services/agent/agentServiceClient.ts` - HTTP client for agent service
- `services/agent/agentServiceConfig.ts` - Configuration management
- `routes/agentServiceRoutes.ts` - API routes for agent service
- `tests/services/agent/agentServiceClient.test.ts` - Client tests

---

### Task 1: Agent Service - Agent Registry

**Covers:** S1 (Dynamic Agent Registration)

**Files:**
- Create: `itops-agent-service/src/api/agent_registry.py`
- Test: `itops-agent-service/tests/test_agent_registry.py`

- [ ] **Step 1: Write the failing test**

```python
# itops-agent-service/tests/test_agent_registry.py
import pytest
from src.api.agent_registry import AgentRegistry, AgentConfig

@pytest.fixture
def registry():
    return AgentRegistry()

def test_register_agent(registry):
    config = AgentConfig(
        name="test-agent",
        system_prompt="You are a test agent",
        model="openai:gpt-4o"
    )
    registry.register("test", config)
    assert "test" in registry.list_agents()

def test_unregister_agent(registry):
    config = AgentConfig(
        name="test-agent",
        system_prompt="You are a test agent",
        model="openai:gpt-4o"
    )
    registry.register("test", config)
    registry.unregister("test")
    assert "test" not in registry.list_agents()

def test_get_agent(registry):
    config = AgentConfig(
        name="test-agent",
        system_prompt="You are a test agent",
        model="openai:gpt-4o"
    )
    registry.register("test", config)
    agent = registry.get_agent("test")
    assert agent is not None
    assert agent.name == "test-agent"

def test_list_agents(registry):
    config1 = AgentConfig(name="agent1", system_prompt="Agent 1")
    config2 = AgentConfig(name="agent2", system_prompt="Agent 2")
    registry.register("test1", config1)
    registry.register("test2", config2)
    agents = registry.list_agents()
    assert len(agents) == 2
    assert "test1" in agents
    assert "test2" in agents
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd itops-agent-service && python -m pytest tests/test_agent_registry.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.api.agent_registry'"

- [ ] **Step 3: Write minimal implementation**

```python
# itops-agent-service/src/api/agent_registry.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..agents import ITOpsAgent, create_agent


class AgentConfig(BaseModel):
    """Agent configuration"""
    name: str = Field(description="Agent display name")
    system_prompt: str = Field(description="System prompt")
    model: Optional[str] = Field(default=None, description="LLM model")
    tools: list[str] = Field(default_factory=list, description="Enabled tools")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AgentRegistry:
    """Dynamic agent registry"""
    
    def __init__(self):
        self._agents: dict[str, ITOpsAgent] = {}
        self._configs: dict[str, AgentConfig] = {}
    
    def register(self, agent_type: str, config: AgentConfig) -> None:
        """Register a new agent type"""
        self._configs[agent_type] = config
        # Create agent instance with custom config
        agent = self._create_agent_from_config(agent_type, config)
        self._agents[agent_type] = agent
    
    def unregister(self, agent_type: str) -> None:
        """Unregister an agent type"""
        self._agents.pop(agent_type, None)
        self._configs.pop(agent_type, None)
    
    def get_agent(self, agent_type: str) -> Optional[ITOpsAgent]:
        """Get agent instance by type"""
        return self._agents.get(agent_type)
    
    def list_agents(self) -> list[str]:
        """List all registered agent types"""
        return list(self._agents.keys())
    
    def get_config(self, agent_type: str) -> Optional[AgentConfig]:
        """Get agent configuration"""
        return self._configs.get(agent_type)
    
    def _create_agent_from_config(self, agent_type: str, config: AgentConfig) -> ITOpsAgent:
        """Create agent instance from config"""
        # Try to use predefined agent types first
        predefined_types = ["general", "alert", "diagnosis", "inspection"]
        
        if agent_type in predefined_types:
            return create_agent(agent_type, model=config.model)
        
        # Create custom agent for unknown types
        return ITOpsAgent(
            name=config.name,
            system_prompt=config.system_prompt,
            model=config.model,
        )


# Global registry instance
_agent_registry: Optional[AgentRegistry] = None


def get_agent_registry() -> AgentRegistry:
    """Get global agent registry instance"""
    global _agent_registry
    if _agent_registry is None:
        _agent_registry = AgentRegistry()
    return _agent_registry
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd itops-agent-service && python -m pytest tests/test_agent_registry.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd itops-agent-service
git add src/api/agent_registry.py tests/test_agent_registry.py
git commit -m "feat: add dynamic agent registry"
```

---

### Task 2: Agent Service - LLM Config Manager

**Covers:** S2 (Shared LLM Configuration)

**Files:**
- Create: `itops-agent-service/src/api/llm_config_manager.py`
- Test: `itops-agent-service/tests/test_llm_config_manager.py`

- [ ] **Step 1: Write the failing test**

```python
# itops-agent-service/tests/test_llm_config_manager.py
import pytest
from src.api.llm_config_manager import LLMConfigManager, LLMConfig

@pytest.fixture
def manager():
    return LLMConfigManager()

def test_update_config(manager):
    config = LLMConfig(
        provider="openai",
        model="gpt-4o",
        api_key="test-key",
        api_base="https://api.openai.com/v1"
    )
    manager.update_config(config)
    assert manager.get_config().provider == "openai"
    assert manager.get_config().model == "gpt-4o"

def test_get_config(manager):
    config = manager.get_config()
    assert config is not None
    assert hasattr(config, 'provider')
    assert hasattr(config, 'model')

def test_update_provider(manager):
    manager.update_provider("doubao")
    assert manager.get_config().provider == "doubao"

def test_update_model(manager):
    manager.update_model("gpt-4o-mini")
    assert manager.get_config().model == "gpt-4o-mini"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd itops-agent-service && python -m pytest tests/test_llm_config_manager.py -v`
Expected: FAIL with "ModuleNotFoundError: No module named 'src.api.llm_config_manager'"

- [ ] **Step 3: Write minimal implementation**

```python
# itops-agent-service/src/api/llm_config_manager.py
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from ..config import settings, LLMProvider


class LLMConfig(BaseModel):
    """LLM configuration"""
    provider: str = Field(description="LLM provider (openai, doubao, deepseek, etc.)")
    model: str = Field(description="Model name")
    api_key: Optional[str] = Field(default=None, description="API key")
    api_base: Optional[str] = Field(default=None, description="API base URL")
    temperature: Optional[float] = Field(default=None, description="Temperature")
    max_tokens: Optional[int] = Field(default=None, description="Max tokens")


class LLMConfigManager:
    """LLM configuration manager"""
    
    def __init__(self):
        self._config: LLMConfig = self._load_from_settings()
    
    def _load_from_settings(self) -> LLMConfig:
        """Load config from settings"""
        return LLMConfig(
            provider=settings.llm_provider.value,
            model=settings.llm_model,
            api_key=settings.openai_api_key,
            api_base=settings.openai_api_base,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
    
    def get_config(self) -> LLMConfig:
        """Get current LLM configuration"""
        return self._config
    
    def update_config(self, config: LLMConfig) -> None:
        """Update LLM configuration"""
        self._config = config
        self._apply_to_settings(config)
    
    def update_provider(self, provider: str) -> None:
        """Update LLM provider"""
        self._config.provider = provider
        self._apply_provider(provider)
    
    def update_model(self, model: str) -> None:
        """Update LLM model"""
        self._config.model = model
        settings.llm_model = model
    
    def _apply_to_settings(self, config: LLMConfig) -> None:
        """Apply config to settings"""
        # Update provider
        try:
            settings.llm_provider = LLMProvider(config.provider)
        except ValueError:
            # If invalid provider, keep current
            pass
        
        # Update model
        if config.model:
            settings.llm_model = config.model
        
        # Update API key based on provider
        if config.api_key:
            if config.provider == "openai":
                settings.openai_api_key = config.api_key
            elif config.provider == "doubao":
                settings.doubao_api_key = config.api_key
            elif config.provider == "deepseek":
                settings.deepseek_api_key = config.api_key
            elif config.provider == "qwen":
                settings.qwen_api_key = config.api_key
        
        # Update API base
        if config.api_base:
            if config.provider == "openai":
                settings.openai_api_base = config.api_base
            elif config.provider == "doubao":
                settings.doubao_api_base = config.api_base
            elif config.provider == "deepseek":
                settings.deepseek_api_base = config.api_base
            elif config.provider == "qwen":
                settings.qwen_api_base = config.api_base
        
        # Update temperature and max tokens
        if config.temperature is not None:
            settings.llm_temperature = config.temperature
        if config.max_tokens is not None:
            settings.llm_max_tokens = config.max_tokens
    
    def _apply_provider(self, provider: str) -> None:
        """Apply provider change"""
        try:
            settings.llm_provider = LLMProvider(provider)
        except ValueError:
            pass


# Global config manager instance
_llm_config_manager: Optional[LLMConfigManager] = None


def get_llm_config_manager() -> LLMConfigManager:
    """Get global LLM config manager instance"""
    global _llm_config_manager
    if _llm_config_manager is None:
        _llm_config_manager = LLMConfigManager()
    return _llm_config_manager
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd itops-agent-service && python -m pytest tests/test_llm_config_manager.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd itops-agent-service
git add src/api/llm_config_manager.py tests/test_llm_config_manager.py
git commit -m "feat: add LLM config manager"
```

---

### Task 3: Agent Service - API Routes

**Covers:** S1, S2, S3 (Agent Registration, LLM Config, Health Check)

**Files:**
- Modify: `itops-agent-service/src/api/__init__.py`

- [ ] **Step 1: Add new API endpoints to FastAPI app**

```python
# Add to itops-agent-service/src/api/__init__.py

from ..api.agent_registry import get_agent_registry, AgentConfig
from ..api.llm_config_manager import get_llm_config_manager, LLMConfig

# ... existing code ...

@app.post("/api/agents/register")
async def register_agent(config: AgentConfig, agent_type: str):
    """Register a new agent type"""
    try:
        registry = get_agent_registry()
        registry.register(agent_type, config)
        return {"success": True, "agent_type": agent_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/agents/unregister")
async def unregister_agent(agent_type: str):
    """Unregister an agent type"""
    try:
        registry = get_agent_registry()
        registry.unregister(agent_type)
        return {"success": True, "agent_type": agent_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/agents/registered")
async def list_registered_agents():
    """List all registered agents"""
    registry = get_agent_registry()
    agents = registry.list_agents()
    configs = {agent_type: registry.get_config(agent_type) for agent_type in agents}
    return {"agents": agents, "configs": configs}

@app.post("/api/llm/config")
async def update_llm_config(config: LLMConfig):
    """Update LLM configuration"""
    try:
        manager = get_llm_config_manager()
        manager.update_config(config)
        return {"success": True, "config": manager.get_config().model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/llm/config")
async def get_llm_config():
    """Get current LLM configuration"""
    manager = get_llm_config_manager()
    return {"config": manager.get_config().model_dump()}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "agents_registered": len(get_agent_registry().list_agents()),
    }
```

- [ ] **Step 2: Test the new endpoints**

Run: `cd itops-agent-service && python -m src.api &`
Then: `curl http://localhost:8000/api/health`
Expected: `{"status":"healthy","version":"0.1.0","agents_registered":0}`

- [ ] **Step 3: Commit**

```bash
cd itops-agent-service
git add src/api/__init__.py
git commit -m "feat: add agent registration and LLM config API endpoints"
```

---

### Task 4: Platform - Agent Service Client

**Covers:** S4 (Platform HTTP Client)

**Files:**
- Create: `backend/src/services/agent/agentServiceClient.ts`
- Test: `backend/tests/services/agent/agentServiceClient.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/tests/services/agent/agentServiceClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentServiceClient } from '../../../src/services/agent/agentServiceClient';

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

    expect((client as any).axios.post).toHaveBeenCalledWith('/api/agents/register', {
      agent_type: 'test',
      name: 'Test Agent',
      system_prompt: 'You are a test agent',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- tests/services/agent/agentServiceClient.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/services/agent/agentServiceClient.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '@utils/logger';

export interface AgentServiceConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
}

export interface ChatRequest {
  message: string;
  agent_type: string;
  context?: Record<string, any>;
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
      await this.axios.post('/api/agents/register', {
        agent_type: agentType,
        ...config,
      });
      logger.info(`Agent ${agentType} registered successfully`);
    } catch (error) {
      logger.error(`Failed to register agent ${agentType}:`, error);
      throw error;
    }
  }

  async unregisterAgent(agentType: string): Promise<void> {
    try {
      await this.axios.post('/api/agents/unregister', {
        agent_type: agentType,
      });
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

  async searchKnowledge(query: string, category?: string): Promise<any[]> {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- tests/services/agent/agentServiceClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/services/agent/agentServiceClient.ts tests/services/agent/agentServiceClient.test.ts
git commit -m "feat: add Agent Service HTTP client"
```

---

### Task 5: Platform - Agent Service Routes

**Covers:** S5 (Platform API Routes)

**Files:**
- Create: `backend/src/routes/agentServiceRoutes.ts`

- [ ] **Step 1: Create agent service routes**

```typescript
// backend/src/routes/agentServiceRoutes.ts
import { Router, Request, Response } from 'express';
import { getAgentServiceClient } from '@services/agent/agentServiceClient';
import { logger } from '@utils/logger';

const router = Router();

// Chat with agent
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, agent_type, context } = req.body;
    const client = getAgentServiceClient();
    const result = await client.chat({ message, agent_type, context });
    res.json(result);
  } catch (error) {
    logger.error('Agent service chat failed:', error);
    res.status(500).json({ error: 'Failed to chat with agent' });
  }
});

// Register agent
router.post('/agents/register', async (req: Request, res: Response) => {
  try {
    const { agent_type, ...config } = req.body;
    const client = getAgentServiceClient();
    await client.registerAgent(agent_type, config);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to register agent:', error);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

// Unregister agent
router.post('/agents/unregister', async (req: Request, res: Response) => {
  try {
    const { agent_type } = req.body;
    const client = getAgentServiceClient();
    await client.unregisterAgent(agent_type);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to unregister agent:', error);
    res.status(500).json({ error: 'Failed to unregister agent' });
  }
});

// List registered agents
router.get('/agents/registered', async (req: Request, res: Response) => {
  try {
    const client = getAgentServiceClient();
    const result = await client.listRegisteredAgents();
    res.json(result);
  } catch (error) {
    logger.error('Failed to list registered agents:', error);
    res.status(500).json({ error: 'Failed to list registered agents' });
  }
});

// Sync LLM config
router.post('/llm/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    const client = getAgentServiceClient();
    await client.syncLLMConfig(config);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to sync LLM config:', error);
    res.status(500).json({ error: 'Failed to sync LLM config' });
  }
});

// Get LLM config
router.get('/llm/config', async (req: Request, res: Response) => {
  try {
    const client = getAgentServiceClient();
    const config = await client.getLLMConfig();
    res.json({ config });
  } catch (error) {
    logger.error('Failed to get LLM config:', error);
    res.status(500).json({ error: 'Failed to get LLM config' });
  }
});

// Search knowledge
router.post('/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { query, category } = req.body;
    const client = getAgentServiceClient();
    const results = await client.searchKnowledge(query, category);
    res.json({ results });
  } catch (error) {
    logger.error('Failed to search knowledge:', error);
    res.status(500).json({ error: 'Failed to search knowledge' });
  }
});

// Health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const client = getAgentServiceClient();
    const isHealthy = await client.healthCheck();
    res.json({ status: isHealthy ? 'healthy' : 'unhealthy' });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.json({ status: 'unhealthy' });
  }
});

export default router;
```

- [ ] **Step 2: Register routes in app.ts**

```typescript
// Add to backend/src/app.ts
import agentServiceRoutes from '@routes/agentServiceRoutes';

// ... existing routes ...

app.use('/api/agent-service', agentServiceRoutes);
```

- [ ] **Step 3: Commit**

```bash
cd backend
git add src/routes/agentServiceRoutes.ts src/app.ts
git commit -m "feat: add agent service API routes"
```

---

### Task 6: Platform - Register Existing Agents on Startup

**Covers:** S6 (Existing Agent Integration)

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Add agent registration on startup**

```typescript
// Add to backend/src/app.ts

import { getAgentServiceClient } from '@services/agent/agentServiceClient';
import db from '@models/database';

async function registerExistingAgents() {
  try {
    const client = getAgentServiceClient();
    
    // Check if agent service is available
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      logger.warn('Agent service not available, skipping agent registration');
      return;
    }
    
    // Get existing agents from database
    const agents = db.prepare('SELECT * FROM agents').all() as Array<{
      id: string;
      name: string;
      system_prompt: string;
    }>;
    
    // Register each agent
    for (const agent of agents) {
      try {
        await client.registerAgent(agent.id, {
          name: agent.name,
          system_prompt: agent.system_prompt,
        });
        logger.info(`Registered agent: ${agent.name}`);
      } catch (error) {
        logger.error(`Failed to register agent ${agent.name}:`, error);
      }
    }
    
    logger.info(`Registered ${agents.length} agents with agent service`);
  } catch (error) {
    logger.error('Failed to register existing agents:', error);
  }
}

// Call on startup
registerExistingAgents();
```

- [ ] **Step 2: Commit**

```bash
cd backend
git add src/app.ts
git commit -m "feat: register existing agents on startup"
```

---

### Task 7: Testing and Verification

**Covers:** All specs

- [ ] **Step 1: Start agent service**

```bash
cd itops-agent-service
python -m src.api
```

- [ ] **Step 2: Test health endpoint**

```bash
curl http://localhost:8000/api/health
```

Expected: `{"status":"healthy","version":"0.1.0","agents_registered":0}`

- [ ] **Step 3: Test agent registration**

```bash
curl -X POST http://localhost:8000/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"agent_type": "test", "name": "Test Agent", "system_prompt": "You are a test agent"}'
```

Expected: `{"success":true,"agent_type":"test"}`

- [ ] **Step 4: Test LLM config update**

```bash
curl -X POST http://localhost:8000/api/llm/config \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "model": "gpt-4o"}'
```

Expected: `{"success":true,"config":{...}}`

- [ ] **Step 5: Start platform backend**

```bash
cd backend
npm run dev
```

- [ ] **Step 6: Test platform agent service routes**

```bash
curl http://localhost:3001/api/agent-service/health
```

Expected: `{"status":"healthy"}`

- [ ] **Step 7: Run all tests**

```bash
# Agent service tests
cd itops-agent-service
python -m pytest tests/ -v

# Platform tests
cd backend
npm test
```

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete agent service integration"
```

---

## Summary

This plan implements the following:

1. **Agent Registry** - Dynamic agent registration in agent-service
2. **LLM Config Manager** - Shared LLM configuration management
3. **API Routes** - New endpoints for registration and config
4. **Platform Client** - HTTP client for calling agent-service
5. **Platform Routes** - API routes exposing agent-service functionality
6. **Startup Registration** - Auto-register existing agents on platform startup
7. **Testing** - Comprehensive testing of all components

The implementation follows the HTTP API proxy pattern with graceful degradation to local agents when agent-service is unavailable.
