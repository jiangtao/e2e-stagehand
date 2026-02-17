/**
 * Chrome CDP 基础连接测试
 *
 * 这个脚本测试基本的 Chrome CDP 连接功能
 */

async function testCDPConnection() {
  console.log('\n=== Chrome CDP 基础连接测试 ===\n');

  // 测试 1: 检查 Chrome 是否在运行
  console.log('1. 检查 Chrome 是否在运行...');
  try {
    const response = await fetch('http://localhost:9222/json/version');
    if (!response.ok) {
      console.error('❌ Chrome 未在端口 9222 上运行');
      console.log('请启动 Chrome 并启用远程调试:');
      console.log('  macOS: /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      console.log('  Linux: google-chrome --remote-debugging-port=9222');
      console.log('  Windows: chrome.exe --remote-debugging-port=9222');
      process.exit(1);
    }

    const version = await response.json();
    console.log('✅ Chrome 已运行');
    console.log('   Browser:', version['Browser']);
    console.log('   WebSocket:', version['webSocketDebuggerUrl']);
    console.log('   Protocol-Version:', version['Protocol-Version']);
  } catch (error) {
    console.error('❌ 无法连接到 Chrome:', error);
    process.exit(1);
  }

  // 测试 2: 列出所有目标
  console.log('\n2. 列出所有可用的目标...');
  try {
    const targetsResponse = await fetch('http://localhost:9222/json');
    const targets = await targetsResponse.json();
    console.log(`✅ 找到 ${targets.length} 个目标:`);
    targets.forEach((t: any, i: number) => {
      console.log(`   [${i + 1}] ${t.type}: ${t.title || t.url} (id: ${t.id})`);
    });

    if (targets.length === 0) {
      console.log('   提示: Chrome 已运行但没有打开的页面');
    }
  } catch (error) {
    console.error('❌ 无法获取目标列表:', error);
  }

  // 测试 3: 测试 WebSocket 连接
  console.log('\n3. 测试 CDP WebSocket 连接...');
  try {
    const version = await fetch('http://localhost:9222/json/version').then(r => r.json());
    const wsUrl = version['webSocketDebuggerUrl'];

    const WebSocket = (await import('ws')).default;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket 连接超时'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket 连接成功');
        console.log('   URL:', wsUrl);
        ws.close();
        resolve();
      });

      ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } catch (error) {
    console.error('❌ WebSocket 连接失败:', error);
  }

  // 测试 4: 如果有页面，尝试连接到第一个页面
  console.log('\n4. 尝试连接到页面（如果有）...');
  try {
    const targets = await fetch('http://localhost:9222/json').then(r => r.json());
    const pageTarget = targets.find((t: any) => t.type === 'page');

    if (!pageTarget) {
      console.log('ℹ️  没有找到页面目标，跳过页面测试');
      console.log('   提示: 在 Chrome 中打开一个网页后再运行此测试');
    } else {
      console.log(`找到页面: ${pageTarget.title || pageTarget.url}`);

      // 连接到页面
      const pageWsUrl = pageTarget.webSocketDebuggerUrl;
      const WebSocket = (await import('ws')).default;
      const pageWs = new WebSocket(pageWsUrl);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('页面 WebSocket 连接超时'));
        }, 5000);

        let messageId = 0;

        pageWs.on('open', () => {
          clearTimeout(timeout);
          console.log('✅ 页面 WebSocket 连接成功');

          // 启用 Page 域
          pageWs.send(JSON.stringify({
            id: ++messageId,
            method: 'Page.enable'
          }));

          // 获取页面信息
          setTimeout(() => {
            pageWs.send(JSON.stringify({
              id: ++messageId,
              method: 'Runtime.evaluate',
              params: {
                expression: '({ title: document.title, url: location.href })',
                returnByValue: true
              }
            }));
          }, 500);
        });

        pageWs.on('message', (data: string) => {
          const message = JSON.parse(data);

          if (message.method === 'Page.loadEventFired') {
            console.log('✅ 页面加载完成');
          }

          if (message.result && message.result.result) {
            const pageInfo = message.result.result.value;
            console.log('✅ 获取页面信息成功');
            console.log('   标题:', pageInfo.title);
            console.log('   URL:', pageInfo.url);

            pageWs.close();
            resolve();
          }
        });

        pageWs.on('error', (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }
  } catch (error) {
    console.error('❌ 页面连接失败:', error);
  }

  console.log('\n=== 测试完成 ===');
}

// 运行测试
testCDPConnection().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
