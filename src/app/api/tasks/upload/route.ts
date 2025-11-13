import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 请求验证 schema
const UploadRequestSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  instanceId: z.string().optional(),
  description: z.string().optional()
});

// 任务存储 (在实际应用中应该使用数据库)
const tasks = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证请求数据
    const { filename, content, instanceId, description } = UploadRequestSchema.parse(body);

    // 创建任务 ID
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 确保 tasks 目录存在
    const tasksDir = join(process.cwd(), 'tasks');
    if (!existsSync(tasksDir)) {
      await mkdir(tasksDir, { recursive: true });
    }

    // 保存文件
    const filePath = join(tasksDir, `${taskId}-${filename}`);
    await writeFile(filePath, content, 'utf8');

    // 创建任务记录
    const task = {
      id: taskId,
      filename,
      filePath,
      content,
      instanceId,
      description,
      status: 'uploaded',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 存储任务
    tasks.set(taskId, task);

    return NextResponse.json({
      success: true,
      data: {
        taskId,
        filename,
        status: 'uploaded',
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Upload task API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload task'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const allTasks = Array.from(tasks.values()).map(task => ({
      id: task.id,
      filename: task.filename,
      description: task.description,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));

    return NextResponse.json({
      success: true,
      data: {
        tasks: allTasks,
        count: allTasks.length
      }
    });

  } catch (error) {
    console.error('❌ List tasks API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list tasks'
    }, { status: 500 });
  }
}
