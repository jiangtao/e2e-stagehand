'use client';

import { useState, useEffect } from 'react';
import TaskUploader from '@/components/TaskUploader';
import RealTimeLogs from '@/components/RealTimeLogs';
import { Stagehand } from '@browserbasehq/stagehand';
import { createGLMStagehandConfig } from '@/lib/llm/glm-stagehand-adapter';

interface Benchmark {
  id: string;
  name: string;
  description: string;
  version: string;
  metadata: {
    tags: string[];
    difficulty: string;
    requires_login: boolean;
  };
}

interface Target {
  id: string;
  type: string;
  url: string;
  name: string;
  icon?: string;
  requiresLogin?: boolean;
}

export default function TasksPage() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [logs, setLogs] = useState<string[]>([]);

  // Stagehand 实例
  const [stagehand, setStagehand] = useState<Stagehand | null>(null);

  useEffect(() => {
    // 加载基准测试列表
    fetch('/api/tests/benchmarks')
      .then(r => r.json())
      .then(data => {
        if (data.success) setBenchmarks(data.benchmarks);
      });

    // 加载目标列表
    fetch('/api/targets')
      .then(r => r.json())
      .then(data => {
        if (data.success) setTargets(data.targets);
      });
  }, []);

  const handleRunBenchmark = async () => {
    if (!selectedBenchmark || !selectedTarget) return;

    setTestStatus('running');
    setLogs(prev => [...prev, '🚀 开始执行基准测试（Stagehand + GLM）...']);

    try {
      // 导入 Stagehand
      const { Stagehand } = await import('@browserbasehq/stagehand');
      const { createGLMStagehandConfig } = await import('@/lib/llm/glm-stagehand-adapter');

      console.log('[Benchmark] 导入 Stagehand 和 GLM 适配器...');

      // 创建 GLM Stagehand 实例
      const stagehandInstance = new Stagehand({
        ...createGLMStagehandConfig({
          model: 'glm-4.7',
        }),
        env: 'LOCAL',
        verbose: 1,
      });

      // 初始化
      await stagehandInstance.init();

      console.log('[Benchmark] Stagehand 已初始化，模型: glm-4-flash');

      // 获取目标
      const target = targets.find(t => t.id === selectedTarget);
      if (!target) {
        throw new Error('Target not found');
      }

      // 导航到目标页面
      console.log('[Benchmark] 导航到:', target.url);
      await stagehandInstance.page.goto(target.url);

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 执行测试操作
      console.log('[Benchmark] 执行测试操作...');

      // 尝试观察页面
      try {
        const observations = await stagehandInstance.observe({
          instruction: '描述页面的主要元素和结构',
        });
        console.log('[Benchmark] 观察结果:', observations);
        setLogs(prev => [...prev, `✅ 测试完成！AI 观察到 ${observations.length} 个可操作元素`]);
      } catch (observeError) {
        console.warn('[Benchmark] 观察失败，继续测试:', observeError);
        setLogs(prev => [...prev, `⚠️ 观察步骤失败，但测试继续执行`]);
      }

      setTestStatus('completed');

      // 清理
      await stagehandInstance.close();
      console.log('[Benchmark] Stagehand 实例已关闭');
    } catch (error) {
      console.error('[Benchmark] 执行失败:', error);
      setLogs(prev => [...prev, `❌ 测试失败: ${error}`]);
      setTestStatus('error');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">任务执行</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          使用 Stagehand + GLM 进行 AI E2E 自动化测试
        </p>
      </div>

      {/* 快速测试启动 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <span className="mr-2">🚀</span>
          快速基准测试
        </h3>
        <div className="flex items-center space-x-4">
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm flex-1"
            value={selectedBenchmark || ''}
            onChange={(e) => setSelectedBenchmark(e.target.value || null)}
          >
            <option value="">选择基准测试</option>
            {benchmarks.map(b => (
              <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm flex-1"
            value={selectedTarget || ''}
            onChange={(e) => setSelectedTarget(e.target.value || null)}
          >
            <option value="">选择目标</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
            ))}
          </select>
          <button
            onClick={handleRunBenchmark}
            disabled={!selectedBenchmark || !selectedTarget || testStatus === 'running'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testStatus === 'running' ? '运行中...' : '开始测试'}
          </button>
        </div>
        {selectedBenchmark && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {benchmarks.find(b => b.id === selectedBenchmark)?.description}
          </div>
        )}
      </div>

      {/* 上半部分：任务上传和管理 */}
      <div className="flex-1">
        <TaskUploader
          instances={[]}
          selectedInstance={selectedInstance}
        />
      </div>

      {/* 下半部分：操作流时间线 */}
      <div className="flex-1">
        <div className="card p-6 h-full">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📊</span>
            执行日志
          </h3>
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded"
              >
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-2">📭</div>
                <p>暂无执行日志</p>
                <p className="text-sm mt-1">选择基准测试和目标后点击"开始测试"</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
