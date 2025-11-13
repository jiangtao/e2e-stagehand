import { NextRequest, NextResponse } from 'next/server';

// 任务存储 (应该与 upload API 共享)
const tasks = new Map<string, any>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;

    // 查找任务
    const task = tasks.get(taskId);
    if (!task) {
      return NextResponse.json({
        success: false,
        error: `Task ${taskId} not found`
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: task.id,
        filename: task.filename,
        description: task.description,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        result: task.result,
        error: task.error
      }
    });

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
    const taskId = params.id;
    const body = await request.json();

    // 查找任务
    const task = tasks.get(taskId);
    if (!task) {
      return NextResponse.json({
        success: false,
        error: `Task ${taskId} not found`
      }, { status: 404 });
    }

    // 更新任务状态
    const updatedTask = {
      ...task,
      ...body,
      updatedAt: new Date().toISOString()
    };

    tasks.set(taskId, updatedTask);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedTask.id,
        status: updatedTask.status,
        updatedAt: updatedTask.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Update task status API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update task status'
    }, { status: 500 });
  }
}
