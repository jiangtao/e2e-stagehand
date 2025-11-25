import CDP from 'chrome-remote-interface';
import { EventEmitter } from 'events';

export interface CDPProxyConnection {
  instanceId: string;
  port: number;
  client: any;
  isConnected: boolean;
}

/**
 * CDP 代理管理器
 * 负责管理本地 CDP 连接并转发命令
 */
export class CDPProxy extends EventEmitter {
  private connections: Map<string, CDPProxyConnection> = new Map();

  /**
   * 连接到本地 CDP 端口
   */
  async connect(instanceId: string, port: number): Promise<void> {
    try {
      // 检查是否已连接
      if (this.connections.has(instanceId)) {
        throw new Error(`Instance ${instanceId} already connected`);
      }

      // 连接到 CDP
      const client = await CDP({ port });

      // 启用必要的域
      await Promise.all([
        client.Page.enable(),
        client.Runtime.enable(),
        client.DOM.enable()
      ]);

      // 监听页面事件
      client.Page.loadEventFired(() => {
        this.emit('pageLoad', instanceId);
      });

      client.Page.frameNavigated((params: any) => {
        this.emit('navigation', instanceId, params.frame.url);
      });

      // 监听断开
      client.on('disconnect', () => {
        this.handleDisconnect(instanceId);
      });

      // 存储连接
      this.connections.set(instanceId, {
        instanceId,
        port,
        client,
        isConnected: true
      });

      this.emit('connected', instanceId, port);
      console.log(`✅ CDP Proxy: Connected to local CDP on port ${port} (Instance: ${instanceId})`);

    } catch (error) {
      console.error(`❌ CDP Proxy: Failed to connect to port ${port}:`, error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(instanceId: string): Promise<void> {
    const connection = this.connections.get(instanceId);
    if (!connection) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      await connection.client.close();
      this.connections.delete(instanceId);
      this.emit('disconnected', instanceId);
      console.log(`🔌 CDP Proxy: Disconnected from instance ${instanceId}`);
    } catch (error) {
      console.error(`❌ CDP Proxy: Error disconnecting from ${instanceId}:`, error);
      this.connections.delete(instanceId);
      throw error;
    }
  }

  /**
   * 执行 CDP 命令
   */
  async executeCommand(instanceId: string, method: string, params?: any): Promise<any> {
    const connection = this.connections.get(instanceId);
    if (!connection || !connection.isConnected) {
      throw new Error(`Instance ${instanceId} not connected`);
    }

    try {
      const result = await connection.client.send(method, params);
      return result;
    } catch (error) {
      console.error(`❌ CDP Proxy: Command failed for ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * 检查连接是否健康
   */
  async isHealthy(instanceId: string): Promise<boolean> {
    const connection = this.connections.get(instanceId);
    if (!connection || !connection.isConnected) {
      return false;
    }

    try {
      await connection.client.Runtime.evaluate({ expression: '1+1' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取所有连接的实例
   */
  getConnectedInstances(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 处理断开连接
   */
  private handleDisconnect(instanceId: string): void {
    const connection = this.connections.get(instanceId);
    if (connection) {
      connection.isConnected = false;
      this.connections.delete(instanceId);
      this.emit('disconnected', instanceId);
      console.log(`🔌 CDP Proxy: Instance ${instanceId} disconnected`);
    }
  }

  /**
   * 清理所有连接
   */
  async cleanup(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(id =>
      this.disconnect(id).catch(console.error)
    );
    await Promise.all(disconnectPromises);
    this.connections.clear();
  }
}

