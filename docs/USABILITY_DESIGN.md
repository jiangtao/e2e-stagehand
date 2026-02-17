# 易用性设计 - 隐藏 CDP 技术细节

## 核心原则

**用户不应该知道什么是 CDP、什么是 remote-debugging-port**

## 当前问题

用户需要：
1. 知道 `--remote-debugging-port=9222` 这个参数
2. 手动启动 Electron 时添加这个参数
3. 手动输入端口号

**这对 QA/产品经理来说太复杂了！**

## 更易用的设计

### 方案 1: 自动扫描 + 一键连接

```
┌─────────────────────────────────────────────────────────────────┐
│  自动发现运行中的应用                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│  正在扫描本地运行的应用...                                  │
│                                                         │
│  ✅ 找到 2 个可用目标                                      │
│                                                         │
│  ┌────────────────────────────────────────────────────┐       │
│  │  [选择]  Electron App - 我的笔记应用               │       │
│  │          端口 9222  |  自动检测                    │       │
│  └────────────────────────────────────────────────────┘       │
│                                                         │
│  ┌────────────────────────────────────────────────────┐       │
│  │  [选择]  Chrome Browser                        │       │
│  │          端口 9223  |  自动检测                    │       │
│  └────────────────────────────────────────────────────┘       │
│                                                         │
│  [开始测试]                                                │
│                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 方案 2: CLI 一键启动脚本

为用户提供一个简单的启动命令：

```bash
# 用户只需要运行这个命令
npx stagehand-electron launch ./my-electron-app

# 自动：
# 1. 启动 Electron 并添加 --remote-debugging-port
# 2. 打开 Web 界面
# 3. 自动连接
```

启动脚本实现：

```typescript
// src/cli/commands/launch.ts
export async function launchCommand(appPath: string) {
  // 1. 找到空闲端口
  const port = await findFreePort(9222);

  // 2. 自动添加调试参数
  const command = `"${appPath}" --remote-debugging-port=${port}`;

  // 3. 启动应用
  const process = spawn(command, {
    shell: true,
    detached: true,
    stdio: 'ignore'
  });

  console.log(`🚀 启动应用: ${appPath}`);
  console.log(`📡 调试端口: ${port}`);
  console.log(`⏳ 等待应用就绪...`);

  // 4. 等待端口就绪
  await waitForPort(port, 10000);

  console.log(`✅ 应用已就绪！`);
  console.log(`🌐 打开测试界面: http://localhost:3000`);

  // 5. 自动打开浏览器
  open(`http://localhost:3000?autoConnect=localhost:${port}`);
}
```

### 方案 3: 代码注入 - 无需修改启动命令

对于已运行的 Electron 应用，提供注入工具：

```bash
# 应用已经在运行，无需重启
npx stagehand-electron inject --pid 12345

# 自动：
# 1. 检测进程的 Electron 版本
# 2. 注入调试模块启用 CDP
# 3. 返回可用端口
```

*注意：这个方案技术复杂度较高，可以作为可选功能*

### 方案 4: 智能 Port 检测

```typescript
class AutoPortDetector {
  /**
   * 自动扫描常用端口范围，找到可用的 CDP 端点
   */
  async detectTargets(): Promise<TargetInfo[]> {
    const targets: TargetInfo[] = [];

    // 扫描常用端口范围 9222-9232
    for (let port = 9222; port <= 9232; port++) {
      try {
        const response = await fetch(`http://localhost:${port}/json`, {
          signal: AbortSignal.timeout(100) // 快速超时
        });

        if (response.ok) {
          const data = await response.json();

          // 识别是 Chrome 还是 Electron
          const isElectron = data.some((t: any) =>
            t.title?.includes('Electron') ||
            t.webSocketDebuggerUrl?.includes('electron')
          );

          targets.push({
            port,
            type: isElectron ? 'electron' : 'chrome',
            url: data[0]?.url,
            title: data[0]?.title,
            autoDetected: true
          });
        }
      } catch {
        // 端口不可用，跳过
      }
    }

    return targets;
  }
}
```

## 用户流程对比

### ❌ 当前流程（复杂）

```
1. 用户打开终端
2. 用户输入: my-app.exe --remote-debugging-port=9222
3. 用户记住端口号 9222
4. 用户打开 Web 界面
5. 用户输入端口号 9222
6. 点击连接
```

### ✅ 新流程（简单）

```
方式 A - 自动扫描：
1. 用户打开 Web 界面
2. 界面自动显示: "发现 Electron App - 我的应用"
3. 用户点击"开始测试"

