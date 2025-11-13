import { NextRequest } from 'next/server';
import { wsServer } from '@/lib/websocket/server';

// 在 API 路由中启动 WebSocket 服务器
let wsStarted = false;

export async function GET(request: NextRequest) {
  if (!wsStarted) {
    try {
      wsServer.start(8080);
      wsStarted = true;
      console.log('🚀 WebSocket server started on port 8080');
    } catch (error) {
      console.error('❌ Failed to start WebSocket server:', error);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'WebSocket server is running',
    port: 8080,
    clients: wsServer.getClientCount()
  }), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
