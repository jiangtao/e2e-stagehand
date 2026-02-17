/**
 * CDP 连接验证测试脚本
 *
 * 这个脚本验证 Chrome CDP 连接并使用 Stagehand 配置
 * 测试基本的 CDP 操作：导航、截图、DOM 操作
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { WebUrlTarget } from '../src/lib/target/web-url-target';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class CDPConnectionVerifier {
  private results: TestResult[] = [];
  private stagehand?: Stagehand;
  private target?: WebUrlTarget;

  /**
   * 记录测试结果
   */
  private recordResult(name: string, passed: boolean, duration: number, error?: string, details?: any) {
    const result: TestResult = { name, passed, duration, error, details };
    this.results.push(result);

    const status = passed ? '✅ PASS' : '❌ FAIL';
    const durationStr = `${duration}ms`;
    console.log(`${status} ${name} (${durationStr})`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
    if (details) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }

  /**
   * 测试 1: 检查 Chrome 是否在运行
   */
  private async testChromeRunning(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await fetch('http://localhost:9222/json/version');
      if (response.ok) {
        const version = await response.json();
        const duration = Date.now() - startTime;
        this.recordResult(
          'Chrome Running Check',
          true,
          duration,
          undefined,
          {
            browser: version['Browser'],
            webSocketDebuggerUrl: version['webSocketDebuggerUrl']
          }
        );
      } else {
        throw new Error('Chrome not responding on port 9222');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Chrome Running Check',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试 2: 创建 WebUrlTarget 并连接
   */
  private async testWebUrlTargetConnection(): Promise<void> {
    const startTime = Date.now();
    try {
      this.target = new WebUrlTarget({
        id: 'cdp-verify-test',
        url: 'https://example.com',
        name: 'CDP Verification Test'
      });

      const result = await this.target.connect();
      const duration = Date.now() - startTime;

      if (this.target.isConnected()) {
        this.recordResult(
          'WebUrlTarget Connection',
          true,
          duration,
          undefined,
          {
            targetId: result.targetId,
            cdpUrl: result.cdpUrl,
            status: this.target.status
          }
        );
      } else {
        throw new Error('Target connection failed');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'WebUrlTarget Connection',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试 3: Stagehand 基本操作
   */
  private async testStagehandBasicOperations(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.target || !this.target.context) {
        throw new Error('Target not connected');
      }

      const page = this.target.context.activePage();
      if (!page) {
        throw new Error('No active page');
      }

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 获取页面标题
      const titleResult = await page.sendCDP('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true
      });

      const duration = Date.now() - startTime;
      this.recordResult(
        'Stagehand Basic Operations',
        true,
        duration,
        undefined,
        {
          pageTitle: titleResult.result.value,
          pageUrl: page.url()
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Stagehand Basic Operations',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 4: DOM 操作
   */
  private async testDOMManipulation(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.target || !this.target.context) {
        throw new Error('Target not connected');
      }

      const page = this.target.context.activePage();
      if (!page) {
        throw new Error('No active page');
      }

      // 执行 DOM 操作
      const domResult = await page.sendCDP('Runtime.evaluate', {
        expression: `
          (function() {
            // 获取页面内容
            const h1 = document.querySelector('h1');
            const p = document.querySelector('p');

            return {
              hasH1: !!h1,
              h1Text: h1 ? h1.textContent : null,
              hasP: !!p,
              pText: p ? p.textContent.substring(0, 50) : null,
              bodyChildrenCount: document.body.children.length
            };
          })()
        `,
        returnByValue: true
      });

      const duration = Date.now() - startTime;
      this.recordResult(
        'DOM Manipulation',
        true,
        duration,
        undefined,
        domResult.result.value
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'DOM Manipulation',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 5: 截图功能
   */
  private async testScreenshot(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.target || !this.target.context) {
        throw new Error('Target not connected');
      }

      const page = this.target.context.activePage();
      if (!page) {
        throw new Error('No active page');
      }

      // 截图
      const screenshotResult = await page.sendCDP('Page.captureScreenshot', {
        format: 'png',
        quality: 80
      });

      // 保存截图
      const screenshotPath = join(process.cwd(), 'test-screenshot.png');
      await writeFile(screenshotPath, Buffer.from(screenshotResult.data, 'base64'));

      const duration = Date.now() - startTime;
      this.recordResult(
        'Screenshot Capture',
        true,
        duration,
        undefined,
        {
          savedPath: screenshotPath,
          dataSize: screenshotResult.data.length
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Screenshot Capture',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 6: 页面导航
   */
  private async testNavigation(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.target || !this.target.context) {
        throw new Error('Target not connected');
      }

      const page = this.target.context.activePage();
      if (!page) {
        throw new Error('No active page');
      }

      // 导航到不同页面
      await page.sendCDP('Page.navigate', { url: 'https://example.com/test' });

      // 等待导航完成
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 导航回原页面
      await page.sendCDP('Page.navigate', { url: 'https://example.com' });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const duration = Date.now() - startTime;
      this.recordResult(
        'Page Navigation',
        true,
        duration,
        undefined,
        {
          navigatedPages: 2,
          finalUrl: page.url()
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Page Navigation',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 7: JavaScript 执行
   */
  private async testJavaScriptExecution(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.target || !this.target.context) {
        throw new Error('Target not connected');
      }

      const page = this.target.context.activePage();
      if (!page) {
        throw new Error('No active page');
      }

      // 执行复杂的 JavaScript
      const jsResult = await page.sendCDP('Runtime.evaluate', {
        expression: `
          (function() {
            // 测试对象创建和操作
            const testObj = {
              numbers: [1, 2, 3, 4, 5],
              message: 'Hello from CDP!',
              timestamp: Date.now()
            };

            // 测试 DOM 操作
            const div = document.createElement('div');
            div.id = 'cdp-test-div';
            div.textContent = testObj.message;
            document.body.appendChild(div);

            // 验证操作
            const createdDiv = document.getElementById('cdp-test-div');

            return {
              success: !!createdDiv,
              divText: createdDiv ? createdDiv.textContent : null,
              testObj: testObj
            };
          })()
        `,
        returnByValue: true
      });

      const duration = Date.now() - startTime;
      this.recordResult(
        'JavaScript Execution',
        true,
        duration,
        undefined,
        jsResult.result.value
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'JavaScript Execution',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 8: 断开连接
   */
  private async testDisconnection(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.target) {
        throw new Error('No target to disconnect');
      }

      await this.target.disconnect();

      const duration = Date.now() - startTime;
      this.recordResult(
        'Target Disconnection',
        true,
        duration,
        undefined,
        {
          isConnected: this.target.isConnected(),
          status: this.target.status
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Target Disconnection',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 生成测试报告
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('CDP 连接验证测试报告');
    console.log('='.repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`\n总计: ${total} 个测试`);
    console.log(`通过: ${passed} 个`);
    console.log(`失败: ${failed} 个`);
    console.log(`通过率: ${passRate}%`);

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    console.log(`总耗时: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n失败的测试:');
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    }

    console.log('\n' + '='.repeat(60));
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('开始 CDP 连接验证测试...\n');

    const tests = [
      { name: 'Chrome 运行检查', fn: () => this.testChromeRunning() },
      { name: 'WebUrlTarget 连接', fn: () => this.testWebUrlTargetConnection() },
      { name: 'Stagehand 基本操作', fn: () => this.testStagehandBasicOperations() },
      { name: 'DOM 操作', fn: () => this.testDOMManipulation() },
      { name: '页面导航', fn: () => this.testNavigation() },
      { name: 'JavaScript 执行', fn: () => this.testJavaScriptExecution() },
      { name: '截图功能', fn: () => this.testScreenshot() },
      { name: '断开连接', fn: () => this.testDisconnection() },
    ];

    for (const test of tests) {
      try {
        await test.fn();
      } catch (error) {
        // 测试失败已经在 recordResult 中记录
        // 如果是关键测试失败，停止后续测试
        if (test.name === 'Chrome 运行检查' || test.name === 'WebUrlTarget 连接') {
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
  const verifier = new CDPConnectionVerifier();

  try {
    await verifier.runAllTests();
  } catch (error) {
    console.error('\n测试运行失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
