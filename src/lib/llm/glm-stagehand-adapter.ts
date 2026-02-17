/**
 * GLM Stagehand LLMClient 适配器
 *
 * 实现符合 Stagehand V3 要求的 LLMClient 接口
 * 支持 GLM (智谱 AI) 模型用于 AI E2E 自动化测试
 */

import {
  generateObject,
  generateText,
  streamText,
  streamObject,
  experimental_generateImage,
  embed,
  embedMany,
  experimental_transcribe,
  experimental_generateSpeech,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

/**
 * GLM 配置接口
 */
export interface GLMStagehandConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  topP?: number;
}

/**
 * GLM Stagehand 适配器
 *
 * 实现 Stagehand 的 LLMClient 抽象类接口
 */
export class GLMStagehandAdapter {
  type: string = 'glm';
  modelName: string;
  hasVision: boolean = true;
  clientOptions: any;
  userProvidedInstructions?: string;

  private config: GLMStagehandConfig;
  private aiProvider: ReturnType<typeof createOpenAI>;

  constructor(modelName: string, userProvidedInstructions?: string) {
    this.modelName = modelName;
    this.userProvidedInstructions = userProvidedInstructions;

    // 从环境变量获取配置
    const apiKey = process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY || '';
    const baseURL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/';

    this.config = {
      apiKey,
      baseURL,
      model: modelName,
      temperature: 0.7,
      topP: 0.9,
    };

    // 创建 AI SDK 提供者（使用 OpenAI 兼容接口）
    this.aiProvider = createOpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
    });

    this.clientOptions = {
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      dangerouslyAllowBrowser: true,
    };
  }

  /**
   * 创建对话完成（带结构化响应）
   */
  async createChatCompletion<T>(options: any & {
    options: {
      response_model: {
        name: string;
        schema: z.ZodTypeAny;
      };
    };
  }): Promise<any> {
    const { messages, options: opts } = options;
    const { response_model } = opts;

    // 使用 AI SDK 的 generateObject 进行结构化输出
    try {
      const result = await generateObject({
        model: this.aiProvider(this.modelName),
        schema: response_model.schema,
        prompt: messages?.[messages.length - 1]?.content,
        temperature: this.config.temperature,
      });

      return {
        data: {
          object: result.object,
          text: JSON.stringify(result.object),
          usage: result.usage,
        },
      } as any;
    } catch (error) {
      console.error('[GLMStagehandAdapter] generateObject error:', error);
      throw error;
    }
  }

  /**
   * 创建对话完成（普通文本响应）
   */
  async createChatCompletion<T = any>(options: any): Promise<T> {
    const { messages } = options;

    try {
      // 提取最后一条消息的内容作为 prompt
      const lastMessage = messages?.[messages.length - 1];
      const prompt = lastMessage?.content || '';

      const result = await generateText({
        model: this.aiProvider(this.modelName),
        prompt: prompt,
        temperature: this.config.temperature,
      });

      return {
        data: {
          text: result.text,
          usage: result.usage,
        },
      } as T;
    } catch (error) {
      console.error('[GLMStagehandAdapter] generateText error:', error);
      throw error;
    }
  }

  /**
   * AI SDK 方法 - generateObject
   */
  generateObject = generateObject;

  /**
   * AI SDK 方法 - generateText
   */
  generateText = generateText;

  /**
   * AI SDK 方法 - streamText
   */
  streamText = streamText;

  /**
   * AI SDK 方法 - streamObject
   */
  streamObject = streamObject;

  /**
   * AI SDK 方法 - generateImage
   */
  generateImage = experimental_generateImage;

  /**
   * AI SDK 方法 - embed
   */
  embed = embed;

  /**
   * AI SDK 方法 - embedMany
   */
  embedMany = embedMany;

  /**
   * AI SDK 方法 - transcribe
   */
  transcribe = experimental_transcribe;

  /**
   * AI SDK 方法 - generateSpeech
   */
  generateSpeech = experimental_generateSpeech;

  /**
   * 获取 LanguageModel (用于 AI SDK)
   */
  getLanguageModel() {
    return this.aiProvider(this.modelName);
  }
}

/**
 * 创建 GLM Stagehand 适配器的工厂函数
 */
export function createGLMStagehandAdapter(
  modelName: string = 'glm-4-flash',
  userProvidedInstructions?: string
): GLMStagehandAdapter {
  return new GLMStagehandAdapter(modelName, userProvidedInstructions);
}

/**
 * 用于 Stagehand V3 的配置助手
 */
export interface GLMStagehandOptions {
  model?: string;
  apiKey?: string;
  baseURL?: string;
  instructions?: string;
}

/**
 * 创建 Stagehand V3 配置的助手函数
 *
 * @example
 * ```ts
 * import { Stagehand } from '@browserbasehq/stagehand';
 * import { createGLMStagehandConfig } from './glm-stagehand-adapter';
 *
 * const stagehand = new Stagehand({
 *   ...createGLMStagehandConfig({
 *     model: 'glm-4-flash',
 *     instructions: '你是一个自动化测试助手',
 *   }),
 *   env: 'local',
 * });
 * ```
 */
export function createGMLStagehandConfig(options: GMLStagehandOptions = {}) {
  const {
    model = 'glm-4.7',
    apiKey = process.env.GML_API_KEY || process.env.ZHIPU_API_KEY,
    baseURL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
    instructions,
  } = options;

  // 设置环境变量供适配器使用
  if (apiKey) {
    process.env.GLM_API_KEY = apiKey;
    process.env.ZHIPU_API_KEY = apiKey;
  }
  if (baseURL) {
    process.env.GLM_BASE_URL = baseURL;
  }

  return {
    model,
    llmClient: new GLMStagehandAdapter(model, instructions),
    llmProvider: 'custom' as const,
  };
}
