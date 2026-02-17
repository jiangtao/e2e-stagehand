/**
 * CDP 连接池
 * 复用 Chrome DevTools Protocol 连接，避免重复启动 Chrome
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { WebUrlTarget } from '../target/web-url-target';

export interface CDPConnection {
  id: string;
  url: string;
  stagehand: Stagehand;
  target?: WebUrlTarget;
  createdAt: Date;
  lastUsed: Date;
  status: 'active' | 'idle' | 'error';
}

export interface ConnectionConfig {
  maxIdleTime?: number;  // 最大空闲时间（毫秒）
  maxConnections?: number;  // 最大连接数
  healthCheckInterval?: number;  // 健康检查间隔（毫秒）
}

/**
 * CDP 连接池管理器
 */
export class CDPConnectionPool {
  private static instance: CDPConnectionPool;
  private connections: Map<string, CDPConnection> = new Map();
  private config: Required<ConnectionConfig>;
  private healthCheckTimer?: NodeJS.Timeout;

  private constructor(config: ConnectionConfig = {}) {
    this.config = {
      maxIdleTime: config.maxIdleTime || 30 * 60 * 1000,  // 默认 30 分钟
      maxConnections: config.maxConnections || 3,  // 默认最多 3 个连接
      healthCheckInterval: config.healthCheckInterval || 60 * 1000,  // 默认每分钟
    };

    // 启动健康检查定时器
    this.startHealthCheck();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: ConnectionConfig): CDPConnectionPool {
    if (!CDPConnectionPool.instance) {
      CDPConnectionPool.instance = new CDPConnectionPool(config);
    }
    return CDPConnectionPool.instance;
  }

  /**
   * 获取或创建连接
   */
  async getConnection(url: string, targetConfig?: {
    id: string;
    name?: string;
  }): Promise<CDPConnection> {
    const connectionId = this.getConnectionId(url);

    // 检查是否已有可用连接
    const existing = this.connections.get(connectionId);
    if (existing && existing.status === 'active') {
      console.log(`[CDPPool] 复用已有连接: ${connectionId}`);
      existing.lastUsed = new Date();
      return existing;
    }

    // 检查连接数限制
    if (this.connections.size >= this.config.maxConnections) {
      // 清理空闲连接
      this.cleanupIdleConnections();

      // 如果还是超限，抛出错误
      if (this.connections.size >= this.config.maxConnections) {
        throw new Error('达到最大连接数限制，请稍后重试');
      }
    }

    // 创建新连接
    console.log(`[CDPPool] 创建新连接: ${connectionId}`);
    return await this.createConnection(url, targetConfig);
  }

  /**
   * 创建新连接
   */
  private async createConnection(
    url: string,
    targetConfig?: { id: string; name?: string }
  ): Promise<CDPConnection> {
    const connectionId = this.getConnectionId(url);

    // 创建 WebUrlTarget
    const target = new WebUrlTarget({
      id: targetConfig?.id || connectionId,
      url: url,
      name: targetConfig?.name || url,
    });

    // 连接到目标 - WebUrlTarget.connect() 会抛出错误如果失败
    try {
      await target.connect();
    } catch (error) {
      throw new Error(`连接失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 从 target 获取已创建的 stagehand
    const stagehand = (target as any).stagehand;
    if (!stagehand) {
      throw new Error('Stagehand 未初始化');
    }

    const connection: CDPConnection = {
      id: connectionId,
      url,
      stagehand,
      target,
      createdAt: new Date(),
      lastUsed: new Date(),
      status: 'active',
    };

    this.connections.set(connectionId, connection);
    return connection;
  }

  /**
   * 释放连接（不关闭，只是标记为空闲）
   */
  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      console.log(`[CDPPool] 释放连接: ${connectionId}`);
      connection.status = 'idle';
      connection.lastUsed = new Date();
    }
  }

  /**
   * 关闭并移除连接
   */
  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`[CDPPool] 关闭连接: ${connectionId}`);

    try {
      if (connection.target) {
        await connection.target.disconnect();
      }
      if (connection.stagehand) {
        await connection.stagehand.close();
      }
    } catch (error) {
      console.error(`[CDPPool] 关闭连接时出错:`, error);
    }

    this.connections.delete(connectionId);
  }

  /**
   * 获取所有连接
   */
  getConnections(): CDPConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 获取连接状态
   */
  getStatus(): {
    total: number;
    active: number;
    idle: number;
    connections: CDPConnection[];
  } {
    const connections = this.getConnections();
    return {
      total: connections.length,
      active: connections.filter(c => c.status === 'active').length,
      idle: connections.filter(c => c.status === 'idle').length,
      connections,
    };
  }

  /**
   * 清理空闲连接
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, conn] of this.connections.entries()) {
      const idleTime = now - conn.lastUsed.getTime();
      if (conn.status === 'idle' && idleTime > this.config.maxIdleTime) {
        console.log(`[CDPPool] 清理空闲连接: ${id} (空闲 ${Math.round(idleTime / 1000)}秒)`);
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.closeConnection(id);
    }
  }

  /**
   * 健康检查
   */
  private async healthCheck(): Promise<void> {
    const toDelete: string[] = [];

    for (const [id, conn] of this.connections.entries()) {
      try {
        // 检查连接是否仍然有效
        if (conn.stagehand) {
          // 简单检查：尝试获取 context
          const context = conn.stagehand.context;
          if (!context) {
            throw new Error('Context 无效');
          }
        }
      } catch (error) {
        console.warn(`[CDPPool] 连接健康检查失败: ${id}`, error);
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.closeConnection(id);
    }

    // 清理空闲连接
    this.cleanupIdleConnections();
  }

  /**
   * 启动健康检查定时器
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.healthCheck().catch(error => {
        console.error('[CDPPool] 健康检查失败:', error);
      });
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查定时器
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * 生成连接 ID
   */
  private getConnectionId(url: string): string {
    // 使用 URL 的哈希作为 ID
    return `conn-${Buffer.from(url).toString('base64').substring(0, 16)}`;
  }

  /**
   * 关闭所有连接
   */
  async closeAll(): Promise<void> {
    console.log(`[CDPPool] 关闭所有连接 (${this.connections.size} 个)`);
    const connectionIds = Array.from(this.connections.keys());

    for (const id of connectionIds) {
      await this.closeConnection(id);
    }

    this.stopHealthCheck();
  }

  /**
   * 销毁连接池
   */
  static async destroy(): Promise<void> {
    if (CDPConnectionPool.instance) {
      await CDPConnectionPool.instance.closeAll();
      CDPConnectionPool.instance = null as any;
    }
  }
}

// 导出单例获取函数
export function getCDPPool(config?: ConnectionConfig): CDPConnectionPool {
  return CDPConnectionPool.getInstance(config);
}

// 进程退出时清理
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await CDPConnectionPool.destroy();
  });

  process.on('SIGINT', async () => {
    await CDPConnectionPool.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await CDPConnectionPool.destroy();
    process.exit(0);
  });
}
