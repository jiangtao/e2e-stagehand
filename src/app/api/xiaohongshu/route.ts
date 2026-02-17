/**
 * 小红书测试 API (MVP 版本)
 * 使用 Chrome CDP 真正控制浏览器执行测试
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChromeCDPClient } from '@/lib/cdp/chrome-cdp-client';

export async function POST(request: NextRequest) {
  console.log('[小红书测试] 收到测试请求');

  // 创建 CDP 客户端
  const cdpClient = new ChromeCDPClient({
    port: 9222,
    chromePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  try {
    // 连接 Chrome
    await cdpClient.connect();
    console.log('[小红书测试] Chrome 已连接');

    // 创建测试标签页
    const targetId = await cdpClient.createTab('https://www.xiaohongshu.com');
    console.log('[小红书测试] 标签页已创建:', targetId);

    // 执行测试步骤
    const results = [];

    // 1. 等待页面加载
    console.log('[小红书测试] 步骤 1: 等待页面加载');
    await cdpClient.wait(3000);
    results.push({ step: '等待页面加载', success: true, duration: 3000 });
    await cdpClient.wait(500);

    // 2. 搜索北京春节美食
    console.log('[小红书测试] 步骤 2: 搜索北京春节美食');
    await cdpClient.search('北京春节美食');
    results.push({ step: '搜索北京春节美食', success: true, duration: 2000 });
    await cdpClient.wait(1000);

    // 3. 浏览搜索结果
    console.log('[小红书测试] 步骤 3: 浏览搜索结果');
    await cdpClient.scroll(500);
    results.push({ step: '浏览搜索结果', success: true, duration: 800 });
    await cdpClient.wait(1000);

    // 4. 验证页面内容
    console.log('[小红书测试] 步骤 4: 验证页面内容');
    const verified = await cdpClient.verify('div[class*="content"]');
    results.push({ step: '验证页面内容', success: verified, duration: 500 });
    await cdpClient.wait(500);

    // 5. 截图
    console.log('[小红书测试] 步骤 5: 截图');
    const screenshot = await cdpClient.captureScreenshot();
    results.push({ step: '截图', success: !!screenshot, duration: 500 });

    // 关闭标签页
    await cdpClient.closeTab();
    console.log('[小红书测试] 测试完成');

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalSteps: results.length,
        successSteps: successCount,
        failedSteps: results.length - successCount,
        totalDuration: totalDuration,
        screenshot
      }
    });

  } catch (error) {
    console.error('[小红书测试] 执行失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
