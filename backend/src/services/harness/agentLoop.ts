/**
 * Agent ReAct 循环引擎
 * 借鉴 NiceKit 的 AgentLoop 设计
 * 
 * ReAct 循环流程：
 * 1. Think: AI 根据上下文决定是否需要调用工具
 * 2. Act: 如果需要工具，解析工具名称和参数
 * 3. Execute: 执行工具，获取结果
 * 4. Observe: 将结果反馈给 AI，继续思考
 * 5. Respond: 当 AI 认为无需更多工具时，返回最终响应
 */

import { logger } from '../../utils/logger';
import type { AgentLoopConfig, AgentLoopResult } from './types';

/** 工具定义 */
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

/** 工具调用解析结果 */
interface ParsedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 解析 AI 响应中的工具调用
 * 支持多种格式：
 * - XML 格式: <tool_calls>{"name":"xxx","arguments":{...}}</tool_calls>
 * - JSON 格式: {"tool_calls": [...]}
 */
export function parseToolCalls(response: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  try {
    // 格式 1: XML 格式
    const toolCallRegex = /<tool_calls>([\s\S]*?)<\/tool_calls>/g;
    let match;

    while ((match = toolCallRegex.exec(response)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.name && parsed.arguments) {
          calls.push({
            name: parsed.name,
            arguments: typeof parsed.arguments === 'string'
              ? JSON.parse(parsed.arguments)
              : parsed.arguments
          });
        }
      } catch {
        // JSON 解析失败，尝试其他格式
      }
    }

    // 格式 2: JSON 格式
    if (calls.length === 0) {
      try {
        const jsonMatch = response.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.tool_calls)) {
            for (const call of parsed.tool_calls) {
              if (call.function) {
                calls.push({
                  name: call.function.name,
                  arguments: typeof call.function.arguments === 'string'
                    ? JSON.parse(call.function.arguments)
                    : call.function.arguments
                });
              }
            }
          }
        }
      } catch {
        // 解析失败
      }
    }
  } catch {
    // 正则匹配失败
  }

  return calls;
}

/**
 * 清理 XML 格式的工具调用标记
 */
export function cleanToolCallMarkers(text: string): string {
  return text
    .replace(/<tool_calls>[\s\S]*?<\/tool_calls>/g, '')
    .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
    .trim();
}

/**
 * 构建 ReAct 提示词
 */
function buildReActPrompt(
  userMessage: string,
  tools: AgentTool[],
  maxIterations: number,
  currentIteration: number,
  toolResults: Array<{ name: string; result: string; success: boolean }>,
): string {
  const toolsDescription = tools.map(tool =>
    `【${tool.name}】${tool.description}\n  参数: ${JSON.stringify(tool.parameters)}`
  ).join('\n\n');

  const toolResultsText = toolResults.length > 0
    ? `\n## 工具调用结果\n${toolResults.map(r => {
        const status = r.success ? '✅' : '❌';
        return `${status} ${r.name}: ${r.result}`;
      }).join('\n')}`
    : '';

  return `## 可用工具
${toolsDescription || '（无可用工具）'}

${toolResultsText}

## 当前任务
用户消息: ${userMessage}

## 执行指令
你正在执行第 ${currentIteration}/${maxIterations} 次迭代。

在回答之前，请先思考是否需要使用工具：
- 如果需要调用工具，请使用以下 XML 格式：
<tool_calls>{"name":"工具名称","arguments":{"参数名":"参数值"}}</tool_calls>
- 如果不需要工具，直接回答用户问题

注意：
1. 每次迭代最多调用一个工具
2. 如果决定调用工具：你必须只输出一段 <tool_calls>... </tool_calls>，不要输出任何额外文本
3. 工具调用完成后，系统会把结果以 <tool_result>... </tool_result> 形式加入对话历史
4. 只有在获得所有必要信息后才给出最终回答
5. 如果达到最大迭代次数仍未完成任务，请给出当前最好的回答`;
}

/**
 * 为 ReAct 循环包装整体超时
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AgentLoop 整体超时')), timeoutMs)
    ),
  ]);
}

/**
 * 执行单个工具调用
 */
