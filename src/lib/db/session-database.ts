/**
 * Session 数据库
 * 持久化存储 Session 信息
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Session 数据库记录
 */
export interface SessionRecord {
  id: string;
  userId?: string;
  targetId: string;
  targetType: string;
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'closed';
  createdAt: Date;
  lastActivity?: Date;
}

/**
 * 简单的文件数据库
 */
class SessionDatabase {
  private dataPath: string;
  private data: Map<string, SessionRecord> = new Map();
  private dirty: boolean = false;

  constructor() {
    this.dataPath = path.join(process.cwd(), '.data', 'sessions.json');
    this.ensureDataDirectory();
    this.load();
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDirectory(): void {
    const dir = path.dirname(this.dataPath);
    try {
      fs.mkdir(dir, { recursive: true });
    } catch {
      // 目录可能已存在
    }
  }

  /**
   * 从文件加载数据
   */
  private load(): void {
    try {
      const content = fs.readFile(this.dataPath, 'utf-8');
      const data = JSON.parse(content);

      for (const record of data) {
        this.data.set(record.id, {
          ...record,
          createdAt: new Date(record.createdAt),
          lastActivity: record.lastActivity
            ? new Date(record.lastActivity)
            : undefined,
        });
      }

      console.log(`📂 Loaded ${this.data.size} sessions from database`);
    } catch (error) {
      console.log('No existing session database found, starting fresh');
    }
  }

  /**
   * 保存数据到文件
   */
  private async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }

    try {
      const data = Array.from(this.data.values());
      await fs.writeFile(
        this.dataPath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      this.dirty = false;
    } catch (error) {
      console.error('Failed to save session database:', error);
    }
  }

  /**
   * 保存或更新 Session
   */
  save(record: SessionRecord): void {
    this.data.set(record.id, record);
    this.dirty = true;
    this.save().catch(console.error);
  }

  /**
   * 获取 Session
   */
  get(id: string): SessionRecord | null {
    return this.data.get(id) || null;
  }

  /**
   * 获取用户的所有 Session
   */
  getByUserId(userId: string): SessionRecord[] {
    return Array.from(this.data.values()).filter(
      (r) => r.userId === userId
    );
  }

  /**
   * 根据 targetId 查找
   */
  findByTargetId(targetId: string): SessionRecord | null {
    return (
      Array.from(this.data.values()).find((r) => r.targetId === targetId) ||
      null
    );
  }

  /**
   * 更新状态
   */
  updateStatus(id: string, status: SessionRecord['status']): void {
    const record = this.data.get(id);
    if (record) {
      record.status = status;
      this.dirty = true;
      this.save().catch(console.error);
    }
  }

  /**
   * 更新最后活动时间
   */
  updateLastActivity(id: string): void {
    const record = this.data.get(id);
    if (record) {
      record.lastActivity = new Date();
      this.dirty = true;
      this.save().catch(console.error);
    }
  }

  /**
   * 获取用户 ID
   */
  getUserId(id: string): string | undefined {
    return this.data.get(id)?.userId;
  }

  /**
   * 删除 Session
   */
  delete(id: string): void {
    if (this.data.delete(id)) {
      this.dirty = true;
      this.save().catch(console.error);
    }
  }

  /**
   * 获取所有 Session
   */
  getAll(): SessionRecord[] {
    return Array.from(this.data.values());
  }

  /**
   * 清理所有数据
   */
  clear(): void {
    this.data.clear();
    this.dirty = true;
    this.save().catch(console.error);
  }

  /**
   * 清理过期数据（超过指定天数）
   */
  cleanup(daysToKeep: number = 7): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    let deleted = 0;

    for (const [id, record] of this.data.entries()) {
      if (record.createdAt < cutoff) {
        this.data.delete(id);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.dirty = true;
      this.save().catch(console.error);
      console.log(`🧹 Cleaned up ${deleted} old sessions`);
    }
  }
}

// 单例实例
export const sessionDB = new SessionDatabase();
