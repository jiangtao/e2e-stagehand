# Stagehand for Electron

> 🚀 AI 驱动的多平台 E2E 测试服务 - 统一 Web、Electron、Chrome

## 项目概述

**Stagehand for Electron** 是一个强大的多平台自动化测试服务，基于 **统一目标(Target)架构**，同时支持：

- **Web URL 测试** - 自动启动 Chrome 并导航到指定网址
- **Electron 应用测试** - 连接到已有 Electron 实例的 CDP 端口
- **Chrome 浏览器测试** - 连接到已有 Chrome 实例的 CDP 端口

通过 Chrome DevTools Protocol (CDP) 和 [Stagehand](https://github.com/browserbasehq/stagehand) v3.0.5 的 AI 能力，提供 REST API、CLI 工具和 Web 管理界面。

### 🎯 核心改进（v2.0 架构重构）

本项目已完成**架构重构**，实现了以下关键改进：

1. **统一抽象** - Web URL、Electron、Chrome 使用相同的 Target 接口
2. **自动发现** - 自动扫描本地运行的 Electron/Chrome 应用（端口 9222-9242）
3. **简化流程** - 用户只需选择目标即可开始测试，无需理解 CDP 技术细节
4. **多平台并发** - 支持同时在多个目标上执行 AI 操作
5. **视频录制** - 内置 Canvas 视频流录制功能

## 核心特性

### 🔄 多实例管理
- **自动发现**: 扫描常用端口范围（9222-9242），自动识别 Electron/Chrome 应用
- **统一连接**: Web URL 和已有应用使用相同的连接流程
- **实时监控**: WebSocket 实时推送连接状态和健康度
- **自动重连**: 连接断开时自动尝试重连

### 🤖 AI 驱动操作
- **自然语言**: 使用自然语言描述执行操作（点击、输入、导航等）
- **智能定位**: AI 自动识别和定位页面元素
- **操作执行**: 支持 `act`、`extract`、`observe` 等操作
- **多平台同步**: 一次操作，同时在多个平台执行

### 🌐 Web 管理界面
- **目标选择**: 自动扫描 + 手动添加 Web URL
- **多平台视图**: 网格布局展示多个目标画面
- **实时操作**: 统一操作输入，实时反馈结果
- **视频录制**: 录制控制面板，支持暂停/继续/下载

### 💻 CLI 工具
```bash
# 扫描可用目标
npx stagehand-electron scan

# 创建测试会话
npx stagehand-electron test --targets web:https://example.com,electron:9222

# 执行操作
npx stagehand-electron run --action "点击登录按钮"
```

### 📊 实时可视化
- **Canvas 绘制**: 操作流程可视化
- **WebSocket 推送**: 毫秒级实时日志
- **统计面板**: 操作类型统计和时间分析

## 技术架构

### 统一目标(Target)架构

```
┌─────────────────────────────────────────────────────────┐
│                    Target (统一接口)                    │
├─────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  WebUrlTarget │  │ ElectronTarget│  │ ChromeTarget  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                   │                   │             │
│         ▼                   ▼                   ▼             │
│  启动新 Chrome       连接已有 CDP       连接已有 CDP         │
│         │                   │                   │             │
│         └───────────────────┴───────────────────┘             │
│                             ▼                                 │
│                    V3Context / Stagehand                       │
│                                                             │
└─────────────────────────────────────────────────────────┘
```

### 项目结构

```
src/
├── lib/
│   ├── target/                      # 统一目标抽象
│   │   ├── types.ts              # Target 接口定义
│   │   ├── auto-detector.ts      # 自动端口扫描器
│   │   ├── web-url-target.ts     # Web URL 目标
│   │   ├── electron-target.ts     # Electron 目标
│   │   ├── chrome-target.ts       # Chrome 目标
│   │   └── index.ts
│   ├── session/                     # Session 管理
│   │   ├── session-manager.ts     # Session 生命周期管理
│   │   ├── session-database.ts    # Session 数据持久化
│   │   └── index.ts
│   └── recorder/                    # 视频录制
│       ├── types.ts
│       ├── video-recorder.ts
│       └── index.ts
├── app/
│   ├── api/
│   │   ├── targets/scan/route.ts          # 扫描可用目标
│   │   └── sessions/
│   │       ├── create/route.ts           # 创建 Session
│   │       └── [sessionId]/act/route.ts  # 执行操作
│   ├── targets/page.tsx                   # 目标选择页面
│   └── components/
│       ├── MultiPlatformView.tsx         # 多平台测试视图
│       └── VideoRecorder.tsx            # 录制控制组件
└── cli/
    └── commands/                        # CLI 命令实现
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + React + TypeScript + Tailwind CSS |
| 后端 | Next.js API Routes + Server Actions |
| 自动化引擎 | @browserbasehq/stagehand v3.0.5 |
| 协议 | Chrome DevTools Protocol (CDP) + WebSocket |
| 部署 | 本地模式 (localhost:3000) |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
# AI 模型配置（选择其一）
OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
# CUSTOM_API_URL=https://your-custom-api.com/v1

# 可选配置
MODEL_PROVIDER=openai
MODEL_NAME=gpt-4
WS_PORT=8080
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 准备测试目标

**Web URL 测试**：无需准备，直接在界面输入网址

**Electron/Chrome 测试**：启动应用时添加远程调试参数：

```bash
# 方法 1: 命令行启动
/path/to/your/electron/app --remote-debugging-port=9222

# 方法 2: 在 Electron 代码中添加
app.commandLine.appendSwitch('remote-debugging-port', '9222');
```

### 5. 连接和使用

1. 打开 Web 界面: `http://localhost:3000`
2. 在"目标选择"页面自动发现或手动添加目标
3. 选择目标后点击"开始测试"
4. 输入自然语言操作指令，如"点击登录按钮"
5. 查看实时画面和操作结果

## API 使用示例

### 扫描可用目标

```bash
curl http://localhost:3000/api/targets/scan
```

响应：
```json
{
  "success": true,
  "targets": [
    {
      "id": "localhost:9222",
      "name": "My Electron App",
      "type": "electron",
      "port": 9222,
      "autoDetected": true
    }
  ]
}
```

### 创建测试会话

```bash
curl -X POST http://localhost:3000/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "targets": [
      { "type": "web-url", "url": "https://example.com" },
      { "type": "electron", "port": 9222 }
    ],
    "options": {
      "concurrent": true
    }
  }'
```

### 执行操作

```bash
curl -X POST http://localhost:3000/api/sessions/session-id/act \
  -H "Content-Type: application/json" \
  -d '{
    "action": "点击登录按钮，输入用户名 admin，然后点击提交"
  }'
```

## 配置选项

### 环境变量

| 变量名 | 描述 | 默认值 |
|---------|------|---------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | - |
| `CUSTOM_API_URL` | 自定义 API URL | - |
| `MODEL_PROVIDER` | AI 模型提供商 | `openai` |
| `MODEL_NAME` | 模型名称 | `gpt-4` |
| `WS_PORT` | WebSocket 端口 | `8080` |
| `PORT` | HTTP 服务端口 | `3000` |

### 支持的 AI 模型

- **OpenAI**: GPT-4, GPT-3.5-turbo 等
- **Anthropic**: Claude-3.5-sonnet, Claude-3-opus 等
- **自定义**: 兼容 OpenAI API 格式的服务

## 故障排除

### 常见问题

1. **连接失败**: 确保 Electron 应用启动时添加了 `--remote-debugging-port` 参数
2. **API 密钥错误**: 检查环境变量配置和密钥有效性
3. **端口冲突**: 修改 WebSocket 端口或 HTTP 服务端口
4. **操作失败**: 检查操作描述是否清晰，页面元素是否存在
5. **自动扫描无结果**: 确保应用正在运行，端口在 9222-9242 范围内

### 调试模式

启用详细日志：

```bash
# 启用所有调试日志
DEBUG=stagehand:* npm run dev

# 启用特定模块调试
DEBUG=stagehand:target,stagehand:session npm run dev
```

## 开发指南

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 构建部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

## 贡献指南

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 提交 Pull Request

## 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- [Stagehand](https://github.com/browserbasehq/stagehand) - 强大的 AI 浏览器自动化框架
- [Next.js](https://nextjs.org/) - React 全栈框架
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - 浏览器调试协议

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
