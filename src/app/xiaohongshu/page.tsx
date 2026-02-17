'use client';

import { useState } from 'react';

export default function XiaohongshuTestPage() {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [results, setResults] = useState<any[]>([]);

  const runTest = async () => {
    setTestStatus('running');
    setResults([]);

    try {
      const response = await fetch('/api/xiaohongshu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setTestStatus('completed');
        setResults(data.results || []);
      } else {
        setTestStatus('error');
      }
    } catch (error) {
      console.error('测试失败:', error);
      setTestStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          🧪 小红书自动化测试 (MVP)
        </h1>

        <div className="space-y-4">
          {/* 测试说明 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">测试流程</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li>打开小红书首页</li>
              <li>等待页面加载 (3秒)</li>
              <li>搜索"北京春节美食"</li>
              <li>浏览搜索结果</li>
              <li>验证页面内容</li>
            </ol>
          </div>

          {/* 运行按钮 */}
          <div className="flex flex-col items-center space-y-4">
            <button
              onClick={runTest}
              disabled={testStatus === 'running'}
              className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold
                       hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors w-full"
            >
              {testStatus === 'running' ? '⏳ 测试中...' :
               testStatus === 'completed' ? '✅ 测试完成' :
               testStatus === 'error' ? '❌ 测试失败' :
               '▶ 运行测试'}
            </button>

            {/* 测试状态 */}
            {testStatus !== 'idle' && (
              <div className="w-full bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  状态: <span className={`font-semibold ${
                    testStatus === 'completed' ? 'text-green-600' :
                    testStatus === 'error' ? 'text-red-600' :
                    'text-blue-600'
                  }`}>
                    {testStatus === 'running' ? '运行中' :
                     testStatus === 'completed' ? '成功' :
                     testStatus === 'error' ? '失败' : testStatus}
                  </span>
                </p>

                {/* 测试结果 */}
                {results.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">测试步骤结果：</h3>
                    {results.map((result, idx) => (
                      <div key={idx} className={`text-xs p-2 rounded ${
                        result.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                      }`}>
                        <div className="flex justify-between">
                          <span className="font-medium">{result.step}</span>
                          <span>{result.success ? '✅' : '❌'} {result.duration}ms</span>
                        </div>
                        {result.error && (
                          <div className="text-red-600 dark:text-red-400 mt-1">
                            错误: {result.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">📋 使用说明</h3>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 dark:text-gray-400">
            <li>点击"运行测试"按钮后，Chrome 会自动打开小红书</li>
            <li>测试会自动执行所有步骤并显示结果</li>
            <li>这是 MVP 版本，使用纯 CDP 协议，无需 LLM API</li>
            <li>如需修改测试步骤，请编辑 <code>src/app/api/xiaohongshu/route.ts</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
