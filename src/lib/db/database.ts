import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { ElectronInstance } from '@/types';

const DB_DIR = join(process.cwd(), '.stagehand');
const DB_PATH = join(DB_DIR, 'stagehand.db');

// 确保数据库目录存在
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用外键约束
db.pragma('foreign_keys = ON');

/**
 * 初始化数据库表
 */
export function initDatabase(): void {
  // 创建用户表（简化版，MVP 不需要密码认证）
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 创建代理客户端表
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      token TEXT UNIQUE,
      status TEXT NOT NULL CHECK(status IN ('connected', 'disconnected', 'error')),
      connected_at TEXT,
      last_heartbeat TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建实例表
  db.exec(`
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      port INTEGER NOT NULL,
      app_path TEXT,
      pid INTEGER,
      status TEXT NOT NULL CHECK(status IN ('connected', 'disconnected', 'error')),
      connected_at TEXT NOT NULL,
      last_activity TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      instance_id TEXT,
      filename TEXT NOT NULL,
      file_path TEXT,
      content TEXT,
      description TEXT,
      action TEXT,
      status TEXT NOT NULL CHECK(status IN ('uploaded', 'pending', 'running', 'completed', 'failed')),
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_instances_user_id ON instances(user_id);
    CREATE INDEX IF NOT EXISTS idx_instances_port ON instances(port);
    CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_instance_id ON tasks(instance_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
    CREATE INDEX IF NOT EXISTS idx_agents_token ON agents(token);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
  `);

  // 数据库迁移：添加新列（如果不存在）
  try {
    // 检查 instance_type 列是否存在
    const columns = db.prepare("PRAGMA table_info(instances)").all() as any[];
    const hasInstanceType = columns.some(col => col.name === 'instance_type');
    const hasIncognito = columns.some(col => col.name === 'incognito');

    if (!hasInstanceType) {
      db.exec('ALTER TABLE instances ADD COLUMN instance_type TEXT DEFAULT \'electron\'');
      console.log('✅ Added instance_type column to instances table');
    }

    if (!hasIncognito) {
      db.exec('ALTER TABLE instances ADD COLUMN incognito INTEGER DEFAULT 0');
      console.log('✅ Added incognito column to instances table');
    }

    // 更新现有记录的默认值
    if (hasInstanceType || hasIncognito) {
      db.exec(`
        UPDATE instances 
        SET instance_type = COALESCE(instance_type, 'electron'),
            incognito = COALESCE(incognito, 0)
        WHERE instance_type IS NULL OR incognito IS NULL
      `);
    }
  } catch (error) {
    console.warn('⚠️  Database migration warning:', error);
  }

  console.log('✅ Database initialized');
}

// 初始化数据库
initDatabase();

/**
 * 水果名称列表
 */
const FRUIT_NAMES = [
  'apple', 'banana', 'orange', 'grape', 'strawberry',
  'watermelon', 'pineapple', 'mango', 'kiwi', 'peach',
  'cherry', 'blueberry', 'raspberry', 'blackberry', 'plum',
  'apricot', 'pear', 'lemon', 'lime', 'coconut',
  'papaya', 'dragonfruit', 'lychee', 'passionfruit', 'guava',
  'pomegranate', 'fig', 'date', 'persimmon', 'cantaloupe'
];

/**
 * 生成随机用户名（水果名称 + id 后缀）
 */
function generateRandomUsername(userId: string): string {
  // 随机选择一个水果名称
  const fruitName = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
  
  // 从 userId 中提取后缀
  // userId 格式通常是: user-{timestamp}-{randomString}
  // 我们提取最后的随机字符串部分，如果格式不同则取最后 6 位字符
  let idSuffix: string;
  const match = userId.match(/user-\d+-(.+)$/);
  if (match && match[1]) {
    // 提取随机字符串部分，取最后 6 位
    idSuffix = match[1].slice(-6);
  } else {
    // 如果格式不匹配，直接取最后 6 位字符
    idSuffix = userId.slice(-6);
  }
  
  return `${fruitName}-${idSuffix}`;
}

/**
 * 获取或创建用户
 */
export function getOrCreateUser(userId: string): { id: string; username?: string; createdAt: string; lastSeenAt: string } {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  
  if (existing) {
    // 更新最后访问时间
    db.prepare('UPDATE users SET last_seen_at = datetime(\'now\') WHERE id = ?').run(userId);
    
    // 如果用户没有 username，自动生成一个
    if (!existing.username) {
      const generatedUsername = generateRandomUsername(userId);
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(generatedUsername, userId);
      return {
        id: existing.id,
        username: generatedUsername,
        createdAt: existing.created_at,
        lastSeenAt: existing.last_seen_at
      };
    }
    
    return {
      id: existing.id,
      username: existing.username || undefined,
      createdAt: existing.created_at,
      lastSeenAt: existing.last_seen_at
    };
  }
  
  // 创建新用户，自动生成 username
  const now = new Date().toISOString();
  const generatedUsername = generateRandomUsername(userId);
  db.prepare('INSERT INTO users (id, username, created_at, last_seen_at) VALUES (?, ?, ?, ?)').run(
    userId,
    generatedUsername,
    now,
    now
  );
  
  return {
    id: userId,
    username: generatedUsername,
    createdAt: now,
    lastSeenAt: now
  };
}

