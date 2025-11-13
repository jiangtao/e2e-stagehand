import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRuntimeConfig, validateConfig } from '@/config/default';

// 配置更新 schema
const ConfigUpdateSchema = z.object({
  stagehand: z.object({
    modelProvider: z.enum(['openai', 'anthropic', 'custom']).optional(),
    apiKey: z.string().optional(),
    customApiUrl: z.string().url().optional(),
    modelName: z.string().optional()
  }).optional(),
  websocket: z.object({
    port: z.number().min(1024).max(65535).optional(),
    reconnectInterval: z.number().min(1000).optional(),
    maxReconnectAttempts: z.number().min(1).optional()
  }).optional(),
  electron: z.object({
    defaultDebugPort: z.number().min(1024).max(65535).optional(),
    healthCheckInterval: z.number().min(5000).optional()
  }).optional()
});

export async function GET() {
  try {
    const config = getRuntimeConfig();
    
    // 隐藏敏感信息
    const safeConfig = {
      ...config,
      stagehand: {
        ...config.stagehand,
        apiKey: config.stagehand.apiKey ? '***' : ''
      }
    };

    return NextResponse.json({
      success: true,
      data: safeConfig
    });

  } catch (error) {
    console.error('❌ Get config API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get configuration'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求数据
    const updates = ConfigUpdateSchema.parse(body);

    // 获取当前配置
    const currentConfig = getRuntimeConfig();
    
    // 合并更新
    const newConfig = {
      ...currentConfig,
      ...updates,
      stagehand: {
        ...currentConfig.stagehand,
        ...updates.stagehand
      },
      websocket: {
        ...currentConfig.websocket,
        ...updates.websocket
      },
      electron: {
        ...currentConfig.electron,
        ...updates.electron
      }
    };

    // 验证新配置
    const errors = validateConfig(newConfig);
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Configuration validation failed',
        details: errors
      }, { status: 400 });
    }

    // 在实际应用中，这里应该保存配置到文件或数据库
    // 现在只是返回验证结果
    console.log('✅ Configuration updated:', updates);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Configuration updated successfully',
        updates
      }
    });

  } catch (error) {
    console.error('❌ Update config API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid configuration data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to update configuration'
    }, { status: 500 });
  }
}
