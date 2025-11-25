'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserInfo from './UserInfo';
import { useStagehandWebSocket } from '@/lib/websocket/client-hook';

const navigation = [
  {
    name: '实例管理',
    href: '/instances',
    icon: '🔌',
    description: '连接和管理 Electron 实例'
  },
  {
    name: '代理客户端',
    href: '/agents',
    icon: '🤖',
    description: '管理代理客户端连接'
  },
  {
    name: '任务执行',
    href: '/tasks',
    icon: '📋',
    description: '上传和执行自动化任务'
  },
  {
    name: '监控分析',
    href: '/monitor',
    icon: '📊',
    description: '实时监控和性能分析'
  },
  {
    name: '系统设置',
    href: '/settings',
    icon: '⚙️',
    description: 'AI 配置和系统偏好'
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isConnected, instances } = useStagehandWebSocket();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Logo 和标题 */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SE</span>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Stagehand
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Electron 自动化
            </p>
          </div>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isConnected ? '已连接' : '未连接'}
          </span>
        </div>
        {instances.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {instances.length} 个实例在线
          </p>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (pathname === '/' && item.href === '/instances');
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-l-4 border-blue-500'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="text-lg mr-3">{item.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.description}
                </div>
              </div>
              {isActive && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 底部信息 */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
        <UserInfo />
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between items-center">
            <span>版本 1.0.0</span>
            <span className={`px-2 py-1 rounded text-xs ${
              isConnected 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {isConnected ? '运行中' : '离线'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
