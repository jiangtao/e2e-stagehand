# Stagehand for Electron - API 文档

## 概述

Stagehand for Electron 提供完整的 REST API，支持实例管理、操作执行、任务管理和配置管理等功能。

**Base URL**: `http://localhost:3000`

## 认证

当前版本为本地服务，无需认证。未来版本可能会添加 API 密钥认证。

## 响应格式

所有 API 响应都使用统一的 JSON 格式：

```json
{
  "success": true,
  "data": {
    // 响应数据
  },
  "error": "错误信息 (仅在 success: false 时存在)"
}
```

## 实例管理 API

### 连接 Electron 实例

连接到一个 Electron 应用实例。

**请求**
```http
POST /api/instances/connect
Content-Type: application/json

{
  "port": 9222,
  "appPath": "/path/to/electron/app" // 可选
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "instanceId": "electron-9222-1699123456789",
    "instance": {
      "id": "electron-9222-1699123456789",
      "port": 9222,
      "appPath": "/path/to/electron/app",
      "status": "connected",
      "connectedAt": "2023-11-04T10:30:45.123Z",
      "lastActivity": "2023-11-04T10:30:45.123Z"
    }
  }
}
```

**错误响应**
```json
{
  "success": false,
  "error": "Failed to connect to Electron on port 9222: Connection refused"
}
```

### 列出所有实例

获取所有已连接的 Electron 实例列表。

**请求**
```http
GET /api/instances
```

**响应**
```json
{
  "success": true,
  "data": {
    "instances": [
      {
        "id": "electron-9222-1699123456789",
        "port": 9222,
        "status": "connected",
        "connectedAt": "2023-11-04T10:30:45.123Z",
        "lastActivity": "2023-11-04T10:31:20.456Z",
        "isHealthy": true
      }
    ],
    "count": 1
  }
}
```

### 断开实例连接

断开与指定 Electron 实例的连接。

**请求**
```http
DELETE /api/instances/{instanceId}/disconnect
```

**响应**
```json
{
  "success": true,
  "data": {
    "message": "Instance electron-9222-1699123456789 disconnected successfully"
  }
}
```

## 操作执行 API

### 执行操作

在指定实例上执行 AI 驱动的操作。

**请求**
```http
POST /api/instances/{instanceId}/act
Content-Type: application/json

{
  "action": "点击登录按钮",
  "options": {
    "timeout": 30000 // 可选，超时时间（毫秒）
  }
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "action": "点击登录按钮",
    "result": {
      "success": true,
      "element": "button[type='submit']",
      "coordinates": { "x": 150, "y": 200 }
    },
    "instanceId": "electron-9222-1699123456789",
    "timestamp": "2023-11-04T10:32:15.789Z"
  }
}
```

### 提取数据

从指定实例的页面中提取数据。

**请求**
```http
POST /api/instances/{instanceId}/extract
Content-Type: application/json

{
  "instruction": "提取页面标题和所有链接",
  "schema": {
    "title": "string",
    "links": ["string"]
  }
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "instruction": "提取页面标题和所有链接",
    "result": {
      "title": "示例网站",
      "links": [
        "https://example.com/about",
        "https://example.com/contact"
      ]
    },
    "instanceId": "electron-9222-1699123456789",
    "timestamp": "2023-11-04T10:33:00.123Z"
  }
}
```

### 观察页面

观察指定实例的页面状态。

**请求**
```http
POST /api/instances/{instanceId}/observe
Content-Type: application/json

{
  "instruction": "描述当前页面的主要内容" // 可选
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "instruction": "描述当前页面的主要内容",
    "result": {
      "description": "这是一个登录页面，包含用户名和密码输入框，以及一个登录按钮。页面顶部有网站logo。",
      "elements": [
        { "type": "input", "placeholder": "用户名" },
        { "type": "input", "placeholder": "密码" },
        { "type": "button", "text": "登录" }
      ]
    },
    "instanceId": "electron-9222-1699123456789",
    "timestamp": "2023-11-04T10:34:30.456Z"
  }
}
```

