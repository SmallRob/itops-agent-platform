import type { Server } from 'socket.io';
import net from 'net';
import { logger } from '@utils/logger';
import { authenticateSocket } from '../../websocket/handler';

interface VNCSession {
  id: string;
  serverId: string;
  vncHost: string;
  vncPort: number;
  vncSocket: net.Socket | null;
  clientSocketId: string;
  createdAt: number;
}

// Allowed VNC host patterns - only allow connections to known servers
const ALLOWED_VNC_HOSTS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
];

function isAllowedVNCHost(host: string): boolean {
  return ALLOWED_VNC_HOSTS.some(pattern => pattern.test(host));
}

class VNCProxyService {
  private sessions: Map<string, VNCSession> = new Map();

  initialize(io: Server) {
    // Apply authentication middleware to VNC namespace (SEC-003)
    io.of('/vnc').use(authenticateSocket);
    
    io.of('/vnc').on('connection', (socket) => {
      logger.info(`VNC client connected: ${socket.id}`);

      socket.on('vnc:connect', async (data: { serverId: string; vncHost: string; vncPort: number; password?: string }) => {
        try {
          // Validate VNC host to prevent SSRF (SEC-008)
          if (!isAllowedVNCHost(data.vncHost)) {
            socket.emit('vnc:error', { message: 'VNC host not allowed' });
            return;
          }
          
          // Validate VNC port range
          if (data.vncPort < 1 || data.vncPort > 65535) {
            socket.emit('vnc:error', { message: 'Invalid VNC port' });
            return;
          }
          
          const sessionId = `${data.serverId}-${Date.now()}`;
          const session: VNCSession = {
            id: sessionId,
            serverId: data.serverId,
            vncHost: data.vncHost,
            vncPort: data.vncPort,
            vncSocket: null,
            clientSocketId: socket.id,
            createdAt: Date.now()
          };

          // 连接到 VNC 服务器
          const vncSocket = net.connect({
            host: data.vncHost,
            port: data.vncPort
          });

          session.vncSocket = vncSocket;
          this.sessions.set(sessionId, session);

          vncSocket.on('connect', () => {
            logger.info(`Connected to VNC server ${data.vncHost}:${data.vncPort}`);
            socket.emit('vnc:connected', { sessionId });
          });

          vncSocket.on('data', (data) => {
            socket.emit('vnc:data', data);
          });

          vncSocket.on('error', (err) => {
            logger.error(`VNC connection error: ${err.message}`);
            socket.emit('vnc:error', { message: err.message });
          });

          vncSocket.on('close', () => {
            logger.info(`VNC connection closed`);
            socket.emit('vnc:closed');
            this.sessions.delete(sessionId);
          });

          // 从客户端接收数据转发给 VNC 服务器
          socket.on('vnc:client-data', (data) => {
            if (vncSocket && !vncSocket.destroyed) {
              vncSocket.write(data);
            }
          });

          socket.on('vnc:disconnect', () => {
            if (vncSocket) {
              vncSocket.destroy();
            }
            this.sessions.delete(sessionId);
          });

        } catch (error) {
          logger.error('Failed to establish VNC connection:', error);
          socket.emit('vnc:error', { message: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

      socket.on('disconnect', () => {
        logger.info(`VNC client disconnected: ${socket.id}`);
        // 清理关联的会话
        for (const [id, session] of this.sessions) {
          if (session.clientSocketId === socket.id && session.vncSocket) {
            session.vncSocket.destroy();
            this.sessions.delete(id);
          }
        }
      });
    });
  }

  getSessionCount() {
    return this.sessions.size;
  }
}

export const vncProxyService = new VNCProxyService();
