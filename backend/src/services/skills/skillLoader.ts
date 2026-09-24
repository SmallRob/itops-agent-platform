/**
 * Skill 加载器（借鉴 openocta skills/loader.go）
 * 扫描技能目录，解析 SKILL.md 的 YAML front-matter + _meta.json + skill.json
 */
import fs from 'fs';
import path from 'path';
import type { SkillLoadError, SkillManifest, SkillToolContract } from './types';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

interface FrontMatter {
  name?: string;
  description?: string;
  tags?: string[];
  triggers?: string[];
}

/** 解析 SKILL.md 头部的 YAML front-matter（仅支持平铺键值与数组） */
export function parseFrontMatter(content: string): FrontMatter {
  const matched = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!matched) return {};

  const result: FrontMatter = {};
  for (const rawLine of matched[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key === 'name') result.name = value.replace(/^["']|["']$/g, '');
    else if (key === 'description') result.description = value.replace(/^["']|["']$/g, '');
    else if (key === 'tags' || key === 'triggers') {
      const items = value
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map((item) => item.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      if (key === 'tags') result.tags = items;
      else result.triggers = items;
    }
  }
  return result;
}

function readJson<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

/** 归一化工具契约（缺省值 + 校验） */
function normalizeTools(raw: unknown, warnings: string[]): SkillToolContract[] {
  if (!Array.isArray(raw)) return [];
  const tools: SkillToolContract[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const tool = item as Partial<SkillToolContract>;
    if (!tool.name || !tool.kind) {
      warnings.push(`工具缺少 name 或 kind，已跳过：${JSON.stringify(item).slice(0, 80)}`);
      continue;
    }
    tools.push({
      name: tool.name,
      description: tool.description || '',
      kind: tool.kind,
      endpoint: tool.endpoint,
      httpMethod: tool.httpMethod || 'POST',
      inputSchema: tool.inputSchema,
      requiresAdmin: Boolean(tool.requiresAdmin),
      write: Boolean(tool.write),
    });
  }
  return tools;
}

/** 装载单个技能目录 */
export function loadSkillDirectory(dir: string): { manifest?: SkillManifest; error?: SkillLoadError } {
  const skillFile = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    return { error: { path: dir, error: '缺少 SKILL.md' } };
  }

  const frontMatter = parseFrontMatter(fs.readFileSync(skillFile, 'utf8'));
  const meta = readJson<{ ownerId?: string; slug?: string; version?: string; publishedAt?: number }>(
    path.join(dir, '_meta.json')
  );
  const definition = readJson<{
    name?: string;
    description?: string;
    version?: string;
    tags?: string[];
    triggers?: string[];
    enabled?: boolean;
    tools?: unknown;
    // 兼容 openocta 的 _meta.json + skill-card.md 习惯：允许把清单直接写在 skill.json
  }>(path.join(dir, 'skill.json'));

  const slug = (meta?.slug || definition?.name || path.basename(dir)).trim();
  const warnings: string[] = [];
  if (!SLUG_PATTERN.test(slug)) {
    return { error: { path: dir, error: `技能 slug 非法：${slug}（需为小写字母/数字/短横线，2-64 位）` } };
  }

  const name = definition?.name || frontMatter.name || slug;
  const description = definition?.description || frontMatter.description || '';
  if (!description) warnings.push('缺少 description，将影响 Agent 的意图匹配');

  const manifest: SkillManifest = {
    slug,
    name,
    description,
    version: definition?.version || meta?.version || '0.0.0',
    ownerId: meta?.ownerId || 'local',
    tags: [...new Set([...(definition?.tags || []), ...(frontMatter.tags || [])])],
    triggers: [...new Set([...(definition?.triggers || []), ...(frontMatter.triggers || [])])],
    tools: normalizeTools(definition?.tools, warnings),
    enabledByDefault: definition?.enabled !== false,
    enabled: definition?.enabled !== false,
    path: dir,
    loadedAt: new Date().toISOString(),
    warnings,
  };

  return { manifest };
}

/** 扫描技能根目录（单层子目录 = 一个技能，与 openocta skills/ 目录约定一致） */
export function scanSkillDirectories(root: string): { manifests: SkillManifest[]; errors: SkillLoadError[] } {
  const manifests: SkillManifest[] = [];
  const errors: SkillLoadError[] = [];

  if (!fs.existsSync(root)) {
    return { manifests, errors };
  }

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const dir = path.join(root, entry.name);
    const { manifest, error } = loadSkillDirectory(dir);
    if (manifest) manifests.push(manifest);
    if (error) errors.push(error);
  }

  manifests.sort((a, b) => a.slug.localeCompare(b.slug));
  return { manifests, errors };
}