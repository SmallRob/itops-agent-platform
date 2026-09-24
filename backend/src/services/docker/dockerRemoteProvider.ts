/**
 * Docker 远端主机 Provider（只读）
 * 复用平台已有服务器凭据与 SSH 连接池，在远端执行 docker CLI 并解析 JSON 输出。
 *
 * 注意：这里不走 sshService.executeCommand 封装——其输出上限为 100KB，
 * 镜像数量多时 JSON 会被截断导致解析失败；本模块单独设置 10MB 上限。
 */
import type { Client } from 'ssh2';
import db from '@models/database';
import { sshPool } from '@services/server/sshService';
import { DockerEngineError } from './dockerEngine';
import type { DockerContainer, DockerImage } from './dockerService';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 8000;

export interface DockerRemoteHost {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  osType: string;
}

/** 可用于 Docker 管理的 Linux 服务器（排除 Windows/RDP 主机） */
export function listRemoteDockerHosts(): DockerRemoteHost[] {
  const rows = db
    .prepare('SELECT id, name, hostname, ip_address, port, username, os_type, os FROM servers WHERE enabled = 1')
    .all() as Array<Record<string, any>>;

  return rows
    .filter((row) => {
      const osType = String(row.os_type || '').toLowerCase();
      const osName = String(row.os || '').toLowerCase();
      if (osType.includes('windows') || osName.includes('windows')) return false;
      if (row.port && Number(row.port) !== 22) return false;
      return osType.includes('linux') || osName.includes('ubuntu') || osName.includes('centos') || osName.includes('linux');
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      host: row.ip_address || row.hostname || '',
      port: Number(row.port) || 22,
      username: row.username || '',
      osType: row.os_type || 'linux',
    }));
}

export function findRemoteHost(serverId: string): DockerRemoteHost | undefined {
  return listRemoteDockerHosts().find((host) => host.id === serverId);
}

/** 在远端执行命令，返回退出码与两个输出流（超时与输出上限受控） */
async function execRemoteRaw(
  serverId: string,
  command: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{ code: number; stdout: string; stderr: string }> {
  const client: Client = await sshPool.acquire(serverId, { timeout: 10000 }).catch((error: Error) => {
    throw new DockerEngineError(`无法建立 SSH 连接：${error.message}`, 502);
  });

  try {
    return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new DockerEngineError(`远端命令执行超时（${timeoutMs}ms）`, 504));
      }, timeoutMs);

      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          reject(new DockerEngineError(`SSH 执行失败：${err.message}`, 502));
          return;
        }

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let stdoutSize = 0;

        stream.on('data', (chunk: Buffer) => {
          if (stdoutSize + chunk.length <= MAX_OUTPUT_BYTES) {
            stdoutChunks.push(chunk);
            stdoutSize += chunk.length;
          }
        });
        stream.stderr.on('data', (chunk: Buffer) => {
          if (stderrChunks.length < 200) stderrChunks.push(chunk);
        });
        stream.on('close', (code: number) => {
          clearTimeout(timer);
          resolve({
            code,
            stdout: Buffer.concat(stdoutChunks).toString('utf8'),
            stderr: Buffer.concat(stderrChunks).toString('utf8'),
          });
        });
      });
    });
  } finally {
    sshPool.release(client, true);
  }
}

/** 执行命令，退出码非 0 视为失败（错误信息取 stderr / stdout 尾部） */
async function execRemote(serverId: string, command: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const result = await execRemoteRaw(serverId, command, timeoutMs);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new DockerEngineError(describeDockerError(detail, result.code), 502);
  }
  return result.stdout;
}

/** 把远端常见报错翻译成可操作的中文提示 */
function describeDockerError(stderr: string, code: number): string {
  const text = stderr.trim();
  if (/permission denied.*docker\.sock/i.test(text)) {
    return 'SSH 用户无 Docker 权限（需加入 docker 组或使用 sudo 执行）';
  }
  if (/command not found|not found/i.test(text)) {
    return '该服务器未安装 Docker CLI';
  }
  if (/Cannot connect to the Docker daemon/i.test(text)) {
    return 'Docker 守护进程未运行';
  }
  return text ? `远端命令失败（退出码 ${code}）：${text.slice(0, 200)}` : `远端命令失败（退出码 ${code}）`;
}

function parseJsonLines(raw: string): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(JSON.parse(trimmed) as Record<string, any>);
    } catch {
      /* 跳过非 JSON 行 */
    }
  }
  return rows;
}

/** docker CLI 的时间格式：2026-09-24 10:42:31 +0800 CST */
function parseDockerDate(value?: string): number {
  if (!value) return 0;
  const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?/);
  if (!matched) return 0;
  const [, year, month, day, hour, minute, second, tz] = matched;
  const offset = tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : 'Z';
  const timestamp = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

/** docker CLI 的容量格式：142MB / 1.2GB（1000 进制，取近似字节数用于统计） */
function parseHumanSize(value?: string): number {
  if (!value) return 0;
  const matched = value.trim().match(/^([\d.]+)\s*([kKMGT]?B)$/);
  if (!matched) return 0;
  const amount = Number.parseFloat(matched[1]);
  if (!Number.isFinite(amount)) return 0;
  const unit = matched[2].toUpperCase();
  const scale: Record<string, number> = { B: 1, KB: 1000, MB: 1000 ** 2, GB: 1000 ** 3, TB: 1000 ** 4 };
  return Math.round(amount * (scale[unit] ?? 1));
}

