/**
 * Chrome 目标实现
 * 连接到已有的 Chrome 浏览器实例
 */

import { CdpConnection, V3Context } from '@browserbasehq/stagehand';
import {
  Target,
  TargetType,
  TargetStatus,
  TargetConnectionResult,
  CDPConnectionInfo,
} from './types';

/**
 * Chrome 目标配置
 */
export interface ChromeTargetConfig {
  id: string;
  port: number;
  name?: string;
}

/**
 * Chrome 目标实现
 * 连接到已有 Chrome 实例的 CDP 端口
 */
export class ChromeTarget implements Target {
  readonly id: string;
  readonly type: TargetType = 'chrome';
  readonly displayName: string;

  status: TargetStatus = 'disconnected';
  context?: V3Context;
  lastActivity?: Date;

  private cdpConnection?: CdpConnection;
  private cdpInfo?: CDPConnectionInfo;

  constructor(config: ChromeTargetConfig) {
    this.id = config.id;
    this.displayName = config.name || `Chrome (port ${config.port})`;
    this.cdpInfo = {
      port: config.port,
    };
  }

  /**
   * 连接到 Chrome 实例
   */
  async connect(): Promise<TargetConnectionResult> {
    this.status = 'connecting';

    try {
      const port = this.cdpInfo!.port;

      // 1. 获取 CDP 目标列表
      const targetsResponse = await fetch(`http://localhost:${port}/json`);
      if (!targetsResponse.ok) {
        throw new Error(`无法连接到端口 ${port}，请确保 Chrome 正在运行`);
      }

      const targetsList = await targetsResponse.json();

      // 2. 找到页面目标
      const pageTarget = targetsList.find(
        (t: any) => t.type === 'page'
      );

      if (!pageTarget) {
        throw new Error(`端口 ${port} 上没有可用的页面目标`);
      }

      const wsUrl = (pageTarget as any).webSocketDebuggerUrl;
      const targetId = (pageTarget as any).id;

      // 保存 CDP 信息
      this.cdpInfo = {
        port,
        wsUrl,
        targets: targetsList.map((t: any) => ({
          id: t.id,
          type: t.type,
          title: t.title,
          url: t.url,
        })),
      };

      // 3. 连接 CDP WebSocket
      this.cdpConnection = await CdpConnection.connect(wsUrl);

      // 4. 创建 V3Context
      const context = await V3Context.create(wsUrl, {
        env: 'LOCAL',
        apiClient: null,
        localBrowserLaunchOptions: null,
      });

      this.context = context;
      this.status = 'connected';
      this.lastActivity = new Date();

      return {
        context,
        cdpUrl: wsUrl,
        targetId,
      };

    } catch (error) {
      this.status = 'error';
      throw new Error(
        `连接 Chrome 失败 (${this.cdpInfo?.port}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    try {
      if (this.cdpConnection) {
        await this.cdpConnection.close();
        this.cdpConnection = undefined;
      }

      if (this.context) {
        await this.context.close();
        this.context = undefined;
      }

      this.status = 'disconnected';
      this.lastActivity = new Date();
    } catch (error) {
      console.error(`断开 Chrome 连接时出错:`, error);
      this.status = 'error';
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.context !== undefined;
  }

  /**
   * 获取 CDP 连接信息
   */
  getCDPInfo(): CDPConnectionInfo | null {
    return this.cdpInfo || null;
  }

  /**
   * 刷新连接状态
   */
  async refreshStatus(): Promise<TargetStatus> {
    if (!this.cdpInfo) {
      this.status = 'disconnected';
      return this.status;
    }

    try {
      const response = await fetch(
        `http://localhost:${this.cdpInfo.port}/json/version`
      );

      if (response.ok && this.isConnected()) {
        this.status = 'connected';
      } else {
        this.status = 'disconnected';
      }
    } catch {
      this.status = 'disconnected';
    }

    return this.status;
  }
}
