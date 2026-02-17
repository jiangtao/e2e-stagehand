/**
 * Chrome Tab 管理 API
 * GET /api/cdp/tabs - 获取所有 Tab
 * DELETE /api/cdp/tabs/:id - 关闭指定 Tab
 * DELETE /api/cdp/tabs - 关闭所有 Tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTabManager, ChromeTabManager } from '@/lib/cdp/tab-pool';

export async function GET(request: NextRequest) {
  try {
    const tabManager = getTabManager();
    const status = tabManager.getStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tabId = searchParams.get('id');

    const tabManager = getTabManager();

    if (tabId) {
      // 关闭指定 Tab
      await tabManager.closeTab(tabId);
      return NextResponse.json({
        success: true,
        message: `Tab ${tabId} closed`,
      });
    } else {
      // 关闭所有 Tab
      await tabManager.closeAllTabs();
      return NextResponse.json({
        success: true,
        message: 'All tabs closed',
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
