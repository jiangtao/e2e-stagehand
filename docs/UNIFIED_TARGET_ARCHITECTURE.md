# 统一目标(Target)架构设计

## 问题陈述

AI e2e 测试需要同时支持：
1. **网页版测试** - 用户输入 URL，自动启动 Chrome
2. **Electron 应用测试** - 连接到已有 Electron 实例
3. **已有 Chrome 实例** - 连接到运行中的 Chrome

现有架构中，Web URL 和 Electron 的处理流程不同，需要统一收敛。

## 核心发现

### Stagehand v3 的两种连接模式

**模式 1: 启动新浏览器**（适用于 Web URL 测试）
```typescript
import { V3Context } from '@browserbasehq/stagehand';

const context = await V3Context.create('ws://dummy', {
  env: 'LOCAL',
  localBrowserLaunchOptions: {
    headless: false,
    args: ['--start-maximized']
  }
});

const page = await context.page();
await page.goto('https://example.com');
```

**模式 2: 连接已有 CDP**（适用于 Electron/已有 Chrome）
```typescript
import { CdpConnection, V3Context } from '@browserbasehq/stagehand';

// 1. 连接到 CDP WebSocket
const cdpConnection = await CdpConnection.connect('ws://localhost:9222/devtools/page/ABC123');

// 2. 创建 V3Context
const context = await V3Context.create('ws://localhost:9222', {
  env: 'LOCAL',
  apiClient: null,
  localBrowserLaunchOptions: null
});

// 3. 通过 attachToTarget 获取页面
const session = await cdpConnection.attachToTarget(targetId);
```

### CDP 端点格式

Chrome 和 Electron 通过 `--remote-debugging-port` 暴露 CDP 端口：

```
Electron/Chrome 启动参数:
  --remote-debugging-port=9222

可用的 HTTP 端点:
  http://localhost:9222/json              - 列出所有 targets
  http://localhost:9222/json/version       - 版本信息
  http://localhost:9222/json/protocol      - 可用协议

可用 WebSocket 端点 (从 /json 获取):
  ws://localhost:9222/devtools/page/ABC123
  ws://localhost:9222/devtools/browser/XYZ789
```

## 统一目标(Target)抽象

### 核心接口设计

```typescript
/**
 * 统一的目标类型
 */
interface Target {
  id: string;
  type: 'web-url' | 'electron' | 'chrome';
  displayName: string;

  // 连接到目标并返回 CDP WebSocket URL
  connect(): Promise<string>;

  // 断开连接
  disconnect(): Promise<void>;

  // 检查连接状态
  isConnected(): boolean;
}

/**
 * Web URL 目标 - 启动新的 Chrome
 */
class WebUrlTarget implements Target {
  constructor(
    public id: string,
    public url: string,
    public options?: BrowserLaunchOptions
  ) {}

  get type(): 'web-url' { return 'web-url'; }
  get displayName(): string { return this.url; }

  async connect(): Promise<string> {
    // 使用 Stagehand 的 V3Context.create
    // 启动新 Chrome 并返回 context
    const context = await V3Context.create('ws://dummy', {
      env: 'LOCAL',
      localBrowserLaunchOptions: {
        headless: this.options?.headless ?? false,
        args: this.options?.args
      }
    });

    // 导航到目标 URL
    const page = await context.page();
    await page.goto(this.url);

    return context; // 返回初始化好的 context
  }

  async disconnect(): Promise<void> {
    // 关闭启动的 Chrome
  }

  isConnected(): boolean {
    // 检查 Chrome 是否运行
  }
}

/**
 * Electron 目标 - 连接到已有 Electron 实例
 */
class ElectronTarget implements Target {
  constructor(
    public id: string,
    public port: number,
    public appPath?: string
  ) {}

  get type(): 'electron' { return 'electron'; }
  get displayName(): string { return `Electron (port ${this.port})`; }

  async connect(): Promise<string> {
    // 1. 获取 CDP WebSocket URL
    const targets = await fetch(`http://localhost:${this.port}/json`).then(r => r.json());
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
      throw new Error(`No page target found on port ${this.port}`);
    }

    const wsUrl = pageTarget.webSocketDebuggerUrl;

    // 2. 连接到 CDP
    const cdpConnection = await CdpConnection.connect(wsUrl);

    // 3. 创建 V3Context
    const context = await V3Context.create(wsUrl, {
      env: 'LOCAL',
      apiClient: null,
      localBrowserLaunchOptions: null
    });

    return context;
  }

  async disconnect(): Promise<void> {
    // 断开 CDP 连接
  }

  isConnected(): boolean {
    // 检查 CDP 连接是否活跃
  }
}

/**
 * Chrome 目标 - 连接到已有 Chrome 实例
 */
class ChromeTarget implements Target {
  constructor(
    public id: string,
    public port: number
  ) {}

  get type(): 'chrome' { return 'chrome'; }
  get displayName(): string { return `Chrome (port ${this.port})`; }

  async connect(): Promise<string> {
    // 与 ElectronTarget 类似的逻辑
    // 获取 WebSocket URL 并连接
  }
}
```

### Session 管理器

```typescript
/**
 * 统一的 Session 管理
 */
class SessionManager {
  private sessions: Map<string, {
    target: Target;
    context: any; // V3Context
    stagehand: any; // Stagehand instance
  }> = new Map();

  /**
   * 创建新的测试 Session
   */
  async createSession(target: Target): Promise<string> {
    const sessionId = `${target.type}-${Date.now()}`;

    // 1. 连接到目标
    const context = await target.connect();

    // 2. 初始化 Stagehand
    // 注意：如果目标已经提供了 context，Stagehand 可能不需要启动自己的浏览器
    const stagehand = new Stagehand({
      env: 'LOCAL',
      // 传递已有的 context
    });

    await stagehand.init();

    // 3. 存储 Session
    this.sessions.set(sessionId, { target, context, stagehand });

    return sessionId;
  }

