/**
 * Skill 安装器（对齐 openocta marketplace 的 zip 包规范）
 *
 * 技能包 = zip，内部结构二选一：
 *   ① 根目录直接是技能目录（含 SKILL.md / skill.json / _meta.json）
 *   ② 只含一个顶层目录，技能目录在该层（GitHub 下载的 zip 常见形态）
 *
 * 安装流程：内存 zip → 校验条目（防 zip-slip）→ 解压到技能目录下的隐藏暂存区
 *          → 用与运行时同一套加载器校验 → 原子替换到 <SKILLS_DIR>/<slug> → reload
 * 卸载流程：slug 白名单校验 → 路径回环校验 → 删除目录 → reload
 */
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { logger } from '@utils/logger';
import { loadSkillDirectory } from './skillLoader';
import { skillRegistry } from './skillRegistry';
import type { SkillManifest } from './types';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
/** 技能包体积/条目上限（技能是声明式清单，不需要大文件） */
export const MAX_SKILL_PACKAGE_SIZE = 10 * 1024 * 1024;
const MAX_ENTRIES = 200;
/** 技能包只允许这些扩展名，避免把二进制/可执行文件带进运行时目录 */
const ALLOWED_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt', '.sh', '.py', '.js']);

export interface SkillInstallResult {
  slug: string;
  manifest: SkillManifest;
  overwritten: boolean;
  files: number;
  skillsDir: string;
  reloaded: number;
}

export interface SkillUninstallResult {
  slug: string;
  removedFiles: number;
  skillsDir: string;
  reloaded: number;
}

function countFiles(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(path.join(dir, entry.name));
    else total += 1;
  }
  return total;
}

/** 安全解压：拒绝绝对路径/上跳/符号链接，只放行白名单扩展名 */
function extractToStaging(zip: AdmZip, stagingDir: string): void {
  const entries = zip.getEntries();
  if (entries.length === 0) {
    throw new Error('技能包为空');
  }
  if (entries.length > MAX_ENTRIES) {
    throw new Error(`技能包条目过多（${entries.length} > ${MAX_ENTRIES}）`);
  }

  for (const entry of entries) {
    const rawName = entry.entryName.replace(/\\/g, '/');
    const segments = rawName.split('/').filter(Boolean);
    if (!rawName || path.isAbsolute(rawName) || segments.includes('..')) {
      throw new Error(`技能包存在非法路径：${entry.entryName}`);
    }
    // 跳过压缩工具产生的元数据目录
    if (segments[0] === '__MACOSX' || segments.includes('.DS_Store')) continue;

    const target = path.join(stagingDir, ...segments);
    if (target !== stagingDir && !target.startsWith(stagingDir + path.sep)) {
      throw new Error(`技能包存在越权路径：${entry.entryName}`);
    }

    if (entry.isDirectory) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }

    const ext = path.extname(rawName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`技能包包含不支持的文件类型：${entry.entryName}（允许：${[...ALLOWED_EXTENSIONS].join('/')}）`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
  }
}

/** 定位技能根目录：根上有 SKILL.md，或仅有一个含 SKILL.md 的一级目录 */
function locateSkillRoot(stagingDir: string): string {
  if (fs.existsSync(path.join(stagingDir, 'SKILL.md'))) return stagingDir;

  const subDirs = fs
    .readdirSync(stagingDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));

  if (subDirs.length === 1 && fs.existsSync(path.join(stagingDir, subDirs[0].name, 'SKILL.md'))) {
    return path.join(stagingDir, subDirs[0].name);
  }
  throw new Error('技能包缺少 SKILL.md（应位于根目录或唯一的一级目录内）');
}

/** 安装技能包（zip Buffer） */
export function installSkillPackage(buffer: Buffer, options: { overwrite?: boolean } = {}): SkillInstallResult {
  const skillsDir = path.resolve(skillRegistry.getSkillsDir());
  fs.mkdirSync(skillsDir, { recursive: true });

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (error) {
    throw new Error(`技能包不是合法的 zip：${error instanceof Error ? error.message : error}`);
  }

  const stagingDir = fs.mkdtempSync(path.join(skillsDir, '.install-'));
  try {
    extractToStaging(zip, stagingDir);

    const skillRoot = locateSkillRoot(stagingDir);
    const { manifest, error } = loadSkillDirectory(skillRoot);
    if (!manifest) {
      throw new Error(`技能包校验失败：${error?.error || '未知错误'}`);
    }

    const slug = manifest.slug;
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error(`技能 slug 非法：${slug}`);
    }

    const targetDir = path.join(skillsDir, slug);
    const overwritten = fs.existsSync(targetDir);
    if (overwritten && !options.overwrite) {
      throw new Error(`技能已存在：${slug}（如需覆盖请传 overwrite=1）`);
    }

    // 覆盖安装：先把新版本移入，旧版本删除；失败则回滚暂存区
    const backupDir = path.join(stagingDir, '.previous');
    if (overwritten) fs.renameSync(targetDir, backupDir);
    try {
      fs.renameSync(skillRoot, targetDir);
    } catch (error) {
      if (overwritten && !fs.existsSync(targetDir)) fs.renameSync(backupDir, targetDir);
      throw error;
    }

    const files = countFiles(targetDir);
    const reloaded = skillRegistry.reload().loaded;
    const saved = skillRegistry.get(slug);
    logger.info(`[skills] 已安装技能包 ${slug}（${files} 个文件，${overwritten ? '覆盖' : '新增'}）`);

    return {
      slug,
      manifest: saved || manifest,
      overwritten,
      files,
      skillsDir,
      reloaded,
    };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

/** 卸载技能（删除技能目录并重载注册表） */
export function uninstallSkill(slug: string): SkillUninstallResult {
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`技能 slug 非法：${slug}`);
  }

  const skillsDir = path.resolve(skillRegistry.getSkillsDir());
  const targetDir = path.resolve(path.join(skillsDir, slug));
  if (path.dirname(targetDir) !== skillsDir) {
    throw new Error('技能路径越权，拒绝删除');
  }
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    throw new Error(`技能不存在：${slug}`);
  }

  const removedFiles = countFiles(targetDir);
  fs.rmSync(targetDir, { recursive: true, force: true });
  const reloaded = skillRegistry.reload().loaded;
  logger.info(`[skills] 已卸载技能 ${slug}（移除 ${removedFiles} 个文件）`);

  return { slug, removedFiles, skillsDir, reloaded };
}