/**
 * 基准测试执行器（使用纯 CDP）
 * 不依赖任何 LLM，直接使用 CDP 协议
 */

import type { BenchmarkStep, BenchmarkConfig, BenchmarkResult } from './types';
import { getPureCDPManager } from '../cdp/pure-cdp-manager';

export class BenchmarkExecutor {
  private config: BenchmarkConfig;
  private tabId?: string;
  private manager = getPureCDPManager();
  private results: BenchmarkResult;

  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.results = {
      success: false,
      benchmarkId: config.target.id,
      startTime: new Date(),
      steps: [],
      errors: [],
      metadata: config.metadata,
    };
  }

  /**
   * 执行基准测试
   */
  async execute(): Promise<BenchmarkResult> {
    console.log(`[BenchmarkExecutor] 开始执行: ${this.config.name}`);

    try {
      // 1. 连接到目标（创建新 Tab）
      await this.connectToTarget();

      // 2. 执行所有步骤
      for (const step of this.config.steps) {
        const stepResult = await this.executeStep(step);
        this.results.steps.push(stepResult);

        if (!stepResult.success) {
          throw new Error(`Step ${step.id} failed: ${stepResult.error}`);
        }

        // 步骤之间延迟，模拟人类操作
        await this.sleep(1000 + Math.random() * 2000);
      }

      this.results.success = true;
    } catch (error) {
      this.results.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      this.results.endTime = new Date();
      this.results.duration =
        this.results.endTime.getTime() - this.results.startTime.getTime();

      // 清理资源
      await this.cleanup();
    }

    console.log(`[BenchmarkExecutor] 执行完成:`, this.results);
    return this.results;
  }

  /**
   * 连接到目标（创建新 Tab）
   */
  private async connectToTarget(): Promise<void> {
    const { target } = this.config;

    console.log(`[BenchmarkExecutor] 连接到目标: ${target.url}`);

    // 获取或创建 Tab
    const tab = await this.manager.getTab(target.url, {
      id: target.id,
      name: target.name,
    });

    this.tabId = tab.id;
    console.log(`[BenchmarkExecutor] Tab 已创建: ${tab.id}`);

    // 等待页面加载
    await this.sleep(5000);
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: BenchmarkStep): Promise<{
    id: string;
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }> {
    const startTime = Date.now();
    console.log(`[BenchmarkExecutor] 执行步骤: ${step.name}`);

    try {
      switch (step.type) {
        case 'navigate':
          // 已在 connectToTarget 中处理
          break;

        case 'wait_for_login':
          await this.executeWaitForLogin(step);
          break;

        case 'search':
          await this.executeSearch(step);
          break;

        case 'browse_items':
          await this.executeBrowseItems(step);
          break;

        case 'verify_canvas':
          await this.executeVerifyCanvas(step);
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      return {
        id: step.id,
        name: step.name,
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        id: step.id,
        name: step.name,
        success: false,
        duration: Date.now() - - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 等待用户登录（持续监测）
   */
  private async executeWaitForLogin(step: BenchmarkStep): Promise<void> {
    const { maxWaitTime = 300000, checkInterval = 3000 } = step;

    console.log('[BenchmarkExecutor] 开始监测登录状态...');
    const startTime = Date.now();
    let lastStatus = 'checking';

    while (Date.now() - startTime < maxWaitTime) {
      const isLoggedIn = await this.checkLoginStatus();

      if (isLoggedIn && lastStatus === 'checking') {
        const elapsed = Date.now() - startTime;
        console.log(`[BenchmarkExecutor] ✅ 登录成功！耗时: ${Math.round(elapsed / 1000)}秒`);
        return;
      }

      // 每 10 秒报告一次状态
      const elapsed = Date.now() - startTime;
      const statusReport = Math.floor(elapsed / 10000);

      if (statusReport > lastStatus) {
        console.log(`[BenchmarkExecutor] ⏳ 等待登录中... ${statusReport * 10}秒 / ${Math.round(maxWaitTime / 1000)}秒`);
        lastStatus = statusReport;
      }

      await this.sleep(checkInterval);
    }

    throw new Error('登录超时，请确保已登录');
  }

  /**
   * 执行搜索
   */
  private async executeSearch(step: BenchmarkStep): Promise<void> {
    if (!this.tabId) {
      throw new Error('Tab 未创建');
    }

    console.log(`[BenchmarkExecutor] 搜索: ${step.searchQuery}`);

    // 先滚动到搜索框位置
    await this.manager.executeInTab(this.tabId, {
      type: 'scroll',
      amount: -500, // 向上滚动500px
    });

    await this.sleep(1000);

    // 聚焦搜索框
    const selector = 'input[placeholder*="搜索"], input[type="search"], input[name*="search"]';

    // 输入搜索词
    await this.manager.executeInTab(this.tabId, {
      type: 'type',
      selector: selector,
      text: step.searchQuery,
    });

    await this.sleep(1000);

    // 点击搜索按钮
    await this.manager.executeInTab(this.tabId, {
      type: 'click',
      selector: 'button[type="submit"], button:has-text("搜索"), button:has-text("搜索")',
    });

    await this.sleep(3000);

    console.log('[BenchmarkExecutor] 搜索完成');
  }

  /**
   * 浏览项目列表
   */
  private async executeBrowseItems(step: BenchmarkStep): Promise<void> {
    if (!this.tabId) {
      throw new Error('Tab 未创建');
    }

    const { items = [], maxItems = 10 } = step;
    const itemsToBrowse = items.length > 0 ? items : Array.from({ length: maxItems }, (_, i) => ({ index: i + 1, actions: [] }));

    console.log(`[BenchmarkExecutor] 浏览 ${itemsToBrowse.length} 个项目`);

    for (const item of itemsToBrowse) {
      const { index, actions = [] } = item;
      console.log(`[BenchmarkExecutor] 浏览第 ${index} 个项目`);

      if (actions.length === 0) {
        await this.defaultBrowseAction(index);
      } else {
        for (const action of actions) {
          await this.executeBrowseAction(action);
        }
      }
    }

    console.log('[BenchmarkExecutor] 所有项目浏览完成');
  }

  /**
   * 默认浏览动作
   */
  private async defaultBrowseAction(index: number): Promise<void> {
    console.log(`[BenchmarkExecutor] 默认浏览: 第 ${index} 项`);

    // 1. 点击页面中心区域
    await this.manager.executeInTab(this.tabId, {
      type: 'click',
    });

    // 2. 随机等待 2-5 秒（模拟人类阅读）
    const readWait = Math.floor(Math.random() * 3000) + 2000;
    await this.sleep(readWait);

    // 3. 向下滚动（随机 200-500px）
    const scrollAmount = Math.floor(Math.random() * 300) + 200;
    await this.manager.executeInTab(this.tabId, {
      type: 'scroll',
      amount: scrollAmount,
    });

    // 4. 等待 1-3 秒
    const waitAfterScroll = Math.floor(Math.random() * 2000) + 1000;
    await this.sleep(waitAfterScroll);

    console.log(`[BenchmarkExecutor] 第 ${index} 项浏览完成 (读取${readWait}ms, 滚动${scrollAmount}px, 等待${waitAfterScroll}ms)`);
  }

  /**
   * 执行浏览操作
   */
  private async executeBrowseAction(action: any): Promise<void> {
    switch (action.type) {
      case 'click':
        await this.manager.executeInTab(this.tabId, {
          type: 'click',
        selector: action.selector,
        });
        break;

      case 'scroll':
        await this.manager.executeInTab(this.tabId, {
          type: 'scroll',
          amount: action.amount || 300,
        });
        break;

      case 'check_video':
        console.log('[BenchmarkExecutor] 检查视频流 canvas');
        break;

      default:
        console.warn(`[BenchmarkExecutor] 未知动作: ${action.type}`);
    }

    // 解析等待时间
    let waitTime = action.wait || 1000;
    if (typeof waitTime === 'string' && waitTime.startsWith('random:')) {
      const [min, max] = waitTime.replace('random:', '').split(',').map(Number);
      waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    await this.sleep(waitTime);
  }

  /**
   * 验证 Canvas 展示
   */
  private async executeVerifyCanvas(step: BenchmarkStep): Promise<void> {
    console.log('[BenchmarkExecutor] 验证 Canvas 展示');
    // TODO: 实现 canvas 验证逻辑
    await this.sleep(2000);
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    console.log('[BenchmarkExecutor] 清理资源...');

    if (this.tabId) {
      this.manager.releaseTab(this.tabId);
      this.tabId = undefined;
    }

    console.log('[BenchmarkExecutor] 清理完成');
  }

  /**
   * 工具方法：睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
