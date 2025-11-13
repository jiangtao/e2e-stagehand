'use client';

import { useState } from 'react';
import { ElectronInstance } from '@/types';

interface TaskUploaderProps {
  instances: ElectronInstance[];
  selectedInstance: string | null;
}

export default function TaskUploader({ instances, selectedInstance }: TaskUploaderProps) {
  const [taskContent, setTaskContent] = useState('');
  const [filename, setFilename] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!taskContent.trim() || !filename.trim()) {
      alert('请填写文件名和任务内容');
      return;
    }

    setIsUploading(true);

    try {
      const response = await fetch('/api/tasks/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          content: taskContent,
          description,
          instanceId: selectedInstance
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ 任务上传成功！');
        setTaskContent('');
        setFilename('');
        setDescription('');
      } else {
        alert(`❌ 上传失败: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ 上传错误: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const sampleTasks = [
    {
      name: '简单测试',
      content: `# 简单的网页测试任务
点击登录按钮
输入用户名: test@example.com
输入密码: password123
点击提交按钮
等待页面加载完成`
    },
    {
      name: '数据提取',
      content: `# 数据提取任务
导航到 https://example.com
等待页面加载
提取页面标题
提取所有链接文本
截图保存`
    },
    {
      name: '表单填写',
      content: `# 表单自动填写
找到姓名输入框并输入: 张三
找到邮箱输入框并输入: zhangsan@example.com
选择性别: 男
选择城市: 北京
点击提交按钮`
    }
  ];

  return (
    <div className="space-y-6">
      {/* 任务编辑器 */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <span className="mr-2">📝</span>
          任务编辑器
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                文件名
              </label>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="input-field"
                placeholder="my-task.txt"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                关联实例 (可选)
              </label>
              <select
                value={selectedInstance || ''}
                className="input-field"
                disabled
              >
                <option value="">选择实例</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.id} (端口: {instance.port})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              任务描述 (可选)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              placeholder="描述这个任务的用途..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              任务内容
            </label>
            <textarea
              value={taskContent}
              onChange={(e) => setTaskContent(e.target.value)}
              className="input-field h-64 font-mono text-sm"
              placeholder="输入任务内容，每行一个操作指令..."
            />
            <p className="text-xs text-gray-500 mt-1">
              支持自然语言描述，例如："点击登录按钮"、"输入用户名"、"等待页面加载"等
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleUpload}
              disabled={isUploading || !taskContent.trim() || !filename.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? '上传中...' : '上传任务'}
            </button>
          </div>
        </div>
      </div>

      {/* 示例任务 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">💡</span>
          示例任务
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sampleTasks.map((task, index) => (
            <div
              key={index}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
              onClick={() => {
                setTaskContent(task.content);
                setFilename(`${task.name.toLowerCase().replace(/\s+/g, '-')}.txt`);
                setDescription(`${task.name}示例任务`);
              }}
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                {task.name}
              </h4>
              <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-hidden">
                {task.content.split('\n').slice(0, 4).join('\n')}
                {task.content.split('\n').length > 4 && '\n...'}
              </pre>
              <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                点击加载到编辑器
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">📖</span>
          使用说明
        </h3>
        
        <div className="prose dark:prose-invert max-w-none">
          <h4>任务格式</h4>
          <ul>
            <li>每行一个操作指令</li>
            <li>支持自然语言描述</li>
            <li>以 # 开头的行为注释</li>
            <li>空行会被忽略</li>
          </ul>
          
          <h4>常用指令示例</h4>
          <ul>
            <li><code>点击登录按钮</code> - 查找并点击登录按钮</li>
            <li><code>输入用户名: admin</code> - 在用户名输入框中输入 admin</li>
            <li><code>等待页面加载完成</code> - 等待页面加载</li>
            <li><code>截图</code> - 对当前页面截图</li>
            <li><code>导航到 https://example.com</code> - 跳转到指定网址</li>
          </ul>
          
          <h4>注意事项</h4>
          <ul>
            <li>任务将由 AI 模型解析并执行</li>
            <li>请使用清晰、具体的描述</li>
            <li>复杂操作可能需要分解为多个步骤</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
