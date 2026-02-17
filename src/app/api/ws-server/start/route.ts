/**
 * WebSocket Server 启动 API
 * POST /api/ws-server/start - 启动 WebSocket 代理服务器
 */

import { NextRequest, NextResponse } from 'next/server';
import { wsServer } from '@/lib/websocket/server';

export async function POST(request: NextRequest) {
  try {
    console.log('[WS Server] 启动请求...');

    // 检查是否已经运行
    if (wsServer.isRunning()) {
      const port = wsServer.getPort();
      return NextResponse.json({
        success: true,
        message: 'WebSocket server already running',
        port: port || 8080,
      });
    }

    // 启动 WebSocket 服务器
    wsServer.start(8080);

    console.log('[WS Server] 已启动在端口 8080');

    return NextResponse.json({
      success: true,
      message: 'WebSocket server started',
      port: 8080,
    });
  } catch (error) {
    console.error('[WS Server] 启动失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
