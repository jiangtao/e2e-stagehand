/**
 * WebUrlTarget 测试脚本
 */

import { WebUrlTarget } from './web-url-target';

async function main() {
  console.log('=== WebUrlTarget 功能测试 ===');

  // 定义测试目标
  const testConfig = {
    id: 'test-web-sina',
    url: 'https://sina.com.cn',
    name: '新浪首页',
  };

  const target = new WebUrlTarget(testConfig);

  try {
    // 1. 测试连接
    console.log('\n--- 1. 连接目标 ---');
    const result = await target.connect();
    console.log('连接结果:', result);
    console.log('目标类型:', target.type);
    console.log('CDP URL:', result.cdpUrl);
    console.log('目标 ID:', result.targetId);
    console.log('状态:', target.status);
    console.log('最后活动:', target.lastActivity);

    if (!result.success) {
      console.error('连接失败:', result.error);
      process.exit(1);
    }

    // 2. 验证连接成功
    if (target.status !== 'connected') {
      console.error('状态不是 connected:', target.status);
      process.exit(1);
    }

    console.log('\n--- 2. 验证 completed ---');

    // 3. 测试断开连接
    console.log('检查 isConnected():', target.isConnected());
    console.log('refreshStatus():', await target.refreshStatus());

    // 4. 清理资源
    console.log('\n--- 3. 清理资源 ---');
    await target.disconnect();

    console.log('清理后状态:', target.status);
    console.log('是否还连接:', target.isConnected());

    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }

  console.log('\n=== 完整的流程测试 ===');
}

main();
