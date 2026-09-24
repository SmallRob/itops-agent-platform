/**
 * Skills 契约（借鉴 openocta：技能 = 目录 + SKILL.md(front-matter) + _meta.json + 可选 skill.json）
 *
 * 设计目标：
 *  - 声明式：技能能力用清单描述，不写死在代码里
 *  - 动态插拔：新增/删除技能目录即可装载/卸载；启用状态可运行时切换
 *  - 可集成：技能通过 tools 契约指向平台现有运维能力（REST 端点或内置处理器）
 */

/** 技能工具的能力类型（用于匹配与治理） */
export type SkillToolKind = 'ssh' | 'docker' | 'network' | 'http' | 'ai' | 'builtin';

/** 技能工具契约：一个技能可暴露多个工具 */
export interface SkillToolContract {
  /** 工具名，如 ssh.exec / docker.images.list */
  name: string;
  description: string;
  kind: SkillToolKind;
  /** 平台现有能力的入口（REST 路径模板，如 /api/server-commands/{serverId}/exec） */
  endpoint?: string;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 入参 schema（JSON Schema 子集，供 Agent 生成调用参数） */
  inputSchema?: Record<string, unknown>;
  /** 是否需要管理员权限 */
  requiresAdmin?: boolean;
  /** 是否写操作（用于治理与二次确认） */
  write?: boolean;
}

/** 技能清单（由 SKILL.md + _meta.json + skill.json 合成） */
export interface SkillManifest {
  slug: string;
  name: string;
  description: string;
  version: string;
  ownerId: string;
  tags: string[];
  triggers: string[];
  tools: SkillToolContract[];
  /** 声明默认启用状态（可被运行时开关覆盖） */
  enabledByDefault: boolean;
  /** 实际启用状态（含运行时覆盖） */
  enabled: boolean;
  /** 来源目录 */
  path: string;
  loadedAt: string;
  /** 加载期校验告警（不阻断装载） */
  warnings: string[];
}

/** 技能匹配结果（供 Agent 选择技能） */
export interface SkillMatch {
  slug: string;
  name: string;
  score: number;
  reason: string;
  tools: string[];
}

export interface SkillLoadError {
  path: string;
  error: string;
}