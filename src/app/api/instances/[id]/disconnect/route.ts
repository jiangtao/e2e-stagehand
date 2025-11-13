import { NextRequest, NextResponse } from 'next/server';
import { electronConnector } from '@/lib/cdp/electron-connector';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instanceId = params.id;

    // 检查实例是否存在
    const instance = electronConnector.getInstance(instanceId);
    if (!instance) {
      return NextResponse.json({
        success: false,
        error: `Instance ${instanceId} not found`
      }, { status: 404 });
    }

    // 断开连接
    await electronConnector.disconnect(instanceId);

    return NextResponse.json({
      success: true,
      data: {
        message: `Instance ${instanceId} disconnected successfully`
      }
    });

  } catch (error) {
    console.error('❌ Disconnect API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disconnect instance'
    }, { status: 500 });
  }
}
