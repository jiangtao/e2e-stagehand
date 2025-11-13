import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { StagehandAdapterManager } from '@/lib/stagehand/electron-adapter';

// 请求验证 schema
const ExtractRequestSchema = z.object({
  instruction: z.string().min(1),
  schema: z.object({}).optional()
});

// 获取适配器管理器
function getAdapterManager() {
  const defaultConfig = {
    modelProvider: (process.env.MODEL_PROVIDER as any) || 'openai',
    apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    customApiUrl: process.env.CUSTOM_API_URL,
    modelName: process.env.MODEL_NAME
  };
  
  return new StagehandAdapterManager(defaultConfig);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const instanceId = params.id;
    const body = await request.json();
    
    // 验证请求数据
    const { instruction, schema } = ExtractRequestSchema.parse(body);

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

    // 执行数据提取
    const result = await adapter.extract(instruction, schema);

    return NextResponse.json({
      success: true,
      data: {
        instruction,
        result,
        instanceId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Extract API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract data'
    }, { status: 500 });
  }
}
