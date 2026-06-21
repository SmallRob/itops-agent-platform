/**
 * Token 预算管理器
 * 借鉴 NiceKit 的 ContextBudgetManager 设计
 * 
 * 职责：
 * - 估算文本 token 数
 * - 智能裁剪上下文段
 * - 确保总 prompt 不超出模型预算
 */

import type { ContextSection, ContextBudget } from './types';

export class ContextBudgetManager {
  private budget: ContextBudget;

  constructor(budget?: Partial<ContextBudget>) {
    this.budget = {
      maxTokens: budget?.maxTokens ?? 4000,
      coreRatio: budget?.coreRatio ?? 0.15,
      workingRatio: budget?.workingRatio ?? 0.65,
      archivedRatio: budget?.archivedRatio ?? 0.2,
    };
  }

  /** 获取当前预算配置 */
  getBudget(): ContextBudget {
    return { ...this.budget };
  }

  /** 获取各层 token 上限 */
  getLayerLimits(): { core: number; working: number; archived: number } {
    return {
      core: Math.floor(this.budget.maxTokens * this.budget.coreRatio),
      working: Math.floor(this.budget.maxTokens * this.budget.workingRatio),
      archived: Math.floor(this.budget.maxTokens * this.budget.archivedRatio),
    };
  }

  /**
   * 估算文本 token 数
   * 
   * 估算策略：
   * - 中文字符：约 1.5 token/字
   * - 英文/数字/标点：约 0.25 token/字符
   * - 整体保守估算，预留 10% 安全余量
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;

    // 预留 10% 安全余量
    return Math.ceil((chineseChars * 1.5 + otherChars * 0.25) * 1.1);
  }

  /**
   * 将文本截断到指定 token 数
   * 优先在段落边界截断
   */
  truncateToTokens(text: string, maxTokens: number): string {
    if (!text) return '';
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    // 估算平均每字符 token 数
    const avgTokensPerChar = estimatedTokens / text.length;
    const targetChars = Math.floor(maxTokens / avgTokensPerChar);

    if (targetChars <= 0) return '';

    // 尝试在段落边界截断
    const truncated = text.slice(0, targetChars);
    const lastBreak = Math.max(
      truncated.lastIndexOf('\n'),
      truncated.lastIndexOf('。'),
      truncated.lastIndexOf('；'),
      truncated.lastIndexOf('，'),
    );

    if (lastBreak > targetChars * 0.5) {
      return truncated.slice(0, lastBreak + 1) + '...';
    }
    return truncated.slice(0, targetChars) + '...';
  }

  /**
   * 智能裁剪：当上下文超出预算时，按优先级裁剪
   * 
   * 优先级说明（数值越高越重要）：
   *   10: System Prompt（绝对不可丢弃）
   *    8: 对话历史（最近几轮）
   *    7: 用户输入
   *    5: 知识库检索结果
   *    3: 历史摘要
   */
  fitToBudget(
    sections: ContextSection[],
    budgetOverride?: number,
  ): Array<{ name: string; content: string; tokens: number }> {
    const budget = budgetOverride ?? this.budget.maxTokens;
    const totalTokens = sections.reduce(
      (sum, s) => sum + this.estimateTokens(s.content),
      0,
    );

    // 未超预算，全部保留
    if (totalTokens <= budget) {
      return sections.map((s) => ({
        name: s.name,
        content: s.content,
        tokens: this.estimateTokens(s.content),
      }));
    }

    // 按优先级排序（低优先级在前，先裁剪）
    const sorted = [...sections].sort((a, b) => a.priority - b.priority);
    let remaining = budget;

    // 最高优先级段全部保留
    const criticalPriority = sorted.filter((s) => s.priority >= 9);
    const criticalTokens = criticalPriority.reduce(
      (sum, s) => sum + this.estimateTokens(s.content),
      0,
    );

    if (criticalTokens > budget) {
      // 极端情况：连 System Prompt 都放不下
      const systemPrompt = sections.find((s) => s.name === 'systemPrompt');
      if (systemPrompt) {
        return [
          {
            name: systemPrompt.name,
            content: this.truncateToTokens(systemPrompt.content, budget),
            tokens: budget,
          },
        ];
      }
      return [];
    }

    remaining = budget - criticalTokens;

    // 高优先级段（>= 5）全部保留
    const highPriority = sorted.filter(
      (s) => s.priority >= 5 && s.priority < 9,
    );
    const highTokens = highPriority.reduce(
      (sum, s) => sum + this.estimateTokens(s.content),
      0,
    );

    if (highTokens <= remaining) {
      remaining -= highTokens;
    } else {
      // 高优先级也需要裁剪
      const ratio = remaining / Math.max(highTokens, 1);
      const result = new Map<string, { content: string; tokens: number }>();

      for (const s of criticalPriority) {
        result.set(s.name, {
          content: s.content,
          tokens: this.estimateTokens(s.content),
        });
      }
      for (const s of highPriority) {
        const tokens = this.estimateTokens(s.content);
        const allowed = Math.floor(tokens * ratio);
        if (allowed > 30) {
          result.set(s.name, {
            content: this.truncateToTokens(s.content, allowed),
            tokens: allowed,
          });
        }
      }

      return sections
        .filter((s) => result.has(s.name))
        .map((s) => ({
          name: s.name,
          ...result.get(s.name)!,
        }));
    }

    // 低优先级段（< 5）按比例分配剩余空间
    const lowPriority = sorted.filter((s) => s.priority < 5);
    const lowTokens = lowPriority.reduce(
      (sum, s) => sum + this.estimateTokens(s.content),
      0,
    );

    const result = new Map<string, { content: string; tokens: number }>();

    for (const s of criticalPriority) {
      result.set(s.name, {
        content: s.content,
        tokens: this.estimateTokens(s.content),
      });
    }
    for (const s of highPriority) {
      result.set(s.name, {
        content: s.content,
        tokens: this.estimateTokens(s.content),
      });
    }

    if (lowPriority.length > 0 && remaining > 0) {
      const ratio = remaining / Math.max(lowTokens, 1);
      for (const s of lowPriority) {
        const tokens = this.estimateTokens(s.content);
        const allowed = Math.floor(tokens * ratio);
        // 太少的段直接丢弃（不足以提供有效信息）
        if (allowed > 30) {
          result.set(s.name, {
            content: this.truncateToTokens(s.content, allowed),
            tokens: allowed,
          });
        }
      }
    }

    // 按原始顺序输出
    return sections
      .filter((s) => result.has(s.name))
      .map((s) => ({
        name: s.name,
        ...result.get(s.name)!,
      }));
  }
}
