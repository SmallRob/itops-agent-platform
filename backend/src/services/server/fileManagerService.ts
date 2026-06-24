import { Client, SFTPWrapper } from 'ssh2';
import db from '@models/database';
import { decrypt } from '@services/security/encryptionService';
import { logger } from '@utils/logger';
import type { FileItem, FileInfo, FileManagerConfig } from '@types/fileManager';

const DEFAULT_CONFIG: FileManagerConfig = {
  maxFileSize: 10 * 1024 * 1024,
  allowedExtensions: [],
  blockedPaths: ['/etc/shadow', '/etc/passwd', '/root/.ssh'],
  operations: {
    create: true,
    read: true,
    update: true,
    delete: true,
    rename: true,
    upload: true,
    download: true,
    copy: true,
    paste: true,
    cut: true,
    compress: true,
    extract: true,
    permissions: true,
    ownership: true,
  },
};

interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  private_key: string | null;
  use_ssh_key: number;
  enabled?: number;
}

export class FileManagerService {
  private config: FileManagerConfig;

  constructor(config: FileManagerConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  async listFiles(serverId: string, path: string): Promise<FileItem[]> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      return await new Promise<FileItem[]>((resolve, reject) => {
        sftp.readdir(path, (err, list) => {
          if (err) {
            reject(err);
            return;
          }

          const items: FileItem[] = list.map(item => ({
            name: item.filename,
            path: `${path}/${item.filename}`.replace(/\/\//g, '/'),
            type: item.attrs.isDirectory() ? 'directory' : 'file',
            size: item.attrs.size,
            modified: new Date(item.attrs.mtime * 1000).toISOString(),
            permissions: item.attrs.mode.toString(8).slice(-3),
            owner: item.attrs.uid.toString(),
            group: item.attrs.gid.toString(),
          }));

          resolve(items);
        });
      });
    } finally {
      cleanup();
    }
  }

  async readFile(serverId: string, path: string): Promise<string> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      return await new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];

        const readStream = sftp.createReadStream(path);

        readStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        readStream.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf-8'));
        });

        readStream.on('error', (err: Error) => {
          reject(err);
        });
      });
    } finally {
      cleanup();
    }
  }

  async writeFile(serverId: string, path: string, content: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      await new Promise<void>((resolve, reject) => {
        const writeStream = sftp.createWriteStream(path);

        writeStream.on('close', () => {
          resolve();
        });

        writeStream.on('error', (err: Error) => {
          reject(err);
        });

        writeStream.write(content);
        writeStream.end();
      });
    } finally {
      cleanup();
    }
  }

  async delete(serverId: string, path: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      const stat = await new Promise<import('ssh2').Stats>((resolve, reject) => {
        sftp.stat(path, (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });

      if (stat.isDirectory()) {
        await new Promise<void>((resolve, reject) => {
          sftp.rmdir(path, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.unlink(path, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    } finally {
      cleanup();
    }
  }

  async rename(serverId: string, oldPath: string, newPath: string): Promise<void> {
    if (!this.validatePath(oldPath) || !this.validatePath(newPath)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      await new Promise<void>((resolve, reject) => {
        sftp.rename(oldPath, newPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      cleanup();
    }
  }

  async createDirectory(serverId: string, path: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(path, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } finally {
      cleanup();
    }
  }

  async getFileInfo(serverId: string, path: string): Promise<FileInfo> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const { sftp, cleanup } = await this.getSftpClient(serverId);

    try {
      const stat = await new Promise<import('ssh2').Stats>((resolve, reject) => {
        sftp.stat(path, (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });

      const pathParts = path.split('/');
      const name = pathParts[pathParts.length - 1];

      return {
        path,
        name,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.size,
        modified: new Date(stat.mtime * 1000).toISOString(),
        created: new Date(stat.atime * 1000).toISOString(),
        permissions: stat.mode.toString(8).slice(-3),
        owner: stat.uid.toString(),
        group: stat.gid.toString(),
        mimeType: this.getMimeType(name),
        encoding: 'utf-8',
      };
    } finally {
      cleanup();
    }
  }

  private validatePath(path: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    for (const blockedPath of this.config.blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        return false;
      }
    }
    return true;
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  private async getSftpClient(serverId: string): Promise<{ sftp: SFTPWrapper; cleanup: () => void }> {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo | undefined;

    if (!server) {
      throw new Error('Server not found');
    }

    if (!server.enabled) {
      throw new Error('Server is disabled');
    }

    const decryptedPassword = server.password ? decrypt(server.password) : undefined;
    const decryptedPrivateKey = server.private_key ? decrypt(server.private_key) : undefined;

    const conn = new Client();

    return new Promise((resolve, reject) => {
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }

          const cleanup = () => {
            sftp.end();
            conn.end();
          };

          resolve({ sftp, cleanup });
        });
      });

      conn.on('error', (err) => {
        reject(new Error(`SSH connection error: ${err.message}`));
      });

      conn.on('timeout', () => {
        reject(new Error('SSH connection timeout'));
      });

      const connectConfig: Record<string, unknown> = {
        host: server.hostname,
        port: server.port || 22,
        username: server.username,
        readyTimeout: 15000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        maxTries: 1,
      };

      if (server.use_ssh_key && decryptedPrivateKey) {
        connectConfig.privateKey = decryptedPrivateKey;
      } else if (decryptedPassword) {
        connectConfig.password = decryptedPassword;
      } else {
        reject(new Error('No authentication method configured'));
        return;
      }

      conn.connect(connectConfig);
    });
  }
}

export const fileManagerService = new FileManagerService();
