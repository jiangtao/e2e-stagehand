import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { taskDB } from '@/lib/db/database';
import { getUserId, ensureUser, setUserIdCookie } from '@/lib/middleware/user-id';

// 请求验证 schema
const UploadRequestSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1),
  instanceId: z.string().optional(),
  description: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    // 获取或创建用户 ID
    const userId = getUserId(request);
    ensureUser(userId);

    const body = await request.json();
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

    // 保存到数据库
    taskDB.save({
      id: taskId,
      userId,
      instanceId,
      filename,
      filePath,
      content,
      description,
      status: 'uploaded'
    });

    const response = NextResponse.json({
      success: true,
      data: {
        taskId,
        filename,
        status: 'uploaded',
        createdAt: new Date().toISOString()
      }
    });

    // 设置用户 ID Cookie
    response.headers.set('Set-Cookie', setUserIdCookie(userId));

    return response;

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

export async function GET(request: NextRequest) {
  try {
    // 获取用户 ID
    const userId = getUserId(request);
    ensureUser(userId);

    // 从数据库获取用户的任务
    const tasks = taskDB.findByUserId(userId);

    const response = NextResponse.json({
      success: true,
      data: {
        tasks: tasks.map(task => ({
          id: task.id,
          filename: task.filename,
          description: task.description,
          status: task.status,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString()
        })),
        count: tasks.length
      }
    });

    // 设置用户 ID Cookie
    response.headers.set('Set-Cookie', setUserIdCookie(userId));

    return response;

  } catch (error) {
    console.error('❌ List tasks API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list tasks'
    }, { status: 500 });
  }
}
