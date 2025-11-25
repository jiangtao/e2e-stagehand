export interface AgentConfig {
  serverUrl: string;
  userId?: string;
  name?: string;
  token?: string;
  cdpPortRange?: {
    min: number;
    max: number;
  };
  heartbeatInterval?: number;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

const defaultConfig: AgentConfig = {
  serverUrl: process.env.STAGEHAND_SERVER_URL || 'ws://localhost:8080',
  userId: process.env.STAGEHAND_USER_ID,
  name: process.env.STAGEHAND_AGENT_NAME || `Agent-${Date.now()}`,
  token: process.env.STAGEHAND_AGENT_TOKEN,
  cdpPortRange: {
    min: 9222,
    max: 9999
  },
  heartbeatInterval: 30000, // 30秒
  reconnectInterval: 5000, // 5秒
  maxReconnectAttempts: 10
};

export function getConfig(): AgentConfig {
  return {
    ...defaultConfig,
    serverUrl: process.env.STAGEHAND_SERVER_URL || defaultConfig.serverUrl,
    userId: process.env.STAGEHAND_USER_ID || defaultConfig.userId,
    name: process.env.STAGEHAND_AGENT_NAME || defaultConfig.name,
    token: process.env.STAGEHAND_AGENT_TOKEN || defaultConfig.token
  };
}