async function executeToolCall(
  toolCall: ParsedToolCall,
  tools: AgentTool[],
  timeout: number,
): Promise<{ success: boolean; result: string }> {
  const tool = tools.find(t => t.name === toolCall.name);

  if (!tool) {
    return {
      success: false,
      result: `工具 "${toolCall.name}" 不存在`,
    };
  }

  // 带超时的执行
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race<string>([
      tool.execute(toolCall.arguments),
      new Promise<string>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('工具执行超时'));
        }, timeout);
      })
    ]);

    return { success: true, result };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return { success: false, result: `工具执行错误: ${errorMsg}` };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Agent ReAct 循环核心函数
 */
async function runAgentLoopCore(
  userMessage: string,
  tools: AgentTool[],
  aiCaller: (prompt: string) => Promise<string>,
  config: AgentLoopConfig = {},
): Promise<AgentLoopResult> {
  const maxIterations = config.maxIterations || 5;
  const verbose = config.verbose || false;
  const toolTimeout = config.toolTimeout || 30000;
  const loopStartTime = Date.now();
  const timeoutMs = config.timeoutMs;

  const toolCallHistory: AgentLoopResult['toolCalls'] = [];
  const toolResults: Array<{ name: string; result: string; success: boolean }> = [];
  let iterations = 0;
  let completed = false;
  let finalResponse = '';
  let timedOut = false;

  while (iterations < maxIterations && !completed) {
    iterations++;

    // 检查整体超时
    if (timeoutMs && Date.now() - loopStartTime > timeoutMs) {
      timedOut = true;
      finalResponse = '抱歉，处理该问题已超时，请稍后再试。';
      break;
    }

    if (verbose) {
      logger.info(`[AgentLoop] 迭代 ${iterations}/${maxIterations}`);
    }

    // 构建提示词
    const prompt = buildReActPrompt(
      userMessage,
      tools,
      maxIterations,
      iterations,
      toolResults,
    );

    // 调用 AI
    const aiResponse = await aiCaller(prompt);

    if (verbose) {
      logger.info(`[AgentLoop] AI 响应: ${aiResponse.slice(0, 200)}`);
    }

    // 解析工具调用
    const toolCalls = parseToolCalls(aiResponse);

    if (toolCalls.length === 0) {
      // 没有工具调用，返回响应
      completed = true;
      finalResponse = cleanToolCallMarkers(aiResponse);
      break;
    }

    // 执行工具调用
    const toolCall = toolCalls[0]; // 每次只执行一个
    const { success, result } = await executeToolCall(toolCall, tools, toolTimeout);

    if (verbose) {
      logger.info(`[AgentLoop] 工具结果: ${success ? '✅' : '❌'} ${result.slice(0, 100)}`);
    }

    // 记录工具调用
    toolCallHistory.push({
      name: toolCall.name,
      arguments: toolCall.arguments,
      result,
      success,
      timestamp: Date.now(),
    });

    // 添加到工具结果列表
    toolResults.push({
      name: toolCall.name,
      result,
      success,
    });
  }

  // 达到最大迭代次数
  if (!completed && !timedOut) {
    finalResponse = '抱歉，我需要更多时间来思考这个问题。请稍后再试。';
  }

  const durationMs = Date.now() - loopStartTime;

  return {
    response: finalResponse,
    completed,
    toolCalls: toolCallHistory,
    iterations,
    durationMs,
    timedOut,
  };
}

/**
 * Agent ReAct 循环主函数
 */
export async function runAgentLoop(
  userMessage: string,
  tools: AgentTool[],
  aiGenerate: (prompt: string) => Promise<string>,
  config: AgentLoopConfig = {},
): Promise<AgentLoopResult> {
  return withTimeout(
    runAgentLoopCore(userMessage, tools, aiGenerate, config),
    config.timeoutMs
  );
}

/**
 * 获取 Harness 统计信息
 */
export function getHarnessStats(): {
  toolsRegistered: number;
  toolNames: string[];
} {
  // 这里可以扩展为从全局注册表获取
  return {
    toolsRegistered: 0,
    toolNames: [],
  };
}
