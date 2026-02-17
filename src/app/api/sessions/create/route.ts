/**
 * 创建 Session API
 * POST /api/sessions/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session/session-manager';
import { WebUrlTarget } from '@/lib/target/web-url-target';
import { ElectronTarget } from '@/lib/target/electron-target';
import { ChromeTarget } from '@/lib/target/chrome-target';
import { getUserId } from '@/lib/middleware/user-id';

/**
 * Session 创建请求
 */
interface CreateSessionRequest {
  targets: Array<{
    type: 'web-url' | 'electron' | 'chrome';
    id?: string;
    url?: string;
    port?: number;
    name?: string;
  }>;
  options?: {
    concurrent?: boolean;
    autoInitStagehand?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    const body: CreateSessionRequest = await request.json();

    if (!body.targets || body.targets.length === 0) {
      return NextResponse.json(
        { success: false, error: '至少需要一个目标' },
        { status: 400 }
      );
    }

    const sessionIds: string[] = [];
    const errors: Array<{ target: any; error: string }> = [];

    // 为每个目标创建 Session
    for (const targetConfig of body.targets) {
      try {
        let target;

        switch (targetConfig.type) {
          case 'web-url':
            if (!targetConfig.url) {
              throw new Error('Web URL 目标需要 url 参数');
            }
            target = new WebUrlTarget({
              id: targetConfig.id || `web-${Date.now()}`,
              url: targetConfig.url,
              name: targetConfig.name,
            });
            break;

          case 'electron':
            if (!targetConfig.port) {
              throw new Error('Electron 目标需要 port 参数');
            }
            target = new ElectronTarget({
              id: targetConfig.id || `electron-${targetConfig.port}-${Date.now()}`,
              port: targetConfig.port,
              name: targetConfig.name,
            });
            break;

          case 'chrome':
            if (!targetConfig.port) {
              throw new Error('Chrome 目标需要 port 参数');
            }
            target = new ChromeTarget({
              id: targetConfig.id || `chrome-${targetConfig.port}-${Date.now()}`,
              port: targetConfig.port,
              name: targetConfig.name,
            });
            break;

          default:
            throw new Error(`不支持的目标类型: ${targetConfig.type}`);
        }

        // 并发还是串行创建
        if (body.options?.concurrent !== false) {
          // 并发创建
          const sessionId = await sessionManager.createSession(target, {
            userId,
            autoInitStagehand: body.options?.autoInitStagehand !== false,
          });
          sessionIds.push(sessionId);
        } else {
          // 串行创建（等待前一个完成）
          const sessionId = await sessionManager.createSession(target, {
            userId,
            autoInitStagehand: body.options?.autoInitStagehand !== false,
          });
          sessionIds.push(sessionId);
        }

      } catch (error) {
        errors.push({
          target: targetConfig,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      sessionIds,
      errors,
      message: errors.length === 0
        ? `成功创建 ${sessionIds.length} 个会话`
        : `${sessionIds.length} 个成功, ${errors.length} 个失败`,
    });

  } catch (error) {
    console.error('Failed to create sessions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create sessions',
      },
      { status: 500 }
    );
  }
}
