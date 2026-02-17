'use client';

import { useState, useEffect, useRef } from 'react';

interface Recording {
  id: string;
  targetId: string;
  status: 'idle' | 'recording' | 'paused' | 'stopped' | 'error';
  duration: number;
  size: number;
}

export function VideoRecorder() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);

  // 获取录制列表
  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const response = await fetch('/api/recordings/list');
        const data = await response.json();

        if (data.success) {
          setRecordings(data.recordings);
        }
      } catch (error) {
        console.error('Failed to fetch recordings:', error);
      }
    };

    fetchRecordings();

    // 定期更新
    const interval = setInterval(fetchRecordings, 2000);
    return () => clearInterval(interval);
  }, []);

  // 格式化时长
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 格式化大小
  const formatSize = (bytes: number) => {
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  };

  // 开始录制
  const startRecording = async (targetId: string) => {
    try {
      const response = await fetch('/api/recordings/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      });

      const data = await response.json();

      if (data.success) {
        setSelectedRecording(data.recordingId);
      } else {
        alert('启动录制失败');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('启动录制失败');
    }
  };

  // 停止录制
  const stopRecording = async (recordingId: string) => {
    try {
      const response = await fetch(`/api/recordings/${recordingId}/stop`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success && data.result?.url) {
        // 自动下载视频
        const a = document.createElement('a');
        a.href = data.result.url;
        a.download = `recording-${recordingId}.webm`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('停止录制失败');
    }
  };

  // 暂停/恢复录制
  const togglePause = async (recordingId: string, currentStatus: string) => {
    const action = currentStatus === 'recording' ? 'pause' : 'resume';

    try {
      const response = await fetch(`/api/recordings/${recordingId}/${action}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        alert(`${action === 'pause' ? '暂停' : '恢复'}录制失败`);
      }
    } catch (error) {
      console.error(`Failed to ${action} recording:`, error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        📹 视频录制
      </h2>

      {/* 录制列表 */}
      <div className="space-y-3">
        {recordings.map((recording) => {
          const isSelected = selectedRecording === recording.id;
          const isRecording = recording.status === 'recording';
          const isPaused = recording.status === 'paused';
          const isStopped = recording.status === 'stopped';
          const isError = recording.status === 'error';

          return (
            <div
              key={recording.id}
              className={`border-2 rounded-lg p-4 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      isRecording
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : isPaused
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : isStopped
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {isRecording ? '录制中' :
                       isPaused ? '已暂停' :
                       isStopped ? '已完成' :
                       isError ? '错误' :
                       recording.status}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      目标: {recording.targetId}
                    </span>
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="flex gap-2">
                  {isRecording && (
                    <button
                      onClick={() => togglePause(recording.id, recording.status)}
                      className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm"
                    >
                      暂停
                    </button>
                  )}
                  {isPaused && (
                    <button
                      onClick={() => togglePause(recording.id, recording.status)}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
                    >
                      继续
                    </button>
                  )}
                  {(isRecording || isPaused) && (
                    <button
                      onClick={() => stopRecording(recording.id)}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                    >
                      停止
                    </button>
                  )}
                  {isStopped && recording.url && (
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = recording.url!;
                        a.download = `recording-${recording.id}.webm`;
                        a.click();
                      }}
                      className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                    >
                      下载
                    </button>
                  )}
                </div>

                {/* 信息 */}
                <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>时长: {formatDuration(recording.duration)}</span>
                  <span>大小: {formatSize(recording.size)}</span>
                </div>
              </div>
            );
        })}

        {recordings.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            暂无录制任务
          </div>
        )}
      </div>
    </div>
  );
}
