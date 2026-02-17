/**
 * CDP 连接池管理 API
 * GET /api/cdp/pool - 获取连接池状态
 * DELETE /api/cdp/pool/:id - 关闭指定连接
 * DELETE /api/cdp/pool - 关闭所有连接
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCDPPool, CDPConnectionPool } from '@/lib/cdp/connection-pool';

export async function GET(request: NextRequest) {
  try {
    const pool = getCDPPool();
    const status = pool.getStatus();

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
    const connectionId = searchParams.get('id');

    const pool = getCDPPool();

    if (connectionId) {
      // 关闭指定连接
      await pool.closeConnection(connectionId);
      return NextResponse.json({
        success: true,
        message: `Connection ${connectionId} closed`,
      });
    } else {
      // 关闭所有连接
      await pool.closeAll();
      return NextResponse.json({
        success: true,
        message: 'All connections closed',
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