## 任务管理 API

### 上传任务

上传文本格式的任务文件。

**请求**
```http
POST /api/tasks/upload
Content-Type: application/json

{
  "filename": "login-test.txt",
  "content": "导航到 https://example.com\n点击登录按钮\n输入用户名: admin\n输入密码: password\n点击提交按钮",
  "description": "登录功能测试", // 可选
  "instanceId": "electron-9222-1699123456789" // 可选
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "taskId": "task-1699123456789-abc123",
    "filename": "login-test.txt",
    "status": "uploaded",
    "createdAt": "2023-11-04T10:35:00.000Z"
  }
}
```

### 查询任务状态

查询指定任务的执行状态。

**请求**
```http
GET /api/tasks/{taskId}/status
```

**响应**
```json
{
  "success": true,
  "data": {
    "id": "task-1699123456789-abc123",
    "filename": "login-test.txt",
    "description": "登录功能测试",
    "status": "completed",
    "createdAt": "2023-11-04T10:35:00.000Z",
    "updatedAt": "2023-11-04T10:36:30.000Z",
    "result": {
      "totalSteps": 5,
      "completedSteps": 5,
      "failedSteps": 0,
      "executionTime": 90000
    }
  }
}
```

### 更新任务状态

更新指定任务的状态信息。

**请求**
```http
PUT /api/tasks/{taskId}/status
Content-Type: application/json

{
  "status": "running",
  "result": {
    "currentStep": 3,
    "totalSteps": 5
  }
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "id": "task-1699123456789-abc123",
    "status": "running",
    "updatedAt": "2023-11-04T10:36:15.000Z"
  }
}
```

### 列出所有任务

获取所有已上传的任务列表。

**请求**
```http
GET /api/tasks/upload
```

**响应**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-1699123456789-abc123",
        "filename": "login-test.txt",
        "description": "登录功能测试",
        "status": "completed",
        "createdAt": "2023-11-04T10:35:00.000Z",
        "updatedAt": "2023-11-04T10:36:30.000Z"
      }
    ],
    "count": 1
  }
}
```

## 配置管理 API

### 获取配置

获取当前系统配置信息。

**请求**
```http
GET /api/config
```

**响应**
```json
{
  "success": true,
  "data": {
    "stagehand": {
      "modelProvider": "openai",
      "apiKey": "***", // 隐藏敏感信息
      "modelName": "gpt-4",
      "customApiUrl": null
    },
    "websocket": {
      "port": 8080,
      "reconnectInterval": 3000,
      "maxReconnectAttempts": 5
    },
    "server": {
      "port": 3000,
      "host": "localhost"
    },
    "electron": {
      "defaultDebugPort": 9222,
      "healthCheckInterval": 30000
    }
  }
}
```

### 更新配置

更新系统配置信息。

**请求**
```http
PUT /api/config
Content-Type: application/json

{
  "stagehand": {
    "modelProvider": "anthropic",
    "apiKey": "sk-ant-api-key-here",
    "modelName": "claude-3-sonnet-20240229"
  }
}
```

**响应**
```json
{
  "success": true,
  "data": {
    "message": "Configuration updated successfully",
    "updates": {
      "stagehand": {
        "modelProvider": "anthropic",
        "apiKey": "sk-ant-api-key-here",
        "modelName": "claude-3-sonnet-20240229"
      }
    }
  }
}
```

## WebSocket API

### 连接

连接到 WebSocket 服务器以接收实时事件。

**连接 URL**: `ws://localhost:8080`

### 消息格式

所有 WebSocket 消息都使用 JSON 格式：

```json
{
  "type": "operation|status|error|log",
  "instanceId": "electron-9222-1699123456789", // 可选
  "data": {
    // 消息数据
  },
  "timestamp": "2023-11-04T10:37:00.000Z"
}
```

