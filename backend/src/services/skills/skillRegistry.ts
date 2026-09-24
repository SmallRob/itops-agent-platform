/**
 * Skills 注册表（动态插拔）
 *  - 装载/重载：扫描技能目录
 *  - 启用/停用：运行时切换并持久化（settings 表 key = skills_disabled）
 *  - 匹配：按触发词/标签/描述为 Agent 选择技能
 */
import path from 'path';
import fs from 'fs';
import db from '@models/database';
import { logger } from '@utils/logger';
import { scanSkillDirectories } from './skillLoader';
import type { SkillLoadError, SkillManifest, SkillMatch } from './types';

const DISABLED_SETTINGS_KEY = 'skills_disabled';
/** 默认技能目录：优先 env SKILLS_DIR，否则取进程工作目录下的 skills/（容器内为 /app/skills） */
const DEFAULT_SKILLS_DIR = path.resolve(process.cwd(), 'skills');

function resolveSkillsDir(): string {
  const configured = process.env.SKILLS_DIR?.trim();
  if (configured) return path.resolve(configured);
  return DEFAULT_SKILLS_DIR;
}

class SkillRegistry {
  private manifests = new Map<string, SkillManifest>();
  private errors: SkillLoadError[] = [];
  private loadedAt: string | null = null;

  /** 从磁盘重新装载全部技能（新增/删除目录即插即拔） */
  reload(): { loaded: number; errors: SkillLoadError[]; skillsDir: string } {
    const skillsDir = resolveSkillsDir();
    const { manifests, errors } = scanSkillDirectories(skillsDir);
    const disabled = this.getDisabledSlugs();

    this.manifests.clear();
    for (const manifest of manifests) {
      const forcedDisabled = disabled.has(manifest.slug);
      const enabled = forcedDisabled ? false : manifest.enabledByDefault;
      this.manifests.set(manifest.slug, { ...manifest, enabled });
    }
    this.errors = errors;
    this.loadedAt = new Date().toISOString();

    logger.info(
      `[skills] 已装载 ${this.manifests.size} 个技能（目录：${skillsDir}${errors.length ? `，${errors.length} 个失败` : ''}）`
    );
    return { loaded: this.manifests.size, errors, skillsDir };
  }

  /** 确保已装载（首次访问自动装载） */
  ensureLoaded(): void {
    if (this.manifests.size === 0 && !this.loadedAt) {
      this.reload();
    }
  }

  list(includeDisabled = true): SkillManifest[] {
    this.ensureLoaded();
    const all = [...this.manifests.values()];
    return includeDisabled ? all : all.filter((skill) => skill.enabled);
  }

  get(slug: string): SkillManifest | undefined {
    this.ensureLoaded();
    return this.manifests.get(slug);
  }

  getErrors(): SkillLoadError[] {
    return this.errors;
  }

  getSkillsDir(): string {
    return resolveSkillsDir();
  }

  getLoadedAt(): string | null {
    return this.loadedAt;
  }

  /** 运行时启用/停用（持久化，支持动态插拔） */
  setEnabled(slug: string, enabled: boolean): SkillManifest {
    this.ensureLoaded();
    const manifest = this.manifests.get(slug);
    if (!manifest) {
      throw new Error(`技能不存在：${slug}`);
    }

    const disabled = this.getDisabledSlugs();
    if (enabled) disabled.delete(slug);
    else disabled.add(slug);
    this.saveDisabledSlugs(disabled);

    const updated: SkillManifest = { ...manifest, enabled };
    this.manifests.set(slug, updated);
    logger.info(`[skills] 技能 ${slug} 已${enabled ? '启用' : '停用'}`);
    return updated;
  }

  /**
   * 意图匹配：触发词/标签命中加权，描述命中兜底
   * 返回按得分排序的技能，供 Agent 决定装载哪些能力
   */
  match(query: string, limit = 3): SkillMatch[] {
    this.ensureLoaded();
    const text = (query || '').toLowerCase().trim();
    if (!text) return [];

    const matches: SkillMatch[] = [];
    for (const skill of this.list(false)) {
      let score = 0;
      const reasons: string[] = [];

      for (const trigger of skill.triggers) {
        if (trigger && text.includes(trigger.toLowerCase())) {
          score += 5;
          reasons.push(`触发词「${trigger}」`);
        }
      }
      for (const tag of skill.tags) {
        if (tag && text.includes(tag.toLowerCase())) {
          score += 2;
          reasons.push(`标签「${tag}」`);
        }
      }
      if (skill.name && text.includes(skill.name.toLowerCase())) {
        score += 3;
        reasons.push('技能名命中');
      }
      // 描述分词兜底（中文按字，英文按词）
      const descriptionTokens = (skill.description || '')
        .toLowerCase()
        .split(/[\s,，。;；、]+/)
        .filter((token) => token.length >= 2);
      const hitTokens = descriptionTokens.filter((token) => text.includes(token)).slice(0, 3);
      if (hitTokens.length > 0) {
        score += hitTokens.length;
        reasons.push(`描述命中「${hitTokens.join('/')}」`);
      }

      if (score > 0) {
        matches.push({
          slug: skill.slug,
          name: skill.name,
          score,
          reason: reasons.join('；'),
          tools: skill.tools.map((tool) => tool.name),
        });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, limit);
  }

  /** 供工作流/Agent 直接使用的工具视图（含所属技能与治理标记） */
  listTools() {
    this.ensureLoaded();
    return this.list(false).flatMap((skill) =>
      skill.tools.map((tool) => ({ ...tool, skill: skill.slug, skillName: skill.name }))
    );
  }

  private getDisabledSlugs(): Set<string> {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(DISABLED_SETTINGS_KEY) as
        | { value: string }
        | undefined;
      if (!row?.value) return new Set();
      const parsed = JSON.parse(row.value) as unknown;
      return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private saveDisabledSlugs(disabled: Set<string>): void {
    const value = JSON.stringify([...disabled]);
    const existing = db.prepare('SELECT id FROM settings WHERE key = ?').get(DISABLED_SETTINGS_KEY);
    if (existing) {
      db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = ?").run(
        value,
        DISABLED_SETTINGS_KEY
      );
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(DISABLED_SETTINGS_KEY, value);
    }
  }

  /** 开发期目录监听：技能目录增删/修改后自动重载（动态插拔） */
  watchSkillsDir(onChange: () => void): void {
    if (process.env.NODE_ENV === 'production' || process.env.SKILLS_WATCH === 'false') return;
    const skillsDir = resolveSkillsDir();
    if (!fs.existsSync(skillsDir)) return;
    try {
      let timer: NodeJS.Timeout | null = null;
      fs.watch(skillsDir, { recursive: true }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => onChange(), 500);
      });
      logger.info(`[skills] 已开启技能目录监听：${skillsDir}`);
    } catch (error) {
      logger.warn(`[skills] 技能目录监听失败（忽略）：${error instanceof Error ? error.message : error}`);
    }
  }
}

export const skillRegistry = new SkillRegistry();