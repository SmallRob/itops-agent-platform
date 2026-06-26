/**
 * Token 预算控制服务
 *
 * 用于管理 AI LLM 调用的 Token 用量预算，支持日/月/用户级别的限额控制。
 * 参考 Ongrid 平台设计，提供用量记录、预算检查、告警阈值等功能。
 */

// ===== 接口定义 =====

/** 单次 Token 使用记录 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider: string;
  model: string;
  userId: string;
  timestamp: number;
}

/** 预算配置 */
export interface BudgetConfig {
  /** 每日全局 Token 限额 */
  dailyLimit: number;
  /** 每月全局 Token 限额 */
  monthlyLimit: number;
  /** 每用户每日 Token 限额 */
  perUserDailyLimit: number;
  /** 单次请求 Token 限额 */
  perRequestLimit: number;
  /** 告警阈值（0-1 之间，达到该比例时触发告警） */
  alertThreshold: number;
}

/** 预算检查状态 */
export interface BudgetStatus {
  /** 是否允许本次请求 */
  allowed: boolean;
  /** 剩余可用量 */
  remaining: {
    daily: number;
    monthly: number;
    userDaily: number;
  };
  /** 当前已用量 */
  usage: {
    today: number;
    thisMonth: number;
    userToday: number;
  };
}

// ===== 默认配置 =====

const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  dailyLimit: 1_000_000,        // 每日 100 万 Token
  monthlyLimit: 30_000_000,     // 每月 3000 万 Token
  perUserDailyLimit: 100_000,   // 每用户每日 10 万 Token
  perRequestLimit: 10_000,      // 单次请求 1 万 Token
  alertThreshold: 0.8,          // 80% 时触发告警
};

// ===== Token 预算控制类 =====

export class TokenBudget {
  /** 当前预算配置 */
  private config: BudgetConfig;

  /** 全局每日用量: Map<日期键, Token数> */
  private dailyUsage: Map<string, number>;

  /** 全局每月用量: Map<月份键, Token数> */
  private monthlyUsage: Map<string, number>;

  /** 用户每日用量: Map<userId, Map<日期键, Token数>> */
  private userDailyUsage: Map<string, Map<string, number>>;

