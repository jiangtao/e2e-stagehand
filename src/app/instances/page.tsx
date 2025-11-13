'use client';

import { useState } from 'react';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';
import InstanceManager from '@/components/InstanceManager';

export default function InstancesPage() {
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  
  const {
    instances,
    sendMessage
  } = useStagehandWebSocket();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">实例管理</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          连接和管理 Electron 应用实例
        </p>
      </div>
      
      <div className="flex-1">
        <InstanceManager
          instances={instances}
          selectedInstance={selectedInstance}
          onInstanceSelect={setSelectedInstance}
          onRefresh={() => sendMessage({ type: 'get_instances' })}
        />
      </div>
    </div>
  );
}
