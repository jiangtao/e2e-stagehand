'use client';

import { useState } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';
import RealTimeLogs from '@/components/RealTimeLogs';

export default function MonitorPage() {
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  
  const {
    instances,
    operations,
    isConnected
  } = useStagehandWebSocket();

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">监控分析</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          实时监控和性能分析
        </p>
      </div>
      
      {/* 上半部分：实时日志 */}
      <div className="flex-1">
        <div className="card p-6 h-full">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📋</span>
            实时操作日志
          </h3>
          <RealTimeLogs
            operations={operations}
            selectedInstance={selectedInstance}
          />
        </div>
      </div>
      
      {/* 下半部分：性能统计 */}
      <div className="flex-1">
        <div className="card p-6 h-full">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📈</span>
            性能统计
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {instances.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                连接实例
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {instances.filter(inst => inst.status === 'connected').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                健康实例
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {operations.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                总操作数
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {isConnected ? '在线' : '离线'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                WebSocket
              </div>
            </div>
          </div>
          
          {/* 错误分析区域 */}
          <div className="mt-6">
            <h4 className="text-md font-medium mb-3">错误分析</h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                暂无错误记录
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
