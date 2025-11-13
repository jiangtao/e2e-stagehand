import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { electronConnector } from '@/lib/cdp/electron-connector';

// 请求验证 schema
const ConnectRequestSchema = z.object({
  port: z.number().min(1024).max(65535),
  appPath: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求数据
    const { port, appPath } = ConnectRequestSchema.parse(body);

    // 尝试连接到 Electron 实例
    const instanceId = await electronConnector.connect(port, appPath);

    return NextResponse.json({
      success: true,
      data: {
        instanceId,
        instance: electronConnector.getInstance(instanceId)
      }
    });

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
