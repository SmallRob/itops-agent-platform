import type { Server } from 'socket.io';
import net from 'net';
import { logger } from '@utils/logger';

interface VNCSession {
  id: string;
  serverId: string;
  vncHost: string;
  vncPort: number;
  vncSocket: net.Socket | null;
  clientSocketId: string;
  createdAt: number;
}

class VNCProxyService {
  private sessions: Map<string, VNCSession> = new Map();

  initialize(io: Server) {
    io.of('/vnc').on('connection', (socket) => {
      logger.info(`VNC client connected: ${socket.id}`);

      socket.on('vnc:connect', async (data: { serverId: string; vncHost: string; vncPort: number; password?: string }) => {
        try {
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
