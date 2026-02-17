/**
 * Session 管理器
 * 管理多个测试会话的生命周期和并发操作
 */

import { EventEmitter } from 'events';
import { V3Context } from '@browserbasehq/stagehand';
import { Stagehand } from '@browserbasehq/stagehand';
import { Target, TargetStatus } from '../target/types';
import { sessionDB } from '../db/session-database';

/**
 * Session 状态
 */
export type SessionStatus = 'initializing' | 'ready' | 'busy' | 'error' | 'closed';

/**
 * Session 信息
 */
export interface SessionInfo {
  id: string;
  target: Target;
  context: V3Context;
  stagehand: Stagehand | null;
  status: SessionStatus;
  createdAt: Date;
  lastActivity: Date;
  error?: string;
}

/**
 * Session 创建选项
 */
export interface SessionCreateOptions {
  userId?: string;
  autoInitStagehand?: boolean;
  stagehandConfig?: {
    modelName?: string;
    modelApiKey?: string;
    domSettleTimeoutMs?: number;
    verbose?: boolean;
  };
}

/**
 * 操作执行结果
 */
export interface ActionResult {
  sessionId: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

/**
 * Session 管理器
 * 管理所有测试会话的生命周期
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, SessionInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanupTask();
  }

  /**
   * 创建新的测试会话
   */
  async createSession(
    target: Target,
    options: SessionCreateOptions = {}
  ): Promise<string> {
    const sessionId = `${target.type}-${Date.now()}`;

    try {
      // 1. 连接到目标
      const { context } = await target.connect();

      // 2. 创建 Session 信息
      const sessionInfo: SessionInfo = {
        id: sessionId,
        target,
        context,
        stagehand: null, // 稍后初始化
        status: 'ready',
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      // 3. 自动初始化 Stagehand
      if (options.autoInitStagehand !== false) {
        const stagehand = new Stagehand({
          env: 'LOCAL',
          modelName: options.stagehandConfig?.modelName,
          modelApiKey: options.stagehandConfig?.modelApiKey,
        });

        await stagehand.init();
        sessionInfo.stagehand = stagehand;
      }

      // 4. 保存到内存
      this.sessions.set(sessionId, sessionInfo);

      // 5. 保存到数据库
      if (options.userId) {
        sessionDB.save({
          id: sessionId,
          userId: options.userId,
          targetId: target.id,
          targetType: target.type,
          status: 'ready',
          createdAt: new Date(),
        });
      }

      // 6. 监听目标状态变化
      this.watchTargetStatus(sessionId, target);

      // 7. 发出事件
      this.emit('session_created', sessionInfo);

      console.log(`✅ Session created: ${sessionId} for target ${target.id}`);
      return sessionId;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to create session:`, error);

      this.emit('session_error', {
        sessionId,
        error: errorMessage,
      });

      throw new Error(`创建会话失败: ${errorMessage}`);
    }
  }

  /**
   * 获取 Session 信息
   */
  getSession(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 获取所有 Session
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取用户的 Session 列表
   */
  getUserSessions(userId: string): SessionInfo[] {
    return this.getAllSessions().filter(
      (s) => sessionDB.getUserId(s.id) === userId
    );
  }

  /**
   * 在单个 Session 上执行操作
   */
  async executeOnSession(
    sessionId: string,
    action: string,
    options?: {
      extract?: boolean;
      observe?: boolean;
    }
  ): Promise<ActionResult> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        sessionId,
        success: false,
        error: `Session ${sessionId} 不存在`,
        duration: 0,
      };
    }

    if (!session.stagehand) {
      return {
        sessionId,
        success: false,
        error: `Session ${sessionId} 的 Stagehand 未初始化`,
        duration: 0,
      };
    }

    const startTime = Date.now();
    session.status = 'busy';
    session.lastActivity = new Date();

    try {
      let result: any;

      if (options?.extract) {
        result = await session.stagehand.extract(action);
      } else if (options?.observe) {
        result = await session.stagehand.observe(action);
      } else {
        result = await session.stagehand.act(action);
      }

      session.status = 'ready';
      session.lastActivity = new Date();

      const duration = Date.now() - startTime;

      // 保存到数据库
      sessionDB.updateLastActivity(sessionId);

      this.emit('action_executed', {
        sessionId,
        action,
        result,
        duration,
      });

      return {
        sessionId,
        success: true,
        result,
        duration,
      };

    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : String(error);

      const duration = Date.now() - startTime;

      this.emit('action_failed', {
        sessionId,
        action,
        error: session.error,
      });

      return {
        sessionId,
        success: false,
        error: session.error,
        duration,
      };
    }
  }

  /**
   * 在多个 Session 上同时执行操作
   */
  async executeOnMultiple(
    sessionIds: string[],
    action: string,
    options?: {
      extract?: boolean;
      observe?: boolean;
      concurrent?: boolean;
    }
  ): Promise<Map<string, ActionResult>> {
    const results = new Map<string, ActionResult>();
    const concurrent = options?.concurrent !== false;

    if (concurrent) {
      // 并发执行所有操作
      const promises = sessionIds.map(async (sessionId) => {
        const result = await this.executeOnSession(sessionId, action, options);
        results.set(sessionId, result);
        return result;
      });

      await Promise.all(promises);
    } else {
      // 串行执行
      for (const sessionId of sessionIds) {
        const result = await this.executeOnSession(sessionId, action, options);
        results.set(sessionId, result);
      }
    }

    this.emit('multi_action_executed', {
      sessionIds,
      action,
      results,
    });

    return results;
  }

  /**
   * 关闭 Session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      console.warn(`Session ${sessionId} 不存在`);
      return;
    }

    try {
      // 1. 关闭 Stagehand
      if (session.stagehand) {
        await session.stagehand.close();
      }

      // 2. 断开目标连接
      await session.target.disconnect();

      // 3. 从内存中移除
      this.sessions.delete(sessionId);

      // 4. 更新数据库
      sessionDB.updateStatus(sessionId, 'closed');

      // 5. 发出事件
      this.emit('session_closed', session);

      console.log(`🔌 Session closed: ${sessionId}`);

    } catch (error) {
      console.error(`❌ Error closing session ${sessionId}:`, error);
    }
  }

  /**
   * 关闭所有 Session
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());

    await Promise.all(
      sessionIds.map((id) => this.closeSession(id).catch(console.error))
    );
  }

  /**
   * 监听目标状态变化
   */
  private watchTargetStatus(sessionId: string, target: Target): void {
    const checkInterval = setInterval(async () => {
      const currentStatus = await target.refreshStatus();

      if (currentStatus !== 'connected') {
        const session = this.sessions.get(sessionId);
        if (session && session.status !== 'closed') {
          session.status = 'error';
          session.error = `目标连接已断开`;

          this.emit('session_disconnected', {
            sessionId,
            targetStatus: currentStatus,
          });

          // 自动关闭 session
          await this.closeSession(sessionId);
        }

        clearInterval(checkInterval);
      }
    }, 5000); // 每 5 秒检查一次
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(async () => {
      const now = new Date();
      const inactiveThreshold = 30 * 60 * 1000; // 30 分钟

      for (const [id, session] of this.sessions.entries()) {
        const inactiveTime = now.getTime() - session.lastActivity.getTime();

        // 清理超过 30 分钟未活动的 Session
        if (inactiveTime > inactiveThreshold) {
          console.log(`🧹 Cleaning up inactive session: ${id}`);
          await this.closeSession(id).catch(console.error);
        }
      }
    }, 60 * 1000); // 每分钟检查一次
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.closeAllSessions();
    this.sessions.clear();
  }
}

// 单例实例
export const sessionManager = new SessionManager();
