'use client';

import { useState, useEffect, useRef } from 'react';
import { PlaybackRecord, taskRecorder } from '@/lib/playback/recorder';
import { OperationEvent } from '@/types';

interface TaskPlaybackProps {
  recordId?: string;
  onClose?: () => void;
}

export default function TaskPlayback({ recordId, onClose }: TaskPlaybackProps) {
  const [record, setRecord] = useState<PlaybackRecord | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState(recordId || '');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 加载录制列表
  useEffect(() => {
    const loadRecordings = () => {
      const list = taskRecorder.listRecordings();
      setRecordings(list);
    };
    
    loadRecordings();
  }, []);

  // 加载选中的录制
  useEffect(() => {
    if (selectedRecordId) {
      const loadedRecord = taskRecorder.loadRecording(selectedRecordId);
      if (loadedRecord) {
        setRecord(loadedRecord);
        setCurrentStep(0);
      }
    }
  }, [selectedRecordId]);

  // 绘制当前步骤
  useEffect(() => {
    if (record && canvasRef.current) {
      drawCurrentStep();
    }
  }, [record, currentStep]);

  const drawCurrentStep = () => {
    const canvas = canvasRef.current;
    if (!canvas || !record) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 设置背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制已执行的操作
    const executedOps = record.operations.slice(0, currentStep + 1);
    
    executedOps.forEach((op, index) => {
      const progress = index / Math.max(1, executedOps.length - 1);
      const x = 50 + progress * (canvas.width - 100);
      const y = canvas.height / 2;

      // 根据操作类型选择颜色
      let color = '#6b7280';
      switch (op.type) {
        case 'click':
          color = '#3b82f6';
          break;
        case 'type':
          color = '#10b981';
          break;
        case 'navigate':
          color = '#8b5cf6';
          break;
        case 'scroll':
          color = '#f59e0b';
          break;
        default:
          color = '#6b7280';
      }

      // 绘制操作点
      ctx.beginPath();
      ctx.arc(x, y, index === currentStep ? 8 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // 绘制连接线
      if (index > 0) {
        const prevX = 50 + (index - 1) / Math.max(1, executedOps.length - 1) * (canvas.width - 100);
        ctx.beginPath();
        ctx.moveTo(prevX, y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 绘制操作类型标签
      if (index === currentStep) {
        ctx.fillStyle = '#374151';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(op.type, x, y - 15);
      }
    });

    // 绘制进度信息
    ctx.fillStyle = '#374151';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`步骤: ${currentStep + 1} / ${record.operations.length}`, 10, 20);
    
    if (record.operations[currentStep]) {
      const currentOp = record.operations[currentStep];
      ctx.fillText(`操作: ${currentOp.type}`, 10, 40);
      if (currentOp.target?.text) {
        ctx.fillText(`内容: ${currentOp.target.text}`, 10, 60);
      }
    }
  };

  const playRecording = () => {
    if (!record || isPlaying) return;

    setIsPlaying(true);
    
    playbackIntervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= record.operations.length - 1) {
          setIsPlaying(false);
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
          }
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);
  };

  const pauseRecording = () => {
    setIsPlaying(false);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  const resetRecording = () => {
    pauseRecording();
    setCurrentStep(0);
  };

  const stepForward = () => {
    if (record && currentStep < record.operations.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const stepBackward = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          任务回放
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* 录制选择 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          选择录制
        </label>
        <select
          value={selectedRecordId}
          onChange={(e) => setSelectedRecordId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">请选择录制文件</option>
          {recordings.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      {record && (
        <>
          {/* 录制信息 */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              {record.taskName}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>实例ID: {record.instanceId}</div>
              <div>开始时间: {record.startTime.toLocaleString()}</div>
              <div>操作数量: {record.operations.length}</div>
              {record.endTime && (
                <div>
                  持续时间: {Math.round((record.endTime.getTime() - record.startTime.getTime()) / 1000)}秒
                </div>
              )}
            </div>
          </div>

          {/* 回放画布 */}
          <div className="mb-6">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>

          {/* 控制面板 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={stepBackward}
                disabled={currentStep === 0}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
              >
                ⏮
              </button>
              
              {isPlaying ? (
                <button
                  onClick={pauseRecording}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  ⏸ 暂停
                </button>
              ) : (
                <button
                  onClick={playRecording}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  ▶ 播放
                </button>
              )}
              
              <button
                onClick={stepForward}
                disabled={!record || currentStep >= record.operations.length - 1}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
              >
                ⏭
              </button>
              
              <button
                onClick={resetRecording}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                ⏹ 重置
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">速度:</label>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </div>
          </div>

          {/* 操作详情 */}
          <div className="max-h-40 overflow-y-auto">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">操作详情</h4>
            <div className="space-y-2">
              {record.operations.map((op, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm ${
                    index === currentStep
                      ? 'bg-blue-100 dark:bg-blue-900/20 border-l-4 border-blue-500'
                      : index < currentStep
                      ? 'bg-green-50 dark:bg-green-900/10'
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{index + 1}. {op.type}</span>
                    <span className="text-xs text-gray-500">
                      {op.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {op.target?.text && (
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      内容: {op.target.text}
                    </div>
                  )}
                  {op.target?.selector && (
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      选择器: {op.target.selector}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
