# Electron 应用配置指南

本指南详细说明如何配置 Electron 应用以支持 Stagehand 自动化服务。

## 概述

Stagehand for Electron 通过 Chrome DevTools Protocol (CDP) 与 Electron 应用通信。要启用此功能，需要在 Electron 应用启动时开启远程调试端口。

## 配置方法

### 方法 1: 命令行启动 (推荐用于测试)

这是最简单的方法，适合快速测试和开发环境。

#### macOS
```bash
# 已安装的应用
/Applications/YourApp.app/Contents/MacOS/YourApp --remote-debugging-port=9222

# 开发环境
electron . --remote-debugging-port=9222
```

#### Windows
```cmd
# 已安装的应用
"C:\Program Files\YourApp\YourApp.exe" --remote-debugging-port=9222

# 开发环境
electron . --remote-debugging-port=9222
```

#### Linux
```bash
# 已安装的应用
/opt/YourApp/YourApp --remote-debugging-port=9222

# 开发环境
electron . --remote-debugging-port=9222
```

### 方法 2: 代码中配置 (推荐用于生产)

在 Electron 应用的主进程代码中添加配置，这是最可靠的方法。

#### 基本配置

在 `main.js` 或主进程文件中添加：

```javascript
const { app, BrowserWindow } = require('electron');

// 在 app.ready 之前添加
app.commandLine.appendSwitch('remote-debugging-port', '9222');

app.whenReady().then(() => {
  createWindow();
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}
```

#### 动态端口配置

支持通过环境变量或配置文件设置端口：

```javascript
const { app, BrowserWindow } = require('electron');

// 从环境变量获取端口，默认为 9222
const debugPort = process.env.ELECTRON_DEBUG_PORT || 9222;

// 检查是否启用调试模式
const enableDebugging = process.env.NODE_ENV === 'development' || 
                       process.env.ENABLE_REMOTE_DEBUGGING === 'true';

if (enableDebugging) {
  app.commandLine.appendSwitch('remote-debugging-port', debugPort.toString());
  console.log(`🔧 Remote debugging enabled on port ${debugPort}`);
}

app.whenReady().then(() => {
  createWindow();
});
```

#### 条件启用

只在特定条件下启用远程调试：

```javascript
const { app, BrowserWindow } = require('electron');
const isDev = require('electron-is-dev');

// 只在开发环境或明确启用时开启调试
if (isDev || process.argv.includes('--enable-debugging')) {
  const port = process.env.DEBUG_PORT || 9222;
  app.commandLine.appendSwitch('remote-debugging-port', port.toString());
  
  // 可选：启用其他调试功能
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('log-level', '0');
}
```

### 方法 3: 环境变量配置

通过环境变量控制调试端口：

#### 设置环境变量

**macOS/Linux:**
```bash
export ELECTRON_DEBUG_PORT=9222
export ENABLE_REMOTE_DEBUGGING=true
./your-electron-app
```

**Windows:**
```cmd
set ELECTRON_DEBUG_PORT=9222
set ENABLE_REMOTE_DEBUGGING=true
your-electron-app.exe
```

#### 代码中读取环境变量

```javascript
const { app } = require('electron');

// 读取环境变量
const debugPort = process.env.ELECTRON_DEBUG_PORT;
const enableDebugging = process.env.ENABLE_REMOTE_DEBUGGING === 'true';

if (enableDebugging && debugPort) {
  app.commandLine.appendSwitch('remote-debugging-port', debugPort);
}
```

### 方法 4: 配置文件方式

使用配置文件管理调试设置：

#### 创建配置文件 `electron-config.json`

```json
{
  "debugging": {
    "enabled": true,
    "port": 9222,
    "enableLogging": true
  },
  "security": {
    "allowRemoteDebugging": true,
    "restrictToLocalhost": true
  }
}
```

#### 在代码中读取配置

```javascript
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// 读取配置文件
let config = {};
try {
  const configPath = path.join(__dirname, 'electron-config.json');
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (error) {
  console.warn('配置文件读取失败，使用默认配置');
}

// 应用调试配置
if (config.debugging?.enabled) {
  const port = config.debugging.port || 9222;
  app.commandLine.appendSwitch('remote-debugging-port', port.toString());
  
  if (config.debugging.enableLogging) {
    app.commandLine.appendSwitch('enable-logging');
  }
  
  console.log(`🔧 Remote debugging enabled on port ${port}`);
}
```

### 方法 5: 启动脚本方式

创建专门的启动脚本来管理调试模式：

#### macOS/Linux 脚本 `start-debug.sh`

```bash
#!/bin/bash

# 配置参数
APP_PATH="/Applications/YourApp.app/Contents/MacOS/YourApp"
DEBUG_PORT=9222
LOG_LEVEL=0

# 检查应用是否存在
if [ ! -f "$APP_PATH" ]; then
    echo "❌ 应用未找到: $APP_PATH"
    exit 1
fi

# 启动应用
echo "🚀 启动 Electron 应用 (调试端口: $DEBUG_PORT)"
"$APP_PATH" \
    --remote-debugging-port=$DEBUG_PORT \
    --enable-logging \
    --log-level=$LOG_LEVEL \
    --disable-web-security \
    "$@"
```

#### Windows 脚本 `start-debug.bat`

```batch
@echo off
setlocal

REM 配置参数
set APP_PATH="C:\Program Files\YourApp\YourApp.exe"
set DEBUG_PORT=9222
set LOG_LEVEL=0

REM 检查应用是否存在
if not exist %APP_PATH% (
    echo ❌ 应用未找到: %APP_PATH%
    exit /b 1
)

REM 启动应用
echo 🚀 启动 Electron 应用 (调试端口: %DEBUG_PORT%)
%APP_PATH% ^
    --remote-debugging-port=%DEBUG_PORT% ^
    --enable-logging ^
    --log-level=%LOG_LEVEL% ^
    --disable-web-security ^
    %*
```

