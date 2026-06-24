import { tokenBlacklist } from '@services/security';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import db from '../models/database';
import { terminalService, fileManagerService } from '@services/server';
import type { User } from '../types';
import type { FileItem, FileInfo } from '@types/fileManager';

interface SocketWithUser extends Socket {
  user?: User;
  terminalSessionIds?: Set<string>;
}

const taskRooms = new Map<string, Set<string>>();

function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token || 
                socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    logger.error('❌ WebSocket 认证失败: 未提供 token');
    return next(new Error('未提供认证token'));
  }

  try {
    if (tokenBlacklist.isBlacklisted(token)) {
      logger.error('❌ WebSocket 认证失败: token 已拉黑');
      return next(new Error('token已失效'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    
    const user = db.prepare('SELECT id, username, email, role, enabled FROM users WHERE id = ?').get(decoded.id) as User | undefined;
    
    if (!user || !user.enabled) {
      logger.error('❌ WebSocket 认证失败: 用户不存在或已禁用');
      return next(new Error('用户不存在或已禁用'));
    }

    (socket as SocketWithUser).user = user;
    logger.info(`✅ WebSocket 认证成功: ${user.username}`);
    next();
  } catch (error: unknown) {
    logger.error('❌ WebSocket 认证失败:', error);
    return next(new Error('无效的token'));
  }
}

export function setupWebSocket(io: SocketIOServer) {
  io.use(authenticateSocket);

  io.on('connection', (socket: Socket) => {
    const user = (socket as SocketWithUser).user;
    (socket as SocketWithUser).terminalSessionIds = new Set();
    logger.info(`🔌 Client connected: ${socket.id} (User: ${user?.username})`);

    socket.on('task:subscribe', (taskId: string) => {
      socket.join(`task:${taskId}`);
      if (!taskRooms.has(taskId)) {
        taskRooms.set(taskId, new Set());
      }
      taskRooms.get(taskId)!.add(socket.id);
      logger.info(`📡 Client ${socket.id} subscribed to task ${taskId}`);
    });

    socket.on('task:unsubscribe', (taskId: string) => {
      socket.leave(`task:${taskId}`);
      taskRooms.get(taskId)?.delete(socket.id);
      if (taskRooms.get(taskId)?.size === 0) {
        taskRooms.delete(taskId);
      }
      logger.info(`📤 Client ${socket.id} unsubscribed from task ${taskId}`);
    });

    socket.on('alert:subscribe', () => {
      socket.join('alerts');
      logger.info(`🔔 Client ${socket.id} subscribed to alerts`);
    });

    socket.on('terminal:open', async (data: { serverId: string; cols: number; rows: number }, callback: (result: { sessionId?: string; error?: string }) => void) => {
      try {
        const result = await terminalService.createTerminalSession(data.serverId, data.cols, data.rows);
        
        if (result.error) {
          callback({ error: result.error });
          return;
        }

        const sock = socket as SocketWithUser;
        sock.terminalSessionIds!.add(result.sessionId);
        socket.join(`terminal:${result.sessionId}`);

        const shellDataHandler = (shellData: Buffer) => {
          socket.emit('terminal:data', {
            sessionId: result.sessionId,
            data: shellData.toString('utf-8')
          });
        };

        result.shell.on('data', shellDataHandler);

        socket.on('terminal:disconnect', () => {
          result.shell.removeListener('data', shellDataHandler);
          terminalService.closeTerminalSession(result.sessionId);
        });

        socket.on(`terminal:close-session:${result.sessionId}`, () => {
          result.shell.removeListener('data', shellDataHandler);
        });

        callback({ sessionId: result.sessionId });
      } catch (err) {
        callback({ error: err instanceof Error ? err.message : 'Unknown error' });
      }
    });

    socket.on('terminal:data', (data: { sessionId: string; data: string }) => {
      const role = (socket as SocketWithUser).user?.role;
      terminalService.sendData(data.sessionId, data.data, role);
    });

    socket.on('terminal:resize', (data: { sessionId: string; cols: number; rows: number }) => {
      terminalService.resizeTerminal(data.sessionId, data.cols, data.rows);
    });

    socket.on('terminal:close', (data: { sessionId: string }) => {
      const sock = socket as SocketWithUser;
      sock.terminalSessionIds!.delete(data.sessionId);
      socket.leave(`terminal:${data.sessionId}`);
      socket.emit(`terminal:close-session:${data.sessionId}`);
      terminalService.closeTerminalSession(data.sessionId);
    });

    socket.on('file:list', async (data: { sessionId: string; path: string }, callback: (result: { items?: FileItem[]; error?: string }) => void) => {
      try {
        const items = await fileManagerService.listFiles(data.sessionId, data.path);
        callback({ items });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:read', async (data: { sessionId: string; path: string }, callback: (result: { content?: string; error?: string }) => void) => {
      try {
        const content = await fileManagerService.readFile(data.sessionId, data.path);
        callback({ content });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:write', async (data: { sessionId: string; path: string; content: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      try {
        await fileManagerService.writeFile(data.sessionId, data.path, data.content);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:delete', async (data: { sessionId: string; path: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      try {
        await fileManagerService.delete(data.sessionId, data.path);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:rename', async (data: { sessionId: string; oldPath: string; newPath: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      try {
        await fileManagerService.rename(data.sessionId, data.oldPath, data.newPath);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:mkdir', async (data: { sessionId: string; path: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      try {
        await fileManagerService.createDirectory(data.sessionId, data.path);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:info', async (data: { sessionId: string; path: string }, callback: (result: { info?: FileInfo; error?: string }) => void) => {
      try {
        const info = await fileManagerService.getFileInfo(data.sessionId, data.path);
        callback({ info });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`❌ Client disconnected: ${socket.id}`);
      taskRooms.forEach((sockets, taskId) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          taskRooms.delete(taskId);
        }
      });
      
      const sock = socket as SocketWithUser;
      const sessions = sock.terminalSessionIds;
      if (sessions) {
        sessions.forEach((sessionId) => {
          terminalService.closeTerminalSession(sessionId);
        });
        sock.terminalSessionIds = new Set();
      }
    });
  });

  process.on('SIGTERM', () => {
    logger.info('🔌 WebSocket server shutting down (SIGTERM)');
  });

  process.on('SIGINT', () => {
    logger.info('🔌 WebSocket server shutting down (SIGINT)');
  });
}

export function emitToTask(io: SocketIOServer, taskId: string, event: string, data: Record<string, unknown>) {
  io.to(`task:${taskId}`).emit(event, { taskId, ...data });
}

export function emitToAlerts(io: SocketIOServer, event: string, data: Record<string, unknown>) {
  io.to('alerts').emit(event, data);
}

export function broadcast(io: SocketIOServer, event: string, data: Record<string, unknown>) {
  io.emit(event, data);
}
