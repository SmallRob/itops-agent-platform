import { describe, it, expect, beforeEach } from 'vitest';
import { TokenBudget, type TokenUsage, type BudgetConfig } from './tokenBudget';

/**
 * Token 预算控制单元测试
 */

// 辅助函数：构造 TokenUsage 记录
function makeUsage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return {
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300,
    provider: 'openai',
    model: 'gpt-4',
    userId: 'user-001',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('TokenBudget', () => {
  let budget: TokenBudget;

  beforeEach(() => {
    // 每个测试前使用小限额方便测试
    budget = new TokenBudget({
      dailyLimit: 1000,
      monthlyLimit: 10000,
      perUserDailyLimit: 500,
      perRequestLimit: 200,
      alertThreshold: 0.8,
    });
  });

  // ===== check() 测试 =====

  describe('check', () => {
    it('无用量时应允许请求', () => {
      const status = budget.check('user-001', 100);
      expect(status.allowed).toBe(true);
      // remaining 会减去预估的 100 tokens
      expect(status.remaining.daily).toBe(900); // 1000 - 100
      expect(status.remaining.monthly).toBe(9900); // 10000 - 100
      expect(status.remaining.userDaily).toBe(400); // 500 - 100
    });

    it('预估 Token 超过单次请求限额时应拒绝', () => {
      const status = budget.check('user-001', 300); // perRequestLimit = 200
      expect(status.allowed).toBe(false);
    });

    it('不传预估 Token 时应跳过单次请求检查', () => {
      const status = budget.check('user-001');
      expect(status.allowed).toBe(true);
    });

    it('日用量超限时应拒绝', () => {
      // 记录接近限额的用量
      budget.record(makeUsage({ totalTokens: 900, userId: 'other-user' }));
      const status = budget.check('user-001', 200);
      // 900 + 200 = 1100 > 1000 (dailyLimit)
      expect(status.allowed).toBe(false);
    });

    it('月用量超限时应拒绝', () => {
      // 用大额单次请求模式绕过（perRequestLimit 放大）
      budget.updateConfig({ perRequestLimit: 50000 });
      // 记录超过月限额的用量
      for (let i = 0; i < 20; i++) {
        budget.record(makeUsage({ totalTokens: 500, userId: 'u1' }));
      }
      // 20 * 500 = 10000，刚好等于 monthlyLimit
      const status = budget.check('user-002', 1);
      expect(status.allowed).toBe(false);
    });

    it('用户日用量超限时应拒绝', () => {
      budget.record(makeUsage({ totalTokens: 400, userId: 'user-001' }));
      // user-001 已用 400, perUserDailyLimit = 500, 再请求 200 => 600 > 500
      budget.updateConfig({ perRequestLimit: 10000 }); // 放宽单次限制以聚焦用户限额
      const status = budget.check('user-001', 200);
      expect(status.allowed).toBe(false);
    });

    it('不同用户之间的用量应相互独立', () => {
      budget.record(makeUsage({ totalTokens: 400, userId: 'user-A' }));
      budget.updateConfig({ perRequestLimit: 10000 });
      // user-B 不受 user-A 影响
      const status = budget.check('user-B', 200);
      expect(status.allowed).toBe(true);
      expect(status.usage.userToday).toBe(0);
    });
  });

  // ===== record() 测试 =====

  describe('record', () => {
    it('应正确累加日用量', () => {
      budget.record(makeUsage({ totalTokens: 100 }));
      budget.record(makeUsage({ totalTokens: 200 }));
      expect(budget.getUsage('today')).toBe(300);
    });

    it('应正确累加月用量', () => {
      budget.record(makeUsage({ totalTokens: 100 }));
      budget.record(makeUsage({ totalTokens: 200 }));
      expect(budget.getUsage('thisMonth')).toBe(300);
    });

    it('应正确累加用户日用量', () => {
      budget.record(makeUsage({ totalTokens: 100, userId: 'u1' }));
      budget.record(makeUsage({ totalTokens: 200, userId: 'u1' }));
      budget.record(makeUsage({ totalTokens: 50, userId: 'u2' }));
      expect(budget.getUserUsage('u1')).toBe(300);
      expect(budget.getUserUsage('u2')).toBe(50);
    });

    it('无 userId 时不记录用户用量', () => {
      budget.record(makeUsage({ totalTokens: 100, userId: '' }));
      expect(budget.getUserUsage('')).toBe(0);
    });
  });

  // ===== getUsage() 测试 =====

  describe('getUsage', () => {
    it('无记录时应返回 0', () => {
      expect(budget.getUsage('today')).toBe(0);
      expect(budget.getUsage('thisMonth')).toBe(0);
      expect(budget.getUsage('thisWeek')).toBe(0);
    });

    it('today 应返回当日用量', () => {
      budget.record(makeUsage({ totalTokens: 500 }));
      expect(budget.getUsage('today')).toBe(500);
    });

    it('thisMonth 应返回当月总用量', () => {
      budget.record(makeUsage({ totalTokens: 300 }));
      budget.record(makeUsage({ totalTokens: 400 }));
      expect(budget.getUsage('thisMonth')).toBe(700);
    });

    it('thisWeek 应返回本周用量', () => {
      budget.record(makeUsage({ totalTokens: 600 }));
      expect(budget.getUsage('thisWeek')).toBe(600);
    });
  });

  // ===== getUserUsage() 测试 =====

  describe('getUserUsage', () => {
    it('无记录时应返回 0', () => {
      expect(budget.getUserUsage('unknown-user')).toBe(0);
    });

    it('应返回正确的用户当日用量', () => {
      budget.record(makeUsage({ totalTokens: 150, userId: 'u1' }));
      budget.record(makeUsage({ totalTokens: 250, userId: 'u1' }));
      expect(budget.getUserUsage('u1')).toBe(400);
    });
  });

  // ===== reset() 测试 =====

  describe('reset', () => {
    it('reset daily 应清零当日全局和用户用量', () => {
      budget.record(makeUsage({ totalTokens: 500, userId: 'u1' }));
      expect(budget.getUsage('today')).toBe(500);
      expect(budget.getUserUsage('u1')).toBe(500);

      budget.reset('daily');

      expect(budget.getUsage('today')).toBe(0);
      expect(budget.getUserUsage('u1')).toBe(0);
    });

    it('reset monthly 应清零当月用量', () => {
      budget.record(makeUsage({ totalTokens: 800 }));
      expect(budget.getUsage('thisMonth')).toBe(800);

      budget.reset('monthly');

      expect(budget.getUsage('thisMonth')).toBe(0);
    });
  });

  // ===== updateConfig() 测试 =====

  describe('updateConfig', () => {
    it('应支持部分更新配置', () => {
      budget.updateConfig({ dailyLimit: 5000 });
      const { config } = budget.getStatus();
      expect(config.dailyLimit).toBe(5000);
      // 其他字段应保持不变
      expect(config.monthlyLimit).toBe(10000);
    });

    it('更新后应影响 check 结果', () => {
      budget.updateConfig({ perRequestLimit: 100 });
      const status = budget.check('user-001', 150);
      expect(status.allowed).toBe(false);
    });
  });

  // ===== getStatus() 测试 =====

  describe('getStatus', () => {
    it('应返回完整配置和当前用量', () => {
      budget.record(makeUsage({ totalTokens: 300 }));
      const status = budget.getStatus();
      expect(status.config).toBeDefined();
      expect(status.config.dailyLimit).toBe(1000);
      expect(status.usage.daily).toBe(300);
      expect(status.usage.monthly).toBe(300);
    });
  });

  // ===== 使用默认配置 =====

  describe('默认配置', () => {
    it('不传配置时应使用默认值', () => {
      const defaultBudget = new TokenBudget();
      const { config } = defaultBudget.getStatus();
      expect(config.dailyLimit).toBe(1_000_000);
      expect(config.monthlyLimit).toBe(30_000_000);
      expect(config.perUserDailyLimit).toBe(100_000);
      expect(config.perRequestLimit).toBe(10_000);
      expect(config.alertThreshold).toBe(0.8);
    });
  });
});