  /**
   * 获取 Session
   */
  getSession(sessionId: string) {
    return this.sessions.get(sessionId);
  }

  /**
   * 关闭 Session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    await session.stagehand.close();
    await session.target.disconnect();

    this.sessions.delete(sessionId);
  }

  /**
   * 在多个 Session 上同时执行操作
   */
  async executeOnMultiple(
    sessionIds: string[],
    action: string
  ): Promise<Map<string, any>> {
    const results = new Map();

    await Promise.all(
      sessionIds.map(async (sessionId) => {
        const session = this.sessions.get(sessionId);
        if (session) {
          const result = await session.stagehand.act(action);
          results.set(sessionId, result);
        }
      })
    );

    return results;
  }
}
```

## 用户流程设计

### 简化后的流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户界面                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  选择目标                                          │    │
│  │                                                    │    │
│  │  ○ Web URL: [https://example.com            ]       │    │
│  │                                                    │    │
│  │  ○ Electron: [port 9222           ]              │    │
│  │                                                    │    │
│  │  ○ Chrome:   [port 9223           ]              │    │
│  │                                                    │    │
│  │  [+ 添加更多目标]                                    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  测试操作                                          │    │
│  │                                                    │    │
│  │  [输入操作指令...]                                   │    │
│  │  例如: 点击登录按钮                                 │    │
│  │                                                    │    │
│  │  [开始测试]                                         │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  实时画面                                          │    │
│  │                                                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │    │
│  │  │ Target 1 │  │ Target 2 │  │ Target 3 │        │    │
│  │  │          │  │          │  │          │        │    │
│  │  │ [画面]   │  │ [画面]   │  │ [画面]   │        │    │
│  │  └──────────┘  └──────────┘  └──────────┘        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### 后端流程

```typescript
// 用户选择目标后
POST /api/sessions/create
{
  "targets": [
    { "type": "web-url", "url": "https://example.com" },
    { "type": "electron", "port": 9222 }
  ]
}

// 返回
{
  "sessionId": "multi-123",
  "targets": [
    { "id": "target-1", "status": "connected" },
    { "id": "target-2", "status": "connected" }
  ]
}

// 执行操作
POST /api/sessions/multi-123/act
{
  "action": "点击登录按钮"
}

// 返回所有目标的结果
{
  "results": {
    "target-1": { "success": true, ... },
    "target-2": { "success": true, ... }
  }
}
```

## 关键差异与收敛点

### Chrome vs Electron CDP 差异

| 特性 | Chrome | Electron |
|------|--------|----------|
| CDP 协议 | 标准 CDP | 标准 CDP (基于 Chromium) |
| 启动参数 | `--remote-debugging-port` | `--remote-debugging-port` |
| WebSocket 端点 | `ws://localhost:PORT/devtools/page/ID` | 相同 |
| 页面导航 | 支持 `Page.navigate` | 支持 `Page.navigate` |
| 元素操作 | DOM, Input 协议 | DOM, Input 协议 |
| 截图 | `Page.captureScreenshot` | `Page.captureScreenshot` |

**结论**: CDP 协议层面完全一致，只有启动方式不同。

### 收敛策略

1. **启动层分离**:
   - Web URL: 使用 `chrome-launcher` 启动 Chrome
   - Electron: 假设 Electron 已运行，直接连接
   - Chrome 实例: 假设 Chrome 已运行，直接连接

2. **CDP 连接统一**:
   - 都通过 `CdpConnection.connect(wsUrl)` 连接
   - 都使用 `V3Context.create()` 创建上下文

3. **操作层统一**:
   - 都使用 `stagehand.act()` 执行操作
   - 都使用 `stagehand.extract()` 提取数据

## 实现优先级

### Phase 1: 核心 Target 抽象 (高优先级)
- [ ] 定义 `Target` 接口
- [ ] 实现 `WebUrlTarget`
- [ ] 实现 `ElectronTarget`
- [ ] 实现 `ChromeTarget`

### Phase 2: Session 管理器 (高优先级)
- [ ] 实现 `SessionManager`
- [ ] 支持多 Session 并发操作
- [ ] Session 生命周期管理

### Phase 3: API 层 (中优先级)
- [ ] `POST /api/sessions/create` - 创建 Session
- [ ] `POST /api/sessions/:id/act` - 执行操作
- [ ] `GET /api/sessions/:id` - 获取状态
- [ ] `DELETE /api/sessions/:id` - 关闭 Session

### Phase 4: 前端 UI (中优先级)
- [ ] 目标选择界面
- [ ] 实时画面显示
- [ ] 操作输入界面

### Phase 5: 视频录制 (低优先级)
- [ ] 集成画面录制
- [ ] 视频存储与回放

## 潜在风险

1. **Stagehand V3 API 稳定性**
   - 风险: v3.0.5 是相对新的版本，API 可能有变动
   - 缓解: 锁定版本，密切跟踪更新

2. **多并发性能**
   - 风险: 同时运行多个 Chrome 实例可能消耗大量内存
   - 缓解: 添加资源限制，支持用户选择并发数量

3. **Electron 版本兼容性**
   - 风险: 不同 Electron 版本的 CDP 实现可能有差异
   - 缓解: 测试多个版本，记录兼容性矩阵

4. **CDP 连接超时**
   - 风险: 目标应用响应慢导致连接失败
   - 缓解: 可配置的超时时间，重试机制
