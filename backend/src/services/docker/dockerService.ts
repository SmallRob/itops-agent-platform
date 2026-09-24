/**
 * Docker 资源管理服务（P0：只读）
 * 提供镜像 / 容器 / 卷 / 网络 的列表与统计，数据源为本机 Docker Engine。
 */
import { logger } from '../../utils/logger';
import {
  DockerEngineError,
  assertSafeDockerId,
  assertSafeImageRef,
  dockerRequest,
  dockerRequestJsonStream,
  dockerRequestText,
  getDockerSocketPath,
  isDockerEnabled,
  pingDockerEngine,
} from './dockerEngine';
import { dockerRemoteProvider, findRemoteHost, listRemoteDockerHosts, type DockerRemoteHost } from './dockerRemoteProvider';

/** 远端主机列表项（供前端服务器切换使用） */
export interface DockerHost {
  id: string;
  name: string;
  type: 'local' | 'ssh';
  address: string;
  available: boolean;
  version?: string;
  message?: string;
}

/** 远端查询结果缓存时长（避免前端轮询反复打生产服务器） */
const REMOTE_CACHE_TTL_MS = 20000;
const PROBE_CACHE_TTL_MS = 60000;

/** 默认保护名单：承载网关/平台自身/管理面的容器，禁止通过平台启停（可用 DOCKER_PROTECTED_CONTAINERS 覆盖，逗号分隔） */
const DEFAULT_PROTECTED_CONTAINERS = [
  'tcb-front-nginx',
  'portainer-server',
  'portainer_agent',
  'itops-backend',
  'itops-frontend',
  'itops-dev-backend',
  'itops-dev-frontend',
];

export function getProtectedContainers(): string[] {
  const configured = process.env.DOCKER_PROTECTED_CONTAINERS;
  if (configured === undefined) return DEFAULT_PROTECTED_CONTAINERS;
  return configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isProtectedContainer(name: string): boolean {
  return getProtectedContainers().includes(name);
}

// ============================================================
// 领域模型
// ============================================================

export interface DockerImage {
  id: string;
  shortId: string;
  repoTags: string[];
  repository: string;
  tag: string;
  size: number;
  sizeHuman: string;
  created: number;
  createdHuman: string;
  dangling: boolean;
  containers: number;
}

export interface DockerContainer {
  id: string;
  shortId: string;
  name: string;
  image: string;
  imageId: string;
  state: string;
  status: string;
  created: number;
  createdHuman: string;
  ports: Array<{ privatePort: number; publicPort?: number; type: string; ip?: string }>;
  labels: Record<string, string>;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  created?: string;
  size?: number;
  sizeHuman?: string;
}

export interface DockerNetwork {
  id: string;
  shortId: string;
  name: string;
  driver: string;
  scope: string;
  internal: boolean;
  attachable: boolean;
  containers: number;
  created?: string;
}

export interface DockerOverview {
  available: boolean;
  socketPath: string;
  engineVersion?: string;
  apiVersion?: string;
  message?: string;
  images: { total: number; tagged: number; dangling: number; totalSize: number; totalSizeHuman: string };
  containers: { total: number; running: number; stopped: number; paused: number };
  volumes: { total: number };
  networks: { total: number };
}

// ============================================================
// Docker Engine 原始响应类型（仅取用到的字段）
// ============================================================

interface RawImage {
  Id: string;
  RepoTags: string[] | null;
  Created: number;
  Size: number;
  Containers: number;
}

interface RawContainer {
  Id: string;
  Names: string[] | null;
  Image: string;
  ImageID: string;
  State: string;
  Status: string;
  Created: number;
  Ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string; IP?: string }> | null;
  Labels: Record<string, string> | null;
}

interface RawVolumeResponse {
  Volumes: Array<{
    Name: string;
    Driver: string;
    Mountpoint: string;
    Scope: string;
    CreatedAt?: string;
  }> | null;
}

interface RawNetwork {
  Id: string;
  Name: string;
  Driver: string;
  Scope: string;
  Internal: boolean;
  Attachable: boolean;
  Created?: string;
  Containers?: Record<string, unknown> | null;
}

