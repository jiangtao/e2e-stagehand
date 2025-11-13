'use client';

import ConfigPanel from '@/components/ConfigPanel';

export default function SettingsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">系统设置</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          配置 AI 模型、API 密钥和系统偏好
        </p>
      </div>
      
      <div className="flex-1">
        <ConfigPanel />
      </div>
    </div>
  );
}
