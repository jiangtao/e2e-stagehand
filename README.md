# Stagehand for Electron

🤖 基于 AI 的 Electron 应用浏览器自动化服务

## 项目概述

Stagehand for Electron 是一个强大的自动化测试和操作服务，将 [Stagehand](https://github.com/browserbase/stagehand) 的 AI 驱动浏览器自动化能力扩展到 Electron 应用。通过 Chrome DevTools Protocol (CDP) 连接多个 Electron 实例，提供 REST API、CLI 工具和 Web 管理界面。

## 核心特性

- 🔌 **多实例管理**: 同时连接和管理多个 Electron 应用实例
- 🤖 **AI 驱动**: 使用自然语言描述执行复杂的浏览器操作
- 🌐 **Web 管理界面**: 直观的实时监控和操作界面
- 💻 **CLI 工具**: 强大的命令行工具支持脚本化操作
- 📊 **实时可视化**: Canvas 绘制操作流，WebSocket 实时日志
- ⚙️ **灵活配置**: 支持多种 AI 模型提供商 (OpenAI/Anthropic/自定义)
- 🔄 **健康监控**: 自动连接健康检查和重连机制

## 技术架构

- **前端**: Next.js 14 + React + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + Server Actions
- **自动化引擎**: @browserbasehq/stagehand
- **协议**: Chrome DevTools Protocol (CDP) + WebSocket
- **部署**: 纯本地模式 (localhost:3000)

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置环境变量

创建 \`.env.local\` 文件：

\`\`\`env
# AI 模型配置 (选择其一)
OPENAI_API_KEY=your_openai_api_key
# ANTHROPIC_API_KEY=your_anthropic_api_key
# CUSTOM_API_URL=https://your-custom-api.com/v1

# 可选配置
MODEL_PROVIDER=openai
MODEL_NAME=gpt-4
WS_PORT=8080
\`\`\`

### 3. 启动服务

\`\`\`bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
\`\`\`

服务将在 http://localhost:3000 启动

### 4. 准备 Electron 应用

启动您的 Electron 应用时添加远程调试参数：

\`\`\`bash
# 方法 1: 命令行启动
/path/to/your/electron/app --remote-debugging-port=9222

# 方法 2: 在 Electron 代码中添加
app.commandLine.appendSwitch('remote-debugging-port', '9222');
\`\`\`

### 5. 连接和使用

1. 打开 Web 界面: http://localhost:3000
2. 在"实例管理"标签页连接 Electron 实例
3. 上传任务文件或使用 CLI 工具执行操作

## 使用方法

### Web 界面操作

1. **实例管理**: 连接、监控和管理 Electron 实例
2. **任务上传**: 上传文本任务文件，支持自然语言描述
3. **实时日志**: 查看操作日志和统计信息
4. **配置管理**: 管理 AI 模型和系统配置

### CLI 工具使用

\`\`\`bash
# 连接实例
npx stagehand-electron connect --port 9222

# 列出所有实例
npx stagehand-electron list

# 执行任务文件
npx stagehand-electron run --instance <id> --task samples/simple-test.txt

# 执行单个操作
npx stagehand-electron run --instance <id> --action "点击登录按钮"

# 查看状态
npx stagehand-electron status

# 配置管理
npx stagehand-electron config --provider openai --key <api-key>

# 断开连接
npx stagehand-electron disconnect --instance <id>
\`\`\`

### REST API 使用

\`\`\`bash
# 连接实例
curl -X POST http://localhost:3000/api/instances/connect \\
  -H "Content-Type: application/json" \\
  -d '{"port": 9222}'

# 执行操作
curl -X POST http://localhost:3000/api/instances/<id>/act \\
  -H "Content-Type: application/json" \\
  -d '{"action": "点击登录按钮"}'

# 提取数据
curl -X POST http://localhost:3000/api/instances/<id>/extract \\
  -H "Content-Type: application/json" \\
  -d '{"instruction": "提取页面标题"}'
\`\`\`

## 任务文件格式

任务文件使用简单的文本格式，每行一个操作：

\`\`\`txt
# 这是注释行
导航到 https://example.com
等待页面加载完成
点击登录按钮
输入用户名: admin
输入密码: password
点击提交按钮
截图
\`\`\`

支持的操作类型：
- 导航: \`导航到 <URL>\`
- 点击: \`点击 <元素描述>\`
- 输入: \`输入 <内容>\` 或 \`在 <输入框> 中输入: <内容>\`
- 等待: \`等待页面加载完成\` 或 \`等待 <条件>\`
- 提取: \`提取 <数据描述>\`
- 观察: \`观察 <页面内容>\`
- 截图: \`截图\`

## 项目结构

\`\`\`
stagehand-for-electron/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/            # REST API 路由
│   │   ├── globals.css     # 全局样式
│   │   ├── layout.tsx      # 布局组件
│   │   └── page.tsx        # 主页面
│   ├── components/         # React 组件
│   ├── lib/               # 核心业务逻辑
│   │   ├── cdp/           # CDP 连接管理
│   │   ├── stagehand/     # Stagehand 适配层
│   │   └── websocket/     # WebSocket 服务
│   ├── cli/               # CLI 工具
│   ├── types/             # TypeScript 类型定义
│   └── config/            # 配置管理
├── samples/               # 示例任务文件
├── docs/                  # 文档
└── README.md
\`\`\`

## 配置选项

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| \`OPENAI_API_KEY\` | OpenAI API 密钥 | - |
| \`ANTHROPIC_API_KEY\` | Anthropic API 密钥 | - |
| \`MODEL_PROVIDER\` | AI 模型提供商 | \`openai\` |
| \`MODEL_NAME\` | 模型名称 | \`gpt-4\` |
| \`CUSTOM_API_URL\` | 自定义 API URL | - |
| \`WS_PORT\` | WebSocket 端口 | \`8080\` |
| \`PORT\` | HTTP 服务端口 | \`3000\` |

### 支持的 AI 模型

- **OpenAI**: GPT-4, GPT-3.5-turbo 等
- **Anthropic**: Claude-3-sonnet, Claude-3-haiku 等  
- **自定义**: 兼容 OpenAI API 格式的服务

## 故障排除

### 常见问题

1. **连接失败**: 确保 Electron 应用启动时添加了 \`--remote-debugging-port\` 参数
2. **API 密钥错误**: 检查环境变量配置和密钥有效性
3. **端口冲突**: 修改 WebSocket 端口或 HTTP 服务端口
4. **操作失败**: 检查操作描述是否清晰，页面元素是否存在

### 调试模式

启用详细日志：

\`\`\`bash
DEBUG=stagehand:* npm run dev
\`\`\`

## 开发指南

### 本地开发

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run type-check

# 代码检查
npm run lint
\`\`\`

### 构建部署

\`\`\`bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
\`\`\`

## 贡献指南

1. Fork 本仓库
2. 创建特性分支: \`git checkout -b feature/amazing-feature\`
3. 提交更改: \`git commit -m 'Add amazing feature'\`
4. 推送分支: \`git push origin feature/amazing-feature\`
5. 提交 Pull Request

## 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 致谢

- [Stagehand](https://github.com/browserbase/stagehand) - 强大的 AI 浏览器自动化框架
- [Next.js](https://nextjs.org/) - React 全栈框架
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) - 浏览器调试协议

## 联系方式

如有问题或建议，请提交 Issue 或 Pull Request。