### 事件类型

#### 操作事件 (operation)
```json
{
  "type": "operation",
  "instanceId": "electron-9222-1699123456789",
  "data": {
    "type": "click",
    "timestamp": "2023-11-04T10:37:00.000Z",
    "target": {
      "coordinates": { "x": 150, "y": 200 }
    },
    "result": {
      "success": true
    }
  },
  "timestamp": "2023-11-04T10:37:00.000Z"
}
```

#### 状态事件 (status)
```json
{
  "type": "status",
  "data": {
    "event": "instance_connected",
    "instance": {
      "id": "electron-9222-1699123456789",
      "port": 9222,
      "status": "connected"
    }
  },
  "timestamp": "2023-11-04T10:37:00.000Z"
}
```

#### 错误事件 (error)
```json
{
  "type": "error",
  "data": {
    "error": "Connection lost to instance electron-9222-1699123456789"
  },
  "timestamp": "2023-11-04T10:37:00.000Z"
}
```

### 客户端消息

客户端可以发送以下消息到服务器：

#### 获取实例列表
```json
{
  "type": "get_instances"
}
```

#### 获取实例状态
```json
{
  "type": "get_instance_status",
  "instanceId": "electron-9222-1699123456789"
}
```

#### Ping
```json
{
  "type": "ping"
}
```

## 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 错误响应示例

### 参数验证错误 (400)
```json
{
  "success": false,
  "error": "Invalid request data",
  "details": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["port"],
      "message": "Expected number, received string"
    }
  ]
}
```

### 资源不存在 (404)
```json
{
  "success": false,
  "error": "Instance electron-invalid-id not found"
}
```

### 服务器错误 (500)
```json
{
  "success": false,
  "error": "Failed to connect to Electron instance"
}
```

## 使用示例

### JavaScript/Node.js

```javascript
// 连接实例
const response = await fetch('http://localhost:3000/api/instances/connect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    port: 9222
  }),
});

const result = await response.json();
if (result.success) {
  const instanceId = result.data.instanceId;
  
  // 执行操作
  const actResponse = await fetch(`http://localhost:3000/api/instances/${instanceId}/act`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: '点击登录按钮'
    }),
  });
  
  const actResult = await actResponse.json();
  console.log('操作结果:', actResult.data.result);
}
```

### Python

```python
import requests
import json

# 连接实例
response = requests.post('http://localhost:3000/api/instances/connect', 
                        json={'port': 9222})

if response.json()['success']:
    instance_id = response.json()['data']['instanceId']
    
    # 执行操作
    act_response = requests.post(
        f'http://localhost:3000/api/instances/{instance_id}/act',
        json={'action': '点击登录按钮'}
    )
    
    result = act_response.json()
    print('操作结果:', result['data']['result'])
```

### cURL

```bash
# 连接实例
curl -X POST http://localhost:3000/api/instances/connect \
  -H "Content-Type: application/json" \
  -d '{"port": 9222}'

# 执行操作
curl -X POST http://localhost:3000/api/instances/electron-9222-1699123456789/act \
  -H "Content-Type: application/json" \
  -d '{"action": "点击登录按钮"}'

# 提取数据
curl -X POST http://localhost:3000/api/instances/electron-9222-1699123456789/extract \
  -H "Content-Type: application/json" \
  -d '{"instruction": "提取页面标题"}'
```

## 限制和注意事项

1. **并发限制**: 建议同时连接的实例数不超过 10 个
2. **超时设置**: 默认操作超时时间为 30 秒
3. **内存使用**: 长时间运行可能导致内存使用增加
4. **网络要求**: 需要确保 CDP 端口可访问
5. **API 密钥**: 妥善保管 AI 服务的 API 密钥

## 更新日志

### v1.0.0 (2023-11-04)
- 初始版本发布
- 支持基本的实例管理和操作执行
- 提供完整的 REST API 和 WebSocket 接口
