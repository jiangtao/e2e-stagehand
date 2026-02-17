/**
 * Stagehand CDP 集成测试
 *
 * 测试 Stagehand 与 Chrome CDP 的集成
 * 验证 Stagehand 推荐的 CDP 配置方式
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { writeFile } from 'fs/promises';
import { join } from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class StagehandCDPTest {
  private results: TestResult[] = [];
  private stagehand: Stagehand | null = null;

  /**
   * 记录测试结果
   */
  private recordResult(name: string, passed: boolean, duration: number, error?: string, details?: any): void {
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
   * 测试 1: Stagehand 初始化（LOCAL 模式）
   */
  async testStagehandInit(): Promise<void> {
    const startTime = Date.now();
    try {
      console.log('正在初始化 Stagehand...');
      this.stagehand = new Stagehand({
        env: 'LOCAL',
        verbose: 1, // 启用详细日志
      });

      await this.stagehand.init();
      const duration = Date.now() - startTime;

      // 验证 context 是否存在
      if (!this.stagehand.context) {
        throw new Error('Stagehand context 未初始化');
      }

      this.recordResult(
        'Stagehand 初始化',
        true,
        duration,
        undefined,
        {
          hasContext: !!this.stagehand.context,
          contextType: typeof this.stagehand.context
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Stagehand 初始化',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  /**
   * 测试 2: 创建新页面
   */
  async testCreatePage(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();
      const duration = Date.now() - startTime;

      this.recordResult(
        '创建新页面',
        true,
        duration,
        undefined,
        {
          pageId: page.id(),
          pageUrl: page.url()
        }
      );

      // 关闭测试页面
      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '创建新页面',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 3: 页面导航
   */
  async testPageNavigation(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();

      // 导航到 example.com
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');

      const duration = Date.now() - startTime;

      this.recordResult(
        '页面导航',
        true,
        duration,
        undefined,
        {
          url: page.url(),
          title: await page.title()
        }
      );

      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '页面导航',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 4: CDP 命令执行
   */
  async testCDPCommand(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');

      // 执行 CDP 命令获取页面布局
      const layoutResult = await page.sendCDP('Page.getLayoutMetrics');

      // 执行 Runtime.evaluate
      const evaluateResult = await page.sendCDP('Runtime.evaluate', {
        expression: 'document.title',
        returnByValue: true
      });

      const duration = Date.now() - startTime;

      this.recordResult(
        'CDP 命令执行',
        true,
        duration,
        undefined,
        {
          layoutMetrics: {
            contentWidth: layoutResult.contentWidth,
            contentHeight: layoutResult.contentHeight
          },
          pageTitle: evaluateResult.result.value
        }
      );

      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'CDP 命令执行',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 5: 截图功能
   */
  async testScreenshot(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');

      // 截图
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      });

      // 保存截图
      const screenshotPath = join(process.cwd(), 'stagehand-screenshot.png');
      await writeFile(screenshotPath, screenshot);

      const duration = Date.now() - startTime;

      this.recordResult(
        '截图功能',
        true,
        duration,
        undefined,
        {
          savedPath: screenshotPath,
          dataSize: screenshot.length,
          format: 'PNG'
        }
      );

      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '截图功能',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 6: DOM 操作
   */
  async testDOMOperations(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');

      // 执行 DOM 操作
      const domResult = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const p = document.querySelector('p');
        const anchors = document.querySelectorAll('a');

        return {
          hasH1: !!h1,
          h1Text: h1 ? h1.textContent : null,
          hasP: !!p,
          pText: p ? p.textContent?.substring(0, 50) : null,
          anchorCount: anchors.length
        };
      });

      const duration = Date.now() - startTime;

      this.recordResult(
        'DOM 操作',
        true,
        duration,
        undefined,
        domResult
      );

      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'DOM 操作',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 7: Stagehand observe 方法
   */
  async testStagehandObserve(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');

      // 使用 Stagehand 的 observe 方法
      const observations = await this.stagehand.observe({
        instruction: 'Describe the main content of this page'
      });

      const duration = Date.now() - startTime;

      this.recordResult(
        'Stagehand Observe',
        true,
        duration,
        undefined,
        {
          observationCount: observations.length,
          firstObservation: observations[0]
        }
      );

      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Stagehand Observe',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 8: Stagehand act 方法
   */
  async testStagehandAct(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      const page = await this.stagehand.context.newPage();
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');

      // 使用 Stagehand 的 act 方法
      const actionResult = await this.stagehand.act({
        action: 'Click on the "More information" link'
      });

      const duration = Date.now() - startTime;

      this.recordResult(
        'Stagehand Act',
        true,
        duration,
        undefined,
        {
          action: actionResult.action,
          success: actionResult.success
        }
      );

      await page.close();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        'Stagehand Act',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 9: 多页面管理
   */
  async testMultiplePages(): Promise<void> {
    const startTime = Date.now();
    try {
      if (!this.stagehand || !this.stagehand.context) {
        throw new Error('Stagehand 未初始化');
      }

      // 创建多个页面
      const pages = await Promise.all([
        this.stagehand.context.newPage(),
        this.stagehand.context.newPage(),
        this.stagehand.context.newPage()
      ]);

      // 在每个页面上导航
      await Promise.all([
        pages[0].goto('https://example.com'),
        pages[1].goto('https://example.org'),
        pages[2].goto('https://example.net')
      ]);

      await Promise.all([
        pages[0].waitForLoadState('networkidle'),
        pages[1].waitForLoadState('networkidle'),
        pages[2].waitForLoadState('networkidle')
      ]);

      // 获取页面信息
      const pageInfos = await Promise.all(
        pages.map(async (page) => ({
          url: page.url(),
          title: await page.title()
        }))
      );

      const duration = Date.now() - startTime;

      this.recordResult(
        '多页面管理',
        true,
        duration,
        undefined,
        {
          pageCount: pages.length,
          pages: pageInfos
        }
      );

      // 关闭所有页面
      await Promise.all(pages.map(page => page.close()));
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '多页面管理',
        false,
        duration,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 测试 10: 清理和关闭
   */
  async testCleanup(): Promise<void> {
    const startTime = Date.now();
    try {
      if (this.stagehand) {
        await this.stagehand.close();
        this.stagehand = null;
      }

      const duration = Date.now() - startTime;

      this.recordResult(
        '清理和关闭',
        true,
        duration,
        undefined,
        {
          stagehandClosed: true
        }
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult(
        '清理和关闭',
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
    console.log('Stagehand CDP 集成测试报告');
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
    console.log('\n=== Stagehand CDP 集成测试 ===\n');

    const tests = [
      { name: 'Stagehand 初始化', fn: () => this.testStagehandInit() },
      { name: '创建新页面', fn: () => this.testCreatePage() },
      { name: '页面导航', fn: () => this.testPageNavigation() },
      { name: 'CDP 命令执行', fn: () => this.testCDPCommand() },
      { name: 'DOM 操作', fn: () => this.testDOMOperations() },
      { name: '截图功能', fn: () => this.testScreenshot() },
      { name: '多页面管理', fn: () => this.testMultiplePages() },
      // 注意: observe 和 act 需要 API key，跳过
      // { name: 'Stagehand Observe', fn: () => this.testStagehandObserve() },
      // { name: 'Stagehand Act', fn: () => this.testStagehandAct() },
      { name: '清理和关闭', fn: () => this.testCleanup() },
    ];

    for (const test of tests) {
      try {
        await test.fn();
      } catch (error) {
        // 测试失败已经在 recordResult 中记录
        // 如果是关键测试失败，停止后续测试
        if (test.name === 'Stagehand 初始化') {
          console.log(`\n关键测试失败，停止后续测试`);
          break;
        }
      }

      // 测试之间稍作等待
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.generateReport();
  }
}

// 主函数
async function main() {
  const tester = new StagehandCDPTest();

  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('\n测试运行失败:', error);
    process.exit(1);
  }
}

// 运行测试
main();
