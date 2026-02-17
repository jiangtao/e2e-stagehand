/**
 * WebUrlTarget 完整测试
 */

import { WebUrlTarget } from './src/lib/target/web-url-target';

async function main() {
  console.log('\n=== WebUrlTarget 完整测试 ===\n');

  // 1. 创建目标
  console.log('1. 创建 WebUrlTarget...');
  const target = new WebUrlTarget({
    id: 'test-sina',
    url: 'https://sina.com.cn',
    name: '新浪首页',
  });
  console.log('   目标 ID:', target.id);
  console.log('   目标 URL: https://sina.com.cn');
  console.log('   初始状态:', target.status);

  // 2. 测试连接
  console.log('\n2. 开始连接...');
  const startTime = Date.now();
  const result = await target.connect();
  const duration = Date.now() - startTime;

  console.log('   连接耗时:', duration + 'ms');
  console.log('   连接成功:', result.success ?? true);
  console.log('   CDP URL:', result.cdpUrl);
  console.log('   目标 ID:', result.targetId);
  console.log('   当前状态:', target.status);
  console.log('   最后活动:', target.lastActivity);

  // 3. 验证连接
  console.log('\n3. 验证连接状态...');
  console.log('   isConnected():', target.isConnected());
  console.log('   refreshStatus():', await target.refreshStatus());

  // 4. 等待几秒验证稳定性
  console.log('\n4. 测试连接稳定性（等待 5 秒）...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('   5秒后状态:', target.status);
  console.log('   仍然连接:', target.isConnected());

  // 5. 清理
  console.log('\n5. 断开连接...');
  await target.disconnect();
  console.log('   断开后状态:', target.status);
  console.log('   是否还连接:', target.isConnected());

  console.log('\n=== 测试完成 ===');
}

main().catch((err) => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
