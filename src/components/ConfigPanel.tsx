'use client';

import { useState, useEffect } from 'react';

interface Config {
  stagehand: {
    modelProvider: string;
    apiKey: string;
    customApiUrl?: string;
    modelName?: string;
  };
  websocket: {
    port: number;
    reconnectInterval: number;
    maxReconnectAttempts: number;
  };
  electron: {
    defaultDebugPort: number;
    healthCheckInterval: number;
  };
}

export default function ConfigPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    modelProvider: 'openai',
    apiKey: '',
    customApiUrl: '',
    modelName: ''
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
        setFormData({
          modelProvider: result.data.stagehand.modelProvider,
          apiKey: '',
          customApiUrl: result.data.stagehand.customApiUrl || '',
          modelName: result.data.stagehand.modelName || ''
        });
      }
    } catch (error) {
      console.error('获取配置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const updateData: any = {
        stagehand: {}
      };

      if (formData.modelProvider !== config?.stagehand.modelProvider) {
        updateData.stagehand.modelProvider = formData.modelProvider;
      }
      
      if (formData.apiKey) {
        updateData.stagehand.apiKey = formData.apiKey;
      }
      
      if (formData.customApiUrl !== config?.stagehand.customApiUrl) {
        updateData.stagehand.customApiUrl = formData.customApiUrl;
      }
      
      if (formData.modelName !== config?.stagehand.modelName) {
        updateData.stagehand.modelName = formData.modelName;
      }

      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ 配置更新成功！');
        await fetchConfig();
        setFormData(prev => ({ ...prev, apiKey: '' }));
      } else {
        alert(`❌ 更新失败: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ 更新错误: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">加载配置中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI 模型配置 */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <span className="mr-2">🤖</span>
          AI 模型配置
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型提供商
            </label>
            <select
              value={formData.modelProvider}
              onChange={(e) => setFormData({ ...formData, modelProvider: e.target.value })}
              className="input-field"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              API 密钥
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="input-field"
              placeholder={config?.stagehand.apiKey ? '已设置 (输入新密钥以更新)' : '输入 API 密钥'}
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.modelProvider === 'openai' && '获取 OpenAI API 密钥: https://platform.openai.com/api-keys'}
              {formData.modelProvider === 'anthropic' && '获取 Anthropic API 密钥: https://console.anthropic.com/'}
              {formData.modelProvider === 'custom' && '输入自定义 API 服务的密钥'}
            </p>
          </div>

          {formData.modelProvider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                自定义 API URL
              </label>
              <input
                type="url"
                value={formData.customApiUrl}
                onChange={(e) => setFormData({ ...formData, customApiUrl: e.target.value })}
                className="input-field"
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              模型名称 (可选)
            </label>
            <input
              type="text"
              value={formData.modelName}
              onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
              className="input-field"
              placeholder={
                formData.modelProvider === 'openai' ? 'gpt-4' :
                formData.modelProvider === 'anthropic' ? 'claude-3-sonnet-20240229' :
                '自定义模型名称'
              }
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </div>

      {/* 当前配置状态 */}
      {config && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📊</span>
            当前配置状态
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Stagehand 配置</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">模型提供商:</span>
                  <span className="font-medium">{config.stagehand.modelProvider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">API 密钥:</span>
                  <span className={`font-medium ${config.stagehand.apiKey ? 'text-green-600' : 'text-red-600'}`}>
                    {config.stagehand.apiKey ? '已设置' : '未设置'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">模型名称:</span>
                  <span className="font-medium">{config.stagehand.modelName || '默认'}</span>
                </div>
                {config.stagehand.customApiUrl && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">自定义 URL:</span>
                    <span className="font-medium text-xs">{config.stagehand.customApiUrl}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">系统配置</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">WebSocket 端口:</span>
                  <span className="font-medium">{config.websocket.port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">重连间隔:</span>
                  <span className="font-medium">{config.websocket.reconnectInterval}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">默认调试端口:</span>
                  <span className="font-medium">{config.electron.defaultDebugPort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">健康检查间隔:</span>
                  <span className="font-medium">{config.electron.healthCheckInterval}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 配置说明 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">💡</span>
          配置说明
        </h3>
        
        <div className="prose dark:prose-invert max-w-none text-sm">
          <h4>模型提供商选择</h4>
          <ul>
            <li><strong>OpenAI:</strong> 使用 GPT 系列模型，需要 OpenAI API 密钥</li>
            <li><strong>Anthropic:</strong> 使用 Claude 系列模型，需要 Anthropic API 密钥</li>
            <li><strong>自定义:</strong> 使用兼容 OpenAI API 格式的自定义服务</li>
          </ul>
          
          <h4>注意事项</h4>
          <ul>
            <li>配置更改后需要重启服务才能生效</li>
            <li>API 密钥将安全存储，不会在界面中显示</li>
            <li>建议定期更换 API 密钥以确保安全</li>
            <li>自定义 API 服务需要兼容 OpenAI 的接口格式</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
