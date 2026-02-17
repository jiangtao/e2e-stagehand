/**
 * Chrome CDP 客户端 - 简化版
 */

import { spawn } from 'child_process';
import http from 'http';
import WebSocket from 'ws';

export interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  screenshot?: string;
}

export class ChromeCDPClient {
  private cdpUrl: string;
  private port: number;
  private chromePath: string;
  private ws?: WebSocket;
  private targetId?: string;
  private chromeProcess?: any;

  constructor(config: { port?: number; chromePath?: string }) {
    this.port = config.port || 9222;
    this.cdpUrl = `ws://localhost:${this.port}/devtools/browser`;
    this.chromePath = config.chromePath || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  async isChromeRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${this.port}/json/version`, (res: any) => {
        resolve(true);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async startChrome(): Promise<void> {
    const isRunning = await this.isChromeRunning();

    if (isRunning) {
      console.log('[ChromeCDP] Chrome 已在运行');
      return;
    }

    console.log('[ChromeCDP] 启动 Chrome...');

    this.chromeProcess = spawn(this.chromePath, [
      `--remote-debugging-port=${this.port}`,
      '--user-data-dir=/tmp/xiaohongshu-test',
      '--no-first-run',
      '--no-default-browser-check',
    ], {
      detached: true,
      stdio: 'ignore',
    });

    this.chromeProcess.unref();

    // 等待 Chrome 启动
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const running = await this.isChromeRunning();
      if (running) {
        console.log('[ChromeCDP] Chrome 启动成功！');
        return;
      }
    }

    throw new Error('Chrome 启动失败');
  }

  async connect(): Promise<string> {
    if (this.ws && this.ws.readyState === 1) {
      console.log('[ChromeCDP] 已连接');
      return this.targetId || '';
    }

    await this.startChrome();

    // 等待 CDP 就绪
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('[ChromeCDP] 连接 Chrome CDP...');

    const ws = new WebSocket(this.cdpUrl);

    return new Promise((resolve, reject) => {
      this.ws = ws;

      ws.on('open', () => {
        console.log('[ChromeCDP] CDP 连接成功！');
        resolve();
      });

      ws.on('error', (error) => {
        console.error('[ChromeCDP] CDP 连接失败:', error);
        reject(error);
      });

      setTimeout(() => {
        if (ws.readyState !== 1) {
          reject(new Error('CDP 连接超时'));
        }
      }, 10000);
    });
  }

  async createTab(url: string): Promise<string> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('CDP 未连接');
    }

    console.log(`[ChromeCDP] 创建标签页: ${url}`);

    const result = await this.sendCommand('Target.createTarget', {
      url,
      newWindow: true,
      background: false
    });

    if (!result || !result.targetId) {
      throw new Error('创建标签页失败');
    }

    this.targetId = result.targetId;
    return this.targetId;
  }

  async navigate(url: string): Promise<void> {
    if (!this.targetId) {
      throw new Error('无活动标签页');
    }

    console.log(`[ChromeCDP] 导航到: ${url}`);

    await this.sendCommand('Page.navigate', {
      targetId: this.targetId,
      url
    });
  }

  async wait(duration: number): Promise<void> {
    if (!this.targetId) {
      return;
    }

    console.log(`[ChromeCDP] 等待 ${duration}ms`);
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  async search(query: string): Promise<void> {
    if (!this.targetId) {
      throw new Error('无活动标签页');
    }

    console.log(`[ChromeCDP] 搜索: ${query}`);

    // 先导航（如果需要）
    // await this.navigate('https://www.xiaohongshu.com');

    await this.wait(2000);

    // 使用 Runtime.evaluate 执行搜索
    await this.sendCommand('Runtime.evaluate', {
      targetId: this.targetId,
      expression: `
        (function() {
          const searchBox = document.querySelector('input[placeholder*="搜索"]');
          if (searchBox) {
            searchBox.value = '${query}';
            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
          }

          const searchBtn = document.querySelector('button[type="submit"]') ||
                           document.querySelector('.search-button');
          if (searchBtn) {
            searchBtn.click();
          }

          return { success: true, message: '搜索已执行' };
        }
        return { success: false, message: '搜索框未找到' };
      })();
        `
    });

    await this.wait(2000);
  }

  async scroll(amount: number = 500): Promise<void> {
    if (!this.targetId) {
      return;
    }

    console.log(`[ChromeCDP] 滚动: ${amount}px`);

    await this.sendCommand('Runtime.evaluate', {
      targetId: this.targetId,
      expression: `window.scrollBy(0, ${amount})`
    });
  }

  async verify(selector: string): Promise<boolean> {
    if (!this.targetId) {
      return false;
    }

    console.log(`[ChromeCDP] 验证: ${selector}`);

    await this.wait(1000);

    const result = await this.sendCommand('Runtime.evaluate', {
      targetId: this.targetId,
      expression: `
        (function() {
          const element = document.querySelector('${selector}');
          if (element) {
            return { success: true, text: element.innerText?.substring(0, 50) || '' };
          }
          return { success: false, message: '元素未找到' };
        })();
        `
    });

    return result?.result?.success || false;
  }

  async captureScreenshot(): Promise<string> {
    if (!this.targetId) {
      return '';
    }

    console.log('[ChromeCDP] 截图中...');

    const result = await this.sendCommand('Page.captureScreenshot', {
      targetId: this.targetId,
      format: 'png'
    });

    return result?.data || '';
  }

  async closeTab(): Promise<void> {
    if (!this.targetId) {
      return;
    }

    console.log(`[ChromeCDP] 关闭标签页: ${this.targetId}`);

    await this.sendCommand('Page.close', {
      targetId: this.targetId
    });

    this.targetId = undefined;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    if (this.chromeProcess) {
      // 不关闭 Chrome 进程，保持运行
    }
  }

  private async sendCommand(method: string, params: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new Error('CDP 未连接');
    }

    const id = Math.random().toString(36).substring(2, 11);
    const message = { id, method, params };

    return new Promise((resolve, reject) => {
      const messageHandler = (data: any) => {
        const response = JSON.parse(data);

        if (response.id === id) {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
          this.ws.off('message', messageHandler);
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(message));

      setTimeout(() => {
        this.ws.off('message', messageHandler);
        reject(new Error('命令超时'));
      }, 10000);
    });
  }
}
