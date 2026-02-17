/**
 * GLM Stagehand 适配器
 *
 * 提供便捷的方式创建使用 GLM 模型的 Stagehand 实例
 */

import { Stagehand } from '@browserbasehq/stagehand';
import { createGLMClient, type GLMConfig } from '@/lib/llm/glm-client';

/**
 * GLM Stagehand 配置选项
 */
export interface GLMStagehandOptions {
  /**
   * GLM API 配置
   */
  glm?: GLMConfig;

  /**
   * Stagehand 环境（LOCAL 或 BROWSERBASE）
   */
  env?: 'LOCAL' | 'BROWSERBASE';

  /**
   * 日志详细程度
   */
  verbose?: 0 | 1 | 2;

  /**
   * 是否禁用 API（使用本地 CDP）
   */
  disableAPI?: boolean;

  /**
   * 系统 Prompt
   */
  systemPrompt?: string;

  /**
   * act 操作超时时间（毫秒）
   */
  actTimeoutMs?: number;

  /**
   * DOM 稳定超时时间（毫秒）
   */
  domSettleTimeout?: number;

  /**
   * 本地浏览器启动选项
   */
  localBrowserLaunchOptions?: {
    headless?: boolean;
    cdpUrl?: string;
    port?: number;
    userDataDir?: string;
  };
}

/**
 * 创建使用 GLM 的 Stagehand 实例
 *
 * @example
 * ```typescript
 * const stagehand = await createGLMStagehand({
 *   glm: {
 *     apiKey: process.env.GLM_API_KEY,
 *     model: 'glm-4-flash',
 *   },
 *   env: 'LOCAL',
 * });
 *
 * await stagehand.act('点击搜索按钮');
 * ```
 */
export async function createGLMStagehand(
  options: GLMStagehandOptions = {}
): Promise<Stagehand> {
  const {
    glm,
    env = 'LOCAL',
    verbose = 0,
    disableAPI = true,
    systemPrompt,
    actTimeoutMs,
    domSettleTimeout,
    localBrowserLaunchOptions,
  } = options;

  // 创建 GLM LLM Client
  const glmConfig: GLMConfig = {
    apiKey: glm?.apiKey || process.env.GLM_API_KEY || '',
    baseURL: glm?.baseURL || process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
    model: glm?.model || 'glm-4-flash',
    temperature: glm?.temperature,
    topP: glm?.topP,
  };

  const llmClient = createGLMClient(glmConfig);

  // 创建 Stagehand 实例
  const stagehand = new Stagehand({
    env,
    llmClient: llmClient as any,  // 类型断言，GLMClient 符合 LLMClient 接口
    disableAPI,
    verbose,
    systemPrompt,
    actTimeoutMs,
    domSettleTimeout,
    localBrowserLaunchOptions,
  });

  // 初始化 Stagehand
  await stagehand.init();

  console.log('[GLMStagehand] 已初始化 GLM Stagehand 实例');
  console.log('  - 模型:', glmConfig.model);
  console.log('  - API:', glmConfig.baseURL);
  console.log('  - 环境:', env);

  return stagehand;
}

/**
 * GLM Stagehand 便捷类
 *
 * 提供更简洁的 API 来管理 Stagehand 生命周期
 */
export class GLMStagehandAdapter {
  private stagehand: Stagehand | null = null;
  private options: GLMStagehandOptions;

  constructor(options: GLMStagehandOptions = {}) {
    this.options = options;
  }

  /**
   * 初始化 Stagehand
   */
  async init(): Promise<void> {
    if (this.stagehand) {
      console.warn('[GLMStagehandAdapter] 已经初始化，跳过');
      return;
    }

    this.stagehand = await createGLMStagehand(this.options);
  }

  /**
   * 执行操作
   */
  async act(instruction: string, options?: any): Promise<any> {
    if (!this.stagehand) {
      throw new Error('GLMStagehandAdapter 未初始化，请先调用 init()');
    }

    return this.stagehand.act(instruction, options);
  }

  /**
   * 观察页面
   */
  async observe(instruction?: string, options?: any): Promise<any[]> {
    if (!this.stagehand) {
      throw new Error('GLMStagehandAdapter 未初始化，请先调用 init()');
    }

    return this.stagehand.observe(instruction, options);
  }

  /**
   * 提取数据
   */
  async extract(
    instruction?: string,
    schema?: any,
    options?: any
  ): Promise<any> {
    if (!this.stagehand) {
      throw new Error('GLMStagehandAdapter 未初始化，请先调用 init()');
    }

    return this.stagehand.extract(instruction, schema, options);
  }

  /**
   * 导航到 URL
   */
  async goto(url: string, options?: any): Promise<any> {
    if (!this.stagehand) {
      throw new Error('GLMStagehandAdapter 未初始化，请先调用 init()');
    }

    const page = this.stagehand.context.activePage();
    return page.goto(url, options);
  }

  /**
   * 获取 Stagehand 实例
   */
  getStagehand(): Stagehand {
    if (!this.stagehand) {
      throw new Error('GLMStagehandAdapter 未初始化，请先调用 init()');
    }

    return this.stagehand;
  }

  /**
   * 关闭 Stagehand
   */
  async close(): Promise<void> {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }
  }
}

/**
 * 导出便捷工厂函数
 */
export function createGLMStagehandAdapter(
  options?: GLMStagehandOptions
): GLMStagehandAdapter {
  return new GLMStagehandAdapter(options);
}
