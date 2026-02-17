/**
 * Chrome Tab 管理器
 * 复用单个 Chrome 连接，在不同 tab 中运行不同 URL 的测试
 */

import { Stagehand } from '@browserbasehq/stagehand';

export interface TabInfo {
  id: string;
  url: string;
  stagehand: Stagehand;
  createdAt: Date;
  lastUsed: Date;
  status: 'active' | 'idle' | 'closed';
}

export interface ChromeConnection {
  stagehand: Stagehand;
  tabs: Map<string, TabInfo>;
}

/**
 * Chrome Tab 管理器
 * 单个 Chrome 连接，多个 Tab 并行测试
 */
export class ChromeTabManager {
  private static instance: ChromeTabManager;
  private connection?: ChromeConnection;
  private config: {
    maxTabs: number;
    maxIdleTime: number;
  };

  private constructor(config = {}) {
    this.config = {
      maxTabs: config.maxTabs || 10,  // 最多 10 个 tab
      maxIdleTime: config.maxIdleTime || 30 * 60 * 1000,  // 30 分钟
    };
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: any): ChromeTabManager {
    if (!ChromeTabManager.instance) {
      ChromeTabManager.instance = new ChromeTabManager(config);
    }
    return ChromeTabManager.instance;
  }

  /**
   * 确保连接到 Chrome
   */
  private async ensureConnection(): Promise<ChromeConnection> {
    if (this.connection) {
      // 检查连接是否仍然有效
      try {
        if (this.connection.stagehand.context) {
          return this.connection;
        }
      } catch (error) {
        console.log('[TabManager] 连接失效，重新创建');
      }
    }

    console.log('[TabManager] 创建新的 Chrome 连接');
    const stagehand = new Stagehand({
      env: 'LOCAL',
      verbose: 0,
    });

    await stagehand.init();

    this.connection = {
      stagehand,
      tabs: new Map(),
    };

    return this.connection;
  }

  /**
   * 为指定 URL 获取或创建 Tab
   */
  async getTab(url: string, config?: { id?: string; name?: string }): Promise<TabInfo> {
    // 确保 Chrome 连接存在
    const chrome = await this.ensureConnection();

    // 检查是否已有该 URL 的 tab
    const tabId = config?.id || url;
    const existingTab = chrome.tabs.get(tabId);

    if (existingTab && existingTab.status !== 'closed') {
      console.log(`[TabManager] 复用已有 tab: ${tabId}`);
      existingTab.lastUsed = new Date();
      return existingTab;
    }

    // 检查 tab 数量限制
    if (chrome.tabs.size >= this.config.maxTabs) {
      throw new Error(`Tab 数量已达上限 (${this.config.maxTabs})`);
    }

    // 创建新 tab
    console.log(`[TabManager] 创建新 tab: ${tabId} -> ${url}`);

    // 使用 Stagehand 的 observe 或 act 在新 tab 中打开 URL
    await chrome.stagehand.act(`在新标签页中打开 ${url}`);

    // 为这个 tab 创建独立的 Stagehand 实例
    const tabStagehand = new Stagehand({
      env: 'LOCAL',
      verbose: 0,
    });

    await tabStagehand.init();

    const tab: TabInfo = {
      id: tabId,
      url,
      stagehand: tabStagehand,
      createdAt: new Date(),
      lastUsed: new Date(),
      status: 'active',
    };

    chrome.tabs.set(tabId, tab);
    return tab;
  }

  /**
   * 关闭指定 Tab
   */
  async closeTab(tabId: string): Promise<void> {
    if (!this.connection) return;

    const tab = this.connection.tabs.get(tabId);
    if (!tab) return;

    console.log(`[TabManager] 关闭 tab: ${tabId}`);

    try {
      // 关闭 tab 的 stagehand
      if (tab.stagehand) {
        await tab.stagehand.close();
      }
    } catch (error) {
      console.error(`[TabManager] 关闭 tab 时出错:`, error);
    }

    tab.status = 'closed';
    this.connection.tabs.delete(tabId);
  }

  /**
   * 释放 Tab（标记为空闲，不关闭）
   */
  releaseTab(tabId: string): void {
    if (!this.connection) return;

    const tab = this.connection.tabs.get(tabId);
    if (tab && tab.status === 'active') {
      console.log(`[TabManager] 释放 tab: ${tabId}`);
      tab.status = 'idle';
      tab.lastUsed = new Date();
    }
  }

  /**
   * 获取所有 Tab
   */
  getTabs(): TabInfo[] {
    if (!this.connection) return [];
    return Array.from(this.connection.tabs.values()).filter(t => t.status !== 'closed');
  }

  /**
   * 获取状态
   */
  getStatus(): {
    totalTabs: number;
    activeTabs: number;
    idleTabs: number;
    tabs: TabInfo[];
  } {
    const tabs = this.getTabs();
    return {
      totalTabs: tabs.length,
      activeTabs: tabs.filter(t => t.status === 'active').length,
      idleTabs: tabs.filter(t => t.status === 'idle').length,
      tabs,
    };
  }

  /**
   * 清理空闲 Tab
   */
  private cleanupIdleTabs(): void {
    if (!this.connection) return;

    const now = Date.now();
    const toClose: string[] = [];

    for (const [id, tab] of this.connection.tabs.entries()) {
      if (tab.status === 'idle') {
        const idleTime = now - tab.lastUsed.getTime();
        if (idleTime > this.config.maxIdleTime) {
          console.log(`[TabManager] 清理空闲 tab: ${id}`);
          toClose.push(id);
        }
      }
    }

    for (const id of toClose) {
      this.closeTab(id);
    }
  }

  /**
   * 关闭所有 Tab（保持 Chrome 连接）
   */
  async closeAllTabs(): Promise<void> {
    if (!this.connection) return;

    console.log(`[TabManager] 关闭所有 tab (${this.connection.tabs.size} 个)`);

    const tabIds = Array.from(this.connection.tabs.keys());

    for (const id of tabIds) {
      await this.closeTab(id);
    }
  }

  /**
   * 关闭 Chrome 连接
   */
  async closeConnection(): Promise<void> {
    await this.closeAllTabs();

    if (this.connection?.stagehand) {
      try {
        await this.connection.stagehand.close();
      } catch (error) {
        console.error('[TabManager] 关闭 Chrome 时出错:', error);
      }
    }

    this.connection = undefined;
  }

  /**
   * 销毁管理器
   */
  static async destroy(): Promise<void> {
    if (ChromeTabManager.instance) {
      await ChromeTabManager.instance.closeConnection();
      ChromeTabManager.instance = null as any;
    }
  }
}

// 进程退出时清理
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await ChromeTabManager.destroy();
  });

  process.on('SIGINT', async () => {
    await ChromeTabManager.destroy();
    process.exit(0);
  });
}

// 导出便捷函数
export function getTabManager(): ChromeTabManager {
  return ChromeTabManager.getInstance();
}
