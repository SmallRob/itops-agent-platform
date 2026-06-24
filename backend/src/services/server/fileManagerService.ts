import { SFTPWrapper } from 'ssh2';
import { terminalService } from './terminalService';
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

export class FileManagerService {
  private config: FileManagerConfig;

  constructor(config: FileManagerConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  async listFiles(sessionId: string, path: string): Promise<FileItem[]> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

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
  }

  async readFile(sessionId: string, path: string): Promise<string> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

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
  }

  async writeFile(sessionId: string, path: string, content: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

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
  }

  async delete(sessionId: string, path: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

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
  }

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    if (!this.validatePath(oldPath) || !this.validatePath(newPath)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

    await new Promise<void>((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createDirectory(sessionId: string, path: string): Promise<void> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

    await new Promise<void>((resolve, reject) => {
      sftp.mkdir(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getFileInfo(sessionId: string, path: string): Promise<FileInfo> {
    if (!this.validatePath(path)) {
      throw new Error('Access denied to this path');
    }

    const sftp = await this.getSftpClient(sessionId);

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

  private async getSftpClient(sessionId: string): Promise<SFTPWrapper> {
    const conn = terminalService.getConnection(sessionId);

    if (!conn) {
      throw new Error('No active SSH connection for this session');
    }

    return new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(sftp);
      });
    });
  }
}

export const fileManagerService = new FileManagerService();