/**
 * 更新用户信息
 */
export function updateUser(userId: string, username?: string): void {
  if (username !== undefined) {
    // 如果 username 为空字符串或 null，自动生成一个随机用户名
    const finalUsername = username && username.trim() ? username.trim() : generateRandomUsername(userId);
    db.prepare('UPDATE users SET username = ?, last_seen_at = datetime(\'now\') WHERE id = ?').run(finalUsername, userId);
  } else {
    db.prepare('UPDATE users SET last_seen_at = datetime(\'now\') WHERE id = ?').run(userId);
  }
}

/**
 * 实例数据库操作
 */
export const instanceDB = {
  /**
   * 保存实例
   */
  save(instance: ElectronInstance & { userId: string }): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO instances 
      (id, user_id, port, app_path, pid, status, connected_at, last_activity, instance_type, incognito, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(
      instance.id,
      instance.userId,
      instance.port,
      instance.appPath || null,
      instance.pid || null,
      instance.status,
      instance.connectedAt.toISOString(),
      instance.lastActivity.toISOString(),
      instance.instanceType || 'electron',
      instance.incognito ? 1 : 0
    );
  },

  /**
   * 根据 ID 查找实例
   */
  findById(instanceId: string): (ElectronInstance & { userId: string }) | null {
    const row = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      port: row.port,
      appPath: row.app_path || undefined,
      pid: row.pid || undefined,
      status: row.status as ElectronInstance['status'],
      connectedAt: new Date(row.connected_at),
      lastActivity: new Date(row.last_activity),
      instanceType: (row.instance_type as 'electron' | 'chrome') || 'electron',
      incognito: row.incognito === 1,
      agentId: row.agent_id || undefined,
      connectionType: (row.connection_type as 'local' | 'remote') || 'local'
    };
  },

  /**
   * 根据端口查找实例
   */
  findByPort(port: number, userId?: string): (ElectronInstance & { userId: string }) | null {
    let row: any;
    
    if (userId) {
      row = db.prepare('SELECT * FROM instances WHERE port = ? AND user_id = ?').get(port, userId);
    } else {
      row = db.prepare('SELECT * FROM instances WHERE port = ?').get(port);
    }
    
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      port: row.port,
      appPath: row.app_path || undefined,
      pid: row.pid || undefined,
      status: row.status as ElectronInstance['status'],
      connectedAt: new Date(row.connected_at),
      lastActivity: new Date(row.last_activity),
      instanceType: (row.instance_type as 'electron' | 'chrome') || 'electron',
      incognito: row.incognito === 1,
      agentId: row.agent_id || undefined,
      connectionType: (row.connection_type as 'local' | 'remote') || 'local'
    };
  },

  /**
   * 查找用户的所有实例
   */
  findByUserId(userId: string): (ElectronInstance & { userId: string })[] {
    const rows = db.prepare('SELECT * FROM instances WHERE user_id = ? ORDER BY connected_at DESC').all(userId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      port: row.port,
      appPath: row.app_path || undefined,
      pid: row.pid || undefined,
      status: row.status as ElectronInstance['status'],
      connectedAt: new Date(row.connected_at),
      lastActivity: new Date(row.last_activity),
      instanceType: (row.instance_type as 'electron' | 'chrome') || 'electron',
      incognito: row.incognito === 1,
      agentId: row.agent_id || undefined,
      connectionType: (row.connection_type as 'local' | 'remote') || 'local'
    }));
  },

  /**
   * 更新实例状态
   */
  updateStatus(instanceId: string, status: ElectronInstance['status']): void {
    db.prepare('UPDATE instances SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, instanceId);
  },

  /**
   * 更新最后活动时间
   */
  updateLastActivity(instanceId: string): void {
    db.prepare('UPDATE instances SET last_activity = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?').run(instanceId);
  },

  /**
   * 删除实例
   */
  delete(instanceId: string): void {
    db.prepare('DELETE FROM instances WHERE id = ?').run(instanceId);
  },

  /**
   * 查找所有连接的实例
   */
  findConnected(userId?: string): (ElectronInstance & { userId: string })[] {
    let rows: any[];
    
    if (userId) {
      rows = db.prepare('SELECT * FROM instances WHERE status = \'connected\' AND user_id = ?').all(userId) as any[];
    } else {
      rows = db.prepare('SELECT * FROM instances WHERE status = \'connected\'').all() as any[];
    }
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      port: row.port,
      appPath: row.app_path || undefined,
      pid: row.pid || undefined,
      status: row.status as ElectronInstance['status'],
      connectedAt: new Date(row.connected_at),
      lastActivity: new Date(row.last_activity),
      instanceType: (row.instance_type as 'electron' | 'chrome') || 'electron',
      incognito: row.incognito === 1,
      agentId: row.agent_id || undefined,
      connectionType: (row.connection_type as 'local' | 'remote') || 'local'
    }));
  }
};