/** docker ps 的 Ports 字符串：0.0.0.0:8080->80/tcp, :::8080->80/tcp, 3000/tcp */
function parsePortsString(value?: string): DockerContainer['ports'] {
  if (!value) return [];
  const ports: DockerContainer['ports'] = [];
  const seen = new Set<string>();

  for (const segment of value.split(',')) {
    const item = segment.trim();
    if (!item) continue;
    const mapped = item.match(/^(?:(?<ip>[^\s:]+):)?(?<public>\d+)->(?<private>\d+)\/(?<proto>\w+)$/);
    const single = item.match(/^(?<private>\d+)\/(?<proto>\w+)$/);

    const port = mapped
      ? {
          privatePort: Number(mapped.groups?.private),
          publicPort: Number(mapped.groups?.public),
          type: mapped.groups?.proto || 'tcp',
          ip: mapped.groups?.ip,
        }
      : single
        ? { privatePort: Number(single.groups?.private), type: single.groups?.proto || 'tcp' }
        : null;

    if (!port) continue;
    const key = `${port.publicPort ?? ''}:${port.privatePort}/${port.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ports.push(port);
  }
  return ports;
}

class DockerRemoteProvider {
  /** 探测远端 Docker 是否可用 */
  async probe(serverId: string): Promise<{ available: boolean; version?: string; message?: string }> {
    try {
      const version = await execRemote(serverId, `docker version --format '{{.Server.Version}}'`, PROBE_TIMEOUT_MS);
      return { available: true, version: version.trim() };
    } catch (error) {
      return { available: false, message: error instanceof Error ? error.message : '未知错误' };
    }
  }

  /** 远端镜像列表 */
  async listImages(serverId: string): Promise<DockerImage[]> {
    const raw = await execRemote(serverId, `docker images --no-trunc --format '{{json .}}'`);
    return parseJsonLines(raw)
      .map((row) => {
        const repository = row.Repository || '<none>';
        const tag = row.Tag || '<none>';
        const dangling = !row.Repository || row.Repository === '<none>';
        const size = parseHumanSize(row.Size);
        const created = parseDockerDate(row.CreatedAt);
        return {
          id: row.ID || '',
          shortId: String(row.ID || '').replace(/^sha256:/, '').slice(0, 12),
          repoTags: dangling ? [] : [`${repository}:${tag}`],
          repository: dangling ? '<none>' : repository,
          tag: dangling ? '<none>' : tag,
          size,
          sizeHuman: row.Size || '0 B',
          created,
          createdHuman: created ? new Date(created * 1000).toISOString() : '',
          dangling,
          containers: Number(row.Containers) || 0,
        };
      })
      .sort((a, b) => b.created - a.created);
  }

  /** 远端容器列表 */
  async listContainers(serverId: string, all = true): Promise<DockerContainer[]> {
    const raw = await execRemote(serverId, `docker ps ${all ? '-a ' : ''}--no-trunc --format '{{json .}}'`);
    return parseJsonLines(raw)
      .map((row) => {
        const created = parseDockerDate(row.CreatedAt);
        return {
          id: row.ID || '',
          shortId: String(row.ID || '').slice(0, 12),
          name: String(row.Names || '').replace(/^\//, '') || String(row.ID || '').slice(0, 12),
          image: row.Image || '',
          imageId: '',
          state: row.State || '',
          status: row.Status || '',
          created,
          createdHuman: created ? new Date(created * 1000).toISOString() : '',
          ports: parsePortsString(row.Ports),
          labels: {},
        };
      })
      .sort((a, b) => b.created - a.created);
  }

  /** 远端容器日志 */
  async getContainerLogs(serverId: string, container: string, tail: number): Promise<string> {
    const safeTail = Math.min(Math.max(tail, 1), 2000);
    return execRemote(serverId, `docker logs --tail ${safeTail} ${shellQuote(container)} 2>&1`, 30000);
  }

  /** 远端容器操作：start / stop / restart */
  async containerAction(
    serverId: string,
    container: string,
    action: 'start' | 'stop' | 'restart'
  ): Promise<{ id: string; action: string }> {
    const timeoutOption = action === 'stop' ? '-t 10 ' : '';
    await execRemote(serverId, `docker ${action} ${timeoutOption}${shellQuote(container)}`, 60000);
    return { id: container, action };
  }

  /** 远端拉取镜像（大镜像耗时较长，超时放宽到 20 分钟） */
  async pullImage(serverId: string, ref: string): Promise<{ ref: string; status: string }> {
    // docker pull 的进度写在 stderr，成功时退出码为 0
    const { code, stdout, stderr } = await execRemoteRaw(serverId, `docker pull ${shellQuote(ref)}`, 20 * 60 * 1000);
    if (code !== 0) {
      throw new DockerEngineError(describeDockerError(stderr || stdout, code), 502);
    }
    const lines = `${stderr}\n${stdout}`
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return { ref, status: lines[lines.length - 1] || '已完成' };
  }

  /** 远端删除镜像 */
  async removeImage(serverId: string, ref: string, force = false): Promise<{ id: string }> {
    await execRemote(serverId, `docker rmi ${force ? '-f ' : ''}${shellQuote(ref)}`, 120000);
    return { id: ref };
  }

  /** 远端容器是否存在（按名称，用于保护名单校验） */
  async findContainerName(serverId: string, idOrName: string): Promise<string | undefined> {
    const containers = await this.listContainers(serverId, true);
    const matched = containers.find(
      (item) => item.id === idOrName || item.id.startsWith(idOrName) || item.name === idOrName
    );
    return matched?.name;
  }
}

/** 单引号包裹 + 转义，防止命令注入（ID/名称已通过 assertSafeDockerId 校验） */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export const dockerRemoteProvider = new DockerRemoteProvider();