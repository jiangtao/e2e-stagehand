/**
 * WebUrlTarget 快速测试
 */

import type { WebUrlTarget } from './lib/target/web-url-target';

async function main() {
  console.log('\n=== WebUrlTarget 快速测试 ===');

  const config = {
    id: 'test-web-sina',
    url: 'https://sina.com.cn',
  };

  const target = new WebUrlTarget(config);

  try {
    console.log('1. 开始连接...');
    const result = await target.connect();
    console.log('2. 连接成功:', result.success);
    console.log('- 目标类型:', result.target?.type);
    console.log('- CDP URL:', result.cdpUrl);

    if (!result.success) {
      console.error('连接失败:', result.error);
      process.exit(1);
    }

    console.log('\n--- 验证基本功能 ---');
    console.log('status:', result.target?.status);
    console.log('lastActivity:', result.target?.lastActivity);
    console.log('isConnected:', result.target?.isConnected?.());

    // 检查断开连接
    if (result.target?.status === 'connected') {
      console.log('3. 执行断开连接...');
      await result.target?.disconnect();
      console.log('4. 断开连接成功');
    console.log('- 断开连接后的状态:', result.target?.isConnected?.());
    }

    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('测试失败:', error);
    }
}
}

main();
