import { NextRequest } from 'next/server';
import { getOrCreateUser, updateUser } from '@/lib/db/database';

const USER_ID_COOKIE = 'stagehand_user_id';
const USER_ID_HEADER = 'x-user-id';
const USERNAME_COOKIE = 'stagehand_username';

/**
 * 从请求中获取或创建用户 ID
 */
export function getUserId(request: NextRequest): string {
  // 1. 尝试从 Header 获取
  const headerUserId = request.headers.get(USER_ID_HEADER);
  if (headerUserId) {
    return headerUserId;
  }

  // 2. 尝试从 Cookie 获取
  const cookieUserId = request.cookies.get(USER_ID_COOKIE)?.value;
  if (cookieUserId) {
    return cookieUserId;
  }

  // 3. 生成新的用户 ID
  const newUserId = generateUserId();
  
  // 注意：在 Next.js API Route 中，我们需要在响应中设置 Cookie
  // 这里只返回 ID，由调用方设置 Cookie
  return newUserId;
}

/**
 * 生成新的用户 ID
 */
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 确保用户存在于数据库中
 */
export function ensureUser(userId: string): void {
  getOrCreateUser(userId);
}

/**
 * 获取用户信息（包括 username）
 */
export function getUserInfo(request: NextRequest): { userId: string; username?: string } {
  const userId = getUserId(request);
  ensureUser(userId);
  
  const user = getOrCreateUser(userId);
  const cookieUsername = request.cookies.get(USERNAME_COOKIE)?.value;
  
  return {
    userId,
    username: user.username || cookieUsername || undefined
  };
}

/**
 * 设置用户名
 */
export function setUsername(userId: string, username: string): void {
  updateUser(userId, username);
}

/**
 * 在响应中设置用户 ID Cookie 的辅助函数
 */
export function setUserIdCookie(userId: string): string {
  return `${USER_ID_COOKIE}=${userId}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly`;
}

/**
 * 在响应中设置用户名 Cookie 的辅助函数
 */
export function setUsernameCookie(username: string): string {
  return `${USERNAME_COOKIE}=${username}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

