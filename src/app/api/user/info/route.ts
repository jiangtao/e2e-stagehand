import { NextRequest, NextResponse } from 'next/server';
import { getUserId, ensureUser, setUserIdCookie, getUserInfo, setUsername, setUsernameCookie } from '@/lib/middleware/user-id';
import { getOrCreateUser } from '@/lib/db/database';

// 标记为动态路由
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userInfo = getUserInfo(request);
    const user = getOrCreateUser(userInfo.userId);

    const response = NextResponse.json({
      success: true,
      data: {
        userId: userInfo.userId,
        username: userInfo.username || user.username || undefined
      }
    });

    response.headers.set('Set-Cookie', setUserIdCookie(userInfo.userId));
    if (userInfo.username) {
      response.headers.append('Set-Cookie', setUsernameCookie(userInfo.username));
    }

    return response;
  } catch (error) {
    console.error('❌ Get user info API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get user info'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = getUserId(request);
    ensureUser(userId);

    const body = await request.json();
    const { username } = body;

    if (username !== undefined) {
      setUsername(userId, username);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        userId,
        username: username || undefined
      }
    });

    response.headers.set('Set-Cookie', setUserIdCookie(userId));
    if (username) {
      response.headers.append('Set-Cookie', setUsernameCookie(username));
    }

    return response;
  } catch (error) {
    console.error('❌ Update user info API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update user info'
    }, { status: 500 });
  }
}

