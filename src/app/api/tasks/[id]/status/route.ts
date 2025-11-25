import { NextRequest, NextResponse } from 'next/server';
import { taskDB } from '@/lib/db/database';
import { getUserId, ensureUser, setUserIdCookie } from '@/lib/middleware/user-id';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 获取用户 ID
    const userId = getUserId(request);
    ensureUser(userId);

    const taskId = params.id;

    // 从数据库查找任务
    const task = taskDB.findById(taskId);
    if (!task) {
      return NextResponse.json({
        success: false,
        error: `Task ${taskId} not found`
      }, { status: 404 });
    }

    // 检查任务是否属于当前用户
    if (task.userId !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized access to task'
      }, { status: 403 });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        id: task.id,
        filename: task.filename,
        description: task.description,
        status: task.status,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        result: task.result,
        error: task.error
      }
    });

    // 设置用户 ID Cookie
    response.headers.set('Set-Cookie', setUserIdCookie(userId));

    return response;

  } catch (error) {
    console.error('❌ Task status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get task status'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 获取用户 ID
    const userId = getUserId(request);
    ensureUser(userId);

    const taskId = params.id;
    const body = await request.json();

    // 从数据库查找任务
    const task = taskDB.findById(taskId);
    if (!task) {
      return NextResponse.json({
        success: false,
        error: `Task ${taskId} not found`
      }, { status: 404 });
    }

    // 检查任务是否属于当前用户
    if (task.userId !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized access to task'
      }, { status: 403 });
    }

    // 更新任务状态
    const status = body.status || task.status;
    const result = body.result || task.result;
    const error = body.error || task.error;

    taskDB.updateStatus(taskId, status, result, error);

    const response = NextResponse.json({
      success: true,
      data: {
        id: taskId,
        status,
        updatedAt: new Date().toISOString()
      }
    });

    // 设置用户 ID Cookie
    response.headers.set('Set-Cookie', setUserIdCookie(userId));

    return response;

  } catch (error) {
    console.error('❌ Update task status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update task status'
    }, { status: 500 });
  }
}
