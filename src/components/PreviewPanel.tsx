'use client';

import { useState, useEffect } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';
import OperationCanvas from './OperationCanvas';

export default function PreviewPanel() {
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  const {
    instances,
    operations,
    isConnected
  } = useStagehandWebSocket();

  // 自动选择第一个连接的实例
  useEffect(() => {
    if (instances.length > 0 && !selectedInstance) {
      const connectedInstance = instances.find(inst => inst.status === 'connected');
      if (connectedInstance) {
        setSelectedInstance(connectedInstance.id);
      }
    }
  }, [instances, selectedInstance]);

  const currentInstance = instances.find(inst => inst.id === selectedInstance);
  const recentOperations = operations
    .filter(op => !selectedInstance || op.instanceId === selectedInstance)
    .slice(-5);

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transition-all duration-300 ${
      isExpanded ? 'w-96' : 'w-12'
    }`}>
      {/* 头部控制栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        {isExpanded && (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            实时预览
          </h2>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="text-lg">
            {isExpanded ? '→' : '←'}
          </span>
        </button>
      </div>

      {isExpanded && (
        <>
          {/* 实例选择器 */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              选择实例
            </label>
            <select
              value={selectedInstance || ''}
              onChange={(e) => setSelectedInstance(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">请选择实例</option>
              {instances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.id} ({instance.status})
                </option>
              ))}
            </select>
          </div>

          {/* Sandbox 预览区 */}
          <div className="flex-1 p-4">
            <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Canvas 预览
                  </span>
                  {currentInstance && (
                    <div className={`w-2 h-2 rounded-full ${
                      currentInstance.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                  )}
                </div>
                
                <div className="flex-1 p-2">
                  <OperationCanvas
                    operations={operations}
                    selectedInstance={selectedInstance}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 操作详情 */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              最近操作
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {recentOperations.length > 0 ? (
                recentOperations.map((operation, index) => (
                  <div
                    key={index}
                    className="flex items-center text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      operation.type === 'click' ? 'bg-blue-500' :
                      operation.type === 'type' ? 'bg-green-500' :
                      operation.type === 'navigate' ? 'bg-purple-500' :
                      'bg-gray-500'
                    }`}></div>
                    <div className="flex-1">
                      <div className="font-medium">{operation.type}</div>
                      <div className="text-gray-500 dark:text-gray-500 truncate">
                        {operation.target?.text || operation.target?.selector || '无详情'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  暂无操作记录
                </p>
              )}
            </div>
          </div>

          {/* 快速操作 */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              快速操作
            </h3>
            <div className="space-y-2">
              <button
                disabled={!selectedInstance}
                className="w-full px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                截图
              </button>
              <button
                disabled={!selectedInstance}
                className="w-full px-3 py-2 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                观察页面
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
