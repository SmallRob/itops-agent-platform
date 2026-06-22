import db from '../models/database';
import { logger } from '../utils/logger';

interface PortainerConfig {
  enabled: boolean;
  url: string;
}

const DEFAULT_CONFIG: PortainerConfig = {
  enabled: false,
  url: '',
};

class PortainerService {
  private config: PortainerConfig | null = null;

  private loadConfig(): PortainerConfig {
    try {
      const setting = db.prepare(
        "SELECT value FROM settings WHERE key = 'portainer_config'"
      ).get() as { value: string } | undefined;

      if (setting) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) };
      }
    } catch (error) {
      logger.error('Failed to load Portainer config:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  getConfig(): PortainerConfig {
    if (!this.config) {
      this.config = this.loadConfig();
    }
    return this.config;
  }

  saveConfig(config: PortainerConfig): void {
    const existing = db.prepare(
      "SELECT id FROM settings WHERE key = 'portainer_config'"
    ).get();

    if (existing) {
      db.prepare("UPDATE settings SET value = ?, updated_at = datetime('now') WHERE key = 'portainer_config'")
        .run(JSON.stringify(config));
    } else {
      db.prepare("INSERT INTO settings (key, value) VALUES ('portainer_config', ?)")
        .run(JSON.stringify(config));
    }
    this.config = config;
  }
}

export const portainerService = new PortainerService();
