import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { CDPProxy } from './cdp-proxy';
import { AgentConfig } from './config';

export interface AgentMessage {
  type: string;
  data?: any;
  instanceId?: string;
  requestId?: string;
  timestamp?: Date;
}

/**
 * WebSocket 客户端，连接到远端服务器
 */
export class AgentWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private cdpProxy: CDPProxy;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private agentId: string;
  private isConnected = false;

  constructor(config: AgentConfig, cdpProxy: CDPProxy) {
    super();
    this.config = config;
    this.cdpProxy = cdpProxy;
    this.agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 监听 CDP 代理事件
    this.cdpProxy.on('connected', (instanceId: string, port: number) => {
      this.sendMessage({
        type: 'cdp_instance_connected',
        data: { instanceId, port }
      });
    });

    this.cdpProxy.on('disconnected', (instanceId: string) => {
      this.sendMessage({
        type: 'cdp_instance_disconnected',
        data: { instanceId }
      });
    });

    this.cdpProxy.on('pageLoad', (instanceId: string) => {
      this.sendMessage({
        type: 'cdp_event',
        instanceId,
        data: { type: 'pageLoad' }
      });
    });

    this.cdpProxy.on('navigation', (instanceId: string, url: string) => {
      this.sendMessage({
        type: 'cdp_event',
        instanceId,
        data: { type: 'navigation', url }
      });
    });
  }

  /**
   * 连接到服务器
   */
  connect(): void {
    try {
      const url = this.config.serverUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      console.log(`🔌 Connecting to server: ${url}`);

      this.ws = new WebSocket(url, {
        headers: {
          'x-agent-id': this.agentId,
          'x-user-id': this.config.userId || '',
          'x-agent-token': this.config.token || ''
        }
      });

      this.ws.on('open', () => {
        console.log('✅ Connected to server');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // 发送注册消息
        this.sendMessage({
          type: 'agent_register',
          data: {
            agentId: this.agentId,
            userId: this.config.userId,
            name: this.config.name,
            token: this.config.token
          }
        });

        // 启动心跳
        this.startHeartbeat();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message: AgentMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('🔌 Disconnected from server');
        this.isConnected = false;
        this.stopHeartbeat();
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.attemptReconnect();
    }
  }

  /**
   * 处理服务器消息
   */
  private async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case 'cdp_command':
        await this.handleCDPCommand(message);
        break;

      case 'cdp_connect':
        await this.handleCDPConnect(message);
        break;

      case 'cdp_disconnect':
        await this.handleCDPDisconnect(message);
        break;

      case 'ping':
        this.sendMessage({ type: 'pong', data: { timestamp: new Date() } });
        break;

      default:
        console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }

  /**
   * 处理 CDP 命令
   */
  private async handleCDPCommand(message: AgentMessage): Promise<void> {
    const { instanceId, data, requestId } = message;
    if (!instanceId || !data || !data.method) {
      return;
    }

    try {
      const result = await this.cdpProxy.executeCommand(instanceId, data.method, data.params);
      this.sendMessage({
        type: 'cdp_response',
        instanceId,
        requestId,
        data: { result }
      });
    } catch (error) {
      this.sendMessage({
        type: 'cdp_response',
        instanceId,
        requestId,
        data: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * 处理 CDP 连接请求
   */
  private async handleCDPConnect(message: AgentMessage): Promise<void> {
    const { instanceId, data } = message;
    if (!instanceId || !data || !data.port) {
      return;
    }

    try {
      await this.cdpProxy.connect(instanceId, data.port);
      this.sendMessage({
        type: 'cdp_connected',
        instanceId,
        data: { success: true }
      });
    } catch (error) {
      this.sendMessage({
        type: 'cdp_connected',
        instanceId,
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * 处理 CDP 断开请求
   */
  private async handleCDPDisconnect(message: AgentMessage): Promise<void> {
    const { instanceId } = message;
    if (!instanceId) {
      return;
    }

    try {
      await this.cdpProxy.disconnect(instanceId);
      this.sendMessage({
        type: 'cdp_disconnected',
        instanceId,
        data: { success: true }
      });
    } catch (error) {
      this.sendMessage({
        type: 'cdp_disconnected',
        instanceId,
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * 发送消息到服务器
   */
  sendMessage(message: AgentMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: new Date()
      }));
    } else {
      console.warn('⚠️ WebSocket not connected, message dropped:', message.type);
    }
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ type: 'heartbeat', data: { timestamp: new Date() } });
      }
    }, this.config.heartbeatInterval || 30000);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 尝试重连
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error('❌ Max reconnect attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval || 5000;
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts || 10}) in ${delay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 获取代理 ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * 是否已连接
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }
}

