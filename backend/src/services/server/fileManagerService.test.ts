import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./terminalService', () => ({
  terminalService: {
    getConnection: vi.fn(),
  },
}));

import { FileManagerService } from './fileManagerService';
import { terminalService } from './terminalService';
import type { FileManagerConfig } from '@types/fileManager';

function makeMockSftp() {
  const sftp = {
    readdir: vi.fn(),
    stat: vi.fn(),
    sftp: vi.fn(),
    createReadStream: vi.fn(),
    createWriteStream: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn(),
    rmdir: vi.fn(),
    unlink: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  };
  return sftp;
}

function makeMockConnection(sftp: ReturnType<typeof makeMockSftp>) {
  return {
    sftp: vi.fn((cb: (err: Error | null, sftp: any) => void) => cb(null, sftp)),
  };
}

const config: FileManagerConfig = {
  maxFileSize: 10 * 1024 * 1024,
  allowedExtensions: [],
  blockedPaths: ['/etc/shadow', '/etc/passwd', '/root/.ssh'],
  operations: {
    create: true,
    read: true,
    update: true,
    delete: true,
    rename: true,
    upload: false,
    download: false,
    copy: false,
    paste: false,
    cut: false,
    compress: false,
    extract: false,
    permissions: false,
    ownership: false,
  },
};

