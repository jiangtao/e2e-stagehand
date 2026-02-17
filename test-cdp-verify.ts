/**
 * Chrome CDP 连接验证测试
 *
 * 使用说明：
 * 1. 确保 Chrome 已在端口 9222 上启动了远程调试
 *    macOS: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 *    Linux: google-chrome --remote-debugging-port=9222
 *    Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *
 * 2. 运行测试: npx tsx test-cdp-verify.ts
 */

interface TestResult {
  step: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class CDPConnectionTest {
  private results: TestResult[] = [];
  private cdpUrl: string = '';
  private ws: any = null;

  /**
   * 记录测试结果
   */
  private recordResult(step: string, success: boolean, duration: number, error?: string, details?: any): void {
    const result: TestResult = { step, success, duration, error, details };
    this.results.push(result);

    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${step} (${duration}ms)`);
    if (error) {
      console.log(`   错误: ${error}`);
    }
    if (details) {
      console.log(`   详情:`, JSON.stringify(details, null, 2));
    }
  }

  /**
   * 测试 1: 检查 Chrome 是否在运行
   */
  async testChromeRunning(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await fetch('http://localhost:9222/json/version');
      if (!response.ok) {
        throw new Error('Chrome 未在端口 9222 上运行');
      }

      const version = await response.json();
      this.cdpUrl = version['webSocketDebuggerUrl'];

      const duration = Date.now() - startTime;
      this.recordResult(
        'Chrome 运行检查',
        true,
        duration,
        undefined,
        {
          browser: version['Browser'],
          webSocketDebuggerUrl: version['webSocketDebuggerUrl']
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Chrome 运行检查',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试 2: CDP WebSocket 连接
   */
  async testCDPWebSocketConnection(): Promise<void> {
    const startTime = Date.now();
    try {
      const WebSocket = (await import('ws')).default;

      await new Promise<void>((resolve, reject) => {
        this.ws = new WebSocket(this.cdpUrl);

        this.ws.on('open', () => {
          const duration = Date.now() - startTime;
          this.recordResult('CDP WebSocket 连接', true, duration);
          resolve();
        });

        this.ws.on('error', (error: Error) => {
          const duration = Date.now() - startTime;
          this.recordResult(
            'CDP WebSocket 连接',
            false,
            duration,
            error.message
          );
          reject(error);
        });

        setTimeout(() => {
          reject(new Error('WebSocket 连接超时'));
        }, 5000);
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      if (!this.results.find(r => r.step === 'CDP WebSocket 连接')) {
        this.recordResult(
          'CDP WebSocket 连接',
          false,
          duration,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }

  /**
   * 测试 3: 列出所有可用的页面/目标
   */
  async testListTargets(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await fetch('http://localhost:9222/json');
      const targets = await response.json();

      const duration = Date.now() - startTime;
      this.recordResult(
        '列出可用目标',
        true,
        duration,
        undefined,
        {
          count: targets.length,
          targets: targets.map((t: any) => ({
            type: t.type,
            title: t.title,
            url: t.url,
            id: t.id
          }))
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '列出可用目标',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 4: 创建新标签页
   */
  async testCreateTab(): Promise<void> {
    const startTime = Date.now();
    try {
      const targetId = await this.sendCDPCommand('Target.createTarget', {
        url: 'about:blank',
        newWindow: false
      });

      const duration = Date.now() - startTime;
      this.recordResult(
        '创建新标签页',
        true,
        duration,
        undefined,
        { targetId }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '创建新标签页',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 5: 页面导航
   */
  async testNavigate(): Promise<void> {
    const startTime = Date.now();
    try {
      // 先获取当前页面
      const targets = await fetch('http://localhost:9222/json').then(r => r.json());
      const pageTarget = targets.find((t: any) => t.type === 'page');

      if (!pageTarget) {
        throw new Error('没有找到页面目标');
      }

      const pageWsUrl = pageTarget.webSocketDebuggerUrl;
      const WebSocket = (await import('ws')).default;
      const pageWs = new WebSocket(pageWsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('页面连接超时')), 5000);

        pageWs.on('open', async () => {
          clearTimeout(timeout);

          // 发送导航命令
          const navigateCmd = {
            id: 1,
            method: 'Page.navigate',
            params: { url: 'https://example.com' }
          };

          pageWs.send(JSON.stringify(navigateCmd));

          // 等待导航完成
          await new Promise(res => setTimeout(res, 2000));

          const duration = Date.now() - startTime;
          this.recordResult(
            '页面导航',
            true,
            duration,
            undefined,
            { url: 'https://example.com' }
          );

          pageWs.close();
          resolve();
        });

        pageWs.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      if (!this.results.find(r => r.step === '页面导航')) {
        this.recordResult(
          '页面导航',
          false,
          duration,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * 测试 6: 截图功能
   */
  async testScreenshot(): Promise<void> {
    const startTime = Date.now();
    try {
      const targets = await fetch('http://localhost:9222/json').then(r => r.json());
      const pageTarget = targets.find((t: any) => t.type === 'page');

      if (!pageTarget) {
        throw new Error('没有找到页面目标');
      }

      const pageWsUrl = pageTarget.webSocketDebuggerUrl;
      const WebSocket = (await import('ws')).default;
      const pageWs = new WebSocket(pageWsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('页面连接超时')), 5000);

        let messageId = 0;

        pageWs.on('open', async () => {
          clearTimeout(timeout);

          // 启用 Page 域
          pageWs.send(JSON.stringify({
            id: ++messageId,
            method: 'Page.enable'
          }));

          // 等待一下让页面加载
          await new Promise(res => setTimeout(res, 1000));

          // 截图
          pageWs.send(JSON.stringify({
            id: ++messageId,
            method: 'Page.captureScreenshot',
            params: { format: 'png' }
          }));

          // 设置消息处理器
          const handler = (data: string) => {
            const message = JSON.parse(data);

            if (message.id === messageId && message.result) {
              const duration = Date.now() - startTime;
              this.recordResult(
                '截图功能',
                true,
                duration,
                undefined,
                {
                  dataSize: message.result.data.length,
                  format: 'PNG'
                }
              );

              pageWs.off('message', handler);
              pageWs.close();
              resolve();
            }
          };

          pageWs.on('message', handler);
        });

        pageWs.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      if (!this.results.find(r => r.step === '截图功能')) {
        this.recordResult(
          '截图功能',
          false,
          duration,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * 测试 7: DOM 操作
   */
  async testDOMOperation(): Promise<void> {
    const startTime = Date.now();
    try {
      const targets = await fetch('http://localhost:9222/json').then(r => r.json());
      const pageTarget = targets.find((t: any) => t.type === 'page');

      if (!pageTarget) {
        throw new Error('没有找到页面目标');
      }

      const pageWsUrl = pageTarget.webSocketDebuggerUrl;
      const WebSocket = (await import('ws')).default;
      const pageWs = new WebSocket(pageWsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('页面连接超时')), 5000);

        let messageId = 0;

        pageWs.on('open', async () => {
          clearTimeout(timeout);

          // 启用 Runtime 域
          pageWs.send(JSON.stringify({
            id: ++messageId,
            method: 'Runtime.enable'
          }));

          // 等待一下
          await new Promise(res => setTimeout(res, 500));

          // 执行 JavaScript
          pageWs.send(JSON.stringify({
            id: ++messageId,
            method: 'Runtime.evaluate',
            params: {
              expression: `
                (function() {
                  const h1 = document.querySelector('h1');
                  const title = document.title;
                  const url = window.location.href;

                  return {
                    hasH1: !!h1,
                    h1Text: h1 ? h1.textContent : null,
                    title: title,
                    url: url
                  };
                })()
              `,
              returnByValue: true
            }
          }));

          // 设置消息处理器
          const handler = (data: string) => {
            const message = JSON.parse(data);

            if (message.id === messageId && message.result) {
              const duration = Date.now() - startTime;
              this.recordResult(
                'DOM 操作',
                true,
                duration,
                undefined,
                message.result.result.value
              );

              pageWs.off('message', handler);
              pageWs.close();
              resolve();
            }
          };

          pageWs.on('message', handler);
        });

        pageWs.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      if (!this.results.find(r => r.step === 'DOM 操作')) {
        this.recordResult(
          'DOM 操作',
          false,
          duration,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  /**
   * 发送 CDP 命令
   */
  private async sendCDPCommand(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2, 11);
      const message = { id, method, params };

      const handler = (data: string) => {
        const response = JSON.parse(data);

        if (response.id === id) {
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
          this.ws.off('message', handler);
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));

      setTimeout(() => {
        this.ws.off('message', handler);
        reject(new Error('命令超时'));
      }, 10000);
    });
  }

  /**
   * 生成测试报告
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('CDP 连接验证测试报告');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    console.log(`\n总计: ${total} 个测试`);
    console.log(`通过: ${passed} 个`);
    console.log(`失败: ${failed} 个`);
    console.log(`通过率: ${passRate}%`);

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`总耗时: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n失败的测试:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.step}: ${r.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('\n=== Chrome CDP 连接验证测试 ===\n');

    const tests = [
      { name: 'Chrome 运行检查', fn: () => this.testChromeRunning() },
      { name: 'CDP WebSocket 连接', fn: () => this.testCDPWebSocketConnection() },
      { name: '列出可用目标', fn: () => this.testListTargets() },
      { name: '创建新标签页', fn: () => this.testCreateTab() },
      { name: '页面导航', fn: () => this.testNavigate() },
      { name: 'DOM 操作', fn: () => this.testDOMOperation() },
      { name: '截图功能', fn: () => this.testScreenshot() },
    ];

    for (const test of tests) {
      try {
        await test.fn();
      } catch (error) {
        // 测试失败已经在 recordResult 中记录
        // 如果是关键测试失败，停止后续测试
        if (test.name === 'Chrome 运行检查' || test.name === 'CDP WebSocket 连接') {
          console.log(`\n关键测试失败，停止后续测试`);
          break;
        }
      }

      // 测试之间稍作等待
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.generateReport();
  }
}

// 主函数
async function main() {
  const tester = new CDPConnectionTest();

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('\n测试运行失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
