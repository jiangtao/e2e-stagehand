/**
 * 基准测试执行 API
 * POST /api/benchmarks/run - 执行基准测试
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPureCDPManager } from '@/lib/cdp/pure-cdp-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { benchmarkId, targetId } = body;

    console.log('[Benchmarks] 收到请求:', { benchmarkId, targetId });

    const manager = getPureCDPManager();

    // 确保 Chrome 已启动并连接
    console.log('[Benchmarks] 确保 Chrome CDP 连接...');
    const chrome = await manager.ensureConnection();
    console.log('[Benchmarks] Chrome CDP 已连接');

    console.log('[Benchmarks] 获取 tab:', targetId);

    // 创建或获取 tab
    const tab = await manager.getTab(targetId, {
      id: benchmarkId,
      url: targetId,
      name: benchmarkId,
    });

    console.log('[Benchmarks] 开始执行测试...');

    const startTime = Date.now();

    // 1. 导航到目标 URL（已在 getTab 中完成）
    console.log('[Benchmarks] 已连接到:', targetId);

    // 2. 等待页面加载
    await manager.executeInTab(tab.id, {
      type: 'wait',
      wait: 3000,
    });

    // 3. 触发视频播放（如果有 canvas 或视频元素）
    console.log('[Benchmarks] 尝试播放视频...');
    await manager.executeInTab(tab.id, {
      type: 'playVideo',
    });

    // 4. 如果有登录检测需求，执行登录检测
    // 5. 执行搜索
    try {
      await manager.executeInTab(tab.id, {
        type: 'type',
        selector: 'input[placeholder*="搜索"], input[class*="search"]',
        text: '北京春节美食',
      });
      console.log('[Benchmarks] 搜索执行成功');
    } catch (error) {
      console.log('[Benchmarks] 搜索执行失败（可能没有搜索框）:', error);
    }

    // 6. 浏览项目
    await manager.executeInTab(tab.id, {
      type: 'scroll',
      amount: 500,
    });

    // 7. 等待观察结果
    await manager.executeInTab(tab.id, {
      type: 'wait',
      wait: 3000,
    });

    const duration = Date.now() - startTime;

    console.log(`[Benchmarks] 测试完成！耗时: ${duration}ms`);

    // 8. 释放 tab（不立即关闭）
    manager.releaseTab(tab.id);

    return NextResponse.json({
      success: true,
      benchmark: { id: benchmarkId },
      targetId,
      duration,
      message: 'Test completed successfully',
      tabId: tab.id,
    });
  } catch (error) {
    console.error('[Benchmarks] 执行失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
