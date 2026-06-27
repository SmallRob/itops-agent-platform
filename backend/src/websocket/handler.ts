import { tokenBlacklist } from '../services/security';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import db from '../models/database';
import { terminalService, fileManagerService } from '../services/server';
import type { User } from '../types';
import type { FileItem, FileInfo } from '../types/fileManager';

interface SocketWithUser extends Socket {
  user?: User;
  terminalSessionIds?: Set<string>;
  // SEC-050: Rate limiting state per socket connection
  messageRateLimiter?: {
    count: number;
    windowStart: number;
  };
}

// SEC-050: WebSocket message rate limiting constants
const WS_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const WS_RATE_LIMIT_MAX_MESSAGES = 200; // max messages per window
const WS_RATE_LIMIT_BURST_MAX = 30; // max messages in quick succession (5 seconds)
const WS_RATE_LIMIT_BURST_WINDOW_MS = 5 * 1000; // burst window

const taskRooms = new Map<string, Set<string>>();

export function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
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

  // SEC-050: Rate limiting check function - returns true if message should be allowed
  function checkRateLimit(socket: SocketWithUser): boolean {
    const now = Date.now();
    if (!socket.messageRateLimiter) {
      socket.messageRateLimiter = { count: 0, windowStart: now };
    }

    const limiter = socket.messageRateLimiter;

    // Reset window if expired
    if (now - limiter.windowStart > WS_RATE_LIMIT_WINDOW_MS) {
      limiter.count = 0;
      limiter.windowStart = now;
    }

    limiter.count++;

    // Check overall rate limit
    if (limiter.count > WS_RATE_LIMIT_MAX_MESSAGES) {
      logger.warn(`SEC-050: Rate limit exceeded for user ${socket.user?.username} (${socket.id}), ${limiter.count} messages in window`);
      socket.emit('error', { error: 'Rate limit exceeded. Please slow down.' });
      return false;
    }

    // Check burst limit (messages within a short burst window)
    const windowElapsed = now - limiter.windowStart;
    if (windowElapsed < WS_RATE_LIMIT_BURST_WINDOW_MS && limiter.count > WS_RATE_LIMIT_BURST_MAX) {
      logger.warn(`SEC-050: Burst rate limit exceeded for user ${socket.user?.username} (${socket.id}), ${limiter.count} messages in ${windowElapsed}ms`);
      socket.emit('error', { error: 'Too many messages. Please slow down.' });
      return false;
    }

    return true;
  }

  io.on('connection', (socket: Socket) => {
    const user = (socket as SocketWithUser).user;
    (socket as SocketWithUser).terminalSessionIds = new Set();
    const token = socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.replace('Bearer ', '');
    logger.info(`🔌 Client connected: ${socket.id} (User: ${user?.username})`);

    // SEC-033: Periodic token blacklist re-check during WebSocket session
    const blacklistCheckInterval = setInterval(() => {
      if (user && token && tokenBlacklist.isBlacklisted(token)) {
        logger.warn(`WebSocket: Token blacklisted during active session, disconnecting user ${user.username}`);
        socket.emit('terminal:error', { error: 'Session has been revoked' });
        socket.disconnect(true);
      }
    }, 60000); // Check every 60 seconds

    socket.on('task:subscribe', (taskId: string) => {
      if (!checkRateLimit(socket as SocketWithUser)) return;
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
      // SEC-033: Re-check token blacklist before opening each terminal
      if (token && tokenBlacklist.isBlacklisted(token)) {
        callback({ error: 'Session has been revoked' });
        return;
      }
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
      // SEC-050: Rate limit check for high-volume terminal data events
      if (!checkRateLimit(socket as SocketWithUser)) return;
      const role = (socket as SocketWithUser).user?.role || 'user';
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

    const authorizeSession = (sessionId: string, callback: (result: { error?: string }) => void): boolean => {
      const sock = socket as SocketWithUser;
      if (!sock.terminalSessionIds?.has(sessionId)) {
        callback({ error: 'Unauthorized session access' });
        return false;
      }
      return true;
    };

    socket.on('file:list', async (data: { sessionId: string; path: string }, callback: (result: { items?: FileItem[]; error?: string }) => void) => {
      // SEC-050: Rate limit check for file operations
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        const items = await fileManagerService.listFiles(data.sessionId, data.path);
        callback({ items });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:read', async (data: { sessionId: string; path: string }, callback: (result: { content?: string; encoding?: string; error?: string }) => void) => {
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        const result = await fileManagerService.readFile(data.sessionId, data.path);
        callback({ content: result.content, encoding: result.encoding });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:write', async (data: { sessionId: string; path: string; content: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        await fileManagerService.writeFile(data.sessionId, data.path, data.content);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:delete', async (data: { sessionId: string; path: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        await fileManagerService.delete(data.sessionId, data.path);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:rename', async (data: { sessionId: string; oldPath: string; newPath: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        await fileManagerService.rename(data.sessionId, data.oldPath, data.newPath);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:mkdir', async (data: { sessionId: string; path: string }, callback: (result: { success?: boolean; error?: string }) => void) => {
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        await fileManagerService.createDirectory(data.sessionId, data.path);
        callback({ success: true });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('file:info', async (data: { sessionId: string; path: string }, callback: (result: { info?: FileInfo; error?: string }) => void) => {
      if (!checkRateLimit(socket as SocketWithUser)) { callback({ error: 'Rate limit exceeded' }); return; }
      if (!authorizeSession(data.sessionId, callback)) return;
      try {
        const info = await fileManagerService.getFileInfo(data.sessionId, data.path);
        callback({ info });
      } catch (error: unknown) {
        callback({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    socket.on('disconnect', () => {
      clearInterval(blacklistCheckInterval);
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
