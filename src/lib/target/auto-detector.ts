/**
 * 自动端口扫描器
 * 自动发现本地运行的 Chrome/Electron 实例
 */

import { DetectedTarget, TargetType } from './types';

/**
 * 自动端口扫描器
 * 扫描常用端口范围，自动发现 Chrome 和 Electron 实例
 */
export class TargetAutoDetector {
  private readonly DEFAULT_PORT_RANGE = { start: 9222, end: 9242 };
  private readonly SCAN_TIMEOUT_MS = 200;
  private readonly PORT_CHECK_TIMEOUT_MS = 5000;

  private knownTargets: Map<number, DetectedTarget> = new Map();
  private scanInProgress: boolean = false;

  /**
   * 扫描端口范围，返回所有可用的目标
   */
  async scan(options?: {
    portRange?: { start: number; end: number };
    concurrent?: boolean;
  }): Promise<DetectedTarget[]> {
    if (this.scanInProgress) {
      return Array.from(this.knownTargets.values());
    }

    this.scanInProgress = true;

    try {
      const { start = 9222, end = 9242 } = options?.portRange || this.DEFAULT_PORT_RANGE;
      const concurrent = options?.concurrent !== false;

      const targets: DetectedTarget[] = [];

      if (concurrent) {
        // 并发扫描（更快）
        const scanPromises: Promise<DetectedTarget | null>[] = [];
        for (let port = start; port <= end; port++) {
          scanPromises.push(this.tryPort(port));
        }
        const results = await Promise.all(scanPromises);
        for (const result of results) {
          if (result) {
            targets.push(result);
            this.knownTargets.set(result.port, result);
          }
        }
      } else {
        // 串行扫描（更稳定）
        for (let port = start; port <= end; port++) {
          const result = await this.tryPort(port);
          if (result) {
            targets.push(result);
            this.knownTargets.set(result.port, result);
          }
        }
      }

      return targets;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * 尝试连接单个端口
   */
  async tryPort(port: number): Promise<DetectedTarget | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.SCAN_TIMEOUT_MS);

      // 1. 首先检查版本信息（快速判断是否有 CDP 服务）
      const versionResponse = await fetch(`http://localhost:${port}/json/version`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!versionResponse.ok) {
        return null;
      }

      const versionInfo = await versionResponse.json();

      // 2. 获取目标列表
      const targetsResponse = await fetch(`http://localhost:${port}/json`);
      if (!targetsResponse.ok) {
        return null;
      }

      const targetsList = await targetsResponse.json();

      // 3. 找到第一个页面目标
      const pageTarget = targetsList.find(
        (t: any) => t.type === 'page'
      );

      if (!pageTarget) {
        return null;
      }

      // 4. 判断是 Chrome 还是 Electron
      let type: TargetType = 'chrome';
      const browser = versionInfo['Browser'];
      const product = versionInfo['Product'];

      if (browser?.includes('Electron') ||
          product?.includes('Electron') ||
          (pageTarget as any).title?.includes('Electron')) {
        type = 'electron';
      }

      return {
        port,
        type,
        url: pageTarget.url,
        title: (pageTarget as any).title || `Application on port ${port}`,
        favicon: (pageTarget as any).faviconUrl,
        wsUrl: (pageTarget as any).webSocketDebuggerUrl,
        autoDetected: true,
      };

    } catch {
      // 端口不可用，返回 null
      return null;
    }
  }

  /**
   * 监听端口变化，实时发现新启动的应用
   * 返回清理函数
   */
  watchChanges(
    callback: (added: DetectedTarget[], removed: number[]) => void,
    options?: {
      intervalMs?: number;
      portRange?: { start: number; end: number };
    }
  ): () => void {
    const { intervalMs = 3000 } = options || {};
    let intervalId: NodeJS.Timeout | null = null;

    const scan = async () => {
      const targets = await this.scan(options);
      const currentPorts = new Set(targets.map((t) => t.port));
      const previousPorts = new Set(this.knownTargets.keys());

      // 找到新增的端口
      const added = targets.filter((t) => !previousPorts.has(t.port));

      // 找到移除的端口
      const removed: number[] = [];
      for (const port of previousPorts) {
        if (!currentPorts.has(port)) {
          removed.push(port);
          this.knownTargets.delete(port);
        }
      }

      // 更新已知目标
      this.knownTargets.clear();
      for (const target of targets) {
        this.knownTargets.set(target.port, target);
      }

      // 如果有变化，触发回调
      if (added.length > 0 || removed.length > 0) {
        callback(added, removed);
      }
    };

    // 立即执行一次扫描
    scan().catch(console.error);

    // 定期扫描
    intervalId = setInterval(scan, intervalMs);

    // 返回清理函数
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }

  /**
   * 获取已知的所有目标
   */
  getKnownTargets(): DetectedTarget[] {
    return Array.from(this.knownTargets.values());
  }

  /**
   * 根据 ID 查找目标
   */
  findTarget(id: string): DetectedTarget | null {
    // ID 格式可能是 "electron-9222" 或 "chrome-9223" 或直接是端口号
    const portMatch = id.match(/(\d{4,5})$/);
    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      return this.knownTargets.get(port) || null;
    }
    return null;
  }
}

// 单例实例
export const targetAutoDetector = new TargetAutoDetector();
