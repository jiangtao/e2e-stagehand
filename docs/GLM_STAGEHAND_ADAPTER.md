# GLM Stagehand 适配器使用指南

## 概述

本项目实现了完整的 GLM（智谱 AI）模型适配器，可用于 Stagehand 浏览器自动化框架。

## 核心组件

### 1. GLM LLM Client (`/src/lib/llm/glm-client.ts`)

完整实现 Stagehand 的 LLMClient 接口，提供：

- `type = 'glm'`: 客户端类型标识
- `modelName`: 模型名称（默认: glm-4-flash）
- `hasVision = true`: 支持视觉能力
- `createChatCompletion()`: 核心聊天完成方法
- 自动重试机制（指数退避）
- 日志记录支持

### 2. GLM Stagehand 适配器 (`/src/lib/stagehand/glm-adapter.ts`)

提供便捷的工厂函数和适配器类：

```typescript
// 方式 1: 使用工厂函数
const stagehand = await createGLMStagehand({
  glm: {
    apiKey: process.env.GLM_API_KEY,
    model: 'glm-4-flash',
  },
  env: 'LOCAL',
});

// 方式 2: 使用适配器类
const adapter = new GLMStagehandAdapter({
  glm: {
    apiKey: process.env.GLM_API_KEY,
    model: 'glm-4-flash',
  },
});
await adapter.init();
```

## 使用方式

### 环境变量配置

```bash
# .env.local
GLM_API_KEY=your_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash

# CDP 配置（本地 Chrome）
CDP_URL=http://localhost:9222
```

### 基本用法

```typescript
import { createGLMStagehand } from '@/lib/stagehand/glm-adapter';

// 创建 Stagehand 实例
const stagehand = await createGLMStagehand({
  glm: {
    apiKey: process.env.GLM_API_KEY,
    baseURL: process.env.GLM_BASE_URL,
    model: 'glm-4-flash',
  },
  env: 'LOCAL',
  verbose: 1,
});

// 导航到页面
const page = stagehand.context.activePage();
await page.goto('https://example.com');

// 执行操作
const result = await stagehand.act('点击搜索按钮');
console.log(result.actions);

// 观察页面
const observations = await stagehand.observe('描述页面上的主要元素');

// 提取数据
const data = await stagehand.extract('提取页面标题');

// 关闭
await stagehand.close();
```

### 适配器类用法

```typescript
import { GLMStagehandAdapter } from '@/lib/stagehand/glm-adapter';

const adapter = new GLMStagehandAdapter({
  glm: {
    apiKey: process.env.GLM_API_KEY,
    model: 'glm-4-flash',
  },
  env: 'LOCAL',
});

await adapter.init();

// 执行操作
await adapter.goto('https://example.com');
await adapter.act('点击搜索按钮');

// 关闭
await adapter.close();
```

## 配置选项

### GLMConfig

```typescript
interface GLMConfig {
  apiKey: string;      // GLM API 密钥
  baseURL?: string;    // API 基础 URL
  model?: string;       // 模型名称（默认: glm-4-flash）
  temperature?: number; // 温度参数
  topP?: number;       // Top-P 采样
}
```

### GLMStagehandOptions

```typescript
interface GLMStagehandOptions {
  glm?: GLMConfig;
  env?: 'LOCAL' | 'BROWSERBASE';
  verbose?: 0 | 1 | 2;
  disableAPI?: boolean;
  systemPrompt?: string;
  actTimeoutMs?: number;
  domSettleTimeout?: number;
  localBrowserLaunchOptions?: {
    headless?: boolean;
    cdpUrl?: string;
    port?: number;
    userDataDir?: string;
  };
}
```

## 测试

运行测试脚本：

```bash
npx tsx test-glm-stagehand.ts
```

测试内容：
1. GLM 客户端创建
2. Stagehand 实例创建
3. 基本操作（导航、观察、执行）
4. 数据提取

## 架构说明

### GLM API 兼容性

GLM API 兼容 OpenAI 接口，因此我们可以：

1. 使用 OpenAI SDK 连接 GLM
2. 实现 Stagehand 的 CustomOpenAIClient 模式
3. 支持 JSON 模式输出（用于结构化数据提取）

### 响应格式处理

```typescript
// GLM 返回标准 OpenAI 格式
interface ChatCompletion {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查 CDP_URL 是否正确
   - 确保 Chrome 以调试模式启动：`chrome --remote-debugging-port=9222`

2. **API 调用失败**
   - 验证 GLM_API_KEY 是否有效
   - 检查网络连接
   - 确认 API 配额

3. **响应超时**
   - 增加 `actTimeoutMs` 参数
   - 检查 GLM API 状态

## 集成点

- `/src/lib/cdp/simple-tab-manager.ts` - 使用 GLM 的 Tab 管理器
- `/src/lib/benchmark/executor.ts` - GLM 基准测试执行器

## 相关文档

- [Stagehand 官方文档](https://browserbase.com/docs/stagehand)
- [智谱 AI API 文档](https://open.bigmodel.cn/dev/api)
