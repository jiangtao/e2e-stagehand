import { StagehandConfig } from '@/types';

export interface AppConfig {
  stagehand: StagehandConfig;
  websocket: {
    port: number;
    reconnectInterval: number;
    maxReconnectAttempts: number;
  };
  server: {
    port: number;
    host: string;
  };
  electron: {
    defaultDebugPort: number;
    healthCheckInterval: number;
  };
}

// 默认配置
export const defaultConfig: AppConfig = {
  stagehand: {
    modelProvider: 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    customApiUrl: process.env.CUSTOM_API_URL,
    modelName: process.env.MODEL_NAME || 'gpt-4'
  },
  websocket: {
    port: parseInt(process.env.WS_PORT || '8080'),
    reconnectInterval: 3000,
    maxReconnectAttempts: 5
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || 'localhost'
  },
  electron: {
    defaultDebugPort: 9222,
    healthCheckInterval: 30000
  }
};

// 配置验证函数
export function validateConfig(config: Partial<AppConfig>): string[] {
  const errors: string[] = [];

  if (config.stagehand?.modelProvider === 'openai' && !config.stagehand?.apiKey) {
    errors.push('OpenAI API key is required when using OpenAI provider');
  }

  if (config.stagehand?.modelProvider === 'anthropic' && !config.stagehand?.apiKey) {
    errors.push('Anthropic API key is required when using Anthropic provider');
  }

  if (config.stagehand?.modelProvider === 'custom') {
    if (!config.stagehand?.apiKey) {
      errors.push('API key is required for custom provider');
    }
    if (!config.stagehand?.customApiUrl) {
      errors.push('Custom API URL is required for custom provider');
    }
  }

  if (config.websocket?.port && (config.websocket.port < 1024 || config.websocket.port > 65535)) {
    errors.push('WebSocket port must be between 1024 and 65535');
  }

  if (config.server?.port && (config.server.port < 1024 || config.server.port > 65535)) {
    errors.push('Server port must be between 1024 and 65535');
  }

  return errors;
}

// 获取运行时配置
export function getRuntimeConfig(): AppConfig {
  const config = { ...defaultConfig };

  // 从环境变量覆盖配置
  if (process.env.MODEL_PROVIDER) {
    config.stagehand.modelProvider = process.env.MODEL_PROVIDER as any;
  }

  if (process.env.OPENAI_API_KEY) {
    config.stagehand.apiKey = process.env.OPENAI_API_KEY;
  }

  if (process.env.ANTHROPIC_API_KEY && config.stagehand.modelProvider === 'anthropic') {
    config.stagehand.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  if (process.env.CUSTOM_API_URL) {
    config.stagehand.customApiUrl = process.env.CUSTOM_API_URL;
  }

  if (process.env.MODEL_NAME) {
    config.stagehand.modelName = process.env.MODEL_NAME;
  }

  // 验证配置
  const errors = validateConfig(config);
  if (errors.length > 0) {
    console.warn('⚠️ Configuration warnings:');
    errors.forEach(error => console.warn(`  - ${error}`));
  }

  return config;
}
