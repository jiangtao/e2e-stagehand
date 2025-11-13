'use client';

import { useState } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';
import TaskUploader from '@/components/TaskUploader';
import RealTimeLogs from '@/components/RealTimeLogs';

export default function TasksPage() {
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  
  const {
    instances,
    operations
  } = useStagehandWebSocket();

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">任务执行</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          上传和执行自动化任务
        </p>
      </div>
      
      {/* 上半部分：任务上传和管理 */}
      <div className="flex-1">
        <TaskUploader
          instances={instances}
          selectedInstance={selectedInstance}
        />
      </div>
      
      {/* 下半部分：操作流时间线 */}
      <div className="flex-1">
        <div className="card p-6 h-full">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="mr-2">📊</span>
            操作流时间线
          </h3>
          <RealTimeLogs
            operations={operations}
            selectedInstance={selectedInstance}
          />
        </div>
      </div>
    </div>
  );
}
