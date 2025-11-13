'use client';

import { useEffect, useRef, useState } from 'react';
import { OperationEvent } from '@/types';

interface OperationCanvasProps {
  operations: OperationEvent[];
  selectedInstance: string | null;
  backgroundImage?: string; // 截图背景
  showTrajectory?: boolean; // 是否显示操作轨迹
}

export default function OperationCanvas({ 
  operations, 
  selectedInstance, 
  backgroundImage,
  showTrajectory = true 
}: OperationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  const filteredOperations = selectedInstance 
    ? operations.filter(op => op.instanceId === selectedInstance)
    : operations;

  // 加载背景图片
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        setImageLoaded(true);
      };
      img.onerror = () => {
        console.warn('Failed to load background image');
        setImageLoaded(false);
      };
      img.src = backgroundImage;
    } else {
      backgroundImageRef.current = null;
      setImageLoaded(false);
    }
  }, [backgroundImage]);

  // 绘制点击标记
  const drawClickMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, isLatest: boolean = false) => {
    // 绘制红色圆点
    ctx.beginPath();
    ctx.arc(x, y, isLatest ? 8 : 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    
    // 绘制白色边框
    ctx.beginPath();
    ctx.arc(x, y, isLatest ? 8 : 6, 0, 2 * Math.PI);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    if (isLatest) {
      // 绘制脉冲效果
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // 绘制输入标记
  const drawInputMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, text?: string) => {
    // 绘制绿色边框
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 15, y - 10, 30, 20);
    
    // 绘制半透明填充
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    ctx.fillRect(x - 15, y - 10, 30, 20);
    
    // 绘制文本标签
    if (text) {
      ctx.fillStyle = '#374151';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text.substring(0, 10) + (text.length > 10 ? '...' : ''), x, y - 15);
    }
  };

  // 绘制滚动标记
  const drawScrollMarker = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // 绘制黄色箭头
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 6, y + 4);
    ctx.lineTo(x + 6, y + 4);
    ctx.closePath();
    ctx.fill();
    
    // 绘制边框
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // 绘制通用标记
  const drawGenericMarker = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#6b7280';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  // 绘制连接线
  const drawConnectionLine = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制箭头
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLength = 8;
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowLength * Math.cos(angle - Math.PI / 6),
      y2 - arrowLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowLength * Math.cos(angle + Math.PI / 6),
      y2 - arrowLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const drawOperationTrajectory = (ctx: CanvasRenderingContext2D, operations: OperationEvent[]) => {
    const recentOps = operations.slice(-10); // 显示最近10个操作
    
    // 绘制操作轨迹
    recentOps.forEach((op, index) => {
      if (op.target?.coordinates) {
        const { x, y } = op.target.coordinates;
        
        // 将坐标映射到画布尺寸
        const canvasX = (x / 1920) * ctx.canvas.width; // 假设原始分辨率为1920
        const canvasY = (y / 1080) * ctx.canvas.height; // 假设原始分辨率为1080
        
        // 根据操作类型绘制不同的标注
        switch (op.type) {
          case 'click':
            drawClickMarker(ctx, canvasX, canvasY, index === recentOps.length - 1);
            break;
          case 'type':
            drawInputMarker(ctx, canvasX, canvasY, op.target.text);
            break;
          case 'scroll':
            drawScrollMarker(ctx, canvasX, canvasY);
            break;
          default:
            drawGenericMarker(ctx, canvasX, canvasY);
        }
        
        // 绘制连接线
        if (index > 0 && recentOps[index - 1].target?.coordinates) {
          const prevCoords = recentOps[index - 1].target?.coordinates;
          if (prevCoords) {
            const prevX = (prevCoords.x / 1920) * ctx.canvas.width;
            const prevY = (prevCoords.y / 1080) * ctx.canvas.height;
            
            drawConnectionLine(ctx, prevX, prevY, canvasX, canvasY);
          }
        }
      }
    });
  };

  const drawOperationFlow = (ctx: CanvasRenderingContext2D, operations: OperationEvent[]) => {
    const recentOps = operations.slice(-20); // 只显示最近20个操作
    
    recentOps.forEach((op, index) => {
      const x = 20 + (index * 15);
      const y = ctx.canvas.height / 2;

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
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制背景
    if (backgroundImageRef.current && imageLoaded) {
      // 绘制截图背景
      ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);
      
      // 添加半透明遮罩以便操作标注更清晰
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // 默认背景
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // 绘制网格
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }
    }

    if (showTrajectory) {
      drawOperationTrajectory(ctx, filteredOperations);
    } else {
      drawOperationFlow(ctx, filteredOperations);
    }
  }, [filteredOperations, imageLoaded, showTrajectory]);

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
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