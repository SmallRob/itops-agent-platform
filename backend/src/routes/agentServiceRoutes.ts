import { Router, Request, Response } from 'express';
import { getAgentServiceClient } from '@services/agent/agentServiceClient';
import { logger } from '@utils/logger';

const router = Router();

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

router.post('/agents/:agentType/register', async (req: Request, res: Response) => {
  try {
    const { agentType } = req.params;
    const config = req.body;
    const client = getAgentServiceClient();
    await client.registerAgent(agentType, config);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to register agent:', error);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

router.post('/agents/:agentType/unregister', async (req: Request, res: Response) => {
  try {
    const { agentType } = req.params;
    const client = getAgentServiceClient();
    await client.unregisterAgent(agentType);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to unregister agent:', error);
    res.status(500).json({ error: 'Failed to unregister agent' });
  }
});

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
