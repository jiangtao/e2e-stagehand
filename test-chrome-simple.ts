/**
 * Chrome CDP 简单测试
 */

async function main() {
  console.log('=== 测试 Chrome CDP 连接 ===\n');

  try {
    // 1. 测试 CDP 端口是否可访问
    const response = await fetch('http://localhost:9222/json/version');
    const version = await response.json();

    console.log('✅ Chrome 可访问');
    console.log('   Browser:', version['Browser']);
    console.log('   WebSocket:', version['webSocketDebuggerUrl']);

    console.log('\n=== 测试完成 ===');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

main().catch(console.error);
