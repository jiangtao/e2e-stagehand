import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { StagehandProvider } from '@/contexts/StagehandContext';
import Sidebar from '@/components/Sidebar';
import PreviewPanel from '@/components/PreviewPanel';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Stagehand for Electron',
  description: 'AI-powered browser automation service for Electron applications',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StagehandProvider>
          <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
            {/* 左侧导航栏 */}
            <div className="w-64 flex-shrink-0">
              <Sidebar />
            </div>
            
            {/* 主内容区域 */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* 顶部状态栏 */}
              <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Stagehand for Electron
                    </h1>
                    <span className="ml-3 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                      v1.0.0
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full pulse-dot mr-2"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Service Online
                      </span>
                    </div>
                  </div>
                </div>
              </header>
              
              {/* 主内容区 */}
              <div className="flex-1 flex min-h-0">
                {/* 中间内容区 */}
                <main className="flex-1 p-6 overflow-auto">
                  {children}
                </main>
                
                {/* 右侧预览面板 */}
                <PreviewPanel />
              </div>
            </div>
          </div>
        </StagehandProvider>
      </body>
    </html>
  );
}
