#!/usr/bin/env tsx

/**
 * GLM Stagehand 适配测试脚本
 *
 * 测试 GLM 模型是否正确响应 Stagehand 的操作指令
 */

import { createGLMStagehand, GLMStagehandAdapter } from '@/lib/stagehand/glm-adapter';

/**
 * 测试配置
 */
const TEST_CONFIG = {
  // GLM API 配置
  glmApiKey: process.env.GLM_API_KEY || '94ce4cebcb7b4b91b27b41fd159f19ed.z2QN4usqw9LKSzHE',
  glmBaseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
  glmModel: process.env.GLM_MODEL || 'glm-4-flash',

  // CDP 配置
  cdpUrl: process.env.CDP_URL || 'http://localhost:9222',

  // 测试 URL
  testUrl: process.env.TEST_URL || 'https://www.baidu.com',
};

/**
 * 测试 1: 基本 GLM 客户端创建
 */
async function testGLMClientCreation() {
  console.log('\n=== 测试 1: GLM 客户端创建 ===');

  try {
    const { createGLMClient } = await import('@/lib/llm/glm-client');

    const client = createGLMClient({
      apiKey: TEST_CONFIG.glmApiKey,
      baseURL: TEST_CONFIG.glmBaseUrl,
      model: TEST_CONFIG.glmModel,
    });

    console.log('✅ GLM 客户端创建成功');
    console.log('  - type:', client.type);
    console.log('  - modelName:', client.modelName);
    console.log('  - hasVision:', client.hasVision);

    return true;
  } catch (error) {
    console.error('❌ GLM 客户端创建失败:', error);
    return false;
  }
}

/**
 * 测试 2: Stagehand GLM 实例创建
 */
async function testStagehandCreation() {
  console.log('\n=== 测试 2: Stagehand GLM 实例创建 ===');

  try {
    const stagehand = await createGLMStagehand({
      glm: {
        apiKey: TEST_CONFIG.glmApiKey,
        baseURL: TEST_CONFIG.glmBaseUrl,
        model: TEST_CONFIG.glmModel,
      },
      env: 'LOCAL',
      verbose: 1,
      localBrowserLaunchOptions: {
        cdpUrl: TEST_CONFIG.cdpUrl,
      },
    });

    console.log('✅ Stagehand GLM 实例创建成功');

    // 关闭实例
    await stagehand.close();

    return true;
  } catch (error) {
    console.error('❌ Stagehand GLM 实例创建失败:', error);
    return false;
  }
}

/**
 * 测试 3: GLM Stagehand 基本操作
 */
async function testBasicOperations() {
  console.log('\n=== 测试 3: GLM Stagehand 基本操作 ===');

  try {
    const adapter = new GLMStagehandAdapter({
      glm: {
        apiKey: TEST_CONFIG.glmApiKey,
        baseURL: TEST_CONFIG.glmBaseUrl,
        model: TEST_CONFIG.glmModel,
      },
      env: 'LOCAL',
      verbose: 1,
      localBrowserLaunchOptions: {
        cdpUrl: TEST_CONFIG.cdpUrl,
      },
    });

    // 初始化
    await adapter.init();
    console.log('✅ 适配器初始化成功');

    // 导航到测试页面
    console.log(`📍 导航到: ${TEST_CONFIG.testUrl}`);
    await adapter.goto(TEST_CONFIG.testUrl);
    console.log('✅ 导航完成');

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 观察页面
    console.log('👀 观察页面...');
    const observations = await adapter.observe('描述页面上的主要元素');
    console.log(`✅ 观察完成，发现 ${observations.length} 个元素`);
    console.log('  示例:', observations.slice(0, 3).map((o: any) => o.description).join(', '));

    // 执行操作
    console.log('🤖 执行操作: 在搜索框中输入"GLM 测试"');
    const actResult = await adapter.act('在搜索框中输入"GLM 测试"并点击搜索按钮', {
      timeoutMs: 15000,
    });
    console.log('✅ 操作完成');
    console.log('  结果:', actResult.actions?.[0]?.description);

    // 关闭适配器
    await adapter.close();
    console.log('✅ 适配器已关闭');

    return true;
  } catch (error) {
    console.error('❌ GLM Stagehand 基本操作测试失败:', error);
    return false;
  }
}

/**
 * 测试 4: 数据提取
 */
async function testDataExtraction() {
  console.log('\n=== 测试 4: 数据提取 ===');

  try {
    const adapter = new GLMStagehandAdapter({
      glm: {
        apiKey: TEST_CONFIG.glmApiKey,
        baseURL: TEST_CONFIG.glmBaseUrl,
        model: TEST_CONFIG.glmModel,
      },
      env: 'LOCAL',
      verbose: 1,
      localBrowserLaunchOptions: {
        cdpUrl: TEST_CONFIG.cdpUrl,
      },
    });

    // 初始化
    await adapter.init();
    await adapter.goto(TEST_CONFIG.testUrl);

    // 等待页面加载
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 提取数据
    console.log('🔍 提取页面标题和搜索框信息');
    const extracted = await adapter.extract('提取页面标题和搜索框的占位符文本');
    console.log('✅ 数据提取完成');
    console.log('  结果:', extracted);

    // 关闭适配器
    await adapter.close();

    return true;
  } catch (error) {
    console.error('❌ 数据提取测试失败:', error);
    return false;
  }
}

/**
 * 主测试运行器
 */
async function main() {
  console.log('🧪 GLM Stagehand 适配测试');
  console.log('='.repeat(50));

  const results = {
    clientCreation: await testGLMClientCreation(),
    stagehandCreation: await testStagehandCreation(),
    basicOperations: await testBasicOperations(),
    dataExtraction: await testDataExtraction(),
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总:');
  console.log('  - GLM 客户端创建:', results.clientCreation ? '✅ 通过' : '❌ 失败');
  console.log('  - Stagehand 实例创建:', results.stagehandCreation ? '✅ 通过' : '❌ 失败');
  console.log('  - 基本操作测试:', results.basicOperations ? '✅ 通过' : '❌ 失败');
  console.log('  - 数据提取测试:', results.dataExtraction ? '✅ 通过' : '❌ 失败');

  const allPassed = Object.values(results).every((r) => r);
  console.log('\n' + (allPassed ? '🎉 所有测试通过！' : '⚠️ 部分测试失败'));

  process.exit(allPassed ? 0 : 1);
}

// 运行测试
main().catch((error) => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