## 多实例配置

如果需要同时运行多个 Electron 实例，每个实例需要使用不同的调试端口：

### 自动端口分配

```javascript
const { app } = require('electron');
const net = require('net');

// 查找可用端口
async function findAvailablePort(startPort = 9222) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', () => {
      findAvailablePort(startPort + 1).then(resolve).catch(reject);
    });
  });
}

// 在应用启动前设置端口
app.whenReady().then(async () => {
  const port = await findAvailablePort();
  app.commandLine.appendSwitch('remote-debugging-port', port.toString());
  console.log(`🔧 Remote debugging enabled on port ${port}`);
  
  createWindow();
});
```

### 手动端口配置

```bash
# 启动多个实例
electron app1 --remote-debugging-port=9222 &
electron app2 --remote-debugging-port=9223 &
electron app3 --remote-debugging-port=9224 &
```

## 验证配置

### 检查调试端口是否开启

1. **浏览器访问**：
   打开浏览器访问 `http://localhost:9222/json`，应该看到 JSON 格式的页面信息。

2. **命令行检查**：
   ```bash
   # macOS/Linux
   curl http://localhost:9222/json
   
   # Windows (PowerShell)
   Invoke-WebRequest -Uri http://localhost:9222/json
   ```

3. **端口扫描**：
   ```bash
   # 检查端口是否监听
   netstat -an | grep 9222
   # 或
   lsof -i :9222
   ```

### 使用 Stagehand 连接测试

```bash
# 使用 CLI 工具测试连接
npx stagehand-electron connect --port 9222

# 或使用 API 测试
curl -X POST http://localhost:3000/api/instances/connect \
  -H "Content-Type: application/json" \
  -d '{"port": 9222}'
```

## 安全注意事项

### 生产环境安全

1. **限制访问**：
   ```javascript
   // 只允许本地访问
   app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
   ```

2. **条件启用**：
   ```javascript
   // 只在明确启用时开启调试
   if (process.env.NODE_ENV === 'development' || process.argv.includes('--debug')) {
     app.commandLine.appendSwitch('remote-debugging-port', '9222');
   }
   ```

3. **端口随机化**：
   ```javascript
   // 使用随机端口增加安全性
   const randomPort = 9000 + Math.floor(Math.random() * 1000);
   app.commandLine.appendSwitch('remote-debugging-port', randomPort.toString());
   ```

### 防火墙配置

确保防火墙允许调试端口的本地访问：

```bash
# macOS
sudo pfctl -f /etc/pf.conf

# Linux (UFW)
sudo ufw allow from 127.0.0.1 to any port 9222

# Windows
netsh advfirewall firewall add rule name="Electron Debug" dir=in action=allow protocol=TCP localport=9222
```

## 故障排除

### 常见问题

1. **端口被占用**：
   ```bash
   # 查找占用端口的进程
   lsof -i :9222
   # 或
   netstat -tulpn | grep 9222
   ```

2. **连接被拒绝**：
   - 检查 Electron 应用是否正确启动
   - 确认调试端口参数是否正确添加
   - 验证防火墙设置

3. **权限问题**：
   ```bash
   # 确保有足够权限访问端口
   sudo netstat -tulpn | grep 9222
   ```

### 调试日志

启用详细日志以排查问题：

```javascript
// 启用 Electron 调试日志
app.commandLine.appendSwitch('enable-logging');
app.commandLine.appendSwitch('log-level', '0');

// 监听调试事件
app.on('web-contents-created', (event, contents) => {
  console.log('📄 New web contents created');
  
  contents.on('devtools-opened', () => {
    console.log('🔧 DevTools opened');
  });
});
```

### 网络诊断

```bash
# 测试本地连接
telnet localhost 9222

# 检查 CDP 端点
curl -v http://localhost:9222/json/version

# 测试 WebSocket 连接
wscat -c ws://localhost:9222/devtools/page/<page-id>
```

## 最佳实践

1. **开发环境**：
   - 使用固定端口便于调试
   - 启用详细日志
   - 允许不安全内容加载

2. **测试环境**：
   - 使用环境变量控制
   - 实现健康检查
   - 记录连接状态

3. **生产环境**：
   - 默认禁用调试端口
   - 通过配置文件控制
   - 实施访问控制

4. **多实例部署**：
   - 自动端口分配
   - 实例标识管理
   - 负载均衡考虑

## 示例应用

完整的示例 Electron 应用配置：

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');

// 配置管理
const config = {
  debugging: {
    enabled: isDev || process.env.ENABLE_DEBUG === 'true',
    port: process.env.DEBUG_PORT || 9222,
    address: '127.0.0.1'
  }
};

// 启用远程调试
if (config.debugging.enabled) {
  app.commandLine.appendSwitch('remote-debugging-port', config.debugging.port.toString());
  app.commandLine.appendSwitch('remote-debugging-address', config.debugging.address);
  
  if (isDev) {
    app.commandLine.appendSwitch('enable-logging');
    app.commandLine.appendSwitch('log-level', '0');
  }
  
  console.log(`🔧 Remote debugging: http://${config.debugging.address}:${config.debugging.port}`);
}

// 应用生命周期
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
    
  mainWindow.loadURL(startUrl);

  // 开发环境自动打开 DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// IPC 通信示例
ipcMain.handle('get-debug-info', () => {
  return {
    debuggingEnabled: config.debugging.enabled,
    debugPort: config.debugging.port,
    version: app.getVersion()
  };
});
```

通过以上配置，您的 Electron 应用就可以与 Stagehand for Electron 服务进行通信了。
