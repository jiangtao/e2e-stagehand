#!/usr/bin/env node

import { CDPProxy } from './cdp-proxy';
import { AgentWebSocketClient } from './websocket-client';
import { getConfig, AgentConfig } from './config';

let cdpProxy: CDPProxy;
let wsClient: AgentWebSocketClient;
let isShuttingDown = false;

/**
 * 启动代理客户端
 */
async function startAgent(config: AgentConfig) {
  console.log('🚀 Starting Stagehand Agent...');
  console.log(`   Server: ${config.serverUrl}`);
  console.log(`   User ID: ${config.userId || 'Auto-generated'}`);
  console.log(`   Name: ${config.name}`);

  // 创建 CDP 代理
  cdpProxy = new CDPProxy();

  // 创建 WebSocket 客户端
  wsClient = new AgentWebSocketClient(config, cdpProxy);

  // 监听事件
  wsClient.on('connected', () => {
    console.log('✅ Agent connected to server');
  });

  wsClient.on('disconnected', () => {
    console.log('⚠️ Agent disconnected from server');
  });

  wsClient.on('error', (error) => {
    console.error('❌ Agent error:', error);
  });

  wsClient.on('maxReconnectAttemptsReached', () => {
    console.error('❌ Max reconnect attempts reached, exiting...');
    process.exit(1);
  });

  // 连接到服务器
  wsClient.connect();

  // 处理退出信号
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

/**
 * 处理关闭
 */
async function handleShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n🛑 Shutting down agent...');

  try {
    if (wsClient) {
      wsClient.disconnect();
    }
    if (cdpProxy) {
      await cdpProxy.cleanup();
    }
    console.log('✅ Agent shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// 主函数
if (require.main === module) {
  const config = getConfig();
  startAgent(config).catch((error) => {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  });
}

export { startAgent, CDPProxy, AgentWebSocketClient };

