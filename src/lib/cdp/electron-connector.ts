import CDP from 'chrome-remote-interface';
import { EventEmitter } from 'events';
import { ElectronInstance, CDPCommand, CDPResponse, OperationEvent } from '@/types';
import { instanceDB } from '@/lib/db/database';
import { agentManager } from '@/lib/agent/agent-manager';
import { launchChrome, waitForPort, ChromeProcess } from '@/lib/cdp/chrome-launcher';

export class ElectronConnector extends EventEmitter {
  private instances: Map<string, {
    instance: ElectronInstance;
    client: any;
    isHealthy: boolean;
    chromeProcess?: ChromeProcess;
  }> = new Map();

  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHealthCheck();
  }

  /**
   * 连接到 Electron 或 Chrome 实例
   */
  async connect(
    port: number,
    appPath?: string,
    userId?: string,
    agentId?: string,
    connectionType: 'local' | 'remote' = 'local',
    instanceType: 'electron' | 'chrome' = 'electron',
    chromePath?: string,
    incognito: boolean = false
  ): Promise<string> {
    try {
      // 0. 如果是 Chrome 且提供了 chromePath，先启动 Chrome
      let chromeProcess: ChromeProcess | undefined;
      if (instanceType === 'chrome' && chromePath) {
        console.log(`🚀 Launching Chrome browser...`);
        chromeProcess = launchChrome({
          chromePath,
          port,
          incognito
        });

        // 等待 Chrome 启动完成（最多等待 10 秒）
        console.log(`⏳ Waiting for Chrome to start on port ${port}...`);
        const portReady = await waitForPort(port, 10000);
        if (!portReady) {
          if (chromeProcess) {
            // 如果启动失败，尝试终止进程
            try {
              chromeProcess.process.kill();
            } catch (e) {
              // 忽略错误
            }
          }
          throw new Error(`Chrome failed to start on port ${port} within 10 seconds`);
        }
        console.log(`✅ Chrome is ready on port ${port}`);
      }

      // 1. 检查内存中是否已连接
      const existingInMemory = Array.from(this.instances.values())
        .find(item => item.instance.port === port);
      
      if (existingInMemory) {
        if (chromeProcess) {
          // 如果已经连接，终止刚启动的 Chrome
          chromeProcess.process.kill();
        }
        throw new Error(`Port ${port} is already connected (Instance ID: ${existingInMemory.instance.id})`);
      }

      // 2. 如果提供了 userId，检查数据库中是否有相同端口的实例
      if (userId) {
        const existingInDB = instanceDB.findByPort(port, userId);
        if (existingInDB && existingInDB.status === 'connected') {
          // 尝试重新连接
          console.log(`🔄 Found persisted instance for port ${port}, attempting to reconnect...`);
          
          try {
            const client = await CDP({ port });
            
            const instance: ElectronInstance = {
              ...existingInDB,
              status: 'connected',
              lastActivity: new Date(),
              connectionType: existingInDB.connectionType || 'local',
              instanceType: existingInDB.instanceType || 'electron',
              incognito: existingInDB.incognito || false
            };

            // 如果是远程连接，通过代理重连
            if (instance.connectionType === 'remote' && instance.agentId) {
              return await this.connectViaAgent(existingInDB.id, port, existingInDB.appPath, userId, instance.agentId, instanceType, incognito);
            }

            // 本地直连
            await Promise.all([
              client.Page.enable(),
              client.Runtime.enable(),
              client.DOM.enable()
            ]);

            this.setupClientListeners(existingInDB.id, client);

            this.instances.set(existingInDB.id, {
              instance,
              client,
              isHealthy: true,
              chromeProcess: chromeProcess
            });

            // 更新数据库
            instanceDB.save({ ...instance, userId });

            this.emit('connected', instance);
            const instanceTypeLabel = instance.instanceType === 'chrome' ? 'Chrome' : 'Electron';
            console.log(`✅ Reconnected to ${instanceTypeLabel} instance on port ${port}, ID: ${existingInDB.id}`);
            return existingInDB.id;
          } catch (reconnectError) {
            if (chromeProcess) {
              chromeProcess.process.kill();
            }
            existingInDB.status = 'disconnected';
            instanceDB.save({ ...existingInDB, userId });
            const instanceTypeLabel = instanceType === 'chrome' ? 'Chrome' : 'Electron';
            throw new Error(`Port ${port} was previously connected but is now unavailable. Please ensure the ${instanceTypeLabel} app is running with --remote-debugging-port=${port}`);
          }
        }
      }

      // 3. 新连接
      const instanceId = `${instanceType}-${port}-${Date.now()}`;
      
      // 根据连接类型选择连接方式
      if (connectionType === 'remote' && agentId) {
        // 通过代理客户端连接
        return await this.connectViaAgent(instanceId, port, appPath, userId, agentId, instanceType, incognito);
      } else {
        // 本地直连
        const client = await CDP({ port });
        
        const instance: ElectronInstance = {
          id: instanceId,
          port,
          appPath,
          status: 'connected',
          connectedAt: new Date(),
          lastActivity: new Date(),
          instanceType,
          incognito: instanceType === 'chrome' ? incognito : undefined,
          connectionType: 'local',
          pid: chromeProcess?.pid
        };

        await Promise.all([
          client.Page.enable(),
          client.Runtime.enable(),
          client.DOM.enable()
        ]);

        this.setupClientListeners(instanceId, client);

        this.instances.set(instanceId, {
          instance,
          client,
          isHealthy: true,
          chromeProcess: chromeProcess
        });

        // 保存到数据库（如果提供了 userId）
        if (userId) {
          instanceDB.save({ ...instance, userId });
        }

        this.emit('connected', instance);
        const instanceTypeLabel = instanceType === 'chrome' ? 'Chrome' : 'Electron';
        const incognitoLabel = incognito ? ' (Incognito)' : '';
        console.log(`✅ Connected to ${instanceTypeLabel} instance on port ${port}${incognitoLabel}, ID: ${instanceId}`);
        return instanceId;
      }

    } catch (error) {
      const instanceTypeLabel = instanceType === 'chrome' ? 'Chrome' : 'Electron';
      console.error(`❌ Failed to connect to ${instanceTypeLabel} on port ${port}:`, error);
      throw new Error(`Failed to connect to ${instanceTypeLabel} on port ${port}: ${error}`);
    }
  }

  /**
   * 设置客户端事件监听
   */
  private setupClientListeners(instanceId: string, client: any): void {
    client.Page.loadEventFired(() => {
      this.updateLastActivity(instanceId);
      this.emit('pageLoad', instanceId);
    });

    client.Page.frameNavigated((params: any) => {
      this.updateLastActivity(instanceId);
      this.emit('navigation', instanceId, params.frame.url);
    });

    // 监听客户端断开
    client.on('disconnect', () => {
      this.handleClientDisconnect(instanceId);
    });
  }

  /**
   * 处理客户端断开
   */
  private async handleClientDisconnect(instanceId: string): Promise<void> {
    const connection = this.instances.get(instanceId);
    if (connection) {
      connection.instance.status = 'disconnected';
      connection.isHealthy = false;
      
      // 更新数据库
      instanceDB.updateStatus(instanceId, 'disconnected');
      
      // 从内存中移除
      this.instances.delete(instanceId);
      
      this.emit('disconnected', instanceId);
      console.log(`🔌 Instance ${instanceId} disconnected`);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(instanceId: string, killChrome: boolean = false): Promise<void> {
    const connection = this.instances.get(instanceId);
    if (!connection) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      // 如果是远程代理连接，请求代理断开
      if (connection.instance.connectionType === 'remote' && connection.instance.agentId) {
        agentManager.requestCDPDisconnect(instanceId);
      } else if (connection.client) {
        // 本地直连，关闭客户端
        await connection.client.close();
      }

      // 如果是 Chrome 且是系统启动的，可以选择关闭 Chrome 进程
      if (connection.instance.instanceType === 'chrome' && connection.chromeProcess && killChrome) {
        console.log(`🛑 Terminating Chrome process (PID: ${connection.chromeProcess.pid})...`);
        connection.chromeProcess.process.kill('SIGTERM');
        
        // 如果进程在 3 秒内没有退出，强制终止
        setTimeout(() => {
          if (connection.chromeProcess && !connection.chromeProcess.process.killed) {
            console.log(`⚠️  Force killing Chrome process (PID: ${connection.chromeProcess.pid})...`);
            connection.chromeProcess.process.kill('SIGKILL');
          }
        }, 3000);
      }

      connection.instance.status = 'disconnected';
      
      // 更新数据库
      instanceDB.updateStatus(instanceId, 'disconnected');
      
      // 从内存中移除
      this.instances.delete(instanceId);
      
      this.emit('disconnected', instanceId);
      console.log(`🔌 Disconnected from instance ${instanceId}`);
    } catch (error) {
      console.error(`❌ Error disconnecting from ${instanceId}:`, error);
      // 即使关闭失败，也要更新状态
      connection.instance.status = 'disconnected';
      instanceDB.updateStatus(instanceId, 'disconnected');
      this.instances.delete(instanceId);
      throw error;
    }
  }

  /**
   * 通过代理客户端连接
   */
  private async connectViaAgent(
    instanceId: string,
    port: number,
    appPath: string | undefined,
    userId: string | undefined,
    agentId: string,
    instanceType: 'electron' | 'chrome' = 'electron',
    incognito: boolean = false
  ): Promise<string> {
    // 检查代理客户端是否存在
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found or not connected`);
    }

    // 创建虚拟实例（不直接连接 CDP）
    const instance: ElectronInstance = {
      id: instanceId,
      port,
      appPath,
      status: 'connected',
      connectedAt: new Date(),
      lastActivity: new Date(),
      instanceType,
      incognito: instanceType === 'chrome' ? incognito : undefined,
      connectionType: 'remote',
      agentId
    };

    // 存储实例（但没有实际的 CDP 客户端）
    this.instances.set(instanceId, {
      instance,
      client: null, // 代理连接没有本地客户端
      isHealthy: true
    });

    // 请求代理客户端连接 CDP
    const connected = agentManager.requestCDPConnect(instanceId, port);
    if (!connected) {
      this.instances.delete(instanceId);
      throw new Error(`Failed to request CDP connection via agent ${agentId}`);
    }

    // 保存到数据库
    if (userId) {
      instanceDB.save({ ...instance, userId });
    }

    this.emit('connected', instance);
    const instanceTypeLabel = instanceType === 'chrome' ? 'Chrome' : 'Electron';
    console.log(`✅ Connected to ${instanceTypeLabel} instance via agent ${agentId} on port ${port}, ID: ${instanceId}`);
    return instanceId;
  }

  /**
   * 执行 CDP 命令
   */
  async executeCommand(instanceId: string, command: CDPCommand): Promise<any> {
    const connection = this.instances.get(instanceId);
    if (!connection) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // 如果是远程代理连接，通过代理管理器发送命令
    if (connection.instance.connectionType === 'remote' && connection.instance.agentId) {
      return await this.executeCommandViaAgent(instanceId, command);
    }

    // 本地直连
    if (!connection.isHealthy) {
      throw new Error(`Instance ${instanceId} is not healthy`);
    }

    if (!connection.client) {
      throw new Error(`Instance ${instanceId} has no client connection`);
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
   * 通过代理执行 CDP 命令
   */
  private async executeCommandViaAgent(instanceId: string, command: CDPCommand): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let timeout: NodeJS.Timeout;

      // 设置超时
      timeout = setTimeout(() => {
        agentManager.removeAllListeners(`cdp_response_${requestId}`);
        reject(new Error(`CDP command timeout for ${instanceId}`));
      }, 30000); // 30秒超时

      // 监听响应
      const responseHandler = (message: any) => {
        if (message.requestId === requestId && message.instanceId === instanceId) {
          clearTimeout(timeout);
          agentManager.removeListener('cdp_message', responseHandler);
          
          if (message.data?.error) {
            reject(new Error(message.data.error));
          } else {
            this.updateLastActivity(instanceId);
            
            // 发出操作事件
            const operationEvent: OperationEvent = {
              type: this.getOperationTypeFromCommand(command),
              timestamp: new Date(),
              instanceId,
              target: this.extractTargetFromCommand(command),
              result: message.data?.result
            };
            
            this.emit('operation', operationEvent);
            
            resolve(message.data?.result);
          }
        }
      };

      agentManager.on('cdp_message', responseHandler);

      // 发送命令
      const sent = agentManager.sendCDPCommand(instanceId, command.method, command.params, requestId);
      if (!sent) {
        clearTimeout(timeout);
        agentManager.removeListener('cdp_message', responseHandler);
        reject(new Error(`Failed to send CDP command to agent for ${instanceId}`));
      }
    });
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

    // 如果是远程代理连接，检查代理是否在线
    if (connection.instance.connectionType === 'remote' && connection.instance.agentId) {
      const agent = agentManager.getAgent(connection.instance.agentId);
      if (!agent) {
        connection.isHealthy = false;
        connection.instance.status = 'error';
        instanceDB.updateStatus(instanceId, 'error');
        return false;
      }
      
      // 尝试发送一个简单的命令检查
      try {
        await this.executeCommandViaAgent(instanceId, { method: 'Runtime.evaluate', params: { expression: '1+1' } });
        connection.isHealthy = true;
        connection.instance.status = 'connected';
        instanceDB.updateStatus(instanceId, 'connected');
        return true;
      } catch (error) {
        connection.isHealthy = false;
        connection.instance.status = 'error';
        instanceDB.updateStatus(instanceId, 'error');
        return false;
      }
    }

    // 本地直连
    if (!connection.client) {
      return false;
    }

    try {
      // 发送简单的 ping 命令检查连接
      await connection.client.Runtime.evaluate({ expression: '1+1' });
      
      if (!connection.isHealthy) {
        // 从错误状态恢复
        connection.isHealthy = true;
        connection.instance.status = 'connected';
        instanceDB.updateStatus(instanceId, 'connected');
      }
      
      return true;
    } catch (error) {
      // 连接失败，标记为不健康
      connection.isHealthy = false;
      connection.instance.status = 'error';
      
      // 更新数据库
      instanceDB.updateStatus(instanceId, 'error');
      
      return false;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const instanceIds = Array.from(this.instances.keys());
      
      for (const instanceId of instanceIds) {
        const wasHealthy = this.instances.get(instanceId)?.isHealthy ?? false;
        const isHealthy = await this.isInstanceHealthy(instanceId);
        
        // 如果从健康变为不健康，或者从不健康变为健康，都需要通知
        if (wasHealthy !== isHealthy) {
          const connection = this.instances.get(instanceId);
          if (connection) {
            this.emit('healthChanged', instanceId, isHealthy, connection.instance);
          }
        }
        
        // 如果连接失败，尝试清理
        if (!isHealthy) {
          const connection = this.instances.get(instanceId);
          if (connection) {
            // 对于远程连接，直接清理
            if (connection.instance.connectionType === 'remote') {
              console.log(`🧹 Cleaning up disconnected remote instance ${instanceId}`);
              await this.handleClientDisconnect(instanceId);
            } else if (connection.client) {
              // 本地连接，再次尝试确认
              try {
                await connection.client.Runtime.evaluate({ expression: '1+1' });
              } catch (error) {
                // 确认断开，清理连接
                console.log(`🧹 Cleaning up disconnected instance ${instanceId}`);
                await this.handleClientDisconnect(instanceId);
              }
            }
          }
        }
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 更新最后活动时间
   */
  private async updateLastActivity(instanceId: string): Promise<void> {
    const connection = this.instances.get(instanceId);
    if (connection) {
      connection.instance.lastActivity = new Date();
      // 异步更新数据库（不阻塞）
      instanceDB.updateLastActivity(instanceId);
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
