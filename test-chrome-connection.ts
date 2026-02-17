/**
 * Chrome CDP 连接测试
 */

async function main() {
  console.log('\n=== Chrome CDP 连接测试 ===\n');

  // 1. 验证 Chrome 是否在运行
  console.log('1. 检查 Chrome 是否运行在端口 9222...');
  const response = await fetch('http://localhost:9222/json/version');
  if (!response.ok) {
    console.error('❌ Chrome 未在端口 9222 上运行');
    process.exit(1);
  }
  const version = await response.json();
  console.log('✅ Chrome 已运行');
  console.log('   Browser:', version['Browser']);
  console.log('   WebSocket:', version['webSocketDebuggerUrl']);

  // 2. 测试 CDP WebSocket 连接
  console.log('\n2. 测试 CDP WebSocket 连接...');
  const wsUrl = version['webSocketDebuggerUrl'];
  console.log('   连接 URL:', wsUrl);

  try {
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log('✅ WebSocket 连接成功');
        ws.close();
        resolve(undefined);
      };
      ws.onerror = (err) => reject(err);
      setTimeout(() => reject(new Error('WebSocket 连接超时')), 5000);
    });
  } catch (error) {
    console.error('❌ WebSocket 连接失败:', error);
    process.exit(1);
  }

  // 3. 列出所有可用的页面/目标
  console.log('\n3. 获取可用的页面/目标...');
  const targets = await fetch('http://localhost:9222/json').then(r => r.json());
  console.log(`   找到 ${targets.length} 个目标:`);
  targets.forEach((t: any, i: number) => {
    console.log(`   [${i + 1}] ${t.type}: ${t.title || t.url} (id: ${t.id})`);
  });

  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);
