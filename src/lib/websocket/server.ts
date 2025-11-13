import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { WebSocketMessage, OperationEvent } from '@/types';

export class StagehandWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 启动 WebSocket 服务器
   */
  start(port: number = 8080): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      console.log(`🔌 WebSocket client connected from ${request.socket.remoteAddress}`);
      
      this.clients.add(ws);

      // 发送当前连接的实例列表
      this.sendToClient(ws, {
        type: 'status',
        data: {
          instances: electronConnector.listInstances(),
          message: 'Connected to Stagehand WebSocket server'
        },
        timestamp: new Date()
      });

      // 处理客户端消息
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // 处理连接关闭
      ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log(`🚀 WebSocket server started on port ${port}`);
  }

  /**
   * 停止 WebSocket 服务器
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    console.log('🛑 WebSocket server stopped');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听 Electron 连接事件
    electronConnector.on('connected', (instance) => {
      this.broadcast({
        type: 'status',
        data: {
          event: 'instance_connected',
          instance
        },
        timestamp: new Date()
      });
    });

    // 监听 Electron 断开事件
    electronConnector.on('disconnected', (instanceId) => {
      this.broadcast({
        type: 'status',
        data: {
          event: 'instance_disconnected',
          instanceId
        },
        timestamp: new Date()
      });
    });

    // 监听操作事件
    electronConnector.on('operation', (operationEvent: OperationEvent) => {
      this.broadcast({
        type: 'operation',
        instanceId: operationEvent.instanceId,
        data: operationEvent,
        timestamp: new Date()
      });
    });

    // 监听 Stagehand 操作事件
    electronConnector.on('stagehandOperation', (data) => {
      this.broadcast({
        type: 'operation',
        instanceId: data.instanceId,
        data: {
          type: 'stagehand_' + data.type,
          ...data
        },
        timestamp: new Date()
      });
    });

    // 监听页面加载事件
    electronConnector.on('pageLoad', (instanceId) => {
      this.broadcast({
        type: 'status',
        instanceId,
        data: {
          event: 'page_loaded'
        },
        timestamp: new Date()
      });
    });

    // 监听导航事件
    electronConnector.on('navigation', (instanceId, url) => {
      this.broadcast({
        type: 'operation',
        instanceId,
        data: {
          type: 'navigate',
          url,
          timestamp: new Date()
        },
        timestamp: new Date()
      });
    });
  }

  /**
   * 处理客户端消息
   */
  private async handleClientMessage(ws: WebSocket, message: any): Promise<void> {
    try {
      switch (message.type) {
        case 'get_instances':
          this.sendToClient(ws, {
            type: 'status',
            data: {
              instances: electronConnector.listInstances()
            },
            timestamp: new Date()
          });
          break;

        case 'get_instance_status':
          if (message.instanceId) {
            const instance = electronConnector.getInstance(message.instanceId);
            const isHealthy = await electronConnector.isInstanceHealthy(message.instanceId);
            
            this.sendToClient(ws, {
              type: 'status',
              instanceId: message.instanceId,
              data: {
                instance,
                isHealthy
              },
              timestamp: new Date()
            });
          }
          break;

        case 'ping':
          this.sendToClient(ws, {
            type: 'status',
            data: { pong: true },
            timestamp: new Date()
          });
          break;

        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling client message:', error);
      this.sendError(ws, 'Internal server error');
    }
  }

  /**
   * 向单个客户端发送消息
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Error sending message to client:', error);
      }
    }
  }

  /**
   * 广播消息到所有客户端
   */
  private broadcast(message: WebSocketMessage): void {
    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  /**
   * 发送错误消息
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendToClient(ws, {
      type: 'error',
      data: { error },
      timestamp: new Date()
    });
  }

  /**
   * 获取连接的客户端数量
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// 单例实例
export const wsServer = new StagehandWebSocketServer();
