'use client';

import { useEffect, useRef } from 'react';
import { OperationEvent } from '@/types';

interface OperationCanvasProps {
  operations: OperationEvent[];
  selectedInstance: string | null;
}

export default function OperationCanvas({ operations, selectedInstance }: OperationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const filteredOperations = selectedInstance 
    ? operations.filter(op => op.instanceId === selectedInstance)
    : operations;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 设置画布样式
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制操作流
    const recentOps = filteredOperations.slice(-20); // 只显示最近20个操作
    
    recentOps.forEach((op, index) => {
      const x = 20 + (index * 15);
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
        case 'extract':
          color = '#f59e0b';
          break;
        case 'observe':
          color = '#ef4444';
          break;
      }

      // 绘制操作点
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // 绘制连接线
      if (index > 0) {
        ctx.beginPath();
        ctx.moveTo(x - 15, y);
        ctx.lineTo(x - 4, y);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 绘制操作类型标签
      ctx.fillStyle = '#374151';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(op.type, x, y + 20);
    });

    // 绘制图例
    const legend = [
      { type: 'click', color: '#3b82f6', label: '点击' },
      { type: 'type', color: '#10b981', label: '输入' },
      { type: 'navigate', color: '#8b5cf6', label: '导航' },
      { type: 'extract', color: '#f59e0b', label: '提取' },
      { type: 'observe', color: '#ef4444', label: '观察' }
    ];

    legend.forEach((item, index) => {
      const x = 20;
      const y = 20 + (index * 20);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = item.color;
      ctx.fill();

      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, x + 10, y + 4);
    });

  }, [filteredOperations]);

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="operation-canvas w-full"
      />
      
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>总操作数: {filteredOperations.length}</span>
          <span>显示最近: {Math.min(20, filteredOperations.length)}</span>
        </div>
        
        {filteredOperations.length > 0 && (
          <div className="mt-2">
            <div className="text-xs">
              最新操作: {filteredOperations[filteredOperations.length - 1]?.type} 
              ({new Date(filteredOperations[filteredOperations.length - 1]?.timestamp).toLocaleTimeString()})
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
