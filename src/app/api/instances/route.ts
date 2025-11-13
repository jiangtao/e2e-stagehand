import { NextResponse } from 'next/server';
import { electronConnector } from '@/lib/cdp/electron-connector';

export async function GET() {
  try {
    const instances = electronConnector.listInstances();
    
    // 获取每个实例的健康状态
    const instancesWithHealth = await Promise.all(
      instances.map(async (instance) => ({
        ...instance,
        isHealthy: await electronConnector.isInstanceHealthy(instance.id)
      }))
    );

    return NextResponse.json({
      success: true,
      data: {
        instances: instancesWithHealth,
        count: instancesWithHealth.length
      }
    });

  } catch (error) {
    console.error('❌ List instances API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list instances'
    }, { status: 500 });
  }
}
