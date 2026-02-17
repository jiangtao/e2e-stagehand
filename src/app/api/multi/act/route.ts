/**
 * 多平台操作 API
 * POST /api/multi/act
 * 同时在多个平台上执行 AI 操作
 */

import { NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session/session-manager';
import { WebUrlTarget } from '@/lib/target/web-url-target';
import { ElectronTarget } from '@/lib/target/electron-target';
import { ChromeTarget } from '@/lib/target/chrome-target';

/**
 * 多平台操作请求
 */
interface MultiActRequest {
  targets: Array<{
    type: 'web-url' | 'electron' | 'chrome';
    id?: string;
    url?: string;
    port?: number;
    name?: string;
  }>;
  action: string;
  options?: {
    extract?: boolean;
    observe?: boolean;
  };
}

/**
 * 操作结果
 */
interface ActResult {
  targetId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: MultiActRequest & await request.json();

    if (!body.targets || body.targets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '至少需要一个目标',
        },
        { status: 400 }
      );
    }

    if (!body.action || !body.action.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: '请输入操作指令',
        },
        { status: 400 }
      );
    }

    // 为每个目标创建 Target 实例
    const targetConfigs = body.targets.map(targetConfig => {
      switch (targetConfig.type) {
        case 'web-url':
          if (!targetConfig.url) {
            return NextResponse.json(
              {
                success: false,
                error: 'Web URL 目标需要 url 参数',
              },
              { status: 400 }
            );
          }
          return new WebUrlTarget({
            id: targetConfig.id || `web-${Date.now()}`,
            url: targetConfig.url,
            name: targetConfig.name || targetConfig.url,
          });

        case 'electron':
          if (!targetConfig.port) {
            return NextResponse.json(
              {
                success: false,
                error: 'Electron 目标需要 port 参数',
              },
              { status: 400 }
            );
          }
          return new ElectronTarget({
            id: targetConfig.id || `electron-${targetConfig.port}-${Date.now()}`,
            port: targetConfig.port,
            name: targetConfig.name || `Electron (port ${targetConfig.port})`,
          });

        case 'chrome':
          if (!targetConfig.port) {
            return NextResponse.json(
              {
                success: false,
                error: 'Chrome 目标需要 port 参数',
              },
              { status: 400 }
            );
          }
          return new ChromeTarget({
            id: targetConfig.id || `chrome-${targetConfig.port}-${Date.now()}`,
            port: targetConfig.port,
            name: targetConfig.name || `Chrome (port ${targetConfig.port})`,
          });

        default:
          return NextResponse.json(
            {
              success: false,
              error: `不支持的目标类型: ${targetConfig.type}`,
            },
            { status: 400 }
          );
      }
    });

    // 为所有目标创建 Session
    const sessionIds: string[] = [];
    const errors: Array<{ target: any; error: string }>();

    for (const target of targetConfigs) {
      try {
        const sessionId = await sessionManager.createSession(target, {
          userId: request.headers?.get('x-user-id') || 'local-user',
          autoInitStagehand: true,
        stagehandConfig: {
            modelName: 'gpt-4',
            modelApiKey: process.env.OPENAI_API_KEY || '',
          },
        });

        sessionIds.push(sessionId);

      } catch (error) {
        errors.push({
          target,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 如果所有 Session 都创建失败，返回错误
    if (sessionIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '无法创建任何测试会话',
          details: errors,
        },
        { status: 500 }
      );
    }

    // 在所有 Session 上并发执行操作
    const results = new Map<string, ActResult>();

    await Promise.all(
      sessionIds.map(async (sessionId) => {
        const result = await sessionManager.executeOnSession(
          sessionId,
          body.action,
          body.options
        );

        results.set(sessionId, result);
      })
    );

    // 转换结果为响应格式
    const responseResults = Array.from(results.entries()).map(([id, result]) => ({
      targetId: id,
      success: result.success,
      result: result.result,
      error: result.error,
      duration: result.duration,
    }));

    return NextResponse.json({
      success: true,
      results: responseResults,
      action: body.action,
      totalTargets: body.targets.length,
      successfulTargets: responseResults.filter(r => r.success).length,
    });

  } catch (error) {
    console.error('Multi-platform act error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '操作执行失败',
      },
      { status: 500 }
    );
  }
}
