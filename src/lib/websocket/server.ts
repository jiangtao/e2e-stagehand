import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { WebSocketMessage, OperationEvent } from '@/types';
import { agentManager } from '@/lib/agent/agent-manager';
import { getUserId } from '@/lib/middleware/user-id';

export class StagehandWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private serverPort: number | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 启动 WebSocket 服务器
   */
  start(port: number = 8080): void {
    // 如果已经在这个端口运行，不重复启动
    if (this.serverPort === port && this.wss) {
      console.log('[WS Server] Already running on port', port);
      return;
    }

    this.wss = new WebSocketServer({ port });
    this.serverPort = port;
    console.log(`[WS Server] Started on port ${port}`);

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const remoteAddress = request.socket.remoteAddress;
      console.log(`🔌 WebSocket client connected from ${remoteAddress}`);
      
      // 检查是否是代理客户端连接
      const agentId = request.headers['x-agent-id'] as string;
      const userId = request.headers['x-user-id'] as string;
      const agentToken = request.headers['x-agent-token'] as string;

      if (agentId && userId) {
        // 这是代理客户端连接
        console.log(`🤖 Agent client connected: ${agentId} (User: ${userId})`);
        this.handleAgentConnection(ws, agentId, userId, agentToken);
      } else {
        // 这是普通 Web UI 客户端连接
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
      }
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
    this.serverPort = null;
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
          instances: electronConnector.listInstances(),
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
          instances: electronConnector.listInstances(),
          event: 'instance_disconnected',
          instanceId
        },
        timestamp: new Date()
      });
    });

    // 监听代理客户端连接事件
    agentManager.on('agent_connected', (agentId: string, userId: string) => {
      this.broadcast({
        type: 'status',
        data: {
          event: 'agent_connected',
          agentId,
          userId
        },
        timestamp: new Date()
      });
    });

    // 监听代理客户端断开事件
    agentManager.on('agent_disconnected', (agentId: string) => {
      this.broadcast({
        type: 'status',
        data: {
          event: 'agent_disconnected',
          agentId
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
   * 处理代理客户端连接
   */
  private handleAgentConnection(ws: WebSocket, agentId: string, userId: string, token: string | undefined): void {
    // 注册代理客户端
    agentManager.registerAgent(agentId, userId, undefined, ws);

    // 监听代理客户端消息（通过 agentManager 的事件）
    agentManager.on('cdp_message', (message: any) => {
      // 转发 CDP 响应和事件到所有 Web UI 客户端
      this.broadcast(message);
    });

    agentManager.on('cdp_instance_connected', (instanceId: string, agentId: string) => {
      // 通知所有客户端实例已连接
      this.broadcast({
        type: 'status',
        data: {
          instances: electronConnector.listInstances(),
          event: 'instance_connected',
          instanceId,
          agentId
        },
        timestamp: new Date()
      });
    });

    agentManager.on('cdp_instance_disconnected', (instanceId: string, agentId: string) => {
      // 通知所有客户端实例已断开
      this.broadcast({
        type: 'status',
        data: {
          instances: electronConnector.listInstances(),
          event: 'instance_disconnected',
          instanceId,
          agentId
        },
        timestamp: new Date()
      });
    });

    agentManager.on('agent_disconnected', (agentId: string) => {
      // 通知所有客户端代理已断开
      this.broadcast({
        type: 'status',
        data: {
          event: 'agent_disconnected',
          agentId
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

        case 'get_agents':
          // 获取代理客户端列表（需要从请求中获取 userId）
          // 这里简化处理，返回所有代理
          this.sendToClient(ws, {
            type: 'status',
            data: {
              agents: agentManager.getAllAgents().map(agent => ({
                agentId: agent.agentId,
                userId: agent.userId,
                name: agent.name,
                connectedAt: agent.connectedAt,
                lastHeartbeat: agent.lastHeartbeat
              }))
            },
            timestamp: new Date()
          });
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

  /**
   * 检查服务器是否正在运行
   */
  isRunning(): boolean {
    return this.wss !== null && this.serverPort !== null;
  }

  /**
   * 获取当前监听的端口
   */
  getPort(): number | null {
    return this.serverPort;
  }
}

// 单例实例
export const wsServer = new StagehandWebSocketServer();
