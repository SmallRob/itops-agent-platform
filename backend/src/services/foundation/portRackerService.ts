import axios, { AxiosInstance } from 'axios';
import { logger } from '@utils/logger';
import db from '@models/database';

interface PortRackerConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  directUrl: string;
  username: string;
  password: string;
}

const DEFAULT_CONFIG: PortRackerConfig = {
  enabled: false,
  apiUrl: '',
  apiKey: '',
  directUrl: '',
  username: '',
  password: '',
};

/** 单台服务器聚合结果 */
interface ServerPortsResult {
  id: string;
  server: string;
  url: string;
  type: string;
  platformType: string;
  ok: boolean;
  error: string | null;
  portCount: number;
  data: any[];
}

/** peer 端口拉取超时与聚合缓存（避免前端轮询时反复打 7 台实例） */
const REMOTE_PORTS_TIMEOUT_MS = 8000;
const ALL_PORTS_CACHE_TTL_MS = 5000;

class PortRackerService {
  private client: AxiosInstance | null = null;
  private config: PortRackerConfig | null = null;
  private sessionCookie: string | null = null;
  private allPortsCache: { at: number; data: ServerPortsResult[] } | null = null;

  private loadConfig(): PortRackerConfig {
    try {
      const setting = db.prepare(
        "SELECT value FROM settings WHERE key = 'portracker_config'"
      ).get() as { value: string } | undefined;

      if (setting) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) };
      }
    } catch (error) {
      logger.error('Failed to load PortRacker config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  getConfig(): PortRackerConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  saveConfig(config: PortRackerConfig): void {
    const existing = db.prepare(
      "SELECT id FROM settings WHERE key = 'portracker_config'"
    ).get();

    if (existing) {
      db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'portracker_config'")
        .run(JSON.stringify(config));
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES ('portracker_config', ?)")
        .run(JSON.stringify(config));
    }
    this.config = config;
    this.client = null;
    this.sessionCookie = null;
    this.allPortsCache = null;
  }

  private async login(): Promise<boolean> {
    const config = this.getConfig();
    if (!config.username || !config.password) return false;

    try {
      // 去除结尾斜杠，避免拼出 //api/auth/login 这类 404 路径（与 portainerService 保持一致）
      const baseUrl = config.apiUrl.replace(/\/+$/, '');
      const res = await axios.post(`${baseUrl}/api/auth/login`, {
        username: config.username,
        password: config.password,
      }, { timeout: 30000 });

      const setCookie = res.headers['set-cookie'];
      if (setCookie && setCookie.length > 0) {
        const match = setCookie[0].match(/^(portracker\.sid=[^;]+)/);
        if (match) {
          this.sessionCookie = match[1];
          logger.info('PortRacker login successful');
          return true;
        }
      }
      logger.warn('PortRacker login succeeded but no session cookie received');
      return false;
    } catch (error: any) {
      logger.error('PortRacker login failed:', error.message);
      return false;
    }
  }

  private getClient(): AxiosInstance | null {
    const config = this.getConfig();
    if (!config.enabled || !config.apiUrl) return null;

    if (!this.client) {
      const headers: Record<string, string> = {};
      if (config.apiKey) {
        headers['X-API-Key'] = config.apiKey;
      }
      this.client = axios.create({
        baseURL: config.apiUrl.replace(/\/+$/, ''),
        timeout: 30000,
        headers,
      });
    }
    return this.client;
  }

  private async requestWithAuth<T>(fn: (client: AxiosInstance, headers: Record<string, string>) => Promise<T>): Promise<T> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');

    const config = this.getConfig();
    const buildHeaders = (): Record<string, string> => {
      const h: Record<string, string> = {};
      if (this.sessionCookie) h['Cookie'] = this.sessionCookie;
      else if (config.apiKey) h['X-API-Key'] = config.apiKey;
      return h;
    };

    try {
      return await fn(client, buildHeaders());
    } catch (error: any) {
      if (error.response?.status === 401 && config.username && config.password) {
        const loggedIn = await this.login();
        if (loggedIn) {
          return await fn(client, buildHeaders());
        }
      }
      throw error;
    }
  }

  async healthCheck(): Promise<{ reachable: boolean; data?: any }> {
    try {
      const client = this.getClient();
      if (!client) return { reachable: false };
      const config = this.getConfig();
      const headers: Record<string, string> = {};
      if (this.sessionCookie) headers['Cookie'] = this.sessionCookie;
      else if (config.apiKey) headers['X-API-Key'] = config.apiKey;
      const res = await client.get('/api/health', { headers });
      return { reachable: true, data: res.data };
    } catch {
      return { reachable: false };
    }
  }

  async getPorts(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/ports', { headers });
      return normalizePorts(res.data);
    });
  }

  async getAllPorts(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/all-ports', { headers });
      return normalizePorts(res.data);
    });
  }

  async getServices(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/services', { headers });
      // 关联端口列表，便于服务视图展示每个服务占用的端口
      let ports: any[] = [];
      try {
        const portRes = await client.get('/api/ports', { headers });
        ports = normalizePorts(portRes.data);
      } catch {
        /* 端口列表失败不影响服务列表 */
      }
      return normalizeServices(res.data, ports);
    });
  }

  async getServers(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/servers', { headers });
      return normalizeServers(res.data);
    });
  }

  /**
   * 多服务器端口聚合。
   * 说明：Portracker 自身的 /api/all-ports 在当前版本（1.3.13）对非本机服务器硬编码返回
   * "Peer communication not yet implemented"，不返回任何数据；
   * 因此这里改为：从 /api/servers 取服务器清单（含各自的实例地址），
   * 本机走已配置的 apiUrl，其它服务器直连其自身 Portracker 的 /api/ports 聚合。
   */
  async getAllServersPorts(): Promise<ServerPortsResult[]> {
    const cached = this.allPortsCache;
    if (cached && Date.now() - cached.at < ALL_PORTS_CACHE_TTL_MS) {
      return cached.data;
    }

    const servers = await this.getServers();
    const results = await Promise.all(
      servers.map(async (server: any) => {
        const base: ServerPortsResult = {
          id: server.id,
          server: server.label,
          url: server.url,
          type: server.type,
          platformType: server.platformType,
          ok: false,
          error: null,
          portCount: 0,
          data: [],
        };
        try {
          const ports = server.id === 'local' ? await this.getPorts() : await this.fetchRemotePorts(server.url);
          return { ...base, ok: true, portCount: ports.length, data: ports };
        } catch (error: any) {
          return { ...base, error: error.message || '获取失败' };
        }
      })
    );

    this.allPortsCache = { at: Date.now(), data: results };
    return results;
  }

  /** 直连其它 Portracker 实例获取端口（地址来自 /api/servers 的 url 字段） */
  private async fetchRemotePorts(url: string): Promise<any[]> {
    const base = (url || '').replace(/\/+$/, '');
    if (!base) throw new Error('该服务器未配置访问地址');

    const res = await axios.get(`${base}/api/ports`, { timeout: REMOTE_PORTS_TIMEOUT_MS, validateStatus: () => true });
    if (res.status === 401 || res.status === 403) {
      throw new Error('该服务器已启用认证，需在其 Portracker 设置中生成 API Key 并允许本实例访问');
    }
    if (res.status >= 400) {
      throw new Error(`该服务器返回 HTTP ${res.status}`);
    }
    return normalizePorts(res.data);
  }

  async pingPort(host: string, port: number): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/ping', { params: { host, port }, headers });
      return res.data;
    });
  }

  async scanServer(serverId: string): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get(`/api/servers/${serverId}/scan`, { headers });
      return res.data;
    });
  }

  async getVersion(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/version', { headers });
      return res.data;
    });
  }
}

