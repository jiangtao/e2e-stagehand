import CDP from 'chrome-remote-interface';
import { EventEmitter } from 'events';
import { ElectronInstance, CDPCommand, CDPResponse, OperationEvent } from '@/types';

export class ElectronConnector extends EventEmitter {
  private instances: Map<string, {
    instance: ElectronInstance;
    client: any;
    isHealthy: boolean;
  }> = new Map();

  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHealthCheck();
  }

  /**
   * 连接到 Electron 实例
   */
  async connect(port: number, appPath?: string): Promise<string> {
    try {
      // 检查端口是否已连接
      const existingInstance = Array.from(this.instances.values())
        .find(item => item.instance.port === port);
      
      if (existingInstance) {
        throw new Error(`Port ${port} is already connected`);
      }

      // 尝试连接到 CDP
      const client = await CDP({ port });
      
      // 生成实例 ID
      const instanceId = `electron-${port}-${Date.now()}`;
      
      // 创建实例对象
      const instance: ElectronInstance = {
        id: instanceId,
        port,
        appPath,
        status: 'connected',
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      // 启用必要的 CDP 域
      await Promise.all([
        client.Page.enable(),
        client.Runtime.enable(),
        client.DOM.enable()
      ]);

      // 监听页面事件
      client.Page.loadEventFired(() => {
        this.updateLastActivity(instanceId);
        this.emit('pageLoad', instanceId);
      });

      client.Page.frameNavigated((params: any) => {
        this.updateLastActivity(instanceId);
        this.emit('navigation', instanceId, params.frame.url);
      });

      // 存储连接
      this.instances.set(instanceId, {
        instance,
        client,
        isHealthy: true
      });

      this.emit('connected', instance);
      
      console.log(`✅ Connected to Electron instance on port ${port}, ID: ${instanceId}`);
      return instanceId;

    } catch (error) {
      console.error(`❌ Failed to connect to Electron on port ${port}:`, error);
      throw new Error(`Failed to connect to Electron on port ${port}: ${error}`);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(instanceId: string): Promise<void> {
    const connection = this.instances.get(instanceId);
    if (!connection) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      await connection.client.close();
      connection.instance.status = 'disconnected';
      this.instances.delete(instanceId);
      
      this.emit('disconnected', instanceId);
      console.log(`🔌 Disconnected from instance ${instanceId}`);
    } catch (error) {
      console.error(`❌ Error disconnecting from ${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * 执行 CDP 命令
   */
  async executeCommand(instanceId: string, command: CDPCommand): Promise<any> {
    const connection = this.instances.get(instanceId);
    if (!connection) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (!connection.isHealthy) {
      throw new Error(`Instance ${instanceId} is not healthy`);
    }

    try {
      this.updateLastActivity(instanceId);
      
      // 执行 CDP 命令
      const result = await connection.client.send(command.method, command.params);
      
      // 发出操作事件用于实时可视化
      const operationEvent: OperationEvent = {
        type: this.getOperationTypeFromCommand(command),
        timestamp: new Date(),
        instanceId,
        target: this.extractTargetFromCommand(command),
        result
      };
      
      this.emit('operation', operationEvent);
      
      return result;
    } catch (error) {
      console.error(`❌ CDP command failed for ${instanceId}:`, error);
      connection.isHealthy = false;
      throw error;
    }
  }

  /**
   * 获取所有实例列表
   */
  listInstances(): ElectronInstance[] {
    return Array.from(this.instances.values()).map(item => item.instance);
  }

  /**
   * 获取特定实例
   */
  getInstance(instanceId: string): ElectronInstance | null {
    const connection = this.instances.get(instanceId);
    return connection ? connection.instance : null;
  }

  /**
   * 检查实例是否健康
   */
  async isInstanceHealthy(instanceId: string): Promise<boolean> {
    const connection = this.instances.get(instanceId);
    if (!connection) return false;

    try {
      // 发送简单的 ping 命令检查连接
      await connection.client.Runtime.evaluate({ expression: '1+1' });
      connection.isHealthy = true;
      return true;
    } catch (error) {
      connection.isHealthy = false;
      connection.instance.status = 'error';
      return false;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [instanceId] of this.instances) {
        await this.isInstanceHealthy(instanceId);
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 更新最后活动时间
   */
  private updateLastActivity(instanceId: string): void {
    const connection = this.instances.get(instanceId);
    if (connection) {
      connection.instance.lastActivity = new Date();
    }
  }

  /**
   * 从 CDP 命令推断操作类型
   */
  private getOperationTypeFromCommand(command: CDPCommand): OperationEvent['type'] {
    if (command.method.includes('click') || command.method === 'Input.dispatchMouseEvent') {
      return 'click';
    }
    if (command.method.includes('type') || command.method === 'Input.insertText') {
      return 'type';
    }
    if (command.method.includes('scroll')) {
      return 'scroll';
    }
    if (command.method.includes('navigate') || command.method === 'Page.navigate') {
      return 'navigate';
    }
    if (command.method.includes('evaluate')) {
      return 'extract';
    }
    return 'observe';
  }

  /**
   * 从 CDP 命令提取目标信息
   */
  private extractTargetFromCommand(command: CDPCommand): OperationEvent['target'] | undefined {
    if (command.method === 'Input.dispatchMouseEvent' && command.params) {
      return {
        coordinates: { x: command.params.x, y: command.params.y }
      };
    }
    if (command.method === 'Input.insertText' && command.params) {
      return {
        text: command.params.text
      };
    }
    if (command.method === 'Page.navigate' && command.params) {
      return {
        text: command.params.url
      };
    }
    return undefined;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // 断开所有连接
    const disconnectPromises = Array.from(this.instances.keys()).map(id => 
      this.disconnect(id).catch(console.error)
    );
    
    await Promise.all(disconnectPromises);
    this.instances.clear();
  }
}

// 单例实例
export const electronConnector = new ElectronConnector();
