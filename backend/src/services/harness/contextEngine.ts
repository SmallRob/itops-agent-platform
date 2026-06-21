/**
 * 上下文引擎（Context Engine）
 * 借鉴 NiceKit 的三层智能架构
 * 
 * 职责：
 * - 将原来的线性 prompt 拼接升级为三层架构
 * - 使用 ContextBudgetManager 控制 token 预算
 * - 输出结构化的 systemInstruction + userMessage
 */

import { logger } from '../../utils/logger';
import { ContextBudgetManager } from './contextBudget';
import type {
  AgentExecutionContext,
  ContextBuildOutput,
  ContextSection,
  ContextStats,
  ContextBudget,
} from './types';
import { DEFAULT_BUDGET } from './types';

export class ContextEngine {
  private budgetManager: ContextBudgetManager;

  constructor(budget?: Partial<ContextBudget>) {
    this.budgetManager = new ContextBudgetManager(budget || DEFAULT_BUDGET);
  }

  /**
   * 智能构建 Prompt
   * 
   * 替代原来的线性拼接逻辑，返回结构化的 systemInstruction + userMessage。
   */
  buildPrompt(input: AgentExecutionContext): ContextBuildOutput {
    const budgetManager = input.budget
      ? new ContextBudgetManager({ ...DEFAULT_BUDGET, ...input.budget })
      : this.budgetManager;

    // ── Step 1: 构建核心层（systemInstruction）──
    const systemInstruction = this.buildSystemInstruction(input);

    // ── Step 2: 构建工作层段 ──
    const knowledgeSection = this.buildKnowledgeSection(input);
    const toolResultsSection = this.buildToolResultsSection(input);

    // ── Step 3: 构建历史层段 ──
    const conversationSection = this.buildConversationSection(input);

    // ── Step 4: 构建行动指令段 ──
    const actionSection = this.buildActionSection(input);

    // ── Step 5: Token 预算管理 ──
    const allSections: ContextSection[] = [
      { name: 'knowledge', content: knowledgeSection, priority: 5 },
      { name: 'toolResults', content: toolResultsSection, priority: 6 },
      { name: 'conversation', content: conversationSection, priority: 8 },
      { name: 'action', content: actionSection, priority: 4 },
    ].filter((s) => s.content.length > 0);

    const budgetLimit = budgetManager.getLayerLimits();
    const workingBudget = budgetLimit.working + budgetLimit.archived;

    const fittedSections = budgetManager.fitToBudget(
      allSections,
      workingBudget,
    );

    // ── Step 6: 组装 userMessage ──
    const userMessage = this.assembleUserMessage(fittedSections, input);

    // ── Step 7: 构建统计 ──
    const stats = this.buildStats(
      systemInstruction,
      userMessage,
      allSections,
      fittedSections,
      budgetManager,
    );

    return { systemInstruction, userMessage, stats };
  }

  /**
   * 构建核心层：systemInstruction
   * 包含角色设定 + 行为约束
   */
  private buildSystemInstruction(input: AgentExecutionContext): string {
    const parts: string[] = [];

    // 1. System Prompt（角色设定）
    if (input.systemPrompt?.trim()) {
      parts.push(input.systemPrompt.trim());
    }

    // 2. 行为约束
    parts.push(
      '【行为约束】',
      '- 始终基于事实回答，不要编造信息',
      '- 如果不确定，请明确说明',
      '- 优先使用工具获取最新信息',
      '- 回答要简洁明了，避免冗余',
    );

    return parts.join('\n\n');
  }

  /**
   * 构建知识库检索段
   */
  private buildKnowledgeSection(input: AgentExecutionContext): string {
    if (!input.knowledgeContext?.trim()) return '';

    return `【知识库参考】\n${input.knowledgeContext.trim()}\n\n请基于以上知识库内容回答用户问题。如果知识库内容不足以回答问题，请结合你的专业知识进行补充。`;
  }

  /**
   * 构建工具调用结果段
   */
  private buildToolResultsSection(input: AgentExecutionContext): string {
    if (!input.toolResults?.length) return '';

    const results = input.toolResults
      .map((r, i) => {
        const status = r.success ? '✅' : '❌';
        return `[工具${i + 1}] ${status} ${r.name}\n参数: ${JSON.stringify(r.arguments)}\n结果: ${r.result}`;
      })
      .join('\n\n');

    return `【工具调用结果】\n${results}`;
  }

  /**
   * 构建对话历史段
   */
  private buildConversationSection(input: AgentExecutionContext): string {
    if (!input.conversationHistory?.length) return '';

    // 只保留最近 4 条对话
    const recentMessages = input.conversationHistory.slice(-4);
    const formatted = recentMessages
      .map((m) => {
        const role = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '系统';
        return `${role}：${m.content}`;
      })
      .join('\n');

    return `【对话历史】\n${formatted}`;
  }

  /**
   * 构建行动指令段
   */
  private buildActionSection(input: AgentExecutionContext): string {
    return '请继续回复用户最后一条消息。';
  }

  /**
   * 组装最终 userMessage
   */
  private assembleUserMessage(
    fittedSections: Array<{ name: string; content: string }>,
    input: AgentExecutionContext,
  ): string {
    const parts: string[] = [];

    // 按照固定顺序组装各段
    const sectionOrder: Array<{ name: string; prefix?: string }> = [
      { name: 'knowledge' },
      { name: 'toolResults' },
      { name: 'conversation', prefix: '对话：' },
      { name: 'action' },
    ];

    for (const { name, prefix } of sectionOrder) {
      const section = fittedSections.find((s) => s.name === name);
      if (section) {
        if (prefix) parts.push(prefix);
        parts.push(section.content);
        parts.push(''); // 空行分隔
      }
    }

    // 添加用户输入
    parts.push(`用户消息：${input.userInput}`);
    parts.push('');
    parts.push('请继续回复用户最后一条消息。');

    return parts.join('\n');
  }

  /**
   * 构建统计信息
   */
  private buildStats(
    systemInstruction: string,
    userMessage: string,
    originalSections: ContextSection[],
    fittedSections: Array<{ name: string; content: string }>,
    budgetManager: ContextBudgetManager,
  ): ContextStats {
    const fittedNames = new Set(fittedSections.map((s) => s.name));

    return {
      totalTokens: budgetManager.estimateTokens(systemInstruction) + budgetManager.estimateTokens(userMessage),
      systemTokens: budgetManager.estimateTokens(systemInstruction),
      userTokens: budgetManager.estimateTokens(userMessage),
      sections: originalSections.map((s) => ({
        name: s.name,
        tokens: budgetManager.estimateTokens(s.content),
        included: fittedNames.has(s.name),
      })),
    };
  }
}