/**
 * 任务数据库操作
 */
export const taskDB = {
  /**
   * 保存任务
   */
  save(task: {
    id: string;
    userId: string;
    instanceId?: string;
    filename: string;
    filePath?: string;
    content?: string;
    description?: string;
    action?: string;
    status: 'uploaded' | 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
    error?: string;
    completedAt?: Date;
  }): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO tasks 
      (id, user_id, instance_id, filename, file_path, content, description, action, status, result, error, completed_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(
      task.id,
      task.userId,
      task.instanceId || null,
      task.filename,
      task.filePath || null,
      task.content || null,
      task.description || null,
      task.action || null,
      task.status,
      task.result ? JSON.stringify(task.result) : null,
      task.error || null,
      task.completedAt ? task.completedAt.toISOString() : null
    );
  },

  /**
   * 根据 ID 查找任务
   */
  findById(taskId: string): any | null {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      instanceId: row.instance_id || undefined,
      filename: row.filename,
      filePath: row.file_path || undefined,
      content: row.content || undefined,
      description: row.description || undefined,
      action: row.action || undefined,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    };
  },

  /**
   * 查找用户的所有任务
   */
  findByUserId(userId: string): any[] {
    const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      instanceId: row.instance_id || undefined,
      filename: row.filename,
      filePath: row.file_path || undefined,
      content: row.content || undefined,
      description: row.description || undefined,
      action: row.action || undefined,
      status: row.status,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error || undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined
    }));
  },

  /**
   * 更新任务状态
   */
  updateStatus(taskId: string, status: 'uploaded' | 'pending' | 'running' | 'completed' | 'failed', result?: any, error?: string): void {
    const completedAt = status === 'completed' || status === 'failed' ? new Date().toISOString() : null;
    
    db.prepare(`
      UPDATE tasks 
      SET status = ?, result = ?, error = ?, completed_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      status,
      result ? JSON.stringify(result) : null,
      error || null,
      completedAt,
      taskId
    );
  },

  /**
   * 删除任务
   */
  delete(taskId: string): void {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  }
};

/**
 * 代理客户端数据库操作
 */
export const agentDB = {
  /**
   * 保存代理客户端
   */
  save(agent: {
    id: string;
    userId: string;
    name?: string;
    token: string;
    status: 'connected' | 'disconnected' | 'error';
    connectedAt?: Date;
    lastHeartbeat?: Date;
  }): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO agents 
      (id, user_id, name, token, status, connected_at, last_heartbeat, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(
      agent.id,
      agent.userId,
      agent.name || null,
      agent.token,
      agent.status,
      agent.connectedAt ? agent.connectedAt.toISOString() : null,
      agent.lastHeartbeat ? agent.lastHeartbeat.toISOString() : null
    );
  },

  /**
   * 根据 ID 查找代理客户端
   */
  findById(agentId: string): any | null {
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name || undefined,
      token: row.token,
      status: row.status,
      connectedAt: row.connected_at ? new Date(row.connected_at) : undefined,
      lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  },

  /**
   * 根据 token 查找代理客户端
   */
  findByToken(token: string): any | null {
    const row = db.prepare('SELECT * FROM agents WHERE token = ?').get(token) as any;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name || undefined,
      token: row.token,
      status: row.status,
      connectedAt: row.connected_at ? new Date(row.connected_at) : undefined,
      lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  },

  /**
   * 查找用户的所有代理客户端
   */
  findByUserId(userId: string): any[] {
    const rows = db.prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY connected_at DESC').all(userId) as any[];
    
    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name || undefined,
      token: row.token,
      status: row.status,
      connectedAt: row.connected_at ? new Date(row.connected_at) : undefined,
      lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  },

  /**
   * 更新代理客户端状态
   */
  updateStatus(agentId: string, status: 'connected' | 'disconnected' | 'error'): void {
    db.prepare('UPDATE agents SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, agentId);
  },

  /**
   * 更新心跳时间
   */
  updateHeartbeat(agentId: string): void {
    db.prepare('UPDATE agents SET last_heartbeat = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?').run(agentId);
  },

  /**
   * 删除代理客户端
   */
  delete(agentId: string): void {
    db.prepare('DELETE FROM agents WHERE id = ?').run(agentId);
  }
};

// 导出数据库实例（用于需要直接访问的场景）
export { db };

// 关闭数据库连接（在应用退出时调用）
export function closeDatabase(): void {
  db.close();
}

