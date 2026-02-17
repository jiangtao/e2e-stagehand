#!/usr/bin/env tsx
/**
 * Chrome CDP + GLM Stagehand 验证测试
 *
 * 目标：
 * 1. 验证 Chrome CDP 连接正确性
 * 2. 使用 GLM + Stagehand 配置
 * 3. 测试基本的 CDP 操作（导航、截图、DOM 操作）
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { createGLMStagehandConfig, GLMStagehandAdapter } from './src/lib/llm/glm-stagehand-adapter';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

class CDPGLMValidator {
  private results: TestResult[] = [];
  private stagehand: Stagehand | null = null;

  /**
   * 运行单个测试
   */
  private async runTest(
    name: string,
    testFn: () => Promise<void>
  ): Promise<TestResult> {
    const startTime = Date.now();
    console.log(`\n🧪 测试: ${name}`);

    try {
      await testFn();
      const duration = Date.now() - startTime;
      const result: TestResult = {
        name,
        success: true,
        duration,
      };
      this.results.push(result);
      console.log(`✅ 通过 (${duration}ms)`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: TestResult = {
        name,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
      this.results.push(result);
      console.log(`❌ 失败 (${duration}ms):`, error);
      return result;
    }
  }

  /**
   * 测试 1: GLM 适配器创建
   */
  private async testGLMAdapter(): Promise<void> {
    const adapter = new GLMStagehandAdapter('glm-4-flash');

    if (adapter.type !== 'glm') {
      throw new Error('Adapter type should be "glm"');
    }
    if (adapter.modelName !== 'glm-4-flash') {
      throw new Error('Model name mismatch');
    }
    if (!adapter.hasVision) {
      throw new Error('GLM should support vision');
    }

    console.log('  - type:', adapter.type);
    console.log('  - modelName:', adapter.modelName);
    console.log('  - hasVision:', adapter.hasVision);
  }

  /**
   * 测试 2: Stagehand 配置创建
   */
  private async testStagehandConfig(): Promise<void> {
    const config = createGLMStagehandConfig({
      model: 'glm-4-flash',
      instructions: 'You are a test assistant',
    });

    if (!config.llmClient) {
      throw new Error('llmClient not set in config');
    }
    if (config.llmProvider !== 'custom') {
      throw new Error('llmProvider should be "custom"');
    }

    console.log('  - llmProvider:', config.llmProvider);
    console.log('  - llmClient type:', config.llmClient.type);
  }

  /**
   * 测试 3: Stagehand 初始化
   */
  private async testStagehandInit(): Promise<void> {
    const config = createGLMStagehandConfig({
      model: 'glm-4-flash',
    });

    this.stagehand = new Stagehand({
      ...config,
      env: 'LOCAL',
      verbose: 1,
      disableAPI: true,
    });

    await this.stagehand.init();

    if (!this.stagehand.context) {
      throw new Error('Stagehand context not initialized');
    }

    console.log('  - Stagehand initialized successfully');
    console.log('  - Instance ID:', this.stagehand['instanceId']);
  }

  /**
   * 测试 4: 导航到 URL (使用 context.createPage)
   */
  private async testNavigate(): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    const testUrl = 'https://example.com';
    console.log(`  - 导航到: ${testUrl}`);

    // 使用 context.createPage 创建新页面并导航
    const page = await this.stagehand.context.createPage(testUrl);

    if (!page) {
      throw new Error('Failed to create page');
    }

    // 等待导航完成
    await page.waitForLoadState('domcontentloaded');

    const currentUrl = page.url();
    console.log('  - 当前 URL:', currentUrl);
  }

  /**
   * 测试 5: 截图 (使用 context.pages())
   */
  private async testScreenshot(): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    console.log('  - 执行截图...');

    // 获取所有页面
    const pages = this.stagehand.context.pages();
    const activePage = pages[pages.length - 1]; // 获取最新页面

    if (!activePage) {
      throw new Error('No active page');
    }

    const screenshot = await activePage.screenshot({
      type: 'png',
    });

    if (!screenshot || screenshot.length === 0) {
      throw new Error('Screenshot failed - empty buffer');
    }

    console.log(`  - 截图成功 (${screenshot.length} bytes)`);
  }

  /**
   * 测试 6: DOM 操作（获取标题）
   */
  private async testDOMOperation(): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    console.log('  - 获取页面标题...');

    const pages = this.stagehand.context.pages();
    const activePage = pages[pages.length - 1];

    if (!activePage) {
      throw new Error('No active page');
    }

    const title = await activePage.evaluate(() => {
      return document.title;
    });

    if (!title) {
      throw new Error('Failed to get page title');
    }

    console.log('  - 页面标题:', title);
  }

  /**
   * 测试 7: Stagehand observe（AI 观察）
   */
  private async testObserve(): Promise<void> {
    if (!this.stagehand) {
      throw new Error('Stagehand not initialized');
    }

    console.log('  - 使用 AI observe 观察页面...');

    try {
      const observations = await this.stagehand.observe({
        instruction: 'Describe the main elements on this page',
      });

      console.log('  - 观察成功，元素数量:', observations?.length || 0);
    } catch (error) {
      // AI 调用可能失败，记录但不阻止测试
      console.log('  ⚠️ AI observe 跳过 (可能需要 API key)');
    }
  }

  /**
   * 测试 8: 清理
   */
  private async testCleanup(): Promise<void> {
    if (this.stagehand) {
      console.log('  - 关闭 Stagehand...');
      await this.stagehand.close();
      this.stagehand = null;
    }
  }

  /**
   * 运行所有测试
   */
  async runAll(): Promise<void> {
    console.log('🚀 开始 CDP + GLM Stagehand 验证测试\n');
    console.log('=' .repeat(50));

    // 测试组 1: GLM 适配器
    await this.runTest('GLM 适配器创建', () => this.testGLMAdapter());
    await this.runTest('Stagehand 配置创建', () => this.testStagehandConfig());

    // 测试组 2: CDP 连接
    await this.runTest('Stagehand 初始化', () => this.testStagehandInit());
    await this.runTest('导航到 URL', () => this.testNavigate());
    await this.runTest('截图', () => this.testScreenshot());
    await this.runTest('DOM 操作', () => this.testDOMOperation());
    await this.runTest('AI 观察 (可选)', () => this.testObserve());

    // 清理
    await this.runTest('清理资源', () => this.testCleanup());

    // 打印结果
    this.printResults();
  }

  /**
   * 打印测试结果
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果汇总\n');

    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`总计: ${this.results.length} 个测试`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`⏱️ 总耗时: ${totalDuration}ms\n`);

    // 失败的测试详情
    const failedTests = this.results.filter((r) => !r.success);
    if (failedTests.length > 0) {
      console.log('❌ 失败的测试:');
      failedTests.forEach((test) => {
        console.log(`  - ${test.name}: ${test.error}`);
      });
      console.log('');
    }

    // 通过的测试
    console.log('✅ 通过的测试:');
    this.results.filter((r) => r.success).forEach((test) => {
      console.log(`  - ${test.name} (${test.duration}ms)`);
    });

    console.log('\n' + '='.repeat(50));

    if (failed === 0) {
      console.log('🎉 所有测试通过！');
    } else {
      console.log('⚠️ 部分测试失败，请检查错误信息');
    }
  }
}

// 运行测试
async function main() {
  const validator = new CDPGLMValidator();

  try {
    await validator.runAll();
  } catch (error) {
    console.error('💥 测试运行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { CDPGLMValidator };