describe('FileManagerService', () => {
  let service: FileManagerService;
  let mockSftp: ReturnType<typeof makeMockSftp>;
  let mockConn: ReturnType<typeof makeMockConnection>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new FileManagerService(config);
    mockSftp = makeMockSftp();
    mockConn = makeMockConnection(mockSftp);
    (terminalService.getConnection as any).mockReturnValue(mockConn as any);
  });

  describe('validatePath (via public methods)', () => {
    it('should reject /etc/shadow', async () => {
      await expect(service.listFiles('s1', '/etc/shadow')).rejects.toThrow('Access denied');
    });

    it('should reject /etc/passwd', async () => {
      await expect(service.readFile('s1', '/etc/passwd')).rejects.toThrow('Access denied');
    });

    it('should reject /root/.ssh', async () => {
      await expect(service.writeFile('s1', '/root/.ssh/id_rsa', 'x')).rejects.toThrow('Access denied');
    });

    it('should reject paths under blocked directories', async () => {
      await expect(service.listFiles('s1', '/root/.ssh/authorized_keys')).rejects.toThrow('Access denied');
    });

    it('should allow normal paths', async () => {
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      await expect(service.listFiles('s1', '/home/user')).resolves.toEqual([]);
    });

    it('should normalize backslashes', async () => {
      await expect(service.listFiles('s1', '\\etc\\shadow')).rejects.toThrow('Access denied');
    });
  });

  describe('getMimeType (via getFileInfo)', () => {
    it('should return text/plain for .txt', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => false, size: 100, mtime: 1000, birthtime: new Date(0), atime: 1000, mode: 0o644, uid: 1000, gid: 1000 })
      );
      const info = await service.getFileInfo('s1', '/tmp/readme.txt');
      expect(info.mimeType).toBe('text/plain');
    });

    it('should return application/json for .json', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => false, size: 50, mtime: 1000, birthtime: new Date(0), atime: 1000, mode: 0o644, uid: 1000, gid: 1000 })
      );
      const info = await service.getFileInfo('s1', '/tmp/data.json');
      expect(info.mimeType).toBe('application/json');
    });

    it('should return image/png for .png', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => false, size: 200, mtime: 1000, birthtime: new Date(0), atime: 1000, mode: 0o644, uid: 1000, gid: 1000 })
      );
      const info = await service.getFileInfo('s1', '/tmp/img.png');
      expect(info.mimeType).toBe('image/png');
    });

    it('should return application/octet-stream for unknown extensions', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => false, size: 10, mtime: 1000, birthtime: new Date(0), atime: 1000, mode: 0o644, uid: 1000, gid: 1000 })
      );
      const info = await service.getFileInfo('s1', '/tmp/file.xyz');
      expect(info.mimeType).toBe('application/octet-stream');
    });
  });

  describe('isBinaryPath (via readFile)', () => {
    it('should read text files as utf-8', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { size: 10 })
      );
      const EventEmitter = (await import('events')).EventEmitter;
      const mockStream = new EventEmitter();
      mockSftp.createReadStream.mockReturnValue(mockStream);

      const promise = service.readFile('s1', '/tmp/hello.txt');

      // Wait for microtask to allow getSftpClient to resolve and listeners to be attached
      await new Promise(r => setTimeout(r, 0));
      mockStream.emit('data', Buffer.from('hello'));
      mockStream.emit('end');

      const result = await promise;
      expect(result.encoding).toBe('utf-8');
      expect(result.content).toBe('hello');
    });

    it('should read binary files as base64', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { size: 10 })
      );
      const EventEmitter = (await import('events')).EventEmitter;
      const mockStream = new EventEmitter();
      mockSftp.createReadStream.mockReturnValue(mockStream);

      const promise = service.readFile('s1', '/tmp/image.png');

      await new Promise(r => setTimeout(r, 0));
      const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      mockStream.emit('data', binaryData);
      mockStream.emit('end');

      const result = await promise;
      expect(result.encoding).toBe('base64');
      expect(result.content).toBe(binaryData.toString('base64'));
    });

    it('should reject writing binary files', async () => {
      await expect(service.writeFile('s1', '/tmp/image.png', 'data')).rejects.toThrow('Writing binary files is not supported');
    });
  });

  describe('getSftpClient caching', () => {
    it('should reuse cached sftp client for the same session', async () => {
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      mockSftp.stat.mockImplementation((_p: any, cb: any) => cb(null, null));

      await service.listFiles('s1', '/tmp');
      await service.listFiles('s1', '/home');

      expect(mockConn.sftp).toHaveBeenCalledTimes(1);
    });

    it('should create new sftp client for different sessions', async () => {
      const mockSftp2 = makeMockSftp();
      const mockConn2 = makeMockConnection(mockSftp2);
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      mockSftp2.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));

      (terminalService.getConnection as any)
        .mockReturnValueOnce(mockConn as any)
        .mockReturnValueOnce(mockConn2 as any);

      await service.listFiles('s1', '/tmp');
      await service.listFiles('s2', '/tmp');

      expect(mockConn.sftp).toHaveBeenCalledTimes(1);
      expect(mockConn2.sftp).toHaveBeenCalledTimes(1);
    });

    it('should throw when no SSH connection exists', async () => {
      (terminalService.getConnection as any).mockReturnValue(null);
      await expect(service.listFiles('s1', '/tmp')).rejects.toThrow('No active SSH connection');
    });

    it('should evict stale cache and reconnect when cached sftp is dead', async () => {
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      // First call: stat succeeds (cache healthy)
      mockSftp.stat.mockImplementation((_p: any, cb: any) => cb(null, null));

      await service.listFiles('s1', '/tmp');
      expect(mockConn.sftp).toHaveBeenCalledTimes(1);

      // Make cached sftp stat fail (simulate dead connection)
      mockSftp.stat.mockImplementation((_p: any, cb: any) => cb(new Error('connection lost'), null));
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));

      // Second call: should evict cache and reconnect
      const mockSftp2 = makeMockSftp();
      const mockConn2 = makeMockConnection(mockSftp2);
      mockSftp2.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      (terminalService.getConnection as any).mockReturnValue(mockConn2 as any);

      await service.listFiles('s1', '/home');
      expect(mockConn2.sftp).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should end sftp session and remove from cache', async () => {
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      mockSftp.stat.mockImplementation((_p: any, cb: any) => cb(null, null));

      await service.listFiles('s1', '/tmp');
      service.cleanup('s1');

      expect(mockSftp.end).toHaveBeenCalled();
    });

    it('should not throw if no sftp session exists', () => {
      expect(() => service.cleanup('nonexistent')).not.toThrow();
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should set unimplemented operations to false', () => {
      const defaultService = new FileManagerService();
      const defaultConfig = (defaultService as any).config;
      expect(defaultConfig.operations.upload).toBe(false);
      expect(defaultConfig.operations.download).toBe(false);
      expect(defaultConfig.operations.copy).toBe(false);
      expect(defaultConfig.operations.paste).toBe(false);
      expect(defaultConfig.operations.cut).toBe(false);
      expect(defaultConfig.operations.compress).toBe(false);
      expect(defaultConfig.operations.extract).toBe(false);
      expect(defaultConfig.operations.permissions).toBe(false);
      expect(defaultConfig.operations.ownership).toBe(false);
      expect(defaultConfig.operations.create).toBe(true);
      expect(defaultConfig.operations.read).toBe(true);
      expect(defaultConfig.operations.update).toBe(true);
      expect(defaultConfig.operations.delete).toBe(true);
      expect(defaultConfig.operations.rename).toBe(true);
      expect(defaultConfig.maxFileSize).toBe(10 * 1024 * 1024);
    });
  });

  describe('readFile maxFileSize enforcement', () => {
    it('should reject files exceeding maxFileSize', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { size: 20 * 1024 * 1024 })
      );
      await expect(service.readFile('s1', '/tmp/huge.txt')).rejects.toThrow('exceeds maximum allowed size');
    });
  });

  describe('writeFile content size validation', () => {
    it('should reject content exceeding maxFileSize', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024 + 1);
      await expect(service.writeFile('s1', '/tmp/big.txt', largeContent)).rejects.toThrow('exceeds maximum allowed size');
    });
  });

  describe('delete on non-empty directory', () => {
    it('should reject deleting a non-empty directory', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => true })
      );
      mockSftp.readdir.mockImplementation((_p: any, cb: any) =>
        cb(null, [{ filename: 'file.txt', attrs: {} }])
      );
      await expect(service.delete('s1', '/tmp/notempty')).rejects.toThrow('Directory is not empty');
    });
  });

  describe('rename/writeFile with blocked destination paths', () => {
    it('should reject rename to a blocked path', async () => {
      await expect(service.rename('s1', '/tmp/safe.txt', '/etc/shadow')).rejects.toThrow('Access denied');
    });

    it('should reject writeFile to a blocked path', async () => {
      await expect(service.writeFile('s1', '/etc/shadow', 'data')).rejects.toThrow('Access denied');
    });

    it('should not block paths that share a prefix but are not under the blocked path', async () => {
      mockSftp.rename.mockImplementation((_o: any, _n: any, cb: any) => cb(null));
      await expect(service.rename('s1', '/tmp/a', '/etc/passwd-backup')).resolves.not.toThrow();
    });
  });

  describe('createDirectory', () => {
    it('should create a directory successfully', async () => {
      mockSftp.mkdir.mockImplementation((_p: any, cb: any) => cb(null));
      await expect(service.createDirectory('s1', '/tmp/newdir')).resolves.not.toThrow();
      expect(mockSftp.mkdir).toHaveBeenCalledWith('/tmp/newdir', expect.any(Function));
    });

    it('should reject creating a directory in a blocked path', async () => {
      await expect(service.createDirectory('s1', '/root/.ssh/newdir')).rejects.toThrow('Access denied');
    });

    it('should propagate sftp mkdir errors', async () => {
      mockSftp.mkdir.mockImplementation((_p: any, cb: any) => cb(new Error('Permission denied')));
      await expect(service.createDirectory('s1', '/tmp/baddir')).rejects.toThrow('Permission denied');
    });
  });

  describe('delete on files and empty directories', () => {
    it('should delete a file successfully', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => false })
      );
      mockSftp.unlink.mockImplementation((_p: any, cb: any) => cb(null));
      await expect(service.delete('s1', '/tmp/file.txt')).resolves.not.toThrow();
      expect(mockSftp.unlink).toHaveBeenCalledWith('/tmp/file.txt', expect.any(Function));
    });

    it('should delete an empty directory successfully', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { isDirectory: () => true })
      );
      mockSftp.readdir.mockImplementation((_p: any, cb: any) => cb(null, []));
      mockSftp.rmdir.mockImplementation((_p: any, cb: any) => cb(null));
      await expect(service.delete('s1', '/tmp/emptydir')).resolves.not.toThrow();
      expect(mockSftp.rmdir).toHaveBeenCalledWith('/tmp/emptydir', expect.any(Function));
    });

    it('should reject deleting a blocked path', async () => {
      await expect(service.delete('s1', '/etc/shadow')).rejects.toThrow('Access denied');
    });
  });

  describe('rename success cases', () => {
    it('should rename a file successfully', async () => {
      mockSftp.rename.mockImplementation((_o: any, _n: any, cb: any) => cb(null));
      await expect(service.rename('s1', '/tmp/old.txt', '/tmp/new.txt')).resolves.not.toThrow();
      expect(mockSftp.rename).toHaveBeenCalledWith('/tmp/old.txt', '/tmp/new.txt', expect.any(Function));
    });

    it('should reject renaming from a blocked source path', async () => {
      await expect(service.rename('s1', '/etc/shadow', '/tmp/safe.txt')).rejects.toThrow('Access denied');
    });
  });

  describe('writeFile success cases', () => {
    it('should write a text file successfully', async () => {
      const EventEmitter = (await import('events')).EventEmitter;
      const mockStream = new EventEmitter();
      mockStream.write = vi.fn(() => true);
      mockStream.end = vi.fn(() => mockStream.emit('close'));
      mockSftp.createWriteStream.mockReturnValue(mockStream);

      await expect(service.writeFile('s1', '/tmp/hello.txt', 'hello world')).resolves.not.toThrow();
      expect(mockStream.write).toHaveBeenCalledWith('hello world');
      expect(mockStream.end).toHaveBeenCalled();
    });
  });

  describe('getFileInfo for directories', () => {
    it('should return directory info', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, {
          isDirectory: () => true,
          size: 4096,
          mtime: 1000,
          birthtime: new Date(0),
          atime: 1000,
          mode: 0o755,
          uid: 1000,
          gid: 1000,
        })
      );
      const info = await service.getFileInfo('s1', '/tmp/mydir');
      expect(info.type).toBe('directory');
      expect(info.name).toBe('mydir');
      expect(info.permissions).toBe('755');
    });
  });

  describe('readFile error handling', () => {
    it('should reject reading a blocked path', async () => {
      await expect(service.readFile('s1', '/etc/passwd')).rejects.toThrow('Access denied');
    });

    it('should propagate sftp readStream errors', async () => {
      mockSftp.stat.mockImplementation((_p: any, cb: any) =>
        cb(null, { size: 10 })
      );
      const EventEmitter = (await import('events')).EventEmitter;
      const mockStream = new EventEmitter();
      mockSftp.createReadStream.mockReturnValue(mockStream);

      const promise = service.readFile('s1', '/tmp/error.txt');

      // Need to emit error asynchronously to avoid unhandled error
      setTimeout(() => mockStream.emit('error', new Error('File not found')), 10);

      await expect(promise).rejects.toThrow('File not found');
    });
  });
});
