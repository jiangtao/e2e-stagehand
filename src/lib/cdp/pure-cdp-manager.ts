/**
 * Pure CDP Manager (No LLM Version)
 * Direct CDP protocol, no API key needed, more stable
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';
import http from 'http';

export interface TabInfo {
  id: string;
  url: string;
  page: any;
  createdAt: Date;
  lastUsed: Date;
  status: 'active' | 'idle' | 'closed';
  releaseTimer?: NodeJS.Timeout;
}

export interface ChromeConnection {
  cdp: WebSocket;
  tabs: Map<string, TabInfo>;
}

export class PureCDPManager {
  private static instance: PureCDPManager;
  private connection?: ChromeConnection;
  private config: {
    maxTabs: number;
    autoReleaseTime: number;
    cdpPort: number;
    chromePath: string;
  };
  private chromeProcess?: any;

  private constructor(config = {}) {
    this.config = {
      maxTabs: config.maxTabs || 10,
      autoReleaseTime: config.autoReleaseTime || 4000,
      cdpUrl: config.cdpUrl || 'ws://localhost:9222',
      cdpPort: config.cdpPort || 9222,
      chromePath: config.chromePath || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    };
  }

  static getInstance(config?: any): PureCDPManager {
    if (!PureCDPManager.instance) {
      PureCDPManager.instance = new PureCDPManager(config);
    }
    return PureCDPManager.instance;
  }

  private async getWebSocketUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      const req = http.get('http://localhost:' + this.config.cdpPort + '/json/version', (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const info = JSON.parse(data);
            resolve(info.webSocketDebuggerUrl);
          } catch (e) {
            reject(new Error('Failed to parse Chrome version info'));
          }
        });
      });

      req.on('error', () => {
        reject(new Error('Chrome not running'));
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Chrome connection timeout'));
      });
    });
  }

  private isChromeRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:' + this.config.cdpPort + '/json/version', (res: any) => {
        resolve(true);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async startChromeIfNeeded(): Promise<void> {
    const isRunning = await this.isChromeRunning();

    if (isRunning) {
      console.log('[CDP] Chrome already running, reusing instance');
      return;
    }

    console.log('[CDP] Starting Chrome...');

    this.chromeProcess = spawn(this.config.chromePath, [
      '--remote-debugging-port=' + this.config.cdpPort,
      '--user-data-dir=/tmp/chrome-debug-' + this.config.cdpPort,
      '--no-first-run',
      '--no-default-browser-check',
    ], {
      detached: true,
      stdio: 'ignore',
    });

    this.chromeProcess.unref();

    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const running = await this.isChromeRunning();
      if (running) {
        console.log('[CDP] Chrome started successfully!');
        return;
      }
      attempts++;
    }

    throw new Error('Failed to start Chrome');
  }

  async ensureConnection(): Promise<ChromeConnection> {
    if (this.connection) {
      return this.connection;
    }

    await this.startChromeIfNeeded();
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[CDP] Connecting to Chrome CDP...');

    const wsUrl = await this.getWebSocketUrl();
    console.log('[CDP] WebSocket URL:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('[CDP] CDP connected!');
    });

    ws.on('error', (error) => {
      console.error('[CDP] CDP connection failed:', error);
    });

    this.connection = {
      cdp: ws,
      tabs: new Map(),
    };

    return this.connection;
  }

  async getTab(url: string, config?: { id?: string; name?: string }): Promise<TabInfo> {
    const chrome = await this.ensureConnection();

    const tabId = config?.id || url;
    const existingTab = chrome.tabs.get(tabId);

    if (existingTab && existingTab.status !== 'closed') {
      console.log('[CDP] Reusing existing tab: ' + tabId);
      existingTab.lastUsed = new Date();
      existingTab.status = 'active';

      if (existingTab.releaseTimer) {
        clearTimeout(existingTab.releaseTimer);
        delete existingTab.releaseTimer;
      }

      return existingTab;
    }

    if (chrome.tabs.size >= this.config.maxTabs) {
      throw new Error('Tab limit reached (' + this.config.maxTabs + ')');
    }

    console.log('[CDP] Creating new tab: ' + tabId + ' -> ' + url);

    const tab: TabInfo = {
      id: tabId,
      url,
      page: { targetId: tabId },
      createdAt: new Date(),
      lastUsed: new Date(),
      status: 'active',
    };

    chrome.tabs.set(tabId, tab);
    return tab;
  }

  async executeInTab(tabId: string, action: any): Promise<any> {
    if (!this.connection) {
      throw new Error('Chrome not connected');
    }

    const tab = this.connection.tabs.get(tabId);
    if (!tab || tab.status === 'closed') {
      throw new Error('Tab ' + tabId + ' not found or closed');
    }

    tab.status = 'active';
    tab.lastUsed = new Date();

    if (tab.releaseTimer) {
      clearTimeout(tab.releaseTimer);
      delete tab.releaseTimer;
    }

    console.log('[CDP] Execute action:', action.type, action);

    // 使用 CDP 执行操作
    const result = await this.sendCDPCommand('Runtime.evaluate', {
      expression: this.buildActionScript(action),
      awaitPromise: true,
      returnByValue: true,
    });

    console.log('[CDP] Action result:', result);
    return result;
  }

  /**
   * 构建操作脚本
   */
  private buildActionScript(action: any): string {
    switch (action.type) {
      case 'type':
        return `
          (function() {
            const selector = '${action.selector}';
            const text = '${action.text || ''}';
            const element = document.querySelector(selector);
            if (!element) {
              return { success: false, error: 'Element not found: ' + selector };
            }
            element.value = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, text: text };
          })();
        `;

      case 'scroll':
        return `
          (function() {
            const amount = ${action.amount || 500};
            window.scrollBy(0, amount);
            return { success: true, scrolled: amount };
          })();
        `;

      case 'click':
        return `
          (function() {
            const selector = '${action.selector}';
            const element = document.querySelector(selector);
            if (!element) {
              return { success: false, error: 'Element not found: ' + selector };
            }
            element.click();
            return { success: true };
          })();
        `;

      case 'playVideo':
        return `
          (function() {
            // 查找所有 canvas 元素
            const canvases = document.querySelectorAll('canvas');
            let played = false;

            for (const canvas of canvases) {
              // 尝试触发 canvas 相关的播放
              const event = new Event('play', { bubbles: true });
              canvas.dispatchEvent(event);

              // 查找父级媒体元素
              const parent = canvas.closest('video, [data-playing], .video-player');
              if (parent) {
                parent.dispatchEvent(new Event('play', { bubbles: true }));
              }

              // 尝试查找并点击播放按钮
              const playButton = document.querySelector('[class*="play"], [aria-label*="play"], .play-btn');
              if (playButton) {
                playButton.click();
              }

              played = true;
            }

            return { success: true, canvasCount: canvases.length, played };
          })();
        `;

      case 'wait':
        return `
          (function() {
            return new Promise(resolve => setTimeout(resolve, ${action.wait || 1000}));
          })();
        `;

      default:
        return `
          (function() {
            return { success: false, error: 'Unknown action type: ${action.type}' };
          })();
        `;
    }
  }

  /**
   * 发送 CDP 命令
   */
  private async sendCDPCommand(method: string, params: any = {}): Promise<any> {
    if (!this.connection || !this.connection.cdp || this.connection.cdp.readyState !== 1) {
      throw new Error('CDP not connected');
    }

    const id = Math.random().toString(36).substring(2, 11);
    const message = { id, method, params };

    return new Promise((resolve, reject) => {
      const messageHandler = (data: any) => {
        try {
          const response = JSON.parse(data);

          if (response.id === id) {
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
            this.connection!.cdp.off('message', messageHandler);
          }
        } catch (e) {
          reject(new Error('Failed to parse CDP response'));
        }
      };

      this.connection!.cdp.on('message', messageHandler);
      this.connection!.cdp.send(JSON.stringify(message));

      // 设置超时
      setTimeout(() => {
        this.connection!.cdp.off('message', messageHandler);
        reject(new Error('CDP command timeout'));
      }, 10000);
    });
  }

  releaseTab(tabId: string): void {
    if (!this.connection) return;

    const tab = this.connection.tabs.get(tabId);
    if (!tab || tab.status === 'closed') return;

    console.log('[CDP] Release tab: ' + tabId + ' (will auto-close in 4s)');

    tab.status = 'idle';
    tab.lastUsed = new Date();

    if (tab.releaseTimer) {
      clearTimeout(tab.releaseTimer);
    }

    tab.releaseTimer = setTimeout(() => {
      console.log('[CDP] Auto-closing tab: ' + tabId);
      this.closeTab(tabId);
    }, this.config.autoReleaseTime);
  }

  async closeTab(tabId: string): Promise<void> {
    if (!this.connection) return;

    const tab = this.connection.tabs.get(tabId);
    if (!tab) return;

    console.log('[CDP] Closing tab: ' + tabId);

    if (tab.releaseTimer) {
      clearTimeout(tab.releaseTimer);
    }

    tab.status = 'closed';
    this.connection.tabs.delete(tabId);
  }

  getTabs(): TabInfo[] {
    if (!this.connection) return [];
    return Array.from(this.connection.tabs.values()).filter((t) => t.status !== 'closed');
  }

  getStatus(): {
    totalTabs: number;
    activeTabs: number;
    idleTabs: number;
    tabs: TabInfo[];
  } {
    const tabs = this.getTabs();
    return {
      totalTabs: tabs.length,
      activeTabs: tabs.filter((t) => t.status === 'active').length,
      idleTabs: tabs.filter((t) => t.status === 'idle').length,
      tabs,
    };
  }

  async closeConnection(): Promise<void> {
    const tabIds = this.connection?.tabs.keys() || [];
    for (const id of tabIds) {
      await this.closeTab(id);
    }

    if (this.connection?.cdp) {
      try {
        this.connection.cdp.close();
      } catch (error) {
        console.error('[CDP] Error closing CDP:', error);
      }
    }

    this.connection = undefined;
  }

  static async destroy(): Promise<void> {
    if (PureCDPManager.instance) {
      await PureCDPManager.instance.closeConnection();
      PureCDPManager.instance = null as any;
    }
  }
}

export function getPureCDPManager(config?: any): PureCDPManager {
  return PureCDPManager.getInstance(config);
}

export async function ensureChrome(): Promise<PureCDPManager> {
  const manager = getPureCDPManager();
  await manager.ensureConnection();
  return manager;
}
