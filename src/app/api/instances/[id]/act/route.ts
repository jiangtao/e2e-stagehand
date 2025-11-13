import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { StagehandAdapterManager } from '@/lib/stagehand/electron-adapter';

// 请求验证 schema
const ActRequestSchema = z.object({
  action: z.string().min(1),
  options: z.object({}).optional()
});

// 创建全局适配器管理器实例
let adapterManager: StagehandAdapterManager | null = null;

function getAdapterManager() {
  if (!adapterManager) {
    // 从环境变量获取默认配置
    const defaultConfig = {
      modelProvider: (process.env.MODEL_PROVIDER as any) || 'openai',
      apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      customApiUrl: process.env.CUSTOM_API_URL,
      modelName: process.env.MODEL_NAME
    };
    
    adapterManager = new StagehandAdapterManager(defaultConfig);
  }
  return adapterManager;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instanceId = params.id;
    const body = await request.json();
    
    // 验证请求数据
    const { action, options } = ActRequestSchema.parse(body);

    // 检查实例是否存在
    const instance = electronConnector.getInstance(instanceId);
    if (!instance) {
      return NextResponse.json({
        success: false,
        error: `Instance ${instanceId} not found`
      }, { status: 404 });
    }

    // 获取或创建 Stagehand 适配器
    const manager = getAdapterManager();
    let adapter = manager.getAdapter(instanceId);
    
    if (!adapter) {
      adapter = await manager.createAdapter(instanceId);
    }

    // 执行操作
    const result = await adapter.act(action, options);

    return NextResponse.json({
      success: true,
      data: {
        action,
        result,
        instanceId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Act API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute action'
    }, { status: 500 });
  }
}
