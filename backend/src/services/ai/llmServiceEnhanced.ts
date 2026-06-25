/**
 * ITOps Agent Platform - 增强版 LLM 服务
 * 基于 Transport 架构，借鉴 NiceKit 设计
 * 
 * 新增功能：
 * 1. 统一的 Transport 抽象层
 * 2. 流式生成支持
 * 3. 工具调用支持
 * 4. 结构化错误类型
 */

import db from '@models/database';
import { logger } from '@utils/logger';
// 使用简单的 UUID 生成替代 crypto
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import { getApiKey, getModelId, getApiBase, buildApiEndpoint } from '@utils/apiConfig';
import { qanythingService } from '@services/knowledge/qanythingService';
import * as aiModelService from './aiModelService';
import type { AIModel } from './aiModelService';
import { createTransportManager, TransportManager } from './transports';
import type {
  ChatMessage,
  ModelConfig,
  TransportGenerateParams,
  TransportResponse,
  TransportStreamChunk,
  TransportToolParams,
  TransportToolResponse,
  ToolDefinition,
} from './transports';
import {
  ApiError,
  CircuitBreakerError,
  buildUserFacingMessage,
} from '@utils/errors';

// 全局 Transport 管理器实例
let transportManager: TransportManager | null = null;

/**
 * 获取 Transport 管理器（单例）
 */
export function getTransportManager(): TransportManager {
  if (!transportManager) {
    transportManager = createTransportManager();
  }
  return transportManager;
}

/**
 * 将 AIModel 转换为 ModelConfig
 */
function aiModelToModelConfig(model: AIModel): ModelConfig {
  const apiKey = aiModelService.getEffectiveApiKey(model);
  const apiBase = aiModelService.getEffectiveApiBase(model);

  return {
    id: model.id,
    name: model.name,
    provider: model.provider_type,
    modelId: model.model_id,
    apiKey: apiKey || '',
    apiBase: apiBase,
    temperature: 0.7,
    maxTokens: 2048,
  };
}

/**
 * 记录 Agent 执行历史
 */