// ============================================================
// 工具函数
// ============================================================

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${UNITS[index]}`;
}

function formatDate(epochSeconds: number): string {
  if (!epochSeconds) return '-';
  return new Date(epochSeconds * 1000).toISOString();
}

function splitRepoTags(repoTags: string[] | null): { repository: string; tag: string; dangling: boolean } {
  if (!repoTags || repoTags.length === 0 || repoTags[0] === '<none>:<none>') {
    return { repository: '<none>', tag: '<none>', dangling: true };
  }
  const [reference] = repoTags;
  const lastColon = reference.lastIndexOf(':');
  if (lastColon <= 0) {
    return { repository: reference, tag: 'latest', dangling: false };
  }
  return { repository: reference.slice(0, lastColon), tag: reference.slice(lastColon + 1), dangling: false };
}

// ============================================================
// 服务实现
// ============================================================

export class DockerService {
  private cache = new Map<string, { at: number; data: unknown }>();

  /** 带 TTL 的缓存读取（主要用于远端主机，避免频繁 SSH） */
  private async cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      return hit.data as T;
    }
    const data = await loader();
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }

  /** 可选主机清单：本机 + 已接入且支持 Docker 管理的 Linux 服务器 */
  async listHosts(): Promise<DockerHost[]> {
    const localStatus = await pingDockerEngine();
    const hosts: DockerHost[] = [
      {
        id: 'local',
        name: '本机（平台所在主机）',
        type: 'local',
        address: getDockerSocketPath(),
        available: localStatus.available,
        version: localStatus.version,
        message: localStatus.message,
      },
    ];

    const remoteHosts: DockerRemoteHost[] = listRemoteDockerHosts();
    const remote: DockerHost[] = await Promise.all(
      remoteHosts.map(async (host) => {
        const probe = await this.cached(`probe:${host.id}`, PROBE_CACHE_TTL_MS, () => dockerRemoteProvider.probe(host.id));
        return {
          id: host.id,
          name: host.name,
          type: 'ssh' as const,
          address: `${host.host}:${host.port}`,
          available: probe.available,
          version: probe.version,
          message: probe.message,
        };
      })
    );

    return [...hosts, ...remote];
  }

  /** 运行状态与统计概览 */
  async getOverview(host = 'local'): Promise<DockerOverview> {
    if (host !== 'local') {
      return this.getRemoteOverview(host);
    }

    const socketPath = getDockerSocketPath();
    const ping = await pingDockerEngine();

    if (!ping.available) {
      return {
        available: false,
        socketPath,
        message: ping.message,
        images: { total: 0, tagged: 0, dangling: 0, totalSize: 0, totalSizeHuman: '0 B' },
        containers: { total: 0, running: 0, stopped: 0, paused: 0 },
        volumes: { total: 0 },
        networks: { total: 0 },
      };
    }

    const [images, containers, volumes, networks] = await Promise.all([
      this.listImages(),
      this.listContainers(true),
      this.listVolumes(),
      this.listNetworks(),
    ]);

    const totalSize = images.reduce((sum, image) => sum + image.size, 0);
    const tagged = images.filter((image) => !image.dangling).length;
    const running = containers.filter((container) => container.state === 'running').length;
    const paused = containers.filter((container) => container.state === 'paused').length;

    return {
      available: true,
      socketPath,
      engineVersion: ping.version,
      apiVersion: ping.apiVersion,
      images: {
        total: images.length,
        tagged,
        dangling: images.length - tagged,
        totalSize,
        totalSizeHuman: formatBytes(totalSize),
      },
      containers: {
        total: containers.length,
        running,
        paused,
        stopped: containers.length - running - paused,
      },
      volumes: { total: volumes.length },
      networks: { total: networks.length },
    };
  }

  /** 镜像列表 */
  async listImages(host = 'local'): Promise<DockerImage[]> {
    if (host !== 'local') {
      this.assertRemoteHost(host);
      return this.cached(`images:${host}`, REMOTE_CACHE_TTL_MS, () => dockerRemoteProvider.listImages(host));
    }
    const raw = await dockerRequest<RawImage[]>('/images/json');
    return raw
      .map((item) => {
        const { repository, tag, dangling } = splitRepoTags(item.RepoTags);
        return {
          id: item.Id,
          shortId: item.Id.replace(/^sha256:/, '').slice(0, 12),
          repoTags: item.RepoTags && item.RepoTags[0] !== '<none>:<none>' ? item.RepoTags : [],
          repository,
          tag,
          size: item.Size,
          sizeHuman: formatBytes(item.Size),
          created: item.Created,
          createdHuman: formatDate(item.Created),
          dangling,
          containers: item.Containers || 0,
        };
      })
      .sort((a, b) => b.created - a.created);
  }

  /** 容器列表（all=true 时包含已停止容器） */
  async listContainers(all = true, host = 'local'): Promise<DockerContainer[]> {
    if (host !== 'local') {
      this.assertRemoteHost(host);
      return this.cached(`containers:${host}:${all}`, REMOTE_CACHE_TTL_MS, () =>
        dockerRemoteProvider.listContainers(host, all)
      );
    }
    const raw = await dockerRequest<RawContainer[]>(`/containers/json?all=${all ? 1 : 0}`);
    return raw
      .map((item) => ({
        id: item.Id,
        shortId: item.Id.slice(0, 12),
        name: (item.Names?.[0] || '').replace(/^\//, '') || item.Id.slice(0, 12),
        image: item.Image,
        imageId: item.ImageID,
        state: item.State,
        status: item.Status,
        created: item.Created,
        createdHuman: formatDate(item.Created),
        ports: (item.Ports || []).map((port) => ({
          privatePort: port.PrivatePort,
          publicPort: port.PublicPort,
          type: port.Type,
          ip: port.IP,
        })),
        labels: item.Labels || {},
      }))
      .sort((a, b) => b.created - a.created);
  }

  /** 卷列表 */
  async listVolumes(): Promise<DockerVolume[]> {
    const raw = await dockerRequest<RawVolumeResponse>('/volumes');
    return (raw.Volumes || [])
      .map((item) => ({
        name: item.Name,
        driver: item.Driver,
        mountpoint: item.Mountpoint,
        scope: item.Scope,
        created: item.CreatedAt,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 网络列表 */
  async listNetworks(): Promise<DockerNetwork[]> {
    const raw = await dockerRequest<RawNetwork[]>('/networks');
    return raw
      .map((item) => ({
        id: item.Id,
        shortId: item.Id.slice(0, 12),
        name: item.Name,
        driver: item.Driver,
        scope: item.Scope,
        internal: item.Internal,
        attachable: item.Attachable,
        containers: item.Containers ? Object.keys(item.Containers).length : 0,
        created: item.Created,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 便捷探测（供健康检查/状态接口使用） */
  async getStatus(): Promise<{ enabled: boolean; available: boolean; socketPath: string; version?: string; message?: string }> {
    const enabled = isDockerEnabled();
    if (!enabled) {
      return { enabled: false, available: false, socketPath: getDockerSocketPath(), message: 'Docker 功能未启用（DOCKER_ENABLED=false）' };
    }
    const ping = await pingDockerEngine();
    if (!ping.available) {
      logger.warn(`[docker] Docker Engine 不可用: ${ping.message}`);
    }
    return { enabled, available: ping.available, socketPath: getDockerSocketPath(), version: ping.version, message: ping.message };
  }

  // ==========================================================
  // 写操作（仅管理员，调用方需做角色校验与审计留痕）
  // ==========================================================

  /** 拉取镜像（ref 支持 nginx:latest / registry:5000/ns/name:tag，默认 tag=latest） */
  async pullImage(ref: string, host = 'local'): Promise<{ ref: string; status: string }> {
    const imageRef = assertSafeImageRef(ref);

    if (host !== 'local') {
      this.assertRemoteHost(host);
      const result = await dockerRemoteProvider.pullImage(host, imageRef);
      this.invalidate(host);
      return result;
    }

    const { fromImage, tag } = splitImageRef(imageRef);

    const path = `/images/create?fromImage=${encodeURIComponent(fromImage)}&tag=${encodeURIComponent(tag)}`;
    // 大镜像拉取耗时较长，超时放宽到 20 分钟
    const { error, chunks } = await dockerRequestJsonStream(path, 20 * 60 * 1000);

    if (error) {
      throw new DockerEngineError(`拉取镜像失败：${error}`, 502);
    }

    const lastStatus = chunks
      .map((chunk) => chunk.status)
      .filter((status): status is string => typeof status === 'string')
      .pop();

    return { ref: `${fromImage}:${tag}`, status: lastStatus || '已完成' };
  }

  /** 删除镜像 */
  async removeImage(idOrRef: string, force = false, host = 'local'): Promise<{ id: string }> {
    const image = assertSafeImageRef(idOrRef, '镜像');

    if (host !== 'local') {
      this.assertRemoteHost(host);
      const result = await dockerRemoteProvider.removeImage(host, image, force);
      this.invalidate(host);
      return result;
    }

    await dockerRequest(`/images/${encodeURIComponent(image)}?force=${force ? 1 : 0}&noprune=0`, 'DELETE', 60000);
    return { id: image };
  }

  /** 容器操作：start / stop / restart */
  async containerAction(idOrName: string, action: 'start' | 'stop' | 'restart', host = 'local'): Promise<{ id: string; action: string }> {
    const container = assertSafeDockerId(idOrName, '容器');

    if (host !== 'local') {
      this.assertRemoteHost(host);
      const targetName = await dockerRemoteProvider.findContainerName(host, container);
      if (!targetName) {
        throw new DockerEngineError('容器不存在', 404);
      }
      if (action !== 'start' && isProtectedContainer(targetName)) {
        throw new DockerEngineError(`容器 ${targetName} 属于平台保护名单，禁止通过平台执行 ${action} 操作`, 403);
      }
      const result = await dockerRemoteProvider.containerAction(host, container, action);
      this.invalidate(host);
      return result;
    }

    const target = await this.findContainer(container);

    if (!target) {
      throw new DockerEngineError('容器不存在', 404);
    }
    if (action !== 'start' && isProtectedContainer(target.name)) {
      throw new DockerEngineError(`容器 ${target.name} 属于平台保护名单，禁止通过平台执行 ${action} 操作`, 403);
    }

    const timeout = action === 'stop' ? '?t=10' : '';
    await dockerRequest(`/containers/${encodeURIComponent(container)}/${action}${timeout}`, 'POST', 60000);
    return { id: container, action };
  }

  /** 写操作后清理该主机缓存，保证界面立即看到最新状态 */
  private invalidate(host: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.endsWith(`:${host}`) || key.startsWith(`containers:${host}:`) || key === `images:${host}`) {
        this.cache.delete(key);
      }
    }
  }

  /** 容器日志（尾部 N 行） */
  async getContainerLogs(idOrName: string, tail = 200, host = 'local'): Promise<{ id: string; tail: number; logs: string }> {
    const container = assertSafeDockerId(idOrName, '容器');
    const safeTail = Math.min(Math.max(Number.isFinite(tail) ? tail : 200, 1), 2000);

    if (host !== 'local') {
      this.assertRemoteHost(host);
      const logs = await dockerRemoteProvider.getContainerLogs(host, container, safeTail);
      return { id: container, tail: safeTail, logs };
    }

    const logs = await dockerRequestText(
      `/containers/${encodeURIComponent(container)}/logs?stdout=1&stderr=1&timestamps=0&tail=${safeTail}`,
      'GET',
      30000
    );
    return { id: container, tail: safeTail, logs };
  }

  /** 远端主机概览（由镜像/容器列表派生，免额外命令） */
  private async getRemoteOverview(serverId: string): Promise<DockerOverview> {
    const info = findRemoteHost(serverId);
    const empty = {
      images: { total: 0, tagged: 0, dangling: 0, totalSize: 0, totalSizeHuman: '0 B' },
      containers: { total: 0, running: 0, stopped: 0, paused: 0 },
      volumes: { total: 0 },
      networks: { total: 0 },
    };

    if (!info) {
      return { available: false, socketPath: '', message: '未找到该服务器，或该服务器不支持 Docker 管理（仅支持 Linux）', ...empty };
    }

    const probe = await this.cached(`probe:${serverId}`, PROBE_CACHE_TTL_MS, () => dockerRemoteProvider.probe(serverId));
    if (!probe.available) {
      return { available: false, socketPath: `${info.host}:${info.port}`, message: probe.message, ...empty };
    }

    const [images, containers] = await Promise.all([this.listImages(serverId), this.listContainers(true, serverId)]);
    const totalSize = images.reduce((sum, image) => sum + image.size, 0);
    const tagged = images.filter((image) => !image.dangling).length;
    const running = containers.filter((container) => container.state === 'running').length;
    const paused = containers.filter((container) => container.state === 'paused').length;

    return {
      available: true,
      socketPath: `${info.host}:${info.port}`,
      engineVersion: probe.version,
      images: {
        total: images.length,
        tagged,
        dangling: images.length - tagged,
        totalSize,
        // 远端容量由 docker CLI 的人类可读值换算，为近似值
        totalSizeHuman: `${formatBytes(totalSize)}（近似）`,
      },
      containers: { total: containers.length, running, paused, stopped: containers.length - running - paused },
      volumes: { total: 0 },
      networks: { total: 0 },
    };
  }

  /** 远端主机存在性校验 */
  private assertRemoteHost(host: string): void {
    if (!findRemoteHost(host)) {
      throw new DockerEngineError('未找到该服务器，或该服务器不支持 Docker 管理（仅支持 Linux）', 404);
    }
  }

  /** 按 ID 或名称查找容器（用于保护名单与存在性校验） */
  private async findContainer(idOrName: string): Promise<DockerContainer | undefined> {
    const containers = await this.listContainers(true);
    return containers.find(
      (item) => item.id === idOrName || item.id.startsWith(idOrName) || item.name === idOrName
    );
  }
}

/** 拆分镜像引用为 fromImage / tag（tag 缺省为 latest；registry:port 场景下不误判端口为 tag） */
export function splitImageRef(ref: string): { fromImage: string; tag: string } {
  const lastSlash = ref.lastIndexOf('/');
  const lastColon = ref.lastIndexOf(':');
  if (lastColon > lastSlash && lastColon !== -1) {
    return { fromImage: ref.slice(0, lastColon), tag: ref.slice(lastColon + 1) || 'latest' };
  }
  return { fromImage: ref, tag: 'latest' };
}

export { DockerEngineError };
export const dockerService = new DockerService();