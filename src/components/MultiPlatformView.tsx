'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Session {
  id: string;
  targetId: string;
  targetType: string;
  displayName: string;
  status: string;
  lastActivity: Date;
}

export function MultiPlatformView() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [action, setAction] = useState('');
  const [results, setResults] = useState<Map<string, any>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);

  // 从 URL 参数获取 session IDs
  const sessionIds = searchParams.get('sessions')?.split(',') || [];

  // 获取会话信息
  useEffect(() => {
    const fetchSessions = async () => {
      const sessionData: Session[] = [];

      for (const sessionId of sessionIds) {
        try {
          const response = await fetch(`/api/sessions/${sessionId}/act`);
          const data = await response.json();

          if (data.success && data.session) {
            sessionData.push(data.session);
          }
        } catch (error) {
          console.error(`Failed to get session ${sessionId}:`, error);
        }
      }

      setSessions(sessionData);
    };

    fetchSessions();

    // 定期更新状态
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [sessionIds]);

  // 执行操作
  const executeAction = async () => {
    if (!action.trim() || isExecuting) return;

    setIsExecuting(true);
    setResults(new Map());

    try {
      const response = await fetch('/api/sessions/multi-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionIds,
          action,
          options: {
            concurrent: true,
          },
        }),
      });

      const data = await response.json();

      if (data.success && data.results) {
        // data.results 是 Map<string, ActionResult>
        const resultsMap = new Map(Object.entries(data.results));
        setResults(resultsMap);
      }
    } catch (error) {
      console.error('Failed to execute action:', error);
      alert('执行操作失败');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 顶部控制栏 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            多平台测试控制
          </h1>

          {/* 操作输入 */}
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="输入操作指令，例如：点击登录按钮"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  executeAction();
                }
              }}
            />
            <button
              onClick={executeAction}
              disabled={isExecuting || !action.trim()}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
            >
              {isExecuting ? '执行中...' : '执行'}
            </button>
          </div>

          {/* 结果统计 */}
          {results.size > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              成功: {Array.from(results.values()).filter((r) => r.success).length} / {results.size}
            </div>
          )}
        </div>
      </div>

      {/* 目标画面网格 */}
      <div className="p-4">
        <div className={`grid gap-4 mx-auto ${
          sessions.length === 1
            ? 'grid-cols-1 max-w-4xl'
            : sessions.length === 2
            ? 'grid-cols-2 max-w-6xl'
            : 'grid-cols-2 lg:grid-cols-3 max-w-7xl'
        }`}>
          {sessions.map((session) => {
            const result = results.get(session.id);
            const isSuccess = result?.success;

            return (
              <div
                key={session.id}
                className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg"
              >
                {/* 标题栏 */}
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {session.displayName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {session.targetType}
                    </span>
                  </div>
                  <div className={`px-2 py-1 text-xs font-medium rounded ${
                    session.status === 'ready'
                      ? 'bg-green-100 text-green-800'
                      : session.status === 'busy'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {session.status === 'ready' ? '就绪' :
                     session.status === 'busy' ? '忙碌' :
                     session.status}
                  </div>
                </div>

                {/* 画面区域 */}
                <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                  <div className="text-white text-center">
                    <div className="text-4xl mb-2">🖥️</div>
                    <p className="text-sm text-gray-400">画面预览</p>
                  </div>

                  {/* 操作结果覆盖层 */}
                  {result && (
                    <div className={`absolute inset-0 flex items-center justify-center p-4 ${
                      isSuccess
                        ? 'bg-green-500/90'
                        : 'bg-red-500/90'
                    }`}>
                      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-xl ${
                        isSuccess ? 'border-2 border-green-500' : 'border-2 border-red-500'
                      }`}>
                        <div className="text-center">
                          <div className={`text-4xl mb-2 ${
                            isSuccess ? '✅' : '❌'
                          }`}></div>
                          <p className="font-medium text-gray-900 dark:text-white mb-1">
                            {isSuccess ? '操作成功' : '操作失败'}
                          </p>
                          {!isSuccess && result.error && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {result.error}
                            </p>
                          )}
                          {result.duration !== undefined && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              耗时: {result.duration}ms
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 底部状态 */}
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-xs text-gray-600 dark:text-gray-400 flex justify-between">
                  <span>ID: {session.id.slice(-8)}</span>
                  <span>
                    最后活动: {session.lastActivity.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
