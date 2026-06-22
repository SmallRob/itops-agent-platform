import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import db from '../models/database';

interface PortRackerConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  directUrl: string;
}

const DEFAULT_CONFIG: PortRackerConfig = {
  enabled: false,
  apiUrl: '',
  apiKey: '',
  directUrl: '',
};

class PortRackerService {
  private client: AxiosInstance | null = null;
  private config: PortRackerConfig | null = null;

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
  }

  private getClient(): AxiosInstance | null {
    const config = this.getConfig();
    if (!config.enabled || !config.apiUrl) return null;

    if (!this.client) {
      this.client = axios.create({
        baseURL: config.apiUrl,
        timeout: 10000,
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
      });
    }
    return this.client;
  }

  async healthCheck(): Promise<{ reachable: boolean; data?: any }> {
    try {
      const client = this.getClient();
      if (!client) return { reachable: false };
      const res = await client.get('/api/health');
      return { reachable: true, data: res.data };
    } catch {
      return { reachable: false };
    }
  }

  async getPorts(): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get('/api/ports');
    return res.data;
  }

  async getAllPorts(): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get('/api/all-ports');
    return res.data;
  }

  async getServices(): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get('/api/services');
    return res.data;
  }

  async getServers(): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get('/api/servers');
    return res.data;
  }

  async pingPort(host: string, port: number): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get('/api/ping', { params: { host, port } });
    return res.data;
  }

  async scanServer(serverId: string): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get(`/api/servers/${serverId}/scan`);
    return res.data;
  }

  async getVersion(): Promise<any> {
    const client = this.getClient();
    if (!client) throw new Error('PortRacker 未配置或已禁用');
    const res = await client.get('/api/version');
    return res.data;
  }
}

export const portRackerService = new PortRackerService();
