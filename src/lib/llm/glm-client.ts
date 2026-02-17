/**
 * GLM (智谱 AI) 客户端
 * 完整实现 Stagehand LLMClient 接口
 */

import OpenAI from 'openai';
import type { ChatCompletion } from 'openai/resources/chat/completions';
import type { ClientOptions } from '@anthropic-ai/sdk';

/**
 * GLM API 配置
 */
export interface GLMConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  temperature?: number;
  topP?: number;
}

/**
 * GLM LLM Client - 完整实现 Stagehand LLMClient 接口
 *
 * 使用 OpenAI SDK 连接 GLM API（GLM 兼容 OpenAI 接口）
 */
export class GLMLLMClient {
  type = 'glm' as const;
  modelName: string;
  hasVision = true;  // GLM-4-flash 支持视觉
  clientOptions: any;
  userProvidedInstructions?: string;

  private client: OpenAI;
  private config: GLMConfig;

  constructor(config: GLMConfig) {
    this.config = config;
    this.modelName = config.model || 'glm-4-flash';

    // 创建 OpenAI 客户端实例，指向 GLM API
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4/',
    });

    this.clientOptions = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4/',
    };
  }

  /**
   * Stagehand LLMClient 核心方法：创建聊天完成
   */
  async createChatCompletion(
    options: any
  ): Promise<ChatCompletion> {
    const { options: chatOptions, retries, logger } = options;

    const maxRetries = retries ?? 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.modelName,
          messages: chatOptions.messages as any,
          temperature: this.config.temperature ?? 0.7,
          top_p: this.config.topP,
          stream: false,
          // GLM 兼容 OpenAI 的 response_format
          ...(chatOptions.response_model?.schema && {
            response_format: { type: 'json_object' },
          }),
        });

        logger?.({
          category: 'glm',
          message: `GLM request completed: ${response.usage?.total_tokens || 0} tokens`,
          level: 0,
        });

        return response as ChatCompletion;
      } catch (error) {
        const isLastAttempt = attempt === maxRetries;

        if (!isLastAttempt && this.isRetryableError(error)) {
          logger?.({
            category: 'glm',
            message: `GLM request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`,
            level: 1,
          });

          // 指数退避
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }

        logger?.({
          category: 'glm',
          message: `GLM request failed: ${error}`,
          level: 0,
        });

        throw error;
      }
    }

    throw new Error('GLM request failed after retries');
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: any): boolean {
    if (error?.status) {
      // 429 Rate Limit, 500 Server Error, 503 Service Unavailable
      return [429, 500, 502, 503, 504].includes(error.status);
    }
    return false;
  }

  /**
   * 睡眠工具
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建 GLM LLM Client 的工厂函数
 */
export function createGLMClient(config: GLMConfig): GLMLLMClient {
  return new GLMLLMClient(config);
}

/**
 * 便捷函数：创建用于 Stagehand 的 GLM LLMClient
 */
export function createStagehandGLMClient(
  apiKey?: string,
  baseURL?: string,
  model?: string
): GLMLLMClient {
  return createGLMClient({
    apiKey: apiKey || process.env.GLM_API_KEY || '',
    baseURL: baseURL || process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
    model: model || 'glm-4-flash',
  });
}

/**
 * 导出旧名称以保持向后兼容
 * @deprecated 使用 createGLMClient 或 createStagehandGLMClient
 */
export function createGLMClientLegacy(config: GLMConfig) {
  console.warn('createGLMClientLegacy is deprecated, use createGLMClient instead');
  return createGLMClient(config);
}

// 重新导出类型
export type { GLMConfig };