方式 B - 一键启动：
1. 用户输入: npx stagehand-electron launch ./my-app
2. Web 界面自动打开并连接
3. 用户立即开始测试
```

## Web URL 的易用性

对于 Web URL 测试，用户只需要：

```
┌─────────────────────────────────────────────────────────────────┐
│  测试网页                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│  输入网址:                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ https://example.com                               │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                         │
│  浏览器选项:                                             │
│  ○ 无痕模式                                              │
│  ○ 显示浏览器窗口                                          │
│                                                         │
│  [开始测试]                                                │
│                                                         │
└─────────────────────────────────────────────────────────────────┘
```

**不需要用户知道 Chrome 从哪里启动、版本是什么**。

## 多平台同时测试的易用性

```
┌─────────────────────────────────────────────────────────────────┐
│  选择要测试的平台                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│  检测到的应用:                                            │
│  ☑ Electron - 我的笔记应用 (port 9222)                      │
│  ☑ Chrome 网页版 (https://example.com)                      │
│  ☐ 添加更多...                                            │
│                                                         │
│  ─────────────────────────────────────────────────────────      │
│                                                         │
│  测试操作:                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 点击登录按钮，输入用户名 admin，输入密码 123456      │    │
│  │ 然后点击提交                                          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                         │
│  [同时在 2 个平台上运行]                                    │
│                                                         │
└─────────────────────────────────────────────────────────────────┘
```

## 后端实现 - 自动端口扫描

```typescript
// src/lib/target/auto-detector.ts
import { fetch } from 'undici';

export interface DetectedTarget {
  port: number;
  type: 'electron' | 'chrome' | 'unknown';
  url?: string;
  title?: string;
  favicon?: string;
}

export class TargetAutoDetector {
  /**
   * 扫描常用端口范围
   */
  async scan(rangeStart = 9222, rangeEnd = 9242): Promise<DetectedTarget[]> {
    const targets: DetectedTarget[] = [];

    // 并发扫描（快速）
    const scanPromises = [];
    for (let port = rangeStart; port <= rangeEnd; port++) {
      scanPromises.push(this.tryPort(port));
    }

    const results = await Promise.all(scanPromises);

    for (const result of results) {
      if (result) {
        targets.push(result);
      }
    }

    return targets;
  }

  /**
   * 尝试单个端口
   */
  private async tryPort(port: number): Promise<DetectedTarget | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 200);

      const response = await fetch(`http://localhost:${port}/json/version`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const versionInfo = await response.json();

      // 获取详细目标信息
      const targetsResponse = await fetch(`http://localhost:${port}/json`);
      const targetsList = await targetsResponse.json();

      const firstTarget = targetsList[0];

      // 判断类型
      let type: DetectedTarget['type'] = 'chrome';
      if (versionInfo['Browser']?.includes('Electron') ||
          firstTarget?.title?.includes('Electron')) {
        type = 'electron';
      }

      return {
        port,
        type,
        url: firstTarget?.url,
        title: firstTarget?.title,
        favicon: firstTarget?.faviconUrl
      };

    } catch {
      return null;
    }
  }

  /**
   * 监听端口变化（实时发现新启动的应用）
   */
  async watchChanges(callback: (added: DetectedTarget[], removed: number[]) => void): Promise<() => void> {
    const knownPorts = new Set<number>();
    let intervalId: NodeJS.Timeout;

    const scan = async () => {
      const targets = await this.scan();
      const currentPorts = new Set(targets.map(t => t.port));

      // 新增的端口
      const added = targets.filter(t => !knownPorts.has(t.port));

      // 移除的端口
      const removed = Array.from(knownPorts).filter(p => !currentPorts.has(p));

      if (added.length > 0 || removed.length > 0) {
        callback(added, removed);
      }

      // 更新已知端口
      knownPorts.clear();
      targets.forEach(t => knownPorts.add(t.port));
    };

    // 初始扫描
    await scan();

    // 定期扫描
    intervalId = setInterval(scan, 3000); // 每 3 秒扫描一次

    // 返回清理函数
    return () => clearInterval(intervalId);
  }
}
```

## API 端点

```typescript
// src/app/api/targets/scan/route.ts
import { TargetAutoDetector } from '@/lib/target/auto-detector';

export async function GET() {
  const detector = new TargetAutoDetector();
  const targets = await detector.scan();

  return Response.json({
    targets: targets.map(t => ({
      id: `localhost:${t.port}`,
      name: t.title || `Application on port ${t.port}`,
      type: t.type,
      port: t.port,
      url: t.url,
      favicon: t.favicon,
      autoDetected: true
    }))
  });
}

// src/app/api/targets/watch/route.ts
export async function GET(request: Request) {
  const detector = new TargetAutoDetector();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      detector.watchChanges(async (added, removed) => {
        const data = JSON.stringify({ added, removed });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

## 前端实时更新

```typescript
// src/components/TargetSelector.tsx
'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

export function TargetSelector() {
  const [targets, setTargets] = useState<DetectedTarget[]>([]);

  // 初始扫描
  const { data } = useSWR('/api/targets/scan', fetcher);

  // SSE 实时更新
  useEffect(() => {
    const eventSource = new EventSource('/api/targets/watch');

    eventSource.onmessage = (event) => {
      const { added, removed } = JSON.parse(event.data);

      setTargets(prev => {
        // 移除断开的
        let updated = prev.filter(t => !removed.includes(t.port));

        // 添加新发现的
        updated = [...updated, ...added];

        return updated;
      });
    };

    return () => eventSource.close();
  }, []);

  return (
    <div>
      <h2>选择测试目标</h2>
      {targets.map(target => (
        <TargetCard
          key={target.port}
          target={target}
          onSelect={() => selectTarget(target)}
        />
      ))}
    </div>
  );
}
```

## 术语优化

| 技术术语 | 用户友好术语 |
|---------|-------------|
| CDP Port | 调试端口 |
| Remote Debugging | 自动检测 |
| WebSocket URL | （隐藏） |
| Electron Instance | Electron 应用 |
| Chrome Browser | Chrome 浏览器 |
| Target | 测试目标 |
| Session | 测试会话 |

## 总结

**核心原则**: 零配置、自动发现、一键开始

用户只需：
1. 打开界面（自动检测或一键启动）
2. 输入网址/选择应用
3. 开始测试

不需要理解 CDP、端口、调试参数等技术细节。
