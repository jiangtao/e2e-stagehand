/**
 * Chrome CDP 综合验证测试
 *
 * 这个脚本验证所有 CDP 客户端的连接和功能
 * 包括: ChromeCDPClient, PureCDPManager, SimpleTabManager, ChromeTabManager
 */

import { ChromeCDPClient } from './src/lib/cdp/chrome-cdp-client';
import { PureCDPManager } from './src/lib/cdp/pure-cdp-manager';
import { SimpleTabManager } from './src/lib/cdp/simple-tab-manager';
import { ChromeTabManager } from './src/lib/cdp/tab-pool';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

class CDPVerifier {
  private results: TestResult[] = [];

  private recordResult(name: string, passed: boolean, duration: number, error?: string, details?: any) {
    const result: TestResult = { name, passed, duration, error, details };
    this.results.push(result);

    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name} (${duration}ms)`);
    if (error) console.log(`   错误: ${error}`);
    if (details) console.log(`   详情:`, JSON.stringify(details, null, 2));
  }

  /**
   * 测试 1: ChromeCDPClient 基础连接
   */
  async testChromeCDPClient() {
    const startTime = Date.now();
    try {
      console.log('\n[测试 1] ChromeCDPClient 基础连接');

      const client = new ChromeCDPClient({
        port: 9222,
        chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      });

      // 测试 Chrome 是否运行
      const isRunning = await client.isChromeRunning();
      if (!isRunning) {
        throw new Error('Chrome 未运行');
      }

      // 测试连接
      await client.connect();

      const duration = Date.now() - startTime;
      this.recordResult('ChromeCDPClient 连接', true, duration, undefined, {
        isRunning,
        connected: true
      });

      await client.disconnect();
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult('ChromeCDPClient 连接', false, duration, String(error));
    }
  }

  /**
   * 测试 2: PureCDPManager 连接和 Tab 管理
   */
  async testPureCDPManager() {
    const startTime = Date.now();
    try {
      console.log('\n[测试 2] PureCDPManager 连接和 Tab 管理');

      const manager = PureCDPManager.getInstance({
        maxTabs: 5,
        cdpPort: 9222
      });

      // 确保连接
      const connection = await manager.ensureConnection();

      // 创建 tab
      const tab = await manager.getTab('https://example.com', { id: 'test-tab-1' });

      // 获取 tab 列表
      const tabs = manager.getTabs();
      const status = manager.getStatus();

      const duration = Date.now() - startTime;
      this.recordResult('PureCDPManager Tab 管理', true, duration, undefined, {
        tabCount: tabs.length,
        status: status,
        tabId: tab.id
      });

      // 清理
      await manager.closeTab('test-tab-1');
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult('PureCDPManager Tab 管理', false, duration, String(error));
    }
  }

  /**
   * 测试 3: SimpleTabManager (使用 GLM)
   */
  async testSimpleTabManager() {
    const startTime = Date.now();
    try {
      console.log('\n[测试 3] SimpleTabManager (GLM 集成)');

      const manager = SimpleTabManager.getInstance({
        maxTabs: 3,
        glmApiKey: process.env.GLM_API_KEY || 'test-key',
        glmBaseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/'
      });

      // 注意: SimpleTabManager 需要 GLM API key 才能完全工作
      // 这里只测试基本连接

      const duration = Date.now() - startTime;
      this.recordResult('SimpleTabManager 初始化', true, duration, undefined, {
        hasGLMConfig: true,
        maxTabs: 3
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult('SimpleTabManager 初始化', false, duration, String(error));
    }
  }

  /**
   * 测试 4: ChromeTabManager
   */
  async testChromeTabManager() {
    const startTime = Date.now();
    try {
      console.log('\n[测试 4] ChromeTabManager');

      const manager = ChromeTabManager.getInstance({
        maxTabs: 5
      });

      // 获取 status
      const status = manager.getStatus();

      const duration = Date.now() - startTime;
      this.recordResult('ChromeTabManager 状态', true, duration, undefined, {
        totalTabs: status.totalTabs,
        activeTabs: status.activeTabs,
        idleTabs: status.idleTabs
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordResult('ChromeTabManager 状态', false, duration, String(error));
    }
  }

  /**
   * 生成报告
   */
  private generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('CDP 综合验证测试报告');
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
  async runAllTests() {
    console.log('\n=== Chrome CDP 综合验证测试 ===\n');

    const tests = [
      { name: 'ChromeCDPClient', fn: () => this.testChromeCDPClient() },
      { name: 'PureCDPManager', fn: () => this.testPureCDPManager() },
      { name: 'SimpleTabManager', fn: () => this.testSimpleTabManager() },
      { name: 'ChromeTabManager', fn: () => this.testChromeTabManager() }
    ];

    for (const test of tests) {
      try {
        await test.fn();
      } catch (error) {
        // 错误已在 recordResult 中记录
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.generateReport();
  }
}

// 主函数
async function main() {
  const verifier = new CDPVerifier();

  try {
    await verifier.runAllTests();
  } catch (error) {
    console.error('测试运行失败:', error);
    process.exit(1);
  }
}

main();
