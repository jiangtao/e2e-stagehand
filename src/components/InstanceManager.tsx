'use client';

import { useState } from 'react';
import { ElectronInstance } from '@/types';

interface InstanceManagerProps {
  instances: ElectronInstance[];
  selectedInstance: string | null;
  onInstanceSelect: (instanceId: string | null) => void;
  onRefresh: () => void;
}

export default function InstanceManager({
  instances,
  selectedInstance,
  onInstanceSelect,
  onRefresh
}: InstanceManagerProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectForm, setConnectForm] = useState({
    port: '9222',
    appPath: '',
    agentId: '',
    connectionType: 'local' as 'local' | 'remote'
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const response = await fetch('/api/instances/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          port: parseInt(connectForm.port),
          appPath: connectForm.appPath || undefined,
          agentId: connectForm.agentId || undefined,
          connectionType: connectForm.connectionType
        }),
      });

      const result = await response.json();

      if (result.success) {
        onRefresh();
        setConnectForm({ port: '9222', appPath: '', agentId: '', connectionType: 'local' });
        alert('✅ 连接成功！');
      } else {
        alert(`❌ 连接失败: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ 连接错误: ${error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    if (!confirm('确定要断开此实例的连接吗？')) return;

    try {
      const response = await fetch(`/api/instances/${instanceId}/disconnect`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        if (selectedInstance === instanceId) {
          onInstanceSelect(null);
        }
        onRefresh();
        alert('✅ 断开连接成功！');
      } else {
        alert(`❌ 断开连接失败: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ 断开连接错误: ${error}`);
    }
  };

  const getStatusIcon = (instance: ElectronInstance) => {
    switch (instance.status) {
      case 'connected':
        return '🟢';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const getStatusClass = (instance: ElectronInstance) => {
    switch (instance.status) {
      case 'connected':
        return 'status-connected';
      case 'disconnected':
        return 'status-disconnected';
      case 'error':
        return 'status-error';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 连接新实例 */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <span className="mr-2">🔌</span>
          连接 Electron 实例
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              连接类型
            </label>
            <select
              value={connectForm.connectionType || 'local'}
              onChange={(e) => setConnectForm({ ...connectForm, connectionType: e.target.value as 'local' | 'remote' })}
              className="input-field"
            >
              <option value="local">本地直连</option>
              <option value="remote">远程代理</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CDP 调试端口
              </label>
              <input
                type="number"
                value={connectForm.port}
                onChange={(e) => setConnectForm({ ...connectForm, port: e.target.value })}
                className="input-field"
                placeholder="9222"
                min="1024"
                max="65535"
              />
              <p className="text-xs text-gray-500 mt-1">
                Electron 应用的远程调试端口 (通常是 9222)
              </p>
            </div>
            
            {connectForm.connectionType === 'remote' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  代理客户端 ID (可选)
                </label>
                <input
                  type="text"
                  value={connectForm.agentId || ''}
                  onChange={(e) => setConnectForm({ ...connectForm, agentId: e.target.value })}
                  className="input-field"
                  placeholder="agent-xxx"
                />
                <p className="text-xs text-gray-500 mt-1">
                  如果为空，将使用第一个可用的代理客户端
                </p>
              </div>
            )}

            {connectForm.connectionType === 'local' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  应用路径 (可选)
                </label>
                <input
                  type="text"
                  value={connectForm.appPath}
                  onChange={(e) => setConnectForm({ ...connectForm, appPath: e.target.value })}
                  className="input-field"
                  placeholder="/path/to/electron/app"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Electron 应用的可执行文件路径
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            💡 确保 Electron 应用启动时添加了 <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">--remote-debugging-port={connectForm.port}</code> 参数
          </div>
          <button
            onClick={handleConnect}
            disabled={isConnecting || !connectForm.port}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? '连接中...' : '连接'}
          </button>
        </div>
      </div>

      {/* 实例列表 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <span className="mr-2">📱</span>
            已连接的实例 ({instances.length})
          </h2>
          <button
            onClick={onRefresh}
            className="btn-secondary text-sm"
          >
            🔄 刷新
          </button>
        </div>

        {instances.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>暂无连接的 Electron 实例</p>
            <p className="text-sm mt-1">请先连接一个实例</p>
          </div>
        ) : (
          <div className="space-y-4">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className={`border rounded-lg p-4 transition-all duration-200 cursor-pointer ${
                  selectedInstance === instance.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => onInstanceSelect(instance.id === selectedInstance ? null : instance.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getStatusIcon(instance)}</span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {instance.id}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        端口: {instance.port}
                        {instance.appPath && (
                          <span className="ml-2">• {instance.appPath}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`status-indicator ${getStatusClass(instance)}`}>
                      {instance.status}
                    </span>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnect(instance.id);
                      }}
                      className="btn-danger text-sm"
                    >
                      断开
                    </button>
                  </div>
                </div>
                
                {selectedInstance === instance.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 fade-in">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">连接时间:</span>
                        <div className="font-medium">
                          {new Date(instance.connectedAt).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">最后活动:</span>
                        <div className="font-medium">
                          {new Date(instance.lastActivity).toLocaleString()}
                        </div>
                      </div>
                      {instance.pid && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">进程 ID:</span>
                          <div className="font-medium">{instance.pid}</div>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">状态:</span>
                        <div className="font-medium">{instance.status}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
