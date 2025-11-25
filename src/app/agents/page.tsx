'use client';

import { useState, useEffect } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';

interface Agent {
  agentId: string;
  userId: string;
  name?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const { sendMessage, isConnected } = useStagehandWebSocket();

  useEffect(() => {
    if (isConnected) {
      sendMessage({ type: 'get_agents' });
    }
  }, [isConnected, sendMessage]);

  // 这里应该从 WebSocket 消息中更新 agents
  // 暂时使用模拟数据，后续需要集成 WebSocket 消息处理

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">代理客户端管理</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          管理连接到服务器的代理客户端
        </p>
      </div>

      <div className="flex-1">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <span className="mr-2">🤖</span>
              已连接的代理客户端 ({agents.length})
            </h2>
            <button
              onClick={() => sendMessage({ type: 'get_agents' })}
              className="btn-secondary text-sm"
            >
              🔄 刷新
            </button>
          </div>

          {agents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <p>暂无连接的代理客户端</p>
              <p className="text-sm mt-1">请在局域网内运行代理客户端程序</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="border rounded-lg p-4 border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🤖</span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {agent.name || agent.agentId}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {agent.agentId}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          用户: {agent.userId.slice(0, 8)}...
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div className="text-gray-500 dark:text-gray-400">
                        连接时间: {new Date(agent.connectedAt).toLocaleString()}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400">
                        最后心跳: {new Date(agent.lastHeartbeat).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

