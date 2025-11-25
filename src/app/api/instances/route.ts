import { NextRequest, NextResponse } from 'next/server';
import { electronConnector } from '@/lib/cdp/electron-connector';
import { instanceDB } from '@/lib/db/database';
import { getUserId, ensureUser, setUserIdCookie } from '@/lib/middleware/user-id';

export async function GET(request: NextRequest) {
  try {
    // 获取用户 ID
    const userId = getUserId(request);
    ensureUser(userId);

    // 从数据库获取用户的实例（结合内存中的连接状态）
    const dbInstances = instanceDB.findByUserId(userId);
    const memoryInstances = electronConnector.listInstances();
    
    // 合并数据：优先使用内存中的连接状态
    const instances = dbInstances.map(dbInst => {
      const memoryInst = memoryInstances.find(m => m.id === dbInst.id);
      return memoryInst || dbInst;
    });

    // 获取健康状态
    const instancesWithHealth = await Promise.all(
      instances.map(async (instance) => ({
        ...instance,
        isHealthy: await electronConnector.isInstanceHealthy(instance.id)
      }))
    );

    const response = NextResponse.json({
      success: true,
      data: {
        instances: instancesWithHealth,
        count: instancesWithHealth.length
      }
    });

    // 设置用户 ID Cookie
    response.headers.set('Set-Cookie', setUserIdCookie(userId));

    return response;

  } catch (error) {
    console.error('❌ List instances API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list instances'
    }, { status: 500 });
  }
}