function recordAgentExecution(
  agentId: string,
  agentName: string,
  inputText: string,
  outputText: string,
  status: 'success' | 'failure',
  errorMessage?: string,
  executionTimeMs?: number,
  metadata?: Record<string, unknown>
): void {
  try {
    db.prepare(`
      INSERT INTO agent_executions (
        id, agent_id, agent_name, input_text, output_text, status, error_message, execution_time_ms, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateUUID(),
      agentId,
      agentName,
      inputText,
      outputText,
      status,
      errorMessage || null,
      executionTimeMs || null,
      metadata ? JSON.stringify(metadata) : null
    );
  } catch (error) {
    logger.error('Failed to record agent execution:', error);
  }
}

/**
 * 更新 Agent 使用统计
 */
function updateAgentStats(agentId: string): void {
  try {
    db.prepare(`
      UPDATE agents 
      SET usage_count = usage_count + 1, last_used_at = datetime('now','localtime')
      WHERE id = ?
    `).run(agentId);
  } catch (error) {
    logger.error('Failed to update agent stats:', error);
  }
}

/**
 * 增强版 LLM 生成完成函数
 * 支持流式输出和工具调用
 */
export async function generateCompletion(
  prompt: string,
  systemPrompt: string = '你是一个专业的助手。',
  temperature: number = 0.7,
  model?: string,
  agentId: string = ''
): Promise<string> {
  const timeoutMs = 120000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`LLM generateCompletion 超时 (${timeoutMs / 1000}s)`)), timeoutMs);
  });

  // 优先使用 AI 模型池中的默认模型
  const defaultModel = aiModelService.getDefaultModel();
  if (defaultModel && defaultModel.enabled) {
    logger.info(`🤖 [generateCompletion] Using default model from AI Model Pool: ${defaultModel.name} (${defaultModel.provider_type})`);

    const modelConfig = aiModelToModelConfig(defaultModel);
    const manager = getTransportManager();
    const transport = manager.getTransport(modelConfig);

    const params: TransportGenerateParams = {
      model: modelConfig,
      messages: [{ role: 'user', content: prompt }],
      systemInstruction: systemPrompt,
      temperature,
    };

    return Promise.race([
      transport.generate(params).then(result => result.text),
      timeoutPromise
    ]);
  }

  // 降级到旧逻辑（向后兼容）
  logger.info(`[generateCompletion] No AI Model Pool configured, falling back to legacy mode`);

  // 动态导入旧的 llmService 以避免循环依赖
  const { generateCompletion: legacyGenerateCompletion } = await import('./llmService');
  return legacyGenerateCompletion(prompt, systemPrompt, temperature, model, agentId);
}

/**
 * 增强版 Agent 执行函数
 * 使用 Transport 架构，支持流式和工具调用
 */
export async function executeAgentWithLLM(
  agentId: string,
  userInput: string
): Promise<string> {
  const agent = db.prepare('SELECT id, name, system_prompt, temperature, model, api_provider, primary_model_id, fallback_model_id FROM agents WHERE id = ?').get(agentId) as {
    id: string;
    name: string;
    system_prompt: string;
    temperature: number;
    model: string;
    api_provider: string;
    primary_model_id: string | null;
    fallback_model_id: string | null;
  } | undefined;

  if (!agent) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  updateAgentStats(agentId);

  // 优先使用 QAnything 检索知识库
  let knowledgeContext = '';
  try {
    if (qanythingService.isEnabled()) {
      logger.info('🔍 Using QAnything for knowledge retrieval...');
      knowledgeContext = await qanythingService.queryKnowledge(userInput, qanythingService.getTopK());
    }
  } catch (error) {
    logger.warn('⚠️ QAnything query failed, proceeding without knowledge context:', error);
  }

  // 构建增强 System Prompt
  let enhancedSystemPrompt = agent.system_prompt || `你是一个专业的${agent.name || 'IT运维'}助手。`;

  if (knowledgeContext) {
    enhancedSystemPrompt += `\n\n【相关知识库内容】\n${knowledgeContext}\n\n`;
    enhancedSystemPrompt += '请基于以上知识库内容回答用户问题。如果知识库内容不足以回答问题，请结合你的专业知识进行补充。\n\n';
  }

  const temperature = agent.temperature || 0.7;
  const manager = getTransportManager();

  // 模型选择优先级：主模型 > 备选模型 > 默认模型
  const modelCandidates = [
    agent.primary_model_id,
    agent.fallback_model_id,
  ].filter(Boolean) as string[];

  // 添加默认模型
  const defaultModel = aiModelService.getDefaultModel();
  if (defaultModel) {
    modelCandidates.push(defaultModel.id);
  }

  let lastError: unknown = null;

  for (const modelId of modelCandidates) {
    try {
      const model = aiModelService.getModelById(modelId);
      if (!model || !model.enabled) {
        continue;
      }

      const modelConfig = aiModelToModelConfig(model);
      const transport = manager.getTransport(modelConfig);

      const params: TransportGenerateParams = {
        model: modelConfig,
        messages: [{ role: 'user', content: userInput }],
        systemInstruction: enhancedSystemPrompt,
        temperature,
      };

      logger.info(`🤖 [${agent.name}] Calling ${model.name} (${model.model_id})...`);

      const result = await transport.generate(params);

      // 记录执行成功
      recordAgentExecution(
        agentId,
        agent.name,
        userInput,
        result.text,
        'success',
        undefined,
        result.latencyMs,
        {
          tokens: result.usage,
          model_id: model.model_id,
          provider: model.provider_type,
        }
      );

      logger.info(`✅ [${agent.name}] Call successful, ${result.text.length} chars, ${result.latencyMs}ms`);

      return result.text;
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`⚠️ [${agent.name}] Model ${modelId} failed: ${errorMessage}`);

      // 如果是熔断器错误，继续尝试下一个模型
      if (error instanceof CircuitBreakerError) {
        continue;
      }
    }
  }

  // 所有模型都失败
  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown error';
  const userMessage = buildUserFacingMessage(lastError);

  recordAgentExecution(
    agentId,
    agent.name,
    userInput,
    '',
    'failure',
    errorMessage
  );

  logger.error(`❌ [${agent.name}] All models failed`);
  throw new Error(userMessage);
}

/**
 * 流式生成函数
 * 使用 AsyncGenerator 返回增量结果
 */
export async function* generateCompletionStream(
  prompt: string,
  systemPrompt: string = '你是一个专业的助手。',
  temperature: number = 0.7,
  agentId: string = ''
): AsyncGenerator<TransportStreamChunk, string> {
  const defaultModel = aiModelService.getDefaultModel();
  if (!defaultModel || !defaultModel.enabled) {
    throw new Error('No AI model configured');
  }

  const modelConfig = aiModelToModelConfig(defaultModel);
  const manager = getTransportManager();
  const transport = manager.getTransport(modelConfig);

  const params = {
    model: modelConfig,
    messages: [{ role: 'user' as const, content: prompt }],
    systemInstruction: systemPrompt,
    temperature,
    onToken: (token: string) => {
      // 可以在这里添加实时回调
    },
  };

  const generator = transport.generateStream(params);
  let result = await generator.next();

  while (!result.done) {
    yield result.value;
    result = await generator.next();
  }

  return result.value.text;
}

/**
 * 工具调用函数
 */
export async function generateWithTools(
  prompt: string,
  tools: ToolDefinition[],
  systemPrompt: string = '你是一个专业的助手。',
  temperature: number = 0.7,
  agentId: string = ''
): Promise<TransportToolResponse> {
  const defaultModel = aiModelService.getDefaultModel();
  if (!defaultModel || !defaultModel.enabled) {
    throw new Error('No AI model configured');
  }

  const modelConfig = aiModelToModelConfig(defaultModel);
  const manager = getTransportManager();
  const transport = manager.getTransport(modelConfig);

  if (!transport.generateWithTools) {
    throw new Error(`Transport ${transport.id} does not support tool calls`);
  }

  const params: TransportToolParams = {
    model: modelConfig,
    messages: [{ role: 'user', content: prompt }],
    systemInstruction: systemPrompt,
    temperature,
    tools,
  };

  return transport.generateWithTools(params);
}

/**
 * 检查 LLM 服务可用性
 */
export async function checkLLMAvailability(): Promise<{
  available: boolean;
  message: string;
  provider?: string;
}> {
  const defaultModel = aiModelService.getDefaultModel();

  if (defaultModel && defaultModel.enabled) {
    const modelConfig = aiModelToModelConfig(defaultModel);
    const manager = getTransportManager();

    try {
      const transport = manager.getTransport(modelConfig);
      return {
        available: true,
        message: `${defaultModel.name} available`,
        provider: defaultModel.provider_type,
      };
    } catch {
      return {
        available: false,
        message: `No transport available for ${defaultModel.name}`,
      };
    }
  }

  return {
    available: false,
    message: 'No AI model configured',
  };
}

/**
 * 获取 Transport 统计信息
 */
export function getTransportStats(): {
  transports: string[];
  models: Array<{ id: string; name: string; provider: string; enabled: boolean }>;
} {
  const manager = getTransportManager();
  const transports = manager.getTransports().map(t => t.id);
  const models = aiModelService.getAllModels().map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider_type,
    enabled: m.enabled === 1,
  }));

  return { transports, models };
}
