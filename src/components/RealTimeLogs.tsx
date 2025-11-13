'use client';

import { useEffect, useRef } from 'react';
import { OperationEvent } from '@/types';

interface RealTimeLogsProps {
  operations: OperationEvent[];
  selectedInstance: string | null;
}

export default function RealTimeLogs({ operations, selectedInstance }: RealTimeLogsProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  const filteredOperations = selectedInstance 
    ? operations.filter(op => op.instanceId === selectedInstance)
    : operations;

  // 自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredOperations]);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'click': return '👆';
      case 'type': return '⌨️';
      case 'navigate': return '🧭';
      case 'extract': return '📤';
      case 'observe': return '👀';
      case 'scroll': return '📜';
      default: return '🔧';
    }
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'click': return 'text-blue-400';
      case 'type': return 'text-green-400';
      case 'navigate': return 'text-purple-400';
      case 'extract': return 'text-yellow-400';
      case 'observe': return 'text-red-400';
      case 'scroll': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <span className="mr-2">📊</span>
            实时操作日志
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedInstance ? `实例: ${selectedInstance}` : '所有实例'} • {filteredOperations.length} 条记录
          </div>
        </div>

        <div className="log-container">
          {filteredOperations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-2xl mb-2">📭</div>
              <p>暂无操作日志</p>
              <p className="text-sm mt-1">执行操作后将在此显示</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOperations.map((operation, index) => (
                <div key={index} className="flex items-start space-x-3 fade-in">
                  <span className="text-gray-500 text-xs font-mono w-20 flex-shrink-0">
                    {formatTimestamp(operation.timestamp)}
                  </span>
                  
                  <span className="text-lg flex-shrink-0">
                    {getOperationIcon(operation.type)}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className={`font-medium ${getOperationColor(operation.type)}`}>
                        {operation.type.toUpperCase()}
                      </span>
                      <span className="text-gray-400 text-xs">
                        [{operation.instanceId.slice(-8)}]
                      </span>
                    </div>
                    
                    {operation.target && (
                      <div className="text-sm text-gray-300 mt-1">
                        {operation.target.selector && (
                          <div>选择器: {operation.target.selector}</div>
                        )}
                        {operation.target.coordinates && (
                          <div>
                            坐标: ({operation.target.coordinates.x}, {operation.target.coordinates.y})
                          </div>
                        )}
                        {operation.target.text && (
                          <div>文本: "{operation.target.text}"</div>
                        )}
                      </div>
                    )}
                    
                    {operation.result && (
                      <div className="text-xs text-gray-400 mt-1 bg-gray-800 p-2 rounded">
                        <pre className="whitespace-pre-wrap">
                          {typeof operation.result === 'string' 
                            ? operation.result 
                            : JSON.stringify(operation.result, null, 2)
                          }
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* 操作统计 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">📈</span>
          操作统计
        </h3>
        
        {filteredOperations.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(
              filteredOperations.reduce((acc, op) => {
                acc[op.type] = (acc[op.type] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="text-2xl mb-1">{getOperationIcon(type)}</div>
                <div className="font-medium text-gray-900 dark:text-white">{count}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400">
            暂无统计数据
          </div>
        )}
      </div>
    </div>
  );
}