  constructor(config?: Partial<BudgetConfig>) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
    this.dailyUsage = new Map();
    this.monthlyUsage = new Map();
    this.userDailyUsage = new Map();
  }

  // ===== 公共方法 =====

  /**
   * 检查是否允许本次请求
   * @param userId - 用户 ID（可选）
   * @param estimatedTokens - 预估 Token 数（可选）
   * @returns 预算状态
   */
  check(userId?: string, estimatedTokens?: number): BudgetStatus {
    // 先清理过期条目
    this.cleanupOldEntries();

    const todayKey = this.getDateKey();
    const monthKey = this.getMonthKey();

    // 当前已用量
    const todayUsage = this.dailyUsage.get(todayKey) || 0;
    const monthUsage = this.monthlyUsage.get(monthKey) || 0;

    // 用户当日已用量
    let userTodayUsage = 0;
    if (userId) {
      const userMap = this.userDailyUsage.get(userId);
      if (userMap) {
        userTodayUsage = userMap.get(todayKey) || 0;
      }
    }

    // 预估的额外用量
    const extra = estimatedTokens || 0;

    // 计算剩余量
    const remainingDaily = Math.max(0, this.config.dailyLimit - todayUsage);
    const remainingMonthly = Math.max(0, this.config.monthlyLimit - monthUsage);
    const remainingUserDaily = Math.max(0, this.config.perUserDailyLimit - userTodayUsage);

    // 判断是否允许
    let allowed = true;

    // 单次请求限额检查
    if (estimatedTokens && estimatedTokens > this.config.perRequestLimit) {
      allowed = false;
    }

    // 日限额检查
    if (todayUsage + extra > this.config.dailyLimit) {
      allowed = false;
    }

    // 月限额检查
    if (monthUsage + extra > this.config.monthlyLimit) {
      allowed = false;
    }

    // 用户日限额检查
    if (userId && userTodayUsage + extra > this.config.perUserDailyLimit) {
      allowed = false;
    }

    return {
      allowed,
      remaining: {
        daily: Math.max(0, remainingDaily - extra),
        monthly: Math.max(0, remainingMonthly - extra),
        userDaily: Math.max(0, remainingUserDaily - extra),
      },
      usage: {
        today: todayUsage,
        thisMonth: monthUsage,
        userToday: userTodayUsage,
      },
    };
  }

  /**
   * 记录一次 Token 用量
   * @param usage - Token 使用记录
   */
  record(usage: TokenUsage): void {
    const todayKey = this.getDateKey();
    const monthKey = this.getMonthKey();

    // 更新全局日用量
    const currentDaily = this.dailyUsage.get(todayKey) || 0;
    this.dailyUsage.set(todayKey, currentDaily + usage.totalTokens);

    // 更新全局月用量
    const currentMonthly = this.monthlyUsage.get(monthKey) || 0;
    this.monthlyUsage.set(monthKey, currentMonthly + usage.totalTokens);

    // 更新用户日用量
    if (usage.userId) {
      let userMap = this.userDailyUsage.get(usage.userId);
      if (!userMap) {
        userMap = new Map();
        this.userDailyUsage.set(usage.userId, userMap);
      }
      const currentUserDaily = userMap.get(todayKey) || 0;
      userMap.set(todayKey, currentUserDaily + usage.totalTokens);
    }
  }

  /**
   * 获取指定时段的全局用量
   * @param period - 时段：today / thisMonth / thisWeek
   * @returns Token 总量
   */
  getUsage(period: 'today' | 'thisMonth' | 'thisWeek'): number {
    this.cleanupOldEntries();

    if (period === 'today') {
      return this.dailyUsage.get(this.getDateKey()) || 0;
    }

    if (period === 'thisMonth') {
      return this.monthlyUsage.get(this.getMonthKey()) || 0;
    }

    // thisWeek: 计算本周各天用量之和
    if (period === 'thisWeek') {
      let total = 0;
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=周日
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 距周一的天数

      for (let i = 0; i <= mondayOffset; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = this.formatDateKey(d);
        total += this.dailyUsage.get(key) || 0;
      }
      return total;
    }

    return 0;
  }

  /**
   * 获取指定用户在指定时段的用量
   * @param userId - 用户 ID
   * @param period - 时段（默认 today）
   * @returns Token 总量
   */
  getUserUsage(userId: string, period: 'today' = 'today'): number {
    this.cleanupOldEntries();

    const userMap = this.userDailyUsage.get(userId);
    if (!userMap) return 0;

    if (period === 'today') {
      return userMap.get(this.getDateKey()) || 0;
    }

    return 0;
  }

  /**
   * 重置指定时段的用量
   * @param period - 重置范围：daily / monthly
   */
  reset(period: 'daily' | 'monthly'): void {
    if (period === 'daily') {
      const todayKey = this.getDateKey();
      this.dailyUsage.delete(todayKey);
      // 同时重置所有用户的当日用量
      for (const [, userMap] of this.userDailyUsage) {
        userMap.delete(todayKey);
      }
    }

    if (period === 'monthly') {
      const monthKey = this.getMonthKey();
      this.monthlyUsage.delete(monthKey);
    }
  }

  /**
   * 更新预算配置（支持部分更新）
   * @param config - 要更新的配置字段
   */
  updateConfig(config: Partial<BudgetConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取预算控制状态概览
   * @returns 配置与当前用量
   */
  getStatus(): { config: BudgetConfig; usage: { daily: number; monthly: number } } {
    return {
      config: { ...this.config },
      usage: {
        daily: this.getUsage('today'),
        monthly: this.getUsage('thisMonth'),
      },
    };
  }

  // ===== 内部方法 =====

  /**
   * 获取当天日期键，格式 YYYY-MM-DD
   */
  private getDateKey(): string {
    return this.formatDateKey(new Date());
  }

  /**
   * 格式化指定日期为 YYYY-MM-DD 键
   */
  private formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * 获取当月日期键，格式 YYYY-MM
   */
  private getMonthKey(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * 清理过期条目（保留最近 3 天日用量 + 当前月用量）
   */
  private cleanupOldEntries(): void {
    const now = new Date();
    const keepDays = 3;

    // 计算保留的最早日期
    const earliestKeep = new Date(now);
    earliestKeep.setDate(earliestKeep.getDate() - keepDays);
    const earliestKey = this.formatDateKey(earliestKeep);

    // 清理日用量中过期条目
    for (const [key] of this.dailyUsage) {
      if (key < earliestKey) {
        this.dailyUsage.delete(key);
      }
    }

    // 清理用户日用量中过期条目
    const currentMonthKey = this.getMonthKey();
    for (const [userId, userMap] of this.userDailyUsage) {
      for (const [key] of userMap) {
        if (key < earliestKey) {
          userMap.delete(key);
        }
      }
      // 如果用户已无数据，删除整个映射
      if (userMap.size === 0) {
        this.userDailyUsage.delete(userId);
      }
    }

    // 清理月用量中非当月条目
    for (const [key] of this.monthlyUsage) {
      if (key !== currentMonthKey) {
        this.monthlyUsage.delete(key);
      }
    }
  }
}

// ===== 导出单例 =====

/** 全局 Token 预算控制实例 */
export const tokenBudget = new TokenBudget();
