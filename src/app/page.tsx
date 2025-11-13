'use client';

import { useState, useEffect } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';
import { ElectronInstance, OperationEvent } from '@/types';
import InstanceManager from '@/components/InstanceManager';
import TaskUploader from '@/components/TaskUploader';
import OperationCanvas from '@/components/OperationCanvas';
import RealTimeLogs from '@/components/RealTimeLogs';
import ConfigPanel from '@/components/ConfigPanel';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'instances' | 'tasks' | 'logs' | 'config'>('instances');
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  
  const {
    isConnected,
    instances,
    operations,
    error,
    sendMessage,
    requestInstanceStatus,
    clearError,
    reconnect
  } = useStagehandWebSocket();

  // 定期刷新实例状态
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        sendMessage({ type: 'get_instances' });
      }, 10000); // 每10秒刷新一次

      return () => clearInterval(interval);
    }
  }, [isConnected, sendMessage]);

  const tabs = [
    { id: 'instances', label: '实例管理', icon: '🔌' },
    { id: 'tasks', label: '任务上传', icon: '📋' },
    { id: 'logs', label: '实时日志', icon: '📊' },
    { id: 'config', label: '配置管理', icon: '⚙️' }
  ] as const;

  return (
    <div className="space-y-6">
      {/* 连接状态提示 */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${isConnected ? 'bg-green-500 pulse-dot' : 'bg-red-500'}`}></div>
            <span className="font-medium">
              WebSocket: {isConnected ? '已连接' : '未连接'}
            </span>
            {instances.length > 0 && (
              <span className="ml-4 text-sm text-gray-600 dark:text-gray-400">
                {instances.length} 个 Electron 实例已连接
              </span>
            )}
          </div>
          
          {error && (
            <div className="flex items-center">
              <span className="text-red-600 text-sm mr-2">{error}</span>
              <button
                onClick={clearError}
                className="text-red-600 hover:text-red-800 text-sm underline"
              >
                清除
              </button>
            </div>
          )}
          
          {!isConnected && (
            <button
              onClick={reconnect}
              className="btn-primary text-sm"
            >
              重新连接
            </button>
          )}
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧主要内容 */}
        <div className="lg:col-span-2">
          {activeTab === 'instances' && (
            <InstanceManager
              instances={instances}
              selectedInstance={selectedInstance}
              onInstanceSelect={setSelectedInstance}
              onRefresh={() => sendMessage({ type: 'get_instances' })}
            />
          )}
          
          {activeTab === 'tasks' && (
            <TaskUploader
              instances={instances}
              selectedInstance={selectedInstance}
            />
          )}
          
          {activeTab === 'logs' && (
            <RealTimeLogs
              operations={operations}
              selectedInstance={selectedInstance}
            />
          )}
          
          {activeTab === 'config' && (
            <ConfigPanel />
          )}
        </div>

        {/* 右侧操作可视化 */}
        <div className="space-y-6">
          {/* 操作流可视化 */}
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">🎨</span>
              操作流可视化
            </h3>
            <OperationCanvas
              operations={operations}
              selectedInstance={selectedInstance}
            />
          </div>

          {/* 快速操作面板 */}
          {selectedInstance && (
            <div className="card p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">⚡</span>
                快速操作
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => requestInstanceStatus(selectedInstance)}
                  className="w-full btn-secondary text-sm"
                >
                  刷新状态
                </button>
                <button
                  onClick={() => {
                    // 这里可以添加截图功能
                    console.log('Taking screenshot...');
                  }}
                  className="w-full btn-secondary text-sm"
                >
                  截图
                </button>
                <button
                  onClick={() => {
                    // 这里可以添加页面观察功能
                    console.log('Observing page...');
                  }}
                  className="w-full btn-secondary text-sm"
                >
                  观察页面
                </button>
              </div>
            </div>
          )}

          {/* 统计信息 */}
          <div className="card p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">📈</span>
              统计信息
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">连接实例</span>
                <span className="font-medium">{instances.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">健康实例</span>
                <span className="font-medium text-green-600">
                  {instances.filter(inst => inst.status === 'connected').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">总操作数</span>
                <span className="font-medium">{operations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">WebSocket</span>
                <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isConnected ? '在线' : '离线'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
