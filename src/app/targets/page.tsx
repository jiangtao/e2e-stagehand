'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TargetsPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<Array<{
    id: string;
    name: string;
    type: 'electron' | 'chrome' | 'web-url';
    port?: number;
    url?: string;
  }>>([]);

  const [webUrl, setWebUrl] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);

  // 扫描可用目标
  const scanTargets = async () => {
    setIsScanning(true);
    try {
      const response = await fetch('/api/targets/scan');
      const data = await response.json();

      if (data.success) {
        setTargets(data.targets);
      }
    } catch (error) {
      console.error('Failed to scan targets:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // 添加 Web URL 目标
  const addWebUrlTarget = () => {
    if (!webUrl.trim()) return;

    const newTarget = {
      id: `web-${Date.now()}`,
      name: webUrl,
      type: 'web-url' as const,
      url: webUrl,
    };

    setTargets([...targets, newTarget]);
    setWebUrl('');
    setSelectedTargets(new Set(selectedTargets).add(newTarget.id));
  };

  // 切换目标选择
  const toggleTarget = (id: string) => {
    const newSelected = new Set(selectedTargets);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTargets(newSelected);
  };

  // 开始测试
  const startTesting = async () => {
    if (selectedTargets.size === 0) {
      alert('请至少选择一个测试目标');
      return;
    }

    const selectedTargetsData = targets.filter((t) =>
      selectedTargets.has(t.id)
    );

    try {
      const response = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targets: selectedTargetsData.map((t) => ({
            type: t.type,
            id: t.id,
            url: t.url,
            port: t.port,
            name: t.name,
          })),
          options: {
            concurrent: true,
            autoInitStagehand: true,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 跳转到测试页面
        router.push(`/testing?sessions=${data.sessionIds.join(',')}`);
      } else {
        alert(`创建测试会话失败: ${data.message}`);
      }
    } catch (error) {
      console.error('Failed to create sessions:', error);
      alert('创建测试会话失败，请查看控制台');
    }
  };

  // 初始扫描
  useEffect(() => {
    scanTargets();

    // 设置定期扫描
    const interval = setInterval(scanTargets, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            选择测试目标
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            自动发现本地运行的 Electron/Chrome 应用，或输入 Web URL
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 自动检测的目标 */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                自动检测到的应用
              </h2>
              <button
                onClick={scanTargets}
                disabled={isScanning}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
              >
                {isScanning ? '扫描中...' : '刷新'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targets.map((target) => (
                <div
                  key={target.id}
                  onClick={() => toggleTarget(target.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedTargets.has(target.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          target.type === 'electron'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {target.type === 'electron' ? 'Electron' : 'Chrome'}
                        </span>
                        {target.port && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            端口 {target.port}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {target.name}
                      </p>
                      {target.url && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {target.url}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      <input
                        type="checkbox"
                        checked={selectedTargets.has(target.id)}
                        onChange={() => toggleTarget(target.id)}
                        className="w-5 h-5 text-blue-500 rounded focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {targets.length === 0 && !isScanning && (
                <div className="col-span-2 text-center py-12 text-gray-500 dark:text-gray-400">
                  未检测到运行中的应用
                </div>
              )}
            </div>
          </div>

          {/* 添加 Web URL */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              添加 Web URL
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                网址
              </label>
              <input
                type="url"
                value={webUrl}
                onChange={(e) => setWebUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white mb-4"
              />
              <button
                onClick={addWebUrlTarget}
                disabled={!webUrl.trim()}
                className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>

        {/* 已选择的目标 */}
        {selectedTargets.size > 0 && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-blue-900 dark:text-blue-100 font-medium">
                已选择 {selectedTargets.size} 个目标
              </p>
              <button
                onClick={startTesting}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                开始测试 →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
