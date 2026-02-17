/**
 * Session 操作执行 API
 * POST /api/sessions/[sessionId]/act
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session/session-manager';

interface ActRequest {
  action: string;
  options?: {
    extract?: boolean;
    observe?: boolean;
  };
}

interface ActResponse {
  sessionId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  try {
    const body: ActRequest = await request.json();

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: '缺少 action 参数' },
        { status: 400 }
      );
    }

    // 执行操作
    const result = await sessionManager.executeOnSession(
      sessionId,
      body.action,
      body.options
    );

    return NextResponse.json<ActResponse>(result);

  } catch (error) {
    console.error(`Failed to execute action on session ${sessionId}:`, error);
    return NextResponse.json(
      {
        sessionId,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute action',
        duration: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取 Session 信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  try {
    const session = sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: `Session ${sessionId} 不存在` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        targetType: session.target.type,
        targetId: session.target.id,
        displayName: session.target.displayName,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        hasStagehand: session.stagehand !== null,
        error: session.error,
      },
    });

  } catch (error) {
    console.error(`Failed to get session ${sessionId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 关闭 Session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

  try {
    await sessionManager.closeSession(sessionId);

    return NextResponse.json({
      success: true,
      message: `Session ${sessionId} 已关闭`,
    });

  } catch (error) {
    console.error(`Failed to close session ${sessionId}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close session',
      },
      { status: 500 }
    );
  }
}
