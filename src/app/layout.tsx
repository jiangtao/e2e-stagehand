import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import PreviewPanel from '@/components/PreviewPanel';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Browser Automation',
  description: 'AI-powered browser automation service',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
          {/* Left sidebar */}
          <div className="w-64 flex-shrink-0">
            <Sidebar />
          </div>
          
          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top status bar */}
            <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    AI Browser Automation
                  </h1>
                  <span className="ml-3 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                    v1.0.0
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Service Online
                  </span>
                </div>
              </div>
            </header>
              
            {/* Main content area */}
            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
            
            {/* Right preview panel - 50% width */}
            <div className="w-1/2">
              <PreviewPanel />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
