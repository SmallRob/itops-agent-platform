/**
 * ITOps Agent Harness 统一入口
 * 借鉴 NiceKit 的 Harness 架构
 * 
 * 提供统一的初始化和使用接口
 */

import { ContextEngine } from './contextEngine';
import { ContextBudgetManager } from './contextBudget';
import { runAgentLoop, parseToolCalls, cleanToolCallMarkers } from './agentLoop';
import type { AgentTool } from './agentLoop';
import type {
  AgentExecutionContext,
  ContextBuildOutput,
  ContextBudget,
  AgentLoopConfig,
  AgentLoopResult,
} from './types';
import { DEFAULT_BUDGET } from './types';

// 初始化标志
let _initialized = false;

// ContextEngine 单例
let _contextEngine: ContextEngine | null = null;

/**
 * 获取 ContextEngine 实例（懒加载单例）
 */
export const getContextEngine = (budget?: Partial<ContextBudget>): ContextEngine => {
  if (!_contextEngine) {
    _contextEngine = new ContextEngine(budget || DEFAULT_BUDGET);
  }
  return _contextEngine;
};

/**
 * 初始化 Harness 系统（只需调用一次）
 */
export const initializeHarness = (): void => {
  if (_initialized) {
    console.log('[Harness] 已初始化，跳过');
    return;
  }

  _initialized = true;
  console.log('[Harness] Agent Harness 初始化完成');
};

// 导出所有类型和函数
export {
  // 上下文引擎
  ContextEngine,
  ContextBudgetManager,
  
  // Agent Loop
  runAgentLoop,
  parseToolCalls,
  cleanToolCallMarkers,
  
  // 类型
  type AgentTool,
  type AgentExecutionContext,
  type ContextBuildOutput,
  type ContextBudget,
  type AgentLoopConfig,
  type AgentLoopResult,
  
  // 常量
  DEFAULT_BUDGET,
};
