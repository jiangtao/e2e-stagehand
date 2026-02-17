/**
 * Web URL 目标实现
 * 启动新的 Chrome 浏览器并导航到指定 URL
 */

import { Stagehand } from '@browserbasehq/stagehand';
import {
  Target,
  TargetType,
  TargetStatus,
  TargetConnectionResult,
  BrowserLaunchOptions,
} from './types';

/**
 * Web URL 目标配置
 */
export interface WebUrlTargetConfig {
  id: string;
  url: string;
  name?: string;
  launchOptions?: BrowserLaunchOptions;
}

/**
 * Web URL 目标实现
 * 启动新的 Chrome 浏览器并导航到目标 URL
 */
export class WebUrlTarget implements Target {
  readonly id: string;
  readonly type: TargetType = 'web-url';
  readonly displayName: string;
  status: TargetStatus = 'disconnected';
  context?: any;  // Stagehand context (V3Context)
  lastActivity?: Date;

  private targetUrl: string;
  private launchOptions?: BrowserLaunchOptions;
  private stagehand?: Stagehand;
  private targetId?: string;

  /**
   * 构造函数
   */
  constructor(config: WebUrlTargetConfig) {
    this.id = config.id;
    this.displayName = config.name || config.url;
    this.targetUrl = config.url;
    this.launchOptions = config.launchOptions;
  }

  /**
   * 目标连接和页面操作的性能日志
   */
  private log(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [WebUrlTarget] ${message}`, data || '');
  }

  /**
   * 警告日志
   */
  private warn(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WebUrlTarget] ${message}`, data || '');
  }

  /**
   * 连接到目标（启动新 Chrome 并导航到目标 URL）
   */
  async connect(): Promise<TargetConnectionResult> {
    this.status = 'connecting';
    this.log('开始连接', { targetUrl: this.targetUrl });

    try {
      // 1. 准备浏览器启动选项
      const localBrowserLaunchOptions: BrowserLaunchOptions = {
        headless: this.launchOptions?.headless ?? false,
        args: [
          '--start-maximized',
          '--disable-web-security', // 用于跨域测试
          ...(this.launchOptions?.args ?? [])
        ],
      };

      // 2. 创建并初始化 Stagehand 实例（带重试机制）
      let retries = 3;
      let stagehand: Stagehand | undefined;

      while (retries > 0) {
        try {
          // 创建 Stagehand 实例
          stagehand = new Stagehand({
            env: 'LOCAL',
            localBrowserLaunchOptions,
            verbose: 0,
          });

          // 调用 init() 方法来初始化 context
          await stagehand.init();

          // 验证 context 可用
          if (stagehand.context) {
            break;
          } else {
            throw new Error('stagehand.context 为 undefined');
          }
        } catch (error) {
          this.log('Stagehand 初始化失败', {
            attempt: 4 - retries,
            error: error instanceof Error ? error.message : String(error)
          });
          retries--;
          if (retries === 0) {
            throw new Error(`Stagehand 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!stagehand) {
        throw new Error('无法创建 Stagehand 实例');
      }

      // 保存 stagehand 到实例
      this.stagehand = stagehand;
      this.context = stagehand.context;

      // 3. 获取页面对象并导航到目标 URL
      this.log('准备导航到:', this.targetUrl);

      // V3Context 使用 activePage() 获取当前活动页面
      const page = stagehand.context.activePage();
      if (!page) {
        throw new Error('无法获取活动页面对象');
      }
      this.log('获取到页面对象');

      // 使用 CDP 命令导航到目标 URL
      this.log('开始导航...');
      await page.sendCDP('Page.navigate', { url: this.targetUrl });

      // 等待页面加载完成
      this.log('等待页面加载完成...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      this.status = 'connected';
      this.lastActivity = new Date();
      this.targetId = page.targetId();
      this.log('页面导航成功', { targetUrl: this.targetUrl, targetId: this.targetId });

      // 4. 生成 CDP URL 并返回结果
      const cdpUrl = `ws://localhost:9222/devtools/page/${this.targetId}`;
      return {
        context: stagehand.context,
        cdpUrl,
        targetId: this.targetId,
      };

    } catch (error) {
      this.status = 'error';
      const errorMessage = `连接到 ${this.targetUrl} 失败: ${error instanceof Error ? error.message : String(error)}`;
      this.log(errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * 断开连接（关闭 Chrome）
   */
  async disconnect(): Promise<void> {
    try {
      if (this.stagehand) {
        this.log('关闭 Stagehand，将自动关闭 Chrome');
        await this.stagehand.close();
        this.stagehand = undefined;
        this.context = undefined;
      }
    } catch (error) {
      this.warn('关闭 Chrome 时出错:', error);
    }
    this.status = 'disconnected';
    this.lastActivity = new Date();
  }

  /**
   * 刷新连接状态
   */
  async refreshStatus(): Promise<TargetStatus> {
    if (this.stagehand && this.stagehand.context && this.status === 'connected') {
      this.log('检查连接状态，context 已连接，返回状态');
      return this.status;
    }

    if (!this.stagehand || this.status !== 'connected') {
      this.log('检查连接状态，未连接，尝试重新连接');
      try {
        await this.connect();
      } catch (error) {
        this.status = 'error';
        this.warn('重新连接失败:', error);
      }
    }

    return this.status;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.context !== undefined;
  }
}
