import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import db from '../models/database';

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

class PortRackerService {
  private client: AxiosInstance | null = null;
  private config: PortRackerConfig | null = null;
  private sessionCookie: string | null = null;

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
  }

  private async login(): Promise<boolean> {
    const config = this.getConfig();
    if (!config.username || !config.password) return false;

    try {
      const res = await axios.post(`${config.apiUrl}/api/auth/login`, {
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
        baseURL: config.apiUrl,
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
      return res.data;
    });
  }

  async getAllPorts(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/all-ports', { headers });
      return res.data;
    });
  }

  async getServices(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/services', { headers });
      return res.data;
    });
  }

  async getServers(): Promise<any> {
    return this.requestWithAuth(async (client, headers) => {
      const res = await client.get('/api/servers', { headers });
      return res.data;
    });
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