export const portRackerService = new PortRackerService();

// ============================================================
// 响应归一化：Portracker 的 /api/ports 返回 { cached, ttlMs, data: [...] }，
// 且字段名为 host_port/owner/app_id/compose_project；此处统一为前端页面使用的契约
// ============================================================

function unwrapList(payload: any, key: string): any[] {
  const value = payload?.data ?? payload?.[key] ?? payload;
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

/** 服务器清单归一化：Portracker 的 unreachable 字段因其自身 peer 能力未实现而不可靠，仅作参考 */
function normalizeServers(payload: any): any[] {
  return unwrapList(payload, 'servers').map((item: any) => ({
    id: item.id,
    label: item.label || item.id,
    url: item.url || '',
    type: item.type || '',
    parentId: item.parentId ?? null,
    platformType: item.platform_type || 'unknown',
    isLocal: item.id === 'local',
    hasApiKey: Boolean(item.hasApiKey),
    peerReportedUnreachable: Boolean(item.unreachable),
  }));
}

function normalizePorts(payload: any): any[] {
  return unwrapList(payload, 'ports').map((item: any) => ({
    port: item.host_port ?? item.port ?? null,
    hostIp: item.host_ip ?? item.hostIp ?? '',
    protocol: item.protocol || 'tcp',
    service: item.app_id || item.compose_service || item.owner || '-',
    state: item.internal ? 'internal' : item.probe?.ok === false ? 'closed' : 'open',
    process: Array.isArray(item.owners) && item.owners.length > 0 ? item.owners.join(', ') : item.owner || '-',
    container: item.container_id || item.target || '-',
    composeProject: item.compose_project || '-',
    source: item.source || '',
    target: item.target || '',
  }));
}

/** Portracker 服务健康色 -> 状态文案（前端按 healthy/warning/down 着色） */
function mapServiceStatus(color?: string): string {
  switch ((color || '').toLowerCase()) {
    case 'green': return 'healthy';
    case 'yellow': return 'warning';
    case 'red': return 'down';
    default: return 'unknown';
  }
}

function normalizeServices(payload: any, ports: any[]): any[] {
  return unwrapList(payload, 'services').map((svc: any) => {
    const componentIds: string[] = [];
    (svc.components || []).forEach((component: any) => {
      if (component?.componentId) componentIds.push(component.componentId);
      if (component?.containerId) componentIds.push(component.containerId);
    });
    (svc.failingComponents || []).forEach((id: string) => componentIds.push(id));

    return {
      id: svc.serviceId || svc.id || svc.name,
      name: svc.project ? `${svc.project} / ${svc.name}` : svc.name,
      status: mapServiceStatus(svc.color),
      color: svc.color || 'gray',
      reason: svc.reason || '',
      ports: ports.filter((port) => componentIds.some((id) => port.container && String(port.container).includes(String(id)))),
    };
  });
}
