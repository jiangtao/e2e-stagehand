import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { getUserId, ensureUser, setUserIdCookie } from '@/lib/middleware/user-id';

// 请求验证 schema
const ConnectRequestSchema = z.object({
  port: z.number().min(1024).max(65535),
  appPath: z.string().optional(),
  agentId: z.string().optional(),
  connectionType: z.enum(['local', 'remote']).optional().default('local')
});

export async function POST(request: NextRequest) {
  try {
    // 获取或创建用户 ID
    const userId = getUserId(request);
    ensureUser(userId);

    const body = await request.json();
    const { port, appPath, agentId, connectionType } = ConnectRequestSchema.parse(body);

    // 连接到 Electron 实例（传入 userId, agentId, connectionType）
    const instanceId = await electronConnector.connect(port, appPath, userId, agentId, connectionType);

    const response = NextResponse.json({
      success: true,
      data: {
        instanceId,
        instance: electronConnector.getInstance(instanceId)
      }
    });

    // 设置用户 ID Cookie
    response.headers.set('Set-Cookie', setUserIdCookie(userId));

    return response;

  } catch (error) {
    console.error('❌ Connect API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to Electron instance'
    }, { status: 500 });
  }
}
