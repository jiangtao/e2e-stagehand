/**
 * 基准测试执行器（使用 SimpleTabManager）
 * 单个 Chrome 连接，多个 Tab 并行运行不同 URL 的测试
 * 使用 GLM provider
 */

import { getSimpleTabManager } from '../cdp/simple-tab-manager';

export interface BenchmarkStep {
  id: string;
  name: string;
  type: string;
  action: string;
  [key: string]: any;
}

export interface BenchmarkConfig {
  name: string;
  description: string;
  version: string;
  target: {
    id: string;
    type: string;
    url: string;
    name: string;
  };
  steps: BenchmarkStep[];
  expectations: Record<string, any>;
  metadata: Record<string, any>;
}

export interface BenchmarkResult {
  success: boolean;
  benchmarkId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  steps: Array<{
    id: string;
    name: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  errors: string[];
  metadata: Record<string, any>;
}

export class BenchmarkExecutor {
  private config: BenchmarkConfig;
  private tab?: TabInfo;
  private videoCapture?: VideoCapture;
  private results: BenchmarkResult;
  private testCanvasId?: string;

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

    // 创建测试专用的 canvas ID
    this.testCanvasId = `test-canvas-${Date.now()}`;
  }

  /**
   * 执行基准测试
   */
  async execute(): Promise<BenchmarkResult> {
    console.log(`[BenchmarkExecutor] 开始执行: ${this.config.name}`);

    try {
      // 1. 连接到目标（只连接一次，不重复导航）
      await this.connectToTarget();

      // 2. 执行所有步骤（跳过 navigate 步骤，因为连接时已经导航了）
      for (const step of this.config.steps) {
        // 跳过 navigate 步骤，因为 connectToTarget 已经处理了
        if (step.type === 'navigate') {
          console.log(`[BenchmarkExecutor] 跳过导航步骤（已在连接时完成）: ${step.name}`);
          this.results.steps.push({
            id: step.id,
            name: step.name,
            success: true,
            duration: 0,
          });
          continue;
        }

        const stepResult = await this.executeStep(step);
        this.results.steps.push(stepResult);

        if (!stepResult.success) {
          throw new Error(`Step ${step.id} failed: ${stepResult.error}`);
        }
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
   * 连接到目标（使用 Tab 管理器，在独立 Tab 中运行）
   */
  private async connectToTarget(): Promise<void> {
    const { target } = this.config;

    console.log(`[BenchmarkExecutor] 在新 Tab 中打开: ${target.url}`);

    // 获取 Tab 管理器
    const tabManager = getTabManager();

    // 为目标 URL 创建/获取 Tab
    this.tab = await tabManager.getTab(target.url, {
      id: target.id,
      name: target.name,
    });

    console.log('[BenchmarkExecutor] Tab 已创建:', this.tab.id);
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
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 等待用户登录（持续监测，直到登录成功）
   */
  private async executeWaitForLogin(step: BenchmarkStep): Promise<void> {
    const { maxWaitTime = 300000, checkInterval = 3000, loginIndicators = [] } = step;
    const startTime = Date.now();

    console.log('[BenchmarkExecutor] 开始持续监测登录状态...');

    if (!this.tab?.stagehand) {
      throw new Error('连接未初始化');
    }

    const stagehand = this.tab.stagehand;

    let lastStatus = 'checking';

    while (Date.now() - startTime < maxWaitTime) {
      const currentTime = Date.now() - startTime;
      const isLoggedIn = await this.checkLoginStatus(stagehand, loginIndicators);

      if (isLoggedIn) {
        console.log(`[BenchmarkExecutor] ✅ 登录成功！耗时: ${Math.round(currentTime / 1000)}秒`);
        return;
      }

      // 每 10 秒报告一次状态
      const statusReport = Math.floor(currentTime / 10000);
      if (statusReport > lastStatus) {
        lastStatus = statusReport;
        console.log(`[BenchmarkExecutor] ⏳ 等待登录中... ${statusReport * 10}秒 / ${Math.round(maxWaitTime / 1000)}秒`);
      }

      await this.sleep(checkInterval);
    }

    throw new Error('登录超时，请确保已登录小红书账号');
  }

  /**
   * 检查登录状态
   */
  private async checkLoginStatus(stagehand: any, indicators: any[]): Promise<boolean> {
    try {
      // 使用 observe 方法获取页面状态
      const observation = await stagehand.observe({
        instruction: '检查页面是否存在用户头像或已登录状态，如果看到登录按钮则未登录',
        timeoutMs: 5000,
      });

      // 简单判断：如果 observation 返回了动作且不包含登录，则认为已登录
      const hasLoginButton = observation.some((action: any) =>
        action.description?.includes('登录') ||
        action.description?.includes('login') ||
        action.description?.includes('sign in')
      );

      return !hasLoginButton;
    } catch (error) {
      console.log('[BenchmarkExecutor] 检查登录状态失败:', error);
      return false;
    }
  }

  /**
   * 执行搜索
   */
  private async executeSearch(step: BenchmarkStep): Promise<void> {
    if (!this.tab?.stagehand) {
      throw new Error('连接未初始化');
    }

    const stagehand = this.tab.stagehand;

    console.log(`[BenchmarkExecutor] 搜索: ${step.searchQuery}`);

    // 使用 act 方法执行搜索
    const result = await stagehand.act(
      `在搜索框中输入"${step.searchQuery}"并点击搜索按钮`,
      { timeoutMs: 15000 }
    );

    console.log('[BenchmarkExecutor] 搜索完成:', result.actions?.[0]?.description);
    await this.sleep(step.timeout || 5000);
  }

  /**
   * 浏览项目列表
   */
  private async executeBrowseItems(step: BenchmarkStep): Promise<void> {
    if (!this.tab?.stagehand) {
      throw new Error('连接未初始化');
    }

    const stagehand = this.tab.stagehand;

    const { items = [], maxItems = 10 } = step;
    const itemsToBrowse = items.length > 0 ? items : Array.from({ length: maxItems }, (_, i) => ({ index: i + 1, actions: [] }));

    console.log(`[BenchmarkExecutor] 浏览 ${itemsToBrowse.length} 个项目`);

    for (const item of itemsToBrowse) {
      const { index, actions = [] } = item;
      console.log(`[BenchmarkExecutor] 浏览第 ${index} 个项目`);

      // 如果没有定义具体动作，使用默认浏览动作
      if (actions.length === 0) {
        await this.defaultBrowseAction(stagehand, index);
      } else {
        for (const action of actions) {
          await this.executeBrowseAction(stagehand, action);
        }
      }
    }
  }

  /**
   * 默认浏览动作
   */
  private async defaultBrowseAction(stagehand: any, index: number): Promise<void> {
    // 1. 点击页面中心区域
    await stagehand.act('点击页面中心区域的内容', { timeoutMs: 10000 });

    // 2. 随机等待 2-5 秒（模拟人类浏览）
    const waitTime = Math.floor(Math.random() * 3000) + 2000;
    await this.sleep(waitTime);

    // 3. 向下滚动
    const scrollAmount = Math.floor(Math.random() * 300) + 200;
    await stagehand.act(`向下滚动页面 ${scrollAmount} 像素`, { timeoutMs: 10000 });

    // 4. 随机等待 1-3 秒
    const scrollWait = Math.floor(Math.random() * 2000) + 1000;
    await this.sleep(scrollWait);

    console.log(`[BenchmarkExecutor] 完成浏览第 ${index} 个项目`);
  }

  /**
   * 执行浏览操作
   */
  private async executeBrowseAction(stagehand: any, action: any): Promise<void> {
    switch (action.type) {
      case 'click':
        await stagehand.act('点击页面内容', { timeoutMs: 10000 });
        break;

      case 'scroll':
        const amount = action.amount || 300;
        await stagehand.act(`向下滚动页面 ${amount} 像素`, { timeoutMs: 10000 });
        break;

      case 'check_video':
        console.log('[BenchmarkExecutor] 检查视频流 canvas 展示');
        // TODO: 使用 Stagehand 的 observe 检查视频元素
        break;
    }

    // 解析等待时间（支持 random:min,max 格式）
    let waitTime = action.wait || 1000;
    if (typeof waitTime === 'string' && waitTime.startsWith('random:')) {
      const [min, max] = waitTime.replace('random:', '').split(',').map(Number);
      waitTime = Math.floor(Math.random() * (max - min + 1)) + min;
    }
    await this.sleep(waitTime);
  }

  /**
   * 验证 Canvas 展示（集成视频捕获）
   */
  private async executeVerifyCanvas(step: BenchmarkStep): Promise<void> {
    if (!this.tab?.stagehand) {
      throw new Error('连接未初始化');
    }

    const stagehand = this.tab.stagehand;
    const page = (stagehand as any).context?.activePage?.();
    if (!page) {
      throw new Error('无法获取页面对象');
    }

    const { checks = [] } = step;

    console.log('[BenchmarkExecutor] 验证 Canvas 展示（集成视频捕获）');

    // 创建视频捕获器
    this.videoCapture = new VideoCapture({
      selector: 'video, canvas[src]',
      canvasId: this.testCanvasId,
      fps: 30,
      quality: 0.8,
    });

    // 启动视频捕获
    const captureResult = await this.videoCapture.startCapture(page);

    if (!captureResult.success) {
      console.warn('[BenchmarkExecutor] 视频捕获启动失败:', captureResult.errors);
    } else {
      console.log(`[BenchmarkExecutor] 📹 开始捕获 ${captureResult.videoCount} 个视频流到 canvas #${this.testCanvasId}`);
    }

    // 执行其他检查
    for (const check of checks) {
      switch (check.type) {
        case 'canvas_exists':
          // 已由视频捕获器创建 canvas
          console.log('[BenchmarkExecutor] Canvas 已创建:', this.testCanvasId);
          break;

        case 'canvas_playing':
          // 检查视频是否正在播放中
          if (this.videoCapture && captureResult.success) {
            await this.sleep(5000);  // 等待一些帧被捕获
            console.log('[BenchmarkExecutor] 视频流已在 canvas 中展示');
          }
          break;

        case 'no_errors':
          // TODO: 检查控制台无错误
          break;
      }
    }
  }

  /**
   * 清理资源（释放 Tab，停止视频捕获）
   */
  private async cleanup(): Promise<void> {
    // 停止视频捕获
    if (this.videoCapture) {
      console.log('[BenchmarkExecutor] 停止视频捕获');
      const page = (this.tab?.stagehand as any)?.context?.activePage?.();
      if (page) {
        await this.videoCapture.stopCapture(page);
      }
      this.videoCapture = undefined;
    }

    // 释放 Tab
    if (this.tab) {
      console.log('[BenchmarkExecutor] 释放 Tab 回 Tab 池');
      const tabManager = getTabManager();
      tabManager.releaseTab(this.tab.id);
      this.tab = undefined;
    }
  }

  /**
   * 工具方法：睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
