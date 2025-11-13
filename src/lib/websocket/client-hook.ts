'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketMessage, OperationEvent, ElectronInstance } from '@/types';

interface UseWebSocketOptions {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketState {
  isConnected: boolean;
  instances: ElectronInstance[];
  operations: OperationEvent[];
  error: string | null;
}

export function useStagehandWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = 'ws://localhost:8080',
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    instances: [],
    operations: [],
    error: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 连接 WebSocket
  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        reconnectAttemptsRef.current = 0;
        
        // 请求当前实例列表
        ws.send(JSON.stringify({ type: 'get_instances' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setState(prev => ({ ...prev, isConnected: false }));
        wsRef.current = null;
        
        // 尝试重连
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          setState(prev => ({ 
            ...prev, 
            error: 'Failed to connect after maximum attempts' 
          }));
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'WebSocket connection error' 
        }));
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to create WebSocket connection' 
      }));
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  // 处理 WebSocket 消息
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'status':
        if (message.data.instances) {
          setState(prev => ({ 
            ...prev, 
            instances: message.data.instances 
          }));
        }
        break;

      case 'operation':
        if (message.data && message.instanceId) {
          setState(prev => ({
            ...prev,
            operations: [
              ...prev.operations.slice(-99), // 保留最近100个操作
              {
                ...message.data,
                instanceId: message.instanceId,
                timestamp: new Date(message.timestamp)
              }
            ]
          }));
        }
        break;

      case 'error':
        setState(prev => ({ 
          ...prev, 
          error: message.data.error 
        }));
        break;
    }
  }, []);

  // 发送消息
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket is not connected');
    }
  }, []);

  // 请求实例状态
  const requestInstanceStatus = useCallback((instanceId: string) => {
    sendMessage({ type: 'get_instance_status', instanceId });
  }, [sendMessage]);

  // 清除错误
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 手动重连
  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // 初始化连接
  useEffect(() => {
    connect();

    // 清理函数
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    ...state,
    sendMessage,
    requestInstanceStatus,
    clearError,
    reconnect
  };
}
