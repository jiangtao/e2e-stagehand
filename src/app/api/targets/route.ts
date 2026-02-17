/**
 * 目标管理 API
 * GET /api/targets - 获取所有可用目标
 * POST /api/targets - 添加新目标
 */

import { NextRequest, NextResponse } from 'next/server';
import { WebUrlTarget } from '@/lib/target/web-url-target';

// 预定义的目标列表
const PREDEFINED_TARGETS = [
  {
    id: 'xiaohongshu-web',
    type: 'web-url',
    url: 'https://www.xiaohongshu.com',
    name: '小红书网页版',
    description: '小红书官方网页版',
    icon: '📕',
    category: 'social',
    requiresLogin: true,
  },
  {
    id: 'sina-web',
    type: 'web-url',
    url: 'https://sina.com.cn',
    name: '新浪首页',
    description: '新浪新闻门户',
    icon: '📰',
    category: 'news',
    requiresLogin: false,
  },
  {
    id: 'bilibili-web',
    type: 'web-url',
    url: 'https://www.bilibili.com',
    name: 'B站',
    description: '哔哩哔哩动画',
    icon: '📺',
    category: 'video',
    requiresLogin: false,
  },
];

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      targets: PREDEFINED_TARGETS,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, type, url, name } = body;

    if (!id || !type || !url) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: id, type, url',
      }, { status: 400 });
    }

    // 验证目标类型
    if (type !== 'web-url') {
      return NextResponse.json({
        success: false,
        error: `Unsupported target type: ${type}`,
      }, { status: 400 });
    }

    // 创建目标实例验证
    const target = new WebUrlTarget({ id, url, name });

    return NextResponse.json({
      success: true,
      target: {
        id,
        type,
        url,
        name: name || url,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
